import * as React from 'react'
import { startCase } from 'lodash'
import { SuggestionTypes } from '../../../../../shared/src/search/suggestions/util'

interface RowProps {
    homepage: boolean
    // A callback that adds a new filter to the SelectedFilterRow when one of the buttons are clicked.
    onAddNewFilter: (filter: SuggestionTypes) => void
}

export enum DefaultFilterTypes {
    repo = 'repo',
    file = 'file',
}

export const InteractiveModeAddFilterRow: React.FunctionComponent<RowProps> = ({ homepage, onAddNewFilter }) => (
    <div className={`interactive-mode-add-filter-row ${homepage ? 'interactive-mode-add-filter-row--homepage' : ''}`}>
        {Object.keys(DefaultFilterTypes).map(filterType => (
            <AddFilterButton key={filterType} onAddNewFilter={onAddNewFilter} type={filterType as SuggestionTypes} />
        ))}
    </div>
)

interface ButtonProps {
    type: SuggestionTypes
    onAddNewFilter: (filter: SuggestionTypes) => void
}

class AddFilterButton extends React.Component<ButtonProps> {
    private onAddNewFilter = (): void => {
        this.props.onAddNewFilter(this.props.type)
    }

    public render(): JSX.Element | null {
        return (
            <button
                type="button"
                className="interactive-mode-add-filter-row__button btn btn-outline-primary"
                onClick={this.onAddNewFilter}
            >
                + {startCase(this.props.type)} filter
            </button>
        )
    }
}
