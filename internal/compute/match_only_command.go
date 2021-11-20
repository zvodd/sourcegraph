package compute

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"

	"github.com/inconshreveable/log15"
	"github.com/sourcegraph/sourcegraph/internal/search/result"
)

type MatchOnly struct {
	MatchPattern MatchPattern
}

func (c *MatchOnly) String() string {
	return fmt.Sprintf("Match only: %s", c.MatchPattern.String())
}

func fromRegexpMatches(matches [][]int, namedGroups []string, lineValue string, lineNumber int) Match {
	env := make(Environment)
	var firstValue string
	var firstRange Range
	for _, m := range matches {
		// iterate over pairs of offsets. Cf. FindAllStringSubmatchIndex
		// https://pkg.go.dev/regexp#Regexp.FindAllStringSubmatchIndex.
		for j := 0; j < len(m); j += 2 {
			start := m[j]
			end := m[j+1]
			if start == -1 || end == -1 {
				// The entire regexp matched, but a capture
				// group inside it did not. Ignore this entry.
				continue
			}
			value := lineValue[start:end]
			range_ := newRange(lineNumber, lineNumber, start, end)

			if j == 0 {
				// The first submatch is the overall match
				// value. Don't add this to the Environment
				firstValue = value
				firstRange = range_
				continue
			}

			var v string
			if namedGroups[j/2] == "" {
				v = strconv.Itoa(j / 2)
			} else {
				v = namedGroups[j/2]
			}
			env[v] = Data{Value: value, Range: range_}
		}
	}
	return Match{Value: firstValue, Range: firstRange, Environment: env}
}

type hoverInfo struct {
	Data struct {
		Repository struct {
			Commit struct {
				Blob struct {
					LSIF struct {
						Hover struct {
							Markdown struct {
								Text string `json:"text"`
							} `json:"markdown"`
						} `json:"hover"`
					} `json:"lsif"`
				} `json:"blob"`
			} `json:"commit"`
		} `json:"repository"`
	} `json:"data"`
}

func fetchLSIF(line, column int, path string) (string, error) {
	log15.Info("Asking LSIF for", "v", fmt.Sprintf("%d, %d, %s", line, column, path))
	request := fmt.Sprintf(`{"query":"query Hover($repository: String!, $commit: String!, $path: String!, $line: Int!, $character: Int!) {\n  repository(name: $repository) {\n    commit(rev: $commit) {\n      blob(path: $path) {\n        lsif {\n          hover(line: $line, character: $character) {\n            markdown {\n              text\n            }\n            range {\n              start {\n                line\n                character\n              }\n              end {\n                line\n                character\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n}","variables":{"line":%d,"character":%d,"commit":"HEAD","path":"%s","repository":"github.com/sourcegraph/sourcegraph"},"operationName":"Hover"}`, line, column, path)
	resp, err := http.Post("https://sourcegraph.com/.api/graphql", "application/json", bytes.NewBuffer([]byte(request)))
	if err != nil {
		log15.Info("err response", "is", err.Error())
		return "", err
	}
	defer resp.Body.Close()
	log15.Info("status", "is", resp.Status)
	var res hoverInfo
	err = json.NewDecoder(resp.Body).Decode(&res)
	if err != nil {
		return "", err
	}
	return res.Data.Repository.Commit.Blob.LSIF.Hover.Markdown.Text, nil
}

func matchOnly(fm *result.FileMatch, r *regexp.Regexp) *MatchContext {
	matches := make([]Match, 0, len(fm.LineMatches))
	for _, l := range fm.LineMatches {
		regexpMatches := r.FindAllStringSubmatchIndex(l.Preview, -1)
		if len(regexpMatches) > 0 {
			m := fromRegexpMatches(regexpMatches, r.SubexpNames(), l.Preview, int(l.LineNumber))
			matches = append(matches, m)
			lsifHover, _ := fetchLSIF(m.Environment["1"].Range.Start.Line, m.Environment["1"].Range.Start.Column, fm.Path)
			log15.Info("cool", "v", lsifHover)
		}
	}
	return &MatchContext{Matches: matches, Path: fm.Path}
}

func (c *MatchOnly) Run(_ context.Context, r result.Match) (Result, error) {
	switch m := r.(type) {
	case *result.FileMatch:
		return matchOnly(m, c.MatchPattern.(*Regexp).Value), nil
	}
	return nil, nil
}
