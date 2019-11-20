import * as React from 'react'
import InteractiveModeFilterChip from './InteractiveModeFilterChip'
import { FiltersToTypeAndValue } from './InteractiveModeInput'

interface Props {
    fieldValues: FiltersToTypeAndValue
    /**  A callback to handle a filter's value being edited. */
    onFilterEdited: (filterKey: string, value: string) => void
    /** A callback to handle a filter being deleted from the selected filter row */
    onFilterDeleted: (filterKey: string) => void
    toggleFilterEditable: (filterKey: string) => void
}

export default class InteractiveModeSelectedFiltersRow extends React.PureComponent<Props> {
    public render(): JSX.Element | null {
        const fieldValueKeys = Array.from(Object.keys(this.props.fieldValues))
        return (
            <>
                {fieldValueKeys.length > 0 && (
                    <div className="search-results-filter-bars__row">
                        {this.props.fieldValues &&
                            fieldValueKeys.map(field => (
                                /** Replace this with new input component, which can be an input when editable, and button when non-editable */
                                <InteractiveModeFilterChip
                                    key={field}
                                    mapKey={field}
                                    filterType={this.props.fieldValues[field].type}
                                    value={this.props.fieldValues[field].value}
                                    editable={this.props.fieldValues[field].editable}
                                    onFilterDeleted={this.props.onFilterDeleted}
                                    onFilterEdited={this.props.onFilterEdited}
                                    toggleFilterEditable={this.props.toggleFilterEditable}
                                />
                            ))}
                    </div>
                )}
            </>
        )
    }
}
