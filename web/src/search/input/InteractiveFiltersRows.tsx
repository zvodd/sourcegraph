import * as H from 'history'
import * as React from 'react'
import { InteractiveFilterRow } from './InteractiveFIlterRow'
import { SelectedFiltersRow } from './SelectedFiltersRow'
import { SuggestionTypes } from './Suggestion'
import { ThemeProps } from '../../../../shared/src/theme'
/**
 * InteractiveFiltersRow displays buttons to add filters to the query in interactive mode.
 *
 */

interface State {
    selectedFilters: SuggestionTypes[]
}

interface Props extends ThemeProps {
    onRepoFilterQueryChange: (query: string) => void
    history: H.History
}

export default class InteractiveFiltersRows extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)

        this.state = {
            selectedFilters: [],
        }
    }

    private updateSelectedFilters = (field: SuggestionTypes): void => {
        this.setState(state => ({
            selectedFilters: [...state.selectedFilters, field],
        }))
    }

    public render(): JSX.Element | null {
        return (
            <div>
                <SelectedFiltersRow
                    history={this.props.history}
                    selectedFilters={this.state.selectedFilters}
                    onRepoFilterQueryChange={this.props.onRepoFilterQueryChange}
                />
                <InteractiveFilterRow onSelectFilters={this.updateSelectedFilters} />
            </div>
        )
    }
}
