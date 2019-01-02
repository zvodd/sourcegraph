This directory contains database migrations for the repos-service Postgres DB.

## Usage

Migrations are handled by the [migrate](https://github.com/golang-migrate/migrate/tree/master/cli#installation) tool. Migrations get applied automatically at service startup. The CLI tool can also be used to manually test migrations.

### Add a new migration

**IMPORTANT:** All migrations must be backward-compatible, meaning that the _existing_ version of
the `repos-service` command must be able to run against the _new_ (post-migration) version of the schema.

**IMPORTANT:** Your migration should be written in such a way that tolerates writes from
pre-migration versions of Sourcegraph. This is because frontend pods are updated in a rolling
fashion. During the rolling update, there will be both old and new frontend pods. The first updated
pod will migrate the schema atomically, but the remaining old ones may continue to write before they
are terminated.

Run the following from `cmd/repos-service`

```
migrate create -ext sql -seq -digits 5 -dir migrations/ "your_migration_name"
```

There will be up/down `.sql` migration files created in this directory. Add SQL statements to these
files that will perform the desired migration. **NOTE**: the migration runner wraps each migration
script in a transaction block; do not add explicit transaction blocks to the migration script as
this has caused issues in the past.

```sql
# Enter statements here
```

After adding SQL statements to those files, embed them into the Go code and update the schema doc:

```
go generate ./...
```

### Migrating up/down

Up migrations happen automatically on service start-up after running the
generate scripts. They can also be run manually using the migrate CLI.
