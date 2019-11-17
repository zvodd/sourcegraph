import * as React from 'react'

interface RowProps {
    onAddNewFilter: () => void
}

enum DefaultFilterTypes {
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
    onAddNewFilter: () => void
}

const AddFilterButton: React.FunctionComponent<ButtonProps> = ({ type, onAddNewFilter }) => (
    <button type="button" onClick={onAddNewFilter}>
        {type}
    </button>
)
