package graphqlbackend

import (
	"github.com/sourcegraph/sourcegraph/internal/search"
)

type searchAlertResolver struct {
	alert *search.Alert
}

func NewSearchAlertResolver(alert *search.Alert) *searchAlertResolver {
	if alert == nil {
		return nil
	}
	return &searchAlertResolver{alert: alert}
}

func (a searchAlertResolver) Title() string { return a.alert.Title }

func (a searchAlertResolver) Description() *string {
	if a.alert.Description == "" {
		return nil
	}
	return &a.alert.Description
}

func (a searchAlertResolver) PrometheusType() string {
	return a.alert.PrometheusType
}

func (a searchAlertResolver) ProposedQueries() *[]*searchQueryDescription {
	if len(a.alert.ProposedQueries) == 0 {
		return nil
	}
	var proposedQueries []*searchQueryDescription
	for _, q := range a.alert.ProposedQueries {
		proposedQueries = append(proposedQueries, &searchQueryDescription{q})
	}
	return &proposedQueries
}

func alertToSearchResults(alert *search.Alert) *SearchResults {
	return &SearchResults{Alert: alert}
}
