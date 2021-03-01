package query

type Environment struct {
	DotCom         bool
	VersionContext string
}

func toRepoOptions(q Q) *RepoOptions {
	includeRepos, excludeRepos := FindFields(q, "repo")
	includeRepoGroups := FindPositiveField(q, "repogroup")         // enforce singular, isNotNegated
	fork := ParseYesNoOnly(FindPositiveField(q, "fork"))           // enforce singular
	archived := ParseYesNoOnly(FindPositiveField(q, "archived"))   // enforce singular
	privacy := ParseVisibility(FindPositiveField(q, "visibility")) // ... etc.
	// TODO: deal with repoHasCommitAfter. / commitAfter

	return nil
}

// TODO: send this the version context URL param and ennvar.
func translate(q Q, env Environment) InternalQuery {
	repoOptions := toRepoOptions(q)
	//	contextID := FindPositiveField(q, "context")

	/*
		if repoQuery, ok := toRepoQuery(q); ok {
			if env.DotCom {
				return RepoQuery{DotComDefault{}}
			}
			return repoQuery
		}
	*/
	return GenericQuery{q}
}
