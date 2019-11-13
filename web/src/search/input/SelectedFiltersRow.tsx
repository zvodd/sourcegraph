import * as H from 'history'
import * as React from 'react'
import InteractiveFilterInputs from './InteractiveFiltersInputs'
import { SuggestionTypes } from './Suggestion'

/**
 * SelectedFiltersRow displays the filters currently selected, and filters that the user has selected to add
 * but has yet to input a value for.
 */

// Render selected filters
interface Props {
    selectedFilters: SuggestionTypes[]
    onInteractiveQueryChange: (query: string) => void
    history: H.History
}

export const SelectedFiltersRow: React.FunctionComponent<Props> = (props: Props) => (
    <div>
        {props.selectedFilters.map(filter => (
            <InteractiveFilterInputs
                history={props.history}
                filter={filter}
                key={filter}
                onInteractiveQueryChange={props.onInteractiveQueryChange}
            />
        ))}
    </div>
)
