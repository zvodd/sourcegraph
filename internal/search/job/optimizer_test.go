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
			OnSourcegraphDotCom: true,
			Protocol:            search.Streaming,
		}
		b, err := query.ToBasicQuery(q)
		if err != nil {
			return "Not a basic query: " + err.Error()
		}
		job, _ := ToEvaluateJob(args, b)
		optimizedJob := OptimizeAnd(job)
		return fmt.Sprintf("\nBefore:\n%s\nAfter\n:%s\n", PrettyJSON(job), PrettyJSON(optimizedJob))
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
              "RepoUniverseText",
              "Repo",
              "ComputeExcludedRepos"
            ]
          },
          "value": 40000
        },
        {
          "LIMIT": {
            "PARALLEL": [
              "RepoUniverseText",
              "Repo",
              "ComputeExcludedRepos"
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
:"NoopJob"
`).Equal(t, test("foo and bar"))
}
