package resolvers

import (
	"context"

	"github.com/go-enry/go-enry/v2"
	"github.com/grafana/regexp"

	"github.com/sourcegraph/sourcegraph/lib/errors"
)

// FilesLanguageGroupings returns a grouping of files, non-recursively rooted at root, based on their
// inferred language.
func (r *resolver) FilesLanguageGroupings(ctx context.Context, repositoryID int, rev, root string) (map[string][]string, error) {
	// filter out dotfiles and files in directories deeper than args.Path
	filesRegex, err := regexp.Compile("^" + root + "[^.]{1}[^/]*$")
	if err != nil {
		return nil, errors.Wrapf(err, "path '%s' caused invalid regex", root)
	}

	// TODO(nsc): how to, from ctx maybe?
	// traceLog.Log(log.String("filesRegex", filesRegex.String()))

	files, err := r.gitserverClient.ListFiles(ctx, repositoryID, rev, filesRegex)
	if err != nil {
		return nil, err
	}

	groupings := make(map[string][]string)

	for _, file := range files {
		language, _ := enry.GetLanguageByExtension(file)
		if language == "" {
			language, _ = enry.GetLanguageByFilename(file)
		}
		if language != "" {
			groupings[language] = append(groupings[language], file)
		}
	}

	return groupings, nil
}
