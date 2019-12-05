import * as React from 'react'
import InteractiveModeFilterInput from './InteractiveModeFilterInput'
import { QueryState } from '../helpers'
import { FiltersToTypeAndValue } from '../../../../shared/src/search/interactive/util'

interface Props {
    fieldValues: FiltersToTypeAndValue
    navbarQuery: QueryState
    /**  A callback to handle a filter's value being edited. */
    onFilterEdited: (filterKey: string, value: string) => void
    /** A callback to handle a filter being deleted from the selected filter row */
    onFilterDeleted: (filterKey: string) => void
    toggleFilterEditable: (filterKey: string) => void
}

export const InteractiveModeSelectedFiltersRow: React.FunctionComponent<Props> = ({
    fieldValues,
    navbarQuery,
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
                                fieldValues={fieldValues}
                                navbarQuery={navbarQuery}
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
