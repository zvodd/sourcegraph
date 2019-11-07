import * as React from 'react'
import { FieldOptions } from './AddFilterDropdown'
import AddFilterButton from './AddFilterButton'

interface Props {
    onSelectFilters: (field: FieldOptions) => void
}
export const InteractiveFilterRow: React.FunctionComponent<Props> = (props: Props) => (
    <div>
        {Object.values(FieldOptions).map(option => (
            <AddFilterButton onClicked={props.onSelectFilters} filterType={option} key={option} />
        ))}
    </div>
)
