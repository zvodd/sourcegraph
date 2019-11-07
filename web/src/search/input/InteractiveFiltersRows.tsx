import * as React from 'react'
import { InteractiveFilterRow } from './InteractiveFIlterRow'
import { SelectedFiltersRow } from './SelectedFiltersRow'
import { FieldOptions } from './AddFilterDropdown'
import { ThemeProps } from '../../theme'
/**
 * InteractiveFiltersRow displays buttons to add filters to the query in interactive mode.
 *
 */

interface State {
    selectedFilters: FieldOptions[]
}

interface Props extends ThemeProps {
    onInteractiveQueryChange: (query: string) => void
}

export default class InteractiveFiltersRows extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)

        this.state = {
            selectedFilters: [],
        }
    }

    private updateSelectedFilters = (field: FieldOptions) => {
        this.setState(state => ({
            selectedFilters: [...state.selectedFilters, field],
        }))
    }

    public render(): JSX.Element | null {
        return (
            <div>
                <SelectedFiltersRow
                    selectedFilters={this.state.selectedFilters}
                    onInteractiveQueryChange={this.props.onInteractiveQueryChange}
                />
                <InteractiveFilterRow onSelectFilters={this.updateSelectedFilters} />
            </div>
        )
    }
}
