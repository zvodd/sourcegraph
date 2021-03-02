package search

import "strings"

func ParseVisibility(s string) RepoVisibility {
	switch strings.ToLower(s) {
	case "private":
		return Private
	case "public":
		return Public
	default:
		return UniversalVisibility
	}
}
