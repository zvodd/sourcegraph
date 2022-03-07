package resolvers

import (
	"context"
	"path"

	"github.com/grafana/regexp"

	"github.com/sourcegraph/sourcegraph/lib/errors"
)

func (r *resolver) FilesLanguageGroupings(ctx context.Context, repositoryID int, rev, root string) (map[string][]string, error) {
	// filter out dotfiles and files in directories deeper than args.Path
	filesRegex, err := regexp.Compile("^" + root + "[^.]{1}[^/]*$")
	if err != nil {
		return nil, errors.Wrapf(err, "path '%s' caused invalid regex", root)
	}

	// TODO(nsc): how to, from ctx maybe?
	// traceLog.Log(log.String("filesRegex", filesRegex.String()))

	files, err := r.gitserverClient.ListFiles(ctx, int(repositoryID), rev, filesRegex)
	if err != nil {
		return nil, err
	}

	groupings := make(map[string][]string)

	for _, file := range files {
		if extension := path.Ext(file); extension != "" {
			groupings[extension] = append(groupings[extension], file)
		}
	}

	return groupings, nil
}
