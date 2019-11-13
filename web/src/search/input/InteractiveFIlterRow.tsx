import * as React from 'react'
import AddFilterButton from './AddFilterButton'
import { SuggestionTypes } from './Suggestion'

interface Props {
    onSelectFilters: (field: SuggestionTypes) => void
}
export const InteractiveFilterRow: React.FunctionComponent<Props> = (props: Props) => (
    <div>
        {Object.values([SuggestionTypes['repo']]).map(filterType => (
            <AddFilterButton onClicked={props.onSelectFilters} filterType={filterType} key={filterType} />
        ))}
    </div>
)
