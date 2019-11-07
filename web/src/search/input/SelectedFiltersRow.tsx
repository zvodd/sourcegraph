import * as React from 'react'
import { FieldOptions } from './AddFilterDropdown'
import InteractiveFilterInputs from './InteractiveFiltersInputs'
/**
 * SelectedFiltersRow displays the filters currently selected, and filters that the user has selected to add
 * but has yet to input a value for.
 */

// Render selected filters
interface Props {
    selectedFilters: FieldOptions[]
    onInteractiveQueryChange: (query: string) => void
}

export const SelectedFiltersRow: React.FunctionComponent<Props> = (props: Props) => (
    <div>
        {props.selectedFilters.map(filter => (
            <InteractiveFilterInputs
                filter={filter}
                key={filter}
                onInteractiveQueryChange={props.onInteractiveQueryChange}
            />
        ))}
    </div>
)
