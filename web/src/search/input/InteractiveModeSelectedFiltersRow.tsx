import * as React from 'react'
import InteractiveModeFilterChip from './InteractiveModeFilterChip'

interface Props {
    fieldValues: { [key: string]: { type: string; value: string } }
    /**  A callback to handle a filter's value being edited. */
    onFilterEdited: (filterKey: string, value: string) => void
    /** A callback to handle a filter being deleted from the selected filter row */
    onFilterDeleted: () => void
}

export default class InteractiveModeSelectedFiltersRow extends React.PureComponent<Props> {
    constructor(props: Props) {
        super(props)
    }

    public render(): JSX.Element | null {
        return (
            <div className="search-results-filter-bars__row">
                {this.props.fieldValues &&
                    Array.from(Object.keys(this.props.fieldValues)).map(field => (
                        /** Replace this with new input component, which can be an input when editable, and button when non-editable */
                        // <button key={field} type="button">
                        //     {field}
                        // </button>
                        <InteractiveModeFilterChip
                            key={field}
                            mapKey={field}
                            filterType={this.props.fieldValues[field].type}
                            value={this.props.fieldValues[field].value}
                            onFilterDeleted={this.props.onFilterDeleted}
                            onFilterEdited={this.props.onFilterEdited}
                        />
                    ))}
            </div>
        )
    }
}
