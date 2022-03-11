package store

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/keegancsmith/sqlf"
	"github.com/opentracing/opentracing-go/log"

	"github.com/sourcegraph/sourcegraph/internal/database/basestore"
	"github.com/sourcegraph/sourcegraph/internal/database/dbutil"
	"github.com/sourcegraph/sourcegraph/internal/database/locker"
	"github.com/sourcegraph/sourcegraph/internal/database/migration/definition"
	"github.com/sourcegraph/sourcegraph/internal/database/migration/storetypes"
	"github.com/sourcegraph/sourcegraph/internal/observation"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

type Store struct {
	*basestore.Store
	schemaName string
	operations *Operations
}

func NewWithDB(db dbutil.DB, migrationsTable string, operations *Operations) *Store {
	return &Store{
		Store:      basestore.NewWithDB(db, sql.TxOptions{}),
		schemaName: migrationsTable,
		operations: operations,
	}
}

func (s *Store) With(other basestore.ShareableStore) *Store {
	return &Store{
		Store:      s.Store.With(other),
		schemaName: s.schemaName,
		operations: s.operations,
	}
}

func (s *Store) Transact(ctx context.Context) (*Store, error) {
	txBase, err := s.Store.Transact(ctx)
	if err != nil {
		return nil, err
	}

	return &Store{
		Store:      txBase,
		schemaName: s.schemaName,
		operations: s.operations,
	}, nil
}

const currentMigrationLogSchemaVersion = 2

// EnsureSchemaTable creates the bookeeping tables required to track this schema
// if they do not already exist. If old versions of the tables exist, this method
// will attempt to update them in a backward-compatible manner.
func (s *Store) EnsureSchemaTable(ctx context.Context) (err error) {
	ctx, endObservation := s.operations.ensureSchemaTable.With(ctx, &err, observation.Args{})
	defer endObservation(1, observation.Args{})

	queries := []*sqlf.Query{
		sqlf.Sprintf(`CREATE TABLE IF NOT EXISTS migration_logs(id SERIAL PRIMARY KEY)`),
		sqlf.Sprintf(`ALTER TABLE migration_logs ADD COLUMN IF NOT EXISTS migration_logs_schema_version integer NOT NULL`),
		sqlf.Sprintf(`ALTER TABLE migration_logs ADD COLUMN IF NOT EXISTS schema text NOT NULL`),
		sqlf.Sprintf(`ALTER TABLE migration_logs ADD COLUMN IF NOT EXISTS version integer NOT NULL`),
		sqlf.Sprintf(`ALTER TABLE migration_logs ADD COLUMN IF NOT EXISTS up bool NOT NULL`),
		sqlf.Sprintf(`ALTER TABLE migration_logs ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL`),
		sqlf.Sprintf(`ALTER TABLE migration_logs ADD COLUMN IF NOT EXISTS finished_at timestamptz`),
		sqlf.Sprintf(`ALTER TABLE migration_logs ADD COLUMN IF NOT EXISTS success boolean`),
		sqlf.Sprintf(`ALTER TABLE migration_logs ADD COLUMN IF NOT EXISTS error_message text`),
	}

	tx, err := s.Transact(ctx)
	if err != nil {
		return err
	}
	defer func() { err = tx.Done(err) }()

	for _, query := range queries {
		if err := tx.Exec(ctx, query); err != nil {
			return err
		}
	}

	return nil
}

// Versions returns three sets of migration versions that, together, describe the current schema
// state. These states describe, respectively, the identifieers of all applied, pending, and failed
// migrations.
//
// A failed migration requires administrator attention. A pending migration may currently be
// in-progress, or may indicate that a migration was attempted but failed part way through.
func (s *Store) Versions(ctx context.Context) (appliedVersions, pendingVersions, failedVersions []int, err error) {
	ctx, endObservation := s.operations.versions.With(ctx, &err, observation.Args{})
	defer endObservation(1, observation.Args{})

	migrationLogs, err := scanMigrationLogs(s.Query(ctx, sqlf.Sprintf(versionsQuery, s.schemaName)))
	if err != nil {
		return nil, nil, nil, err
	}

	for _, migrationLog := range migrationLogs {
		if migrationLog.Success == nil {
			pendingVersions = append(pendingVersions, migrationLog.Version)
			continue
		}
		if !*migrationLog.Success {
			failedVersions = append(failedVersions, migrationLog.Version)
			continue
		}
		if migrationLog.Up {
			appliedVersions = append(appliedVersions, migrationLog.Version)
		}
	}

	return appliedVersions, pendingVersions, failedVersions, nil
}

const versionsQuery = `
-- source: internal/database/migration/store/store.go:Versions
WITH ranked_migration_logs AS (
	SELECT
		migration_logs.*,
		ROW_NUMBER() OVER (PARTITION BY version ORDER BY started_at DESC) AS row_number
	FROM migration_logs
	WHERE schema = %s
)
SELECT
	schema,
	version,
	up,
	success
FROM ranked_migration_logs
WHERE row_number = 1
ORDER BY version
`

// TryLock attempts to create hold an advisory lock. This method returns a function that should be
// called once the lock should be released. This method accepts the current function's error output
// and wraps any additional errors that occur on close. Calling this method when the lock was not
// acquired will return the given error without modification (no-op). If this method returns true,
// the lock was acquired and false if the lock is currently held by another process.
//
// Note that we don't use the internal/database/locker package here as that uses transactionally
// scoped advisory locks. We want to be able to hold locks outside of transactions for migrations.
func (s *Store) TryLock(ctx context.Context) (_ bool, _ func(err error) error, err error) {
	key := s.lockKey()

	ctx, endObservation := s.operations.tryLock.With(ctx, &err, observation.Args{LogFields: []log.Field{
		log.Int32("key", key),
	}})
	defer endObservation(1, observation.Args{})

	locked, _, err := basestore.ScanFirstBool(s.Query(ctx, sqlf.Sprintf(`SELECT pg_try_advisory_lock(%s, %s)`, key, 0)))
	if err != nil {
		return false, nil, err
	}

	close := func(err error) error {
		if locked {
			if unlockErr := s.Exec(ctx, sqlf.Sprintf(`SELECT pg_advisory_unlock(%s, %s)`, key, 0)); unlockErr != nil {
				err = errors.Append(err, unlockErr)
			}

			// No-op if called more than once
			locked = false
		}

		return err
	}

	return locked, close, nil
}

func (s *Store) lockKey() int32 {
	return locker.StringKey(fmt.Sprintf("%s:migrations", s.schemaName))
}

// Up runs the given definition's up query.
func (s *Store) Up(ctx context.Context, definition definition.Definition) (err error) {
	ctx, endObservation := s.operations.up.With(ctx, &err, observation.Args{})
	defer endObservation(1, observation.Args{})

	return s.Exec(ctx, definition.UpQuery)
}

// Down runs the given definition's down query.
func (s *Store) Down(ctx context.Context, definition definition.Definition) (err error) {
	ctx, endObservation := s.operations.down.With(ctx, &err, observation.Args{})
	defer endObservation(1, observation.Args{})

	return s.Exec(ctx, definition.DownQuery)
}

// IndexStatus returns an object describing the current validity status and creation progress of the
// index with the given name. If the index does not exist, a false-valued flag is returned.
func (s *Store) IndexStatus(ctx context.Context, tableName, indexName string) (_ storetypes.IndexStatus, _ bool, err error) {
	ctx, endObservation := s.operations.indexStatus.With(ctx, &err, observation.Args{})
	defer endObservation(1, observation.Args{})

	return scanFirstIndexStatus(s.Query(ctx, sqlf.Sprintf(indexStatusQuery, tableName, indexName)))
}

const indexStatusQuery = `
-- source: internal/database/migration/store/store.go:IndexStatus
SELECT
	pi.indisvalid,
	pi.indisready,
	pi.indislive,
	p.phase,
	p.lockers_total,
	p.lockers_done,
	p.blocks_total,
	p.blocks_done,
	p.tuples_total,
	p.tuples_done
FROM pg_catalog.pg_stat_all_indexes ai
JOIN pg_catalog.pg_index pi ON pi.indexrelid = ai.indexrelid
LEFT JOIN pg_catalog.pg_stat_progress_create_index p ON p.relid = ai.relid AND p.index_relid = ai.indexrelid
WHERE
	ai.relname = %s AND
	ai.indexrelname = %s
`

// WithMigrationLog runs the given function while writing its progress to a migration log associated
// with the given definition. All users are assumed to run either `s.Up` or `s.Down` as part of the
// given function, among any other behaviors that are necessary to perform in the _critical section_.
func (s *Store) WithMigrationLog(ctx context.Context, definition definition.Definition, up bool, f func() error) (err error) {
	ctx, endObservation := s.operations.withMigrationLog.With(ctx, &err, observation.Args{})
	defer endObservation(1, observation.Args{})

	logID, err := s.createMigrationLog(ctx, definition.ID, up)
	if err != nil {
		return err
	}

	defer func() {
		if execErr := s.Exec(ctx, sqlf.Sprintf(
			`UPDATE migration_logs SET finished_at = NOW(), success = %s, error_message = %s WHERE id = %d`,
			err == nil,
			errMsgPtr(err),
			logID,
		)); execErr != nil {
			err = errors.Append(err, execErr)
		}
	}()

	if err := f(); err != nil {
		return err
	}

	return nil
}

func (s *Store) createMigrationLog(ctx context.Context, definitionVersion int, up bool) (_ int, err error) {
	tx, err := s.Transact(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { err = tx.Done(err) }()

	id, _, err := basestore.ScanFirstInt(tx.Query(ctx, sqlf.Sprintf(
		`
			INSERT INTO migration_logs (
				migration_logs_schema_version,
				schema,
				version,
				up,
				started_at
			) VALUES (%s, %s, %s, %s, NOW())
			RETURNING id
		`,
		currentMigrationLogSchemaVersion,
		s.schemaName,
		definitionVersion,
		up,
	)))
	if err != nil {
		return 0, err
	}

	return id, nil
}

func errMsgPtr(err error) *string {
	if err == nil {
		return nil
	}

	text := err.Error()
	return &text
}

type migrationLog struct {
	Schema  string
	Version int
	Up      bool
	Success *bool
}

// scanMigrationLogs scans a slice of migration logs from the return value of `*Store.query`.
func scanMigrationLogs(rows *sql.Rows, queryErr error) (_ []migrationLog, err error) {
	if queryErr != nil {
		return nil, queryErr
	}
	defer func() { err = basestore.CloseRows(rows, err) }()

	var logs []migrationLog
	for rows.Next() {
		var log migrationLog

		if err := rows.Scan(
			&log.Schema,
			&log.Version,
			&log.Up,
			&log.Success,
		); err != nil {
			return nil, err
		}

		logs = append(logs, log)
	}

	return logs, nil
}

// scanFirstIndexStatus scans a slice of index status objects from the return value of `*Store.query`.
func scanFirstIndexStatus(rows *sql.Rows, queryErr error) (status storetypes.IndexStatus, _ bool, err error) {
	if queryErr != nil {
		return storetypes.IndexStatus{}, false, queryErr
	}
	defer func() { err = basestore.CloseRows(rows, err) }()

	if rows.Next() {
		if err := rows.Scan(
			&status.IsValid,
			&status.IsReady,
			&status.IsLive,
			&status.Phase,
			&status.LockersDone,
			&status.LockersTotal,
			&status.BlocksDone,
			&status.BlocksTotal,
			&status.TuplesDone,
			&status.TuplesTotal,
		); err != nil {
			return storetypes.IndexStatus{}, false, err
		}

		return status, true, nil
	}

	return storetypes.IndexStatus{}, false, nil
}

//
// Playground

type Schema struct {
	Extensions []string   `json:"extensions"`
	Enums      []Enum     `json:"enums"`
	Functions  []Function `json:"functions"`
	Sequences  []Sequence `json:"sequences"`
	Tables     []Table    `json:"tables"`
	Views      []View     `json:"views"`
}

func (s Schema) String() string {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetIndent("", "    ")
	_ = enc.Encode(s)
	return buf.String()
}

type Enum struct {
	Name   string   `json:"name"`
	Labels []string `json:"labels"`
}

type Function struct {
	Name       string `json:"name"`
	Definition string `json:"definition"`
}

type Sequence struct {
	Name         string `json:"name"`
	TypeName     string `json:"typeName"`
	StartValue   int    `json:"startValue"`
	MinimumValue int    `json:"minimumValue"`
	MaximumValue int    `json:"maximumValue"`
	Increment    int    `json:"increment"`
	CycleOption  string `json:"cycleOption"`
}

type Table struct {
	Name     string    `json:"name"`
	Columns  []Column  `json:"columns"`
	Indexes  []Index   `json:"indexes"`
	Triggers []Trigger `json:"triggers"`
}

type Column struct {
	Name                   string `json:"name"`
	TypeName               string `json:"typeName"`
	IsNullable             bool   `json:"isNullable"`
	Default                string `json:"default"`
	CharacterMaximumLength int    `json:"characterMaximumLength"`
	IsIdentity             bool   `json:"isIdentity"`
	IdentityGeneration     string `json:"identityGeneration"`
}

type Index struct {
	Name            string `json:"name"`
	IsPrimaryKey    bool   `json:"isPrimaryKey"`
	IsUnique        bool   `json:"isUnique"`
	IndexDefinition string `json:"indexDefinition"`
}

type Trigger struct {
	Name       string `json:"name"`
	Definition string `json:"definition"`
}

type View struct {
	Name       string `json:"name"`
	Definition string `json:"definition"`
}

func (s *Store) Describe(ctx context.Context) (_ map[string]Schema, err error) {
	ctx, endObservation := s.operations.describe.With(ctx, &err, observation.Args{})
	defer endObservation(1, observation.Args{})

	schemas := map[string]Schema{}
	updateSchema := func(schemaName string, f func(schema *Schema)) {
		if _, ok := schemas[schemaName]; !ok {
			schemas[schemaName] = Schema{}
		}

		ptr := schemas[schemaName]
		f(&ptr)
		schemas[schemaName] = ptr
	}

	//
	// Extensions

	extensions, err := s.listExtensions(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "store.listExtensions")
	}
	for _, extension := range extensions {
		updateSchema(extension.SchemaName, func(schema *Schema) {
			schema.Extensions = append(schema.Extensions, extension.ExtensionName)
		})
	}

	//
	// Enums

	enums, err := s.listEnums(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "store.listEnums")
	}
	for _, enum := range enums {
		updateSchema(enum.SchemaName, func(schema *Schema) {
			for i, e := range schema.Enums {
				if e.Name == enum.TypeName {
					schema.Enums[i].Labels = append(schema.Enums[i].Labels, enum.Label)
					break
				}
			}

			schema.Enums = append(schema.Enums, Enum{Name: enum.TypeName, Labels: []string{enum.Label}})
		})
	}

	//
	// Functions

	functions, err := s.listFunctions(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "store.listFunctions")
	}
	for _, function := range functions {
		updateSchema(function.SchemaName, func(schema *Schema) {
			schema.Functions = append(schema.Functions, Function{
				Name:       function.FunctionName,
				Definition: function.Definition,
			})
		})
	}

	//
	// Sequences

	sequences, err := s.listSequences(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "store.listSequences")
	}
	for _, sequence := range sequences {
		updateSchema(sequence.SchemaName, func(schema *Schema) {
			schema.Sequences = append(schema.Sequences, Sequence{
				Name:         sequence.SequenceName,
				TypeName:     sequence.DataType,
				StartValue:   sequence.StartValue,
				MinimumValue: sequence.MinimumValue,
				MaximumValue: sequence.MaximumValue,
				Increment:    sequence.Increment,
				CycleOption:  sequence.CycleOption,
			})
		})
	}

	//
	// Tables

	tableMap := map[string]map[string]Table{}
	updateTableMap := func(schemaName, tableName string, f func(table *Table)) {
		if _, ok := tableMap[schemaName]; !ok {
			tableMap[schemaName] = map[string]Table{}
		}

		if _, ok := tableMap[schemaName][tableName]; !ok {
			tableMap[schemaName][tableName] = Table{
				Columns:  []Column{},
				Indexes:  []Index{},
				Triggers: []Trigger{},
			}
		}

		ptr := tableMap[schemaName][tableName]
		f(&ptr)
		tableMap[schemaName][tableName] = ptr
	}

	tables, err := s.listTables(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "store.listTables")
	}
	for _, table := range tables {
		updateTableMap(table.SchemaName, table.TableName, func(t *Table) {
			t.Name = table.TableName
		})
	}

	columns, err := s.listColumns(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "store.listColumns")
	}
	for _, column := range columns {
		updateTableMap(column.SchemaName, column.TableName, func(table *Table) {
			table.Columns = append(table.Columns, Column{
				Name:                   column.ColumnName,
				TypeName:               column.DataType,
				IsNullable:             column.IsNullable,
				Default:                column.Default,
				CharacterMaximumLength: column.CharacterMaximumLength,
				IsIdentity:             column.IsIdentity,
				IdentityGeneration:     column.IdentityGeneration,
			})
		})
	}

	indexes, err := s.listIndexes(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "store.listIndexes")
	}
	for _, index := range indexes {
		updateTableMap(index.SchemaName, index.TableName, func(table *Table) {
			table.Indexes = append(table.Indexes, Index{
				Name:            index.IndexName,
				IsPrimaryKey:    index.IsPrimaryKey,
				IsUnique:        index.IsUnique,
				IndexDefinition: index.IndexDefinition,
			})
		})
	}

	triggers, err := s.listTriggers(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "store.listTriggers")
	}
	for _, trigger := range triggers {
		updateTableMap(trigger.SchemaName, trigger.TableName, func(table *Table) {
			table.Triggers = append(table.Triggers, Trigger{
				Name:       trigger.TriggerName,
				Definition: trigger.TriggerDefinition,
			})
		})
	}

	for schemaName, tables := range tableMap {
		for _, table := range tables {
			updateSchema(schemaName, func(schema *Schema) {
				schema.Tables = append(schema.Tables, table)
			})
		}
	}

	//
	// Views

	views, err := s.listViews(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "store.listViews")
	}
	for _, view := range views {
		updateSchema(view.SchemaName, func(schema *Schema) {
			schema.Views = append(schema.Views, View{
				Name:       view.ViewName,
				Definition: view.Definition,
			})
		})
	}

	return schemas, nil
}

//
// Extensions

type Extension struct {
	SchemaName    string
	ExtensionName string
}

func scanExtensions(rows *sql.Rows, queryErr error) (_ []Extension, err error) {
	if queryErr != nil {
		return nil, queryErr
	}
	defer func() { err = basestore.CloseRows(rows, err) }()

	var extensions []Extension
	for rows.Next() {
		var extension Extension
		if err := rows.Scan(&extension.SchemaName, &extension.ExtensionName); err != nil {
			return nil, err
		}

		extensions = append(extensions, extension)
	}

	return extensions, nil
}

func (s *Store) listExtensions(ctx context.Context) ([]Extension, error) {
	return scanExtensions(s.Query(ctx, sqlf.Sprintf(listExtensionsQuery)))
}

const listExtensionsQuery = `
-- source: internal/database/migration/store/store.go:listExtensions
SELECT
	n.nspname AS schemaName,
	e.extname AS extensionName
FROM pg_catalog.pg_extension e
JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
WHERE
	n.nspname NOT LIKE 'pg_%%' AND
	n.nspname != 'information_schema'
ORDER BY
	n.nspname,
	e.extname
`

//
// Enums

type enum struct {
	SchemaName string
	TypeName   string
	Label      string
}

func scanEnums(rows *sql.Rows, queryErr error) (_ []enum, err error) {
	if queryErr != nil {
		return nil, queryErr
	}
	defer func() { err = basestore.CloseRows(rows, err) }()

	var enums []enum
	for rows.Next() {
		var enum enum

		if err := rows.Scan(
			&enum.SchemaName,
			&enum.TypeName,
			&enum.Label,
		); err != nil {
			return nil, err
		}

		enums = append(enums, enum)
	}

	return enums, nil
}

func (s *Store) listEnums(ctx context.Context) ([]enum, error) {
	return scanEnums(s.Query(ctx, sqlf.Sprintf(listEnumQuery)))
}

const listEnumQuery = `
-- source: internal/database/migration/store/store.go:listEnums
SELECT
	n.nspname AS schemaName,
	t.typname AS typeName,
	e.enumlabel AS label
FROM pg_catalog.pg_enum e
JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE
	n.nspname NOT LIKE 'pg_%%' AND
	n.nspname != 'information_schema'
ORDER BY
	n.nspname,
	t.typname,
	e.enumsortorder
`

//
// Functions

type function struct {
	SchemaName   string
	FunctionName string
	Fancy        string
	ReturnType   string
	Definition   string
}

func scanFunctions(rows *sql.Rows, queryErr error) (_ []function, err error) {
	if queryErr != nil {
		return nil, queryErr
	}
	defer func() { err = basestore.CloseRows(rows, err) }()

	var functions []function
	for rows.Next() {
		var function function

		if err := rows.Scan(
			&function.SchemaName,
			&function.FunctionName,
			&function.Fancy,
			&function.ReturnType,
			&function.Definition,
		); err != nil {
			return nil, err
		}

		functions = append(functions, function)
	}

	return functions, nil
}

func (s *Store) listFunctions(ctx context.Context) ([]function, error) {
	return scanFunctions(s.Query(ctx, sqlf.Sprintf(listFunctionsQuery)))
}

const listFunctionsQuery = `
-- source: internal/database/migration/store/store.go:listFunctions
SELECT
	n.nspname AS schemaName,
	p.proname AS functionName,
	p.oid::regprocedure AS fancy,
	t.typname AS returnType,
	pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_type t ON t.oid = p.prorettype
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON (
	l.oid = p.prolang AND l.lanname IN ('sql', 'plpgsql', 'c')
)
WHERE
	n.nspname NOT LIKE 'pg_%%' AND
	n.nspname != 'information_schema'
ORDER BY
	n.nspname,
	p.proname
`

//
// Sequences

type sequence struct {
	SchemaName   string
	SequenceName string
	DataType     string
	StartValue   int
	MinimumValue int
	MaximumValue int
	Increment    int
	CycleOption  string
}

func scanSequences(rows *sql.Rows, queryErr error) (_ []sequence, err error) {
	if queryErr != nil {
		return nil, queryErr
	}
	defer func() { err = basestore.CloseRows(rows, err) }()

	var sequences []sequence
	for rows.Next() {
		var sequence sequence

		if err := rows.Scan(
			&sequence.SchemaName,
			&sequence.SequenceName,
			&sequence.DataType,
			&sequence.StartValue,
			&sequence.MinimumValue,
			&sequence.MaximumValue,
			&sequence.Increment,
			&sequence.CycleOption,
		); err != nil {
			return nil, err
		}

		sequences = append(sequences, sequence)
	}

	return sequences, nil
}

func (s *Store) listSequences(ctx context.Context) ([]sequence, error) {
	return scanSequences(s.Query(ctx, sqlf.Sprintf(listSequencesQuery)))
}

const listSequencesQuery = `
-- source: internal/database/migration/store/store.go:listSequences
SELECT
	s.sequence_schema AS schemaName,
	s.sequence_name AS sequenceName,
	s.data_type AS dataType,
	s.start_value AS startValue,
	s.minimum_value AS minimumValue,
	s.maximum_value AS maximumValue,
	s.increment AS increment,
	s.cycle_option AS cycleOption
FROM information_schema.sequences s
WHERE
	s.sequence_schema NOT LIKE 'pg_%%' AND
	s.sequence_schema != 'information_schema'
ORDER BY
	s.sequence_schema,
	s.sequence_name
`

//
// Tables

type table struct {
	SchemaName string
	TableName  string
}

func scanTables(rows *sql.Rows, queryErr error) (_ []table, err error) {
	if queryErr != nil {
		return nil, queryErr
	}
	defer func() { err = basestore.CloseRows(rows, err) }()

	var tables []table
	for rows.Next() {
		var table table
		if err := rows.Scan(&table.SchemaName, &table.TableName); err != nil {
			return nil, err
		}

		tables = append(tables, table)
	}

	return tables, nil
}

func (s *Store) listTables(ctx context.Context) ([]table, error) {
	return scanTables(s.Query(ctx, sqlf.Sprintf(listTablesQuery)))
}

const listTablesQuery = `
-- source: internal/database/migration/store/store.go:listTables
SELECT
	t.table_schema AS schemaName,
	t.table_name AS tableName
FROM information_schema.tables t
WHERE
	t.table_type = 'BASE TABLE' AND
	t.table_schema NOT LIKE 'pg_%%' AND
	t.table_schema != 'information_schema'
ORDER BY
	t.table_schema,
	t.table_name
`

type column struct {
	SchemaName             string
	TableName              string
	ColumnName             string
	DataType               string
	IsNullable             bool
	Default                string
	CharacterMaximumLength int
	IsIdentity             bool
	IdentityGeneration     string
}

func scanColumns(rows *sql.Rows, queryErr error) (_ []column, err error) {
	if queryErr != nil {
		return nil, queryErr
	}
	defer func() { err = basestore.CloseRows(rows, err) }()

	var columns []column
	for rows.Next() {
		var (
			column     column
			isNullable string
			isIdentity string
		)

		if err := rows.Scan(
			&column.SchemaName,
			&column.TableName,
			&column.ColumnName,
			&column.DataType,
			&isNullable,
			&dbutil.NullString{S: &column.Default},
			&dbutil.NullInt{N: &column.CharacterMaximumLength},
			&isIdentity,
			&dbutil.NullString{S: &column.IdentityGeneration},
		); err != nil {
			return nil, err
		}

		// :(
		column.IsNullable = isNullable == "YES"
		column.IsIdentity = isIdentity == "YES"

		columns = append(columns, column)
	}

	return columns, nil
}

func (s *Store) listColumns(ctx context.Context) ([]column, error) {
	return scanColumns(s.Query(ctx, sqlf.Sprintf(listColumnsQuery)))
}

const listColumnsQuery = `
-- source: internal/database/migration/store/store.go:listColumns
WITH tables AS (
	SELECT
		t.table_schema,
		t.table_name
	FROM information_schema.tables t
	WHERE
		t.table_type = 'BASE TABLE' AND
		t.table_schema NOT LIKE 'pg_%%' AND
		t.table_schema != 'information_schema'
)
SELECT
	c.table_schema AS schemaName,
	c.table_name AS tableName,
	c.column_name AS columnName,
	c.data_type AS dataTyype,
	c.is_nullable AS isNullable,
	c.column_default AS columnDefault,
	c.character_maximum_length AS characterMaximumLength,
	c.is_identity AS isIdentity,
	c.identity_generation AS identityGeneration
FROM information_schema.columns c
WHERE (c.table_schema, c.table_name) IN (SELECT table_schema, table_name FROM tables)
ORDER BY
	c.table_schema,
	c.table_name,
	c.column_name
`

type index struct {
	SchemaName           string
	TableName            string
	IndexName            string
	IsPrimaryKey         bool
	IsUnique             bool
	IndexDefinition      string
	ConstraintDefinition string
	ConstraintType       string
}

func scanIndexes(rows *sql.Rows, queryErr error) (_ []index, err error) {
	if queryErr != nil {
		return nil, queryErr
	}
	defer func() { err = basestore.CloseRows(rows, err) }()

	var indexes []index
	for rows.Next() {
		var (
			index        index
			isPrimaryKey string
			isUnique     string
		)

		if err := rows.Scan(
			&index.SchemaName,
			&index.TableName,
			&index.IndexName,
			&isPrimaryKey,
			&isUnique,
			&index.IndexDefinition,
			&dbutil.NullString{S: &index.ConstraintDefinition},
			&dbutil.NullString{S: &index.ConstraintType},
		); err != nil {
			return nil, err
		}

		// :(
		index.IsPrimaryKey = isPrimaryKey == "YES"
		index.IsUnique = isUnique == "YES"

		indexes = append(indexes, index)
	}

	return indexes, nil
}

func (s *Store) listIndexes(ctx context.Context) ([]index, error) {
	return scanIndexes(s.Query(ctx, sqlf.Sprintf(listIndexesQuery)))
}

const listIndexesQuery = `
-- source: internal/database/migration/store/store.go:listIndexes
SELECT
	n.nspname AS schemaName,
	table_class.relname AS tableName,
	index_class.relname AS indexName,
	i.indisprimary AS isPrimaryKey,
	i.indisunique AS isUnique,
	pg_catalog.pg_get_indexdef(i.indexrelid, 0, true) as indexDefinition,
	pg_catalog.pg_get_constraintdef(con.oid, true) as constraintDefinition,
	con.contype AS constraintType
FROM pg_catalog.pg_index i
JOIN pg_catalog.pg_class table_class ON table_class.oid = i.indrelid
JOIN pg_catalog.pg_class index_class ON index_class.oid = i.indexrelid
JOIN pg_catalog.pg_namespace n ON n.oid = table_class.relnamespace
LEFT OUTER JOIN pg_catalog.pg_constraint con ON (
	con.conrelid = i.indrelid AND
	con.conindid = i.indexrelid AND
	con.contype IN ('p', 'u', 'x')
)
WHERE
	n.nspname NOT LIKE 'pg_%%' AND
	n.nspname != 'information_schema'
ORDER BY
	n.nspname,
	table_class.relname,
	index_class.relname
`

type trigger struct {
	SchemaName        string
	TableName         string
	TriggerName       string
	TriggerDefinition string
}

func scanTriggers(rows *sql.Rows, queryErr error) (_ []trigger, err error) {
	if queryErr != nil {
		return nil, queryErr
	}
	defer func() { err = basestore.CloseRows(rows, err) }()

	var triggers []trigger
	for rows.Next() {
		var trigger trigger

		if err := rows.Scan(
			&trigger.SchemaName,
			&trigger.TableName,
			&trigger.TriggerName,
			&trigger.TriggerDefinition,
		); err != nil {
			return nil, err
		}

		triggers = append(triggers, trigger)
	}

	return triggers, nil
}

func (s *Store) listTriggers(ctx context.Context) ([]trigger, error) {
	return scanTriggers(s.Query(ctx, sqlf.Sprintf(listTriggersQuery)))
}

const listTriggersQuery = `
-- source: internal/database/migration/store/store.go:listTriggers
SELECT
	n.nspname AS schemaName,
	c.relname AS tableName,
	t.tgname AS triggerName,
	pg_catalog.pg_get_triggerdef(t.oid, true) AS triggerDefinition
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE
	n.nspname NOT LIKE 'pg_%%' AND
	n.nspname != 'information_schema' AND
	NOT t.tgisinternal
ORDER BY
	n.nspname,
	c.relname,
	t.tgname
`

//
// Views

type view struct {
	SchemaName string
	ViewName   string
	Definition string
}

func scanViews(rows *sql.Rows, queryErr error) (_ []view, err error) {
	if queryErr != nil {
		return nil, queryErr
	}
	defer func() { err = basestore.CloseRows(rows, err) }()

	var views []view
	for rows.Next() {
		var view view

		if err := rows.Scan(
			&view.SchemaName,
			&view.ViewName,
			&view.Definition,
		); err != nil {
			return nil, err
		}

		views = append(views, view)
	}

	return views, nil
}

func (s *Store) listViews(ctx context.Context) ([]view, error) {
	return scanViews(s.Query(ctx, sqlf.Sprintf(listViewsQuery)))
}

const listViewsQuery = `
-- source: internal/database/migration/store/store.go:listViews
SELECT
	v.schemaname AS schemaName,
	v.viewname AS viewName,
	v.definition AS definition
FROM pg_catalog.pg_views v
WHERE
	v.schemaname NOT LIKE 'pg_%%' AND
	v.schemaname != 'information_schema'
ORDER BY
	v.schemaname,
	v.viewname
`
