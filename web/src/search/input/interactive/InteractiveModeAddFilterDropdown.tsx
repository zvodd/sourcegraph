import * as React from 'react'
import { SuggestionTypes } from '../../../../../shared/src/search/suggestions/util'
import { startCase } from 'lodash'

interface RowProps {
    // A callback that adds a new filter to the SelectedFilterRow when one of the buttons are clicked.
    onAddNewFilter: (filter: SuggestionTypes) => void
}

export enum DefaultFilterTypes {
    repo = 'repo',
    file = 'file',
}

export const InteractiveModeAddFilterDropdown: React.FunctionComponent<RowProps> = ({ onAddNewFilter }) => (
    <div className="interactive-mode-add-filter-dropdown">
        <AddFilterDropdown onAddNewFilter={onAddNewFilter} />
    </div>
)

interface ButtonProps {
    onAddNewFilter: (filter: SuggestionTypes) => void
}

interface AddFilterDropdownState {
    value: string
}

class AddFilterDropdown extends React.Component<ButtonProps, AddFilterDropdownState> {
    constructor(props: ButtonProps) {
        super(props)
        this.state = {
            value: 'default',
        }
    }

    private onAddNewFilter = (event: React.ChangeEvent<HTMLSelectElement>): void => {
        this.props.onAddNewFilter(event.target.value as SuggestionTypes)
        this.setState({ value: 'default' })
    }

    public render(): JSX.Element | null {
        return (
            <select className="form-control w-25" onChange={this.onAddNewFilter} value={this.state.value}>
                <option value="default" disabled={true}>
                    Add filter…
                </option>
                {Object.keys(DefaultFilterTypes).map(filter => (
                    <option value={filter} key={filter}>
                        {startCase(filter)}
                    </option>
                ))}
            </select>
        )
    }
}
