import * as React from 'react'
import { startCase } from 'lodash'

interface RowProps {
    // A callback that adds a new filter to the SelectedFilterRow when one of the buttons are clicked.
    onAddNewFilter: (filter: DefaultFilterTypes) => void
}

export enum DefaultFilterTypes {
    repo = 'repo',
    file = 'file',
}

export const InteractiveModeAddFilterRow: React.FunctionComponent<RowProps> = ({ onAddNewFilter }) => (
    <div className="interactive-mode-add-filter-row">
        {Object.keys(DefaultFilterTypes).map(filterType => (
            <AddFilterButton key={filterType} onAddNewFilter={onAddNewFilter} type={filterType as DefaultFilterTypes} />
        ))}
    </div>
)

interface ButtonProps {
    type: DefaultFilterTypes
    onAddNewFilter: (filter: DefaultFilterTypes) => void
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
