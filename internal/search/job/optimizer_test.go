package job

import (
	"fmt"
	"testing"

	"github.com/hexops/autogold"

	"github.com/sourcegraph/sourcegraph/internal/search"
	"github.com/sourcegraph/sourcegraph/internal/search/query"
	"github.com/sourcegraph/sourcegraph/internal/search/run"
	"github.com/sourcegraph/sourcegraph/schema"
)

func TestAndExpression(t *testing.T) {
	test := func(input string) string {
		q, _ := query.ParseLiteral(input)
		args := &Args{
			SearchInputs: &run.SearchInputs{
				UserSettings: &schema.Settings{},
			},
			Protocol: search.Streaming,
		}
		b, err := query.ToBasicQuery(q)
		if err != nil {
			return "Not a basic query: " + err.Error()
		}
		job, _ := ToEvaluateJob(args, b)
		optimizedJob := OptimizeAnd(job)
		/*
			result, _ := json.MarshalIndent(
				struct {
					Before string
					After  string
				}{
					Before: PrettyJSONVerbose(job),
					After:  PrettyJSONVerbose(optimizedJob),
				}, "", "  ")
			return string(result)
		*/
		return fmt.Sprintf("\nBefore:\n%s\nAfter\n:%s\n", PrettyJSONVerbose(job), PrettyJSONVerbose(optimizedJob))
	}

	autogold.Want("Zoekt `and` optimization", `
Before:
{
  "TIMEOUT": {
    "LIMIT": {
      "AND": [
        {
          "LIMIT": {
            "PARALLEL": [
              {
                "RepoUniverseText": {
                  "GlobalZoektQuery": {},
                  "ZoektArgs": {
                    "Query": null,
                    "Typ": "text",
                    "FileMatchLimit": 500,
                    "Select": [],
                    "Zoekt": null
                  },
                  "RepoOptions": {
                    "RepoFilters": null,
                    "MinusRepoFilters": null,
                    "CaseSensitiveRepoFilters": false,
                    "SearchContextSpec": "",
                    "UserSettings": {},
                    "NoForks": true,
                    "OnlyForks": false,
                    "NoArchived": true,
                    "OnlyArchived": false,
                    "CommitAfter": "",
                    "Visibility": "Any",
                    "Limit": 0,
                    "Cursors": null,
                    "Query": [
                      {
                        "value": "foo",
                        "negated": false
                      }
                    ]
                  },
                  "UserID": 0
                }
              },
              {
                "RepoSubsetText": {
                  "ZoektArgs": {
                    "Query": {
                      "Pattern": "foo",
                      "CaseSensitive": false,
                      "FileName": false,
                      "Content": false
                    },
                    "Typ": "text",
                    "FileMatchLimit": 500,
                    "Select": [],
                    "Zoekt": null
                  },
                  "SearcherArgs": {
                    "SearcherURLs": null,
                    "PatternInfo": {
                      "Pattern": "foo",
                      "IsNegated": false,
                      "IsRegExp": true,
                      "IsStructuralPat": false,
                      "CombyRule": "",
                      "IsWordMatch": false,
                      "IsCaseSensitive": false,
                      "FileMatchLimit": 500,
                      "Index": "yes",
                      "Select": [],
                      "IncludePatterns": null,
                      "ExcludePattern": "",
                      "FilePatternsReposMustInclude": null,
                      "FilePatternsReposMustExclude": null,
                      "PathPatternsAreCaseSensitive": false,
                      "PatternMatchesContent": true,
                      "PatternMatchesPath": true,
                      "Languages": null
                    },
                    "UseFullDeadline": true
                  },
                  "NotSearcherOnly": false,
                  "UseIndex": "yes",
                  "ContainsRefGlobs": false,
                  "RepoOpts": {
                    "RepoFilters": null,
                    "MinusRepoFilters": null,
                    "CaseSensitiveRepoFilters": false,
                    "SearchContextSpec": "",
                    "UserSettings": {},
                    "NoForks": true,
                    "OnlyForks": false,
                    "NoArchived": true,
                    "OnlyArchived": false,
                    "CommitAfter": "",
                    "Visibility": "Any",
                    "Limit": 0,
                    "Cursors": null,
                    "Query": [
                      {
                        "value": "foo",
                        "negated": false
                      }
                    ]
                  }
                }
              },
              {
                "Repo": {
                  "Args": {
                    "PatternInfo": {
                      "Pattern": "foo",
                      "IsNegated": false,
                      "IsRegExp": true,
                      "IsStructuralPat": false,
                      "CombyRule": "",
                      "IsWordMatch": false,
                      "IsCaseSensitive": false,
                      "FileMatchLimit": 500,
                      "Index": "yes",
                      "Select": [],
                      "IncludePatterns": null,
                      "ExcludePattern": "",
                      "FilePatternsReposMustInclude": null,
                      "FilePatternsReposMustExclude": null,
                      "PathPatternsAreCaseSensitive": false,
                      "PatternMatchesContent": true,
                      "PatternMatchesPath": true,
                      "Languages": null
                    },
                    "RepoOptions": {
                      "RepoFilters": [
                        "foo"
                      ],
                      "MinusRepoFilters": null,
                      "CaseSensitiveRepoFilters": false,
                      "SearchContextSpec": "",
                      "UserSettings": {},
                      "NoForks": true,
                      "OnlyForks": false,
                      "NoArchived": true,
                      "OnlyArchived": false,
                      "CommitAfter": "",
                      "Visibility": "Any",
                      "Limit": 0,
                      "Cursors": null,
                      "Query": [
                        {
                          "value": "foo",
                          "negated": false
                        }
                      ]
                    },
                    "Features": {
                      "ContentBasedLangFilters": false
                    },
                    "ResultTypes": 13,
                    "Timeout": 20000000000,
                    "Repos": null,
                    "UserPrivateRepos": null,
                    "Mode": 1,
                    "Query": [
                      {
                        "value": "foo",
                        "negated": false
                      }
                    ],
                    "UseFullDeadline": true,
                    "Zoekt": null,
                    "SearcherURLs": null
                  }
                }
              },
              {
                "ComputeExcludedRepos": {
                  "Options": {
                    "RepoFilters": null,
                    "MinusRepoFilters": null,
                    "CaseSensitiveRepoFilters": false,
                    "SearchContextSpec": "",
                    "UserSettings": {},
                    "NoForks": true,
                    "OnlyForks": false,
                    "NoArchived": true,
                    "OnlyArchived": false,
                    "CommitAfter": "",
                    "Visibility": "Any",
                    "Limit": 0,
                    "Cursors": null,
                    "Query": [
                      {
                        "value": "foo",
                        "negated": false
                      }
                    ]
                  }
                }
              }
            ]
          },
          "value": 40000
        },
        {
          "LIMIT": {
            "PARALLEL": [
              {
                "RepoUniverseText": {
                  "GlobalZoektQuery": {},
                  "ZoektArgs": {
                    "Query": null,
                    "Typ": "text",
                    "FileMatchLimit": 500,
                    "Select": [],
                    "Zoekt": null
                  },
                  "RepoOptions": {
                    "RepoFilters": null,
                    "MinusRepoFilters": null,
                    "CaseSensitiveRepoFilters": false,
                    "SearchContextSpec": "",
                    "UserSettings": {},
                    "NoForks": true,
                    "OnlyForks": false,
                    "NoArchived": true,
                    "OnlyArchived": false,
                    "CommitAfter": "",
                    "Visibility": "Any",
                    "Limit": 0,
                    "Cursors": null,
                    "Query": [
                      {
                        "value": "bar",
                        "negated": false
                      }
                    ]
                  },
                  "UserID": 0
                }
              },
              {
                "RepoSubsetText": {
                  "ZoektArgs": {
                    "Query": {
                      "Pattern": "bar",
                      "CaseSensitive": false,
                      "FileName": false,
                      "Content": false
                    },
                    "Typ": "text",
                    "FileMatchLimit": 500,
                    "Select": [],
                    "Zoekt": null
                  },
                  "SearcherArgs": {
                    "SearcherURLs": null,
                    "PatternInfo": {
                      "Pattern": "bar",
                      "IsNegated": false,
                      "IsRegExp": true,
                      "IsStructuralPat": false,
                      "CombyRule": "",
                      "IsWordMatch": false,
                      "IsCaseSensitive": false,
                      "FileMatchLimit": 500,
                      "Index": "yes",
                      "Select": [],
                      "IncludePatterns": null,
                      "ExcludePattern": "",
                      "FilePatternsReposMustInclude": null,
                      "FilePatternsReposMustExclude": null,
                      "PathPatternsAreCaseSensitive": false,
                      "PatternMatchesContent": true,
                      "PatternMatchesPath": true,
                      "Languages": null
                    },
                    "UseFullDeadline": true
                  },
                  "NotSearcherOnly": false,
                  "UseIndex": "yes",
                  "ContainsRefGlobs": false,
                  "RepoOpts": {
                    "RepoFilters": null,
                    "MinusRepoFilters": null,
                    "CaseSensitiveRepoFilters": false,
                    "SearchContextSpec": "",
                    "UserSettings": {},
                    "NoForks": true,
                    "OnlyForks": false,
                    "NoArchived": true,
                    "OnlyArchived": false,
                    "CommitAfter": "",
                    "Visibility": "Any",
                    "Limit": 0,
                    "Cursors": null,
                    "Query": [
                      {
                        "value": "bar",
                        "negated": false
                      }
                    ]
                  }
                }
              },
              {
                "Repo": {
                  "Args": {
                    "PatternInfo": {
                      "Pattern": "bar",
                      "IsNegated": false,
                      "IsRegExp": true,
                      "IsStructuralPat": false,
                      "CombyRule": "",
                      "IsWordMatch": false,
                      "IsCaseSensitive": false,
                      "FileMatchLimit": 500,
                      "Index": "yes",
                      "Select": [],
                      "IncludePatterns": null,
                      "ExcludePattern": "",
                      "FilePatternsReposMustInclude": null,
                      "FilePatternsReposMustExclude": null,
                      "PathPatternsAreCaseSensitive": false,
                      "PatternMatchesContent": true,
                      "PatternMatchesPath": true,
                      "Languages": null
                    },
                    "RepoOptions": {
                      "RepoFilters": [
                        "bar"
                      ],
                      "MinusRepoFilters": null,
                      "CaseSensitiveRepoFilters": false,
                      "SearchContextSpec": "",
                      "UserSettings": {},
                      "NoForks": true,
                      "OnlyForks": false,
                      "NoArchived": true,
                      "OnlyArchived": false,
                      "CommitAfter": "",
                      "Visibility": "Any",
                      "Limit": 0,
                      "Cursors": null,
                      "Query": [
                        {
                          "value": "bar",
                          "negated": false
                        }
                      ]
                    },
                    "Features": {
                      "ContentBasedLangFilters": false
                    },
                    "ResultTypes": 13,
                    "Timeout": 20000000000,
                    "Repos": null,
                    "UserPrivateRepos": null,
                    "Mode": 1,
                    "Query": [
                      {
                        "value": "bar",
                        "negated": false
                      }
                    ],
                    "UseFullDeadline": true,
                    "Zoekt": null,
                    "SearcherURLs": null
                  }
                }
              },
              {
                "ComputeExcludedRepos": {
                  "Options": {
                    "RepoFilters": null,
                    "MinusRepoFilters": null,
                    "CaseSensitiveRepoFilters": false,
                    "SearchContextSpec": "",
                    "UserSettings": {},
                    "NoForks": true,
                    "OnlyForks": false,
                    "NoArchived": true,
                    "OnlyArchived": false,
                    "CommitAfter": "",
                    "Visibility": "Any",
                    "Limit": 0,
                    "Cursors": null,
                    "Query": [
                      {
                        "value": "bar",
                        "negated": false
                      }
                    ]
                  }
                }
              }
            ]
          },
          "value": 40000
        }
      ]
    },
    "value": 30
  },
  "value": "20s"
}
After
:{
  "TIMEOUT": {
    "LIMIT": {
      "LIMIT": {
        "PARALLEL": [
          {
            "RepoUniverseText": {
              "GlobalZoektQuery": {},
              "ZoektArgs": {
                "Query": null,
                "Typ": "text",
                "FileMatchLimit": 500,
                "Select": [],
                "Zoekt": null
              },
              "RepoOptions": {
                "RepoFilters": null,
                "MinusRepoFilters": null,
                "CaseSensitiveRepoFilters": false,
                "SearchContextSpec": "",
                "UserSettings": {},
                "NoForks": true,
                "OnlyForks": false,
                "NoArchived": true,
                "OnlyArchived": false,
                "CommitAfter": "",
                "Visibility": "Any",
                "Limit": 0,
                "Cursors": null,
                "Query": [
                  {
                    "value": "foo",
                    "negated": false
                  }
                ]
              },
              "UserID": 0
            }
          },
          {
            "RepoSubsetText": {
              "ZoektArgs": {
                "Query": {
                  "Pattern": "foo",
                  "CaseSensitive": false,
                  "FileName": false,
                  "Content": false
                },
                "Typ": "text",
                "FileMatchLimit": 500,
                "Select": [],
                "Zoekt": null
              },
              "SearcherArgs": {
                "SearcherURLs": null,
                "PatternInfo": {
                  "Pattern": "foo",
                  "IsNegated": false,
                  "IsRegExp": true,
                  "IsStructuralPat": false,
                  "CombyRule": "",
                  "IsWordMatch": false,
                  "IsCaseSensitive": false,
                  "FileMatchLimit": 500,
                  "Index": "yes",
                  "Select": [],
                  "IncludePatterns": null,
                  "ExcludePattern": "",
                  "FilePatternsReposMustInclude": null,
                  "FilePatternsReposMustExclude": null,
                  "PathPatternsAreCaseSensitive": false,
                  "PatternMatchesContent": true,
                  "PatternMatchesPath": true,
                  "Languages": null
                },
                "UseFullDeadline": true
              },
              "NotSearcherOnly": false,
              "UseIndex": "yes",
              "ContainsRefGlobs": false,
              "RepoOpts": {
                "RepoFilters": null,
                "MinusRepoFilters": null,
                "CaseSensitiveRepoFilters": false,
                "SearchContextSpec": "",
                "UserSettings": {},
                "NoForks": true,
                "OnlyForks": false,
                "NoArchived": true,
                "OnlyArchived": false,
                "CommitAfter": "",
                "Visibility": "Any",
                "Limit": 0,
                "Cursors": null,
                "Query": [
                  {
                    "value": "foo",
                    "negated": false
                  }
                ]
              }
            }
          },
          {
            "Repo": {
              "Args": {
                "PatternInfo": {
                  "Pattern": "foo",
                  "IsNegated": false,
                  "IsRegExp": true,
                  "IsStructuralPat": false,
                  "CombyRule": "",
                  "IsWordMatch": false,
                  "IsCaseSensitive": false,
                  "FileMatchLimit": 500,
                  "Index": "yes",
                  "Select": [],
                  "IncludePatterns": null,
                  "ExcludePattern": "",
                  "FilePatternsReposMustInclude": null,
                  "FilePatternsReposMustExclude": null,
                  "PathPatternsAreCaseSensitive": false,
                  "PatternMatchesContent": true,
                  "PatternMatchesPath": true,
                  "Languages": null
                },
                "RepoOptions": {
                  "RepoFilters": [
                    "foo"
                  ],
                  "MinusRepoFilters": null,
                  "CaseSensitiveRepoFilters": false,
                  "SearchContextSpec": "",
                  "UserSettings": {},
                  "NoForks": true,
                  "OnlyForks": false,
                  "NoArchived": true,
                  "OnlyArchived": false,
                  "CommitAfter": "",
                  "Visibility": "Any",
                  "Limit": 0,
                  "Cursors": null,
                  "Query": [
                    {
                      "value": "foo",
                      "negated": false
                    }
                  ]
                },
                "Features": {
                  "ContentBasedLangFilters": false
                },
                "ResultTypes": 13,
                "Timeout": 20000000000,
                "Repos": null,
                "UserPrivateRepos": null,
                "Mode": 1,
                "Query": [
                  {
                    "value": "foo",
                    "negated": false
                  }
                ],
                "UseFullDeadline": true,
                "Zoekt": null,
                "SearcherURLs": null
              }
            }
          },
          {
            "ComputeExcludedRepos": {
              "Options": {
                "RepoFilters": null,
                "MinusRepoFilters": null,
                "CaseSensitiveRepoFilters": false,
                "SearchContextSpec": "",
                "UserSettings": {},
                "NoForks": true,
                "OnlyForks": false,
                "NoArchived": true,
                "OnlyArchived": false,
                "CommitAfter": "",
                "Visibility": "Any",
                "Limit": 0,
                "Cursors": null,
                "Query": [
                  {
                    "value": "foo",
                    "negated": false
                  }
                ]
              }
            }
          }
        ]
      },
      "value": 40000
    },
    "value": 30
  },
  "value": "20s"
}
`).Equal(t, test("foo and bar"))
}
