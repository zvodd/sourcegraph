package query

import (
	"strings"
	"unicode"

	"github.com/inconshreveable/log15"
)

type Fuzzy struct {
	Argument string
}

func (p *Fuzzy) ParseParams(value string) error {
	p.Argument = value
	return nil
}

func (p *Fuzzy) Field() string { return FieldFile }

func (p *Fuzzy) Name() string { return "fuzzy" }

func (p *Fuzzy) Plan(parent Basic) (Plan, error) {
	newParams := MapField(ToNodes(parent.Parameters), "file", func(value string, negated bool) Node {
		if !negated {
			return Parameter{Field: "file", Value: fuzzify(p.Argument)} // not good.
		}
		return Parameter{Field: "file", Value: value}
	})
	return []Basic{parent.MapParameters(toParameters(newParams))}, nil
}

// fuzzify chops up a constant into pieces and inserts .* regexps between these
// pieces and unions the result with the input term. This fuzzifies the constant
// but preserves ordering. We preserve the constant in the regexp so that
// indexers can leverage trigrams. Example:
//
// hello => hello|h.*e.*l.*l.*o
func fuzzify(value string) string {
	chunks3 := strings.Join(chunks(value, 3), ".*")
	chunks2 := strings.Join(chunks(value, 2), ".*")
	chunks1 := fuzzifyf(value)
	// tried having alternator pick longest match but it doesn't. we'd have to process
	// the result set => yuck
	result := "(" + strings.Join([]string{value, chunks3, chunks2, chunks1}, ")|(") + ")"
	log15.Info("f", "fuzzy", result)
	return result
}

// fuzzifies for each char in string
func fuzzifyf(value string) string {
	var result []rune
	pattern := []rune("[^/]*")
	for _, c := range value {
		if unicode.IsSpace(c) {
			result = append(result, '.', '*') // let spaces imply that `/` is allowed
			continue
		}
		result = append(result, c)
		result = append(result, pattern...)
	}
	return string(result)
}

func chunks(s string, chunkSize int) []string {
	if chunkSize >= len(s) {
		return []string{s}
	}
	var chunks []string
	chunk := make([]rune, chunkSize)
	len := 0
	for _, r := range s {
		chunk[len] = r
		len++
		if len == chunkSize {
			chunks = append(chunks, string(chunk))
			len = 0
		}
	}
	if len > 0 {
		chunks = append(chunks, string(chunk[:len]))
	}
	return chunks
}
