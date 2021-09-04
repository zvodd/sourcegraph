package search

import (
	"context"
	"sort"
	"strings"

	"html/template"

	"github.com/inconshreveable/log15"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/internal/highlight"
	"github.com/sourcegraph/sourcegraph/internal/api"
	"github.com/sourcegraph/sourcegraph/internal/search/result"
	stream "github.com/sourcegraph/sourcegraph/internal/search/streaming/http"
	"github.com/sourcegraph/sourcegraph/internal/vcs/git"
)

// segmentToRangs converts line match ranges into absolute ranges.
func segmentToRanges(lineNumber int, segments [][2]int32) []stream.Range {
	ranges := make([]stream.Range, 0, len(segments))
	for _, segment := range segments {
		ranges = append(ranges, stream.Range{
			Start: stream.Location{
				Line:   lineNumber,
				Column: int(segment[0]),
			},
			End: stream.Location{
				Line:   lineNumber,
				Column: int(segment[0]) + int(segment[1]),
			},
		})
	}
	return ranges
}

// group is a list of contiguous line matches by line number.
type group []*result.LineMatch

// toMatch converts a group of line matches to absolute match ranges in the file. These ranges
// specify matched content to emphasize specially (e.g., with overlay-highlights) within the file.
func toMatchRanges(group group) []stream.Range {
	matches := make([]stream.Range, 0, len(group))
	for _, line := range group {
		if len(line.OffsetAndLengths) == 0 {
			continue
		}
		matches = append(matches, segmentToRanges(int(line.LineNumber), line.OffsetAndLengths)...)
	}
	return matches
}

// groupLineMatches converts a flat slice of line matches to groups of
// contiguous line matches based on line numbers.
func groupLineMatches(lineMatches []*result.LineMatch) []group {
	var groups []group
	var previousLine *result.LineMatch
	var currentGroup group
	for _, line := range lineMatches {
		if previousLine == nil {
			previousLine = line
		}
		if len(currentGroup) == 0 {
			currentGroup = append(currentGroup, line)
			// Invariant: previousLine is set to first line match.
			continue
		}
		if line.LineNumber-1 == previousLine.LineNumber {
			currentGroup = append(currentGroup, line)
			previousLine = line
			continue
		}
		groups = append(groups, currentGroup)
		currentGroup = group{line}
		previousLine = line
	}
	if len(currentGroup) > 0 {
		groups = append(groups, currentGroup)
	}
	sort.Slice(groups, func(i, j int) bool {
		// groups may be out of order, sort them. Invariant:
		// indexing is safe because if groups is non-nil, then there
		// exists at least one group with one element.
		return groups[i][0].LineNumber < groups[j][0].LineNumber
	})
	return groups
}

// mergeGroups merges groups of line matches if adding context lines causes
// lines to be contiguous.
func mergeGroups(groups []group, contextLines int) []group {
	var merged []group
	var previousGroup group
	var previousEnd int
	for _, group := range groups {
		if previousGroup == nil {
			previousGroup = group
			previousEnd = int(group[0].LineNumber) + len(group) - 1
			continue
		}
		currentStart := int(group[0].LineNumber)
		overlap := previousEnd - currentStart + (2 * contextLines) + 1 /* +1 for bordering lines */
		log15.Info("x", "prev:", previousEnd, "curr", currentStart)
		if overlap >= 0 {
			emptySpan := make([]*result.LineMatch, 0, overlap)
			for i := 0; i < (overlap-1)/2; i++ {
				emptySpan = append(emptySpan, &result.LineMatch{})
			}
			previousGroup = append(previousGroup, emptySpan...)
			previousGroup = append(previousGroup, group...)
			previousEnd = int(group[0].LineNumber) + len(group) - 1
			continue
		}
		merged = append(merged, previousGroup)
		previousGroup = group
		previousEnd = int(group[0].LineNumber) + len(group) - 1
	}
	merged = append(merged, previousGroup)
	return merged
}

func fetchContent(ctx context.Context, repo api.RepoName, commit api.CommitID, path string) (content []byte, err error) {
	content, err = git.ReadFile(ctx, repo, commit, path, 0)
	if err != nil {
		return nil, err
	}
	return content, nil
}

// DecorateFileHTML returns decorated HTML rendering of file content. If
// successful and within bounds of timeout and line size, it returns HTML marked
// up with highlight classes. In other cases, it returns plaintext HTML.
func DecorateFileHTML(ctx context.Context, repo api.RepoName, commit api.CommitID, path string) (template.HTML, error) {
	content, err := fetchContent(ctx, repo, commit, path)
	if err != nil {
		return "", err
	}
	result, aborted, err := highlight.Code(ctx, highlight.Params{
		Content:            content,
		Filepath:           path,
		DisableTimeout:     false, // use default 3 second timeout
		HighlightLongLines: false, // use default 2000 character line count
		Metadata: highlight.Metadata{ // for logging
			RepoName: string(repo),
			Revision: string(commit),
		},
	})
	if err != nil {
		return "", err
	}
	if aborted {
		// code decoration aborted, returns plaintext HTML.
		return result, nil
	}

	return result, nil
}

// DecorateFileHunksHTML returns decorated file hunks given a file match.
func DecorateFileHunksHTML(ctx context.Context, contextLines int, fm *result.FileMatch) []stream.DecoratedHunk {
	html, err := DecorateFileHTML(ctx, fm.Repo.Name, fm.CommitID, fm.Path)
	if err != nil {
		log15.Warn("stream result decoration could not highlight file", "error", err)
		return nil
	}
	lines, err := highlight.SplitHighlightedLines(html, true)
	if err != nil {
		log15.Warn("stream result decoration could not split highlighted file", "error", err)
		return nil
	}

	// a closure over lines that allows to splice line ranges.
	spliceRows := func(lineStart, lineEnd int) []string {
		if lineStart < 0 {
			lineStart = 0
		}
		if lineEnd > len(lines) {
			lineEnd = len(lines)
		}
		if lineStart > lineEnd {
			lineStart = 0
			lineEnd = 0
		}
		tableRows := make([]string, 0, lineEnd-lineStart)
		for _, line := range lines[lineStart:lineEnd] {
			tableRows = append(tableRows, string(line))
		}
		return tableRows
	}

	groups := groupLineMatches(fm.LineMatches)
	if contextLines > 0 {
		groups = mergeGroups(groups, contextLines)
	}
	hunks := make([]stream.DecoratedHunk, 0, len(groups))
	for _, group := range groups {
		rows := spliceRows(int(group[0].LineNumber), int(group[0].LineNumber)+len(group))
		hunks = append(hunks, stream.DecoratedHunk{
			Content:   stream.DecoratedContent{HTML: strings.Join(rows, "\n")},
			LineStart: int(group[0].LineNumber),
			LineCount: len(group),
			Matches:   toMatchRanges(group),
		})
	}
	return hunks
}
