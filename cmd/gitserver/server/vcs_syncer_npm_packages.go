package server

import (
	"context"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path"
	"strings"

	"github.com/inconshreveable/log15"

	dependenciesStore "github.com/sourcegraph/sourcegraph/internal/codeintel/dependencies/store"
	"github.com/sourcegraph/sourcegraph/internal/conf/reposource"
	"github.com/sourcegraph/sourcegraph/internal/extsvc/npm"
	"github.com/sourcegraph/sourcegraph/internal/repos"
	"github.com/sourcegraph/sourcegraph/internal/unpack"
	"github.com/sourcegraph/sourcegraph/internal/vcs"
	"github.com/sourcegraph/sourcegraph/lib/errors"
	"github.com/sourcegraph/sourcegraph/schema"
)

var (
	placeholderNPMDependency = &reposource.NPMDependency{
		NPMPackage: func() *reposource.NPMPackage {
			pkg, err := reposource.NewNPMPackage("sourcegraph", "placeholder")
			if err != nil {
				panic(fmt.Sprintf("expected placeholder package to parse but got %v", err))
			}
			return pkg
		}(),
		Version: "1.0.0",
	}
)

type NPMPackagesSyncer struct {
	// Configuration object describing the connection to the NPM registry.
	connection schema.NPMPackagesConnection
	depsStore  repos.DependenciesStore
	// The client to use for making queries against NPM.
	client npm.Client
}

// Create a new NPMPackagesSyncer. If customClient is nil, the client
// for the syncer is configured based on the connection parameter.
func NewNPMPackagesSyncer(
	connection schema.NPMPackagesConnection,
	dbStore repos.DependenciesStore,
	customClient npm.Client,
) *NPMPackagesSyncer {
	var client = customClient
	if client == nil {
		client = npm.NewHTTPClient(connection.Registry, connection.RateLimit, connection.Credentials)
	}
	return &NPMPackagesSyncer{connection, dbStore, client}
}

var _ VCSSyncer = &NPMPackagesSyncer{}

func (s *NPMPackagesSyncer) Type() string {
	return "npm_packages"
}

// IsCloneable checks to see if the VCS remote URL is cloneable. Any non-nil
// error indicates there is a problem.
func (s *NPMPackagesSyncer) IsCloneable(ctx context.Context, remoteURL *vcs.URL) error {
	dependencies, err := s.packageDependencies(ctx, remoteURL.Path)
	if err != nil {
		return err
	}

	for _, dependency := range dependencies {
		if err := npm.Exists(ctx, s.client, dependency); err != nil {
			return err
		}
	}
	return nil
}

// Similar to CloneCommand for JVMPackagesSyncer; it handles cloning itself
// instead of returning a command that does the cloning.
func (s *NPMPackagesSyncer) CloneCommand(ctx context.Context, remoteURL *vcs.URL, bareGitDirectory string) (*exec.Cmd, error) {
	err := os.MkdirAll(bareGitDirectory, 0755)
	if err != nil {
		return nil, err
	}

	cmd := exec.CommandContext(ctx, "git", "--bare", "init")
	if _, err := runCommandInDirectory(ctx, cmd, bareGitDirectory, placeholderNPMDependency); err != nil {
		return nil, err
	}

	// The Fetch method is responsible for cleaning up temporary directories.
	if err := s.Fetch(ctx, remoteURL, GitDir(bareGitDirectory)); err != nil {
		return nil, errors.Wrapf(err, "failed to fetch repo for %s", remoteURL)
	}

	// no-op command to satisfy VCSSyncer interface, see docstring for more details.
	return exec.CommandContext(ctx, "git", "--version"), nil
}

// Fetch adds git tags for newly added dependency versions and removes git tags
// for deleted versions.
func (s *NPMPackagesSyncer) Fetch(ctx context.Context, remoteURL *vcs.URL, dir GitDir) error {
	dependencies, err := s.packageDependencies(ctx, remoteURL.Path)
	if err != nil {
		return err
	}

	out, err := runCommandInDirectory(ctx, exec.CommandContext(ctx, "git", "tag"), string(dir), placeholderNPMDependency)
	if err != nil {
		return err
	}

	tags := map[string]bool{}
	for _, line := range strings.Split(out, "\n") {
		if len(line) == 0 {
			continue
		}
		tags[line] = true
	}

	for i, dependency := range dependencies {
		if tags[dependency.GitTagFromVersion()] {
			continue
		}
		// the gitPushDependencyTag method is responsible for cleaning up temporary directories.
		if err := s.gitPushDependencyTag(ctx, string(dir), dependency, i == 0); err != nil {
			return errors.Wrapf(err, "error pushing dependency %q", dependency.PackageManagerSyntax())
		}
	}

	dependencyTags := make(map[string]struct{}, len(dependencies))
	for _, dependency := range dependencies {
		dependencyTags[dependency.GitTagFromVersion()] = struct{}{}
	}

	for tag := range tags {
		if _, isDependencyTag := dependencyTags[tag]; !isDependencyTag {
			cmd := exec.CommandContext(ctx, "git", "tag", "-d", tag)
			if _, err := runCommandInDirectory(ctx, cmd, string(dir), placeholderNPMDependency); err != nil {
				log15.Error("Failed to delete git tag", "error", err, "tag", tag)
				continue
			}
		}
	}

	return nil
}

// RemoteShowCommand returns the command to be executed for showing remote.
func (s *NPMPackagesSyncer) RemoteShowCommand(ctx context.Context, remoteURL *vcs.URL) (cmd *exec.Cmd, err error) {
	return exec.CommandContext(ctx, "git", "remote", "show", "./"), nil
}

// packageDependencies returns the list of NPM dependencies that belong to the
// given URL path. The returned package dependencies are sorted in descending
// semver order (newest first).
//
// For example, if the URL path represents pkg@1, and our configuration has
// [otherPkg@1, pkg@2, pkg@3], we will return [pkg@3, pkg@2].
func (s *NPMPackagesSyncer) packageDependencies(ctx context.Context, repoUrlPath string) (matchingDependencies []*reposource.NPMDependency, err error) {
	repoPackage, err := reposource.ParseNPMPackageFromRepoURL(repoUrlPath)
	if err != nil {
		return nil, err
	}

	var (
		timedout []*reposource.NPMDependency
	)
	for _, configDependencyString := range s.npmDependencies() {
		if repoPackage.MatchesDependencyString(configDependencyString) {
			dep, err := reposource.ParseNPMDependency(configDependencyString)
			if err != nil {
				return nil, err
			}

			if err := npm.Exists(ctx, s.client, dep); err != nil {
				if errors.Is(err, context.DeadlineExceeded) {
					timedout = append(timedout, dep)
					continue
				} else {
					return nil, err
				}
			}
			matchingDependencies = append(matchingDependencies, dep)
			// Silently ignore non-existent dependencies because
			// they are already logged out in the `GetRepo` method
			// in internal/repos/jvm_packages.go.
		}
	}
	if len(timedout) > 0 {
		log15.Warn("non-zero number of timed-out npm invocations", "count", len(timedout), "dependencies", timedout)
	}
	var totalConfigMatched = len(matchingDependencies)

	parsedPackage, err := reposource.ParseNPMPackageFromRepoURL(repoUrlPath)
	if err != nil {
		return nil, err
	}
	dbDeps, err := s.depsStore.ListDependencyRepos(ctx, dependenciesStore.ListDependencyReposOpts{
		Scheme:      dependenciesStore.NPMPackagesScheme,
		Name:        parsedPackage.PackageSyntax(),
		NewestFirst: true,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get npm dependencies from dbStore")
	}

	for _, dbDep := range dbDeps {
		parsedDbPackage, err := reposource.ParseNPMPackageFromPackageSyntax(dbDep.Name)
		if err != nil {
			log15.Error("failed to parse npm package", "package", dbDep.Name, "message", err)
			continue
		}
		if repoPackage.Equal(parsedDbPackage) {
			matchingDependencies = append(matchingDependencies, &reposource.NPMDependency{
				NPMPackage: parsedDbPackage,
				Version:    dbDep.Version,
			})
		}
	}
	var totalDBMatched = len(matchingDependencies) - totalConfigMatched

	if len(matchingDependencies) == 0 {
		return nil, errors.Errorf("no NPM dependencies for URL path %s", repoUrlPath)
	}

	log15.Info("fetched npm artifact for repo path", "repoPath", repoUrlPath,
		"totalDB", totalDBMatched, "totalConfig", totalConfigMatched)
	reposource.SortNPMDependencies(matchingDependencies)
	return matchingDependencies, nil
}

func (s *NPMPackagesSyncer) npmDependencies() []string {
	if s.connection.Dependencies == nil {
		return nil
	}
	return s.connection.Dependencies
}

// gitPushDependencyTag pushes a git tag to the given bareGitDirectory path. The
// tag points to a commit that adds all sources of given dependency. When
// isLatestVersion is true, the HEAD of the bare git directory will also be
// updated to point to the same commit as the git tag.
func (s *NPMPackagesSyncer) gitPushDependencyTag(ctx context.Context, bareGitDirectory string, dependency *reposource.NPMDependency, isLatestVersion bool) error {
	tmpDirectory, err := os.MkdirTemp("", "npm-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDirectory)

	tgz, err := npm.FetchSources(ctx, s.client, dependency)
	if err != nil {
		return err
	}
	defer tgz.Close()

	err = s.commitTgz(ctx, dependency, tmpDirectory, tgz)
	if err != nil {
		return err
	}

	cmd := exec.CommandContext(ctx, "git", "remote", "add", "origin", bareGitDirectory)
	if _, err := runCommandInDirectory(ctx, cmd, tmpDirectory, dependency); err != nil {
		return err
	}

	// Use --no-verify for security reasons. See https://github.com/sourcegraph/sourcegraph/pull/23399
	cmd = exec.CommandContext(ctx, "git", "push", "--no-verify", "--force", "origin", "--tags")
	if _, err := runCommandInDirectory(ctx, cmd, tmpDirectory, dependency); err != nil {
		return err
	}

	if isLatestVersion {
		defaultBranch, err := runCommandInDirectory(ctx, exec.CommandContext(ctx, "git", "rev-parse", "--abbrev-ref", "HEAD"), tmpDirectory, dependency)
		if err != nil {
			return err
		}
		// Use --no-verify for security reasons. See https://github.com/sourcegraph/sourcegraph/pull/23399
		cmd = exec.CommandContext(ctx, "git", "push", "--no-verify", "--force", "origin", strings.TrimSpace(defaultBranch)+":latest", dependency.GitTagFromVersion())
		if _, err := runCommandInDirectory(ctx, cmd, tmpDirectory, dependency); err != nil {
			return err
		}
	}

	return nil
}

// commitTgz initializes a git repository in the given working directory and creates
// a git commit in that contains all the file contents of the given tgz.
func (s *NPMPackagesSyncer) commitTgz(ctx context.Context, dependency *reposource.NPMDependency,
	workingDirectory string, tgz io.Reader) error {
	if err := decompressTgz(tgz, workingDirectory); err != nil {
		return errors.Wrapf(err, "failed to decompress gzipped tarball for %s", dependency.PackageManagerSyntax())
	}

	// See [NOTE: LSIF-config-json] for why we don't create a JSON file here
	// like we do for Java.

	cmd := exec.CommandContext(ctx, "git", "init")
	if _, err := runCommandInDirectory(ctx, cmd, workingDirectory, dependency); err != nil {
		return err
	}

	cmd = exec.CommandContext(ctx, "git", "add", ".")
	if _, err := runCommandInDirectory(ctx, cmd, workingDirectory, dependency); err != nil {
		return err
	}

	// Use --no-verify for security reasons. See https://github.com/sourcegraph/sourcegraph/pull/23399
	cmd = exec.CommandContext(ctx, "git", "commit", "--no-verify",
		"-m", dependency.PackageManagerSyntax(), "--date", stableGitCommitDate)
	if _, err := runCommandInDirectory(ctx, cmd, workingDirectory, dependency); err != nil {
		return err
	}

	cmd = exec.CommandContext(ctx, "git", "tag",
		"-m", dependency.PackageManagerSyntax(), dependency.GitTagFromVersion())
	if _, err := runCommandInDirectory(ctx, cmd, workingDirectory, dependency); err != nil {
		return err
	}

	return nil
}

// Decompress a tarball at tgzPath, putting the files under destination.
//
// Additionally, if all the files in the tarball have paths of the form
// dir/<blah> for the same directory 'dir', the 'dir' will be stripped.
func decompressTgz(tgz io.Reader, destination string) error {
	err := unpack.Tgz(tgz, destination, unpack.Opts{
		SkipInvalid: true,
		Filter: func(path string, file fs.FileInfo) bool {
			size := file.Size()

			const sizeLimit = 15 * 1024 * 1024
			if size >= sizeLimit {
				log15.Warn("skipping large file in npm package",
					"path", file.Name(),
					"size", size,
					"limit", sizeLimit,
				)
				return false
			}

			_, malicious := isPotentiallyMaliciousFilepathInArchive(path, destination)
			return !malicious
		},
	})

	if err != nil {
		return err
	}

	return stripSingleOutermostDirectory(destination)
}

// stripSingleOutermostDirectory strips a single outermost directory in dir
// if it has no sibling files or directories.
//
// In practice, NPM tarballs seem to contain a superfluous directory which
// contains the files. For example, if you extract react's tarball,
// all files will be under a package/ directory, and if you extract
// @types/lodash's files, all files are under lodash/.
//
// However, this additional directory has no meaning. Moreover, it makes
// the UX slightly worse, as when you navigate to a repo, you would see
// that it contains just 1 folder, and you'd need to click again to drill
// down further. So we strip the superfluous directory if we detect one.
//
// https://github.com/sourcegraph/sourcegraph/pull/28057#issuecomment-987890718
func stripSingleOutermostDirectory(dir string) error {
	dirEntries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	if len(dirEntries) != 1 || !dirEntries[0].IsDir() {
		return nil
	}

	outermostDir := dirEntries[0].Name()
	tmpDir := dir + ".tmp"

	// mv $dir $tmpDir
	err = os.Rename(dir, tmpDir)
	if err != nil {
		return err
	}

	// mv $tmpDir/$(basename $outermostDir) $dir
	return os.Rename(path.Join(tmpDir, outermostDir), dir)
}
