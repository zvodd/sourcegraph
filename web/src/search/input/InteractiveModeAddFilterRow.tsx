import * as React from 'react'

interface RowProps {
    // A callback that adds a new filter to the SelectedFilterRow when one of the buttons are clicked.
    onAddNewFilter: (filter: DefaultFilterTypes) => void
}

export enum DefaultFilterTypes {
    repo = 'repo',
}

export default class InteractiveModeAddFilterRow extends React.PureComponent<RowProps> {
    public render(): JSX.Element | null {
        return (
            <>
                {Object.keys(DefaultFilterTypes).map(filterType => (
                    <AddFilterButton key={filterType} {...this.props} type={filterType as DefaultFilterTypes} />
                ))}
            </>
        )
    }
}

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
            <button type="button" onClick={this.onAddNewFilter}>
                {this.props.type}
            </button>
        )
    }
}
