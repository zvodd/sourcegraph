import * as React from 'react'
import InteractiveModeFilterInput from './InteractiveModeFilterInput'
import { FiltersToTypeAndValue } from './InteractiveModeInput'

interface Props {
    fieldValues: FiltersToTypeAndValue
    /**  A callback to handle a filter's value being edited. */
    onFilterEdited: (filterKey: string, value: string) => void
    /** A callback to handle a filter being deleted from the selected filter row */
    onFilterDeleted: (filterKey: string) => void
    toggleFilterEditable: (filterKey: string) => void
}

export const InteractiveModeSelectedFiltersRow: React.FunctionComponent<Props> = ({
    fieldValues,
    onFilterEdited,
    onFilterDeleted,
    toggleFilterEditable,
}) => {
    const fieldValueKeys = Array.from(Object.keys(fieldValues))
    return (
        <>
            {fieldValueKeys.length > 0 && (
                <div className="interactive-mode-selected-filters-row">
                    {fieldValues &&
                        fieldValueKeys.map(field => (
                            /** Replace this with new input component, which can be an input when editable, and button when non-editable */
                            <InteractiveModeFilterInput
                                key={field}
                                mapKey={field}
                                filterType={fieldValues[field].type}
                                value={fieldValues[field].value}
                                editable={fieldValues[field].editable}
                                onFilterDeleted={onFilterDeleted}
                                onFilterEdited={onFilterEdited}
                                toggleFilterEditable={toggleFilterEditable}
                            />
                        ))}
                </div>
            )}
        </>
    )
}
