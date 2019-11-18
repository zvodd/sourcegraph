import * as React from 'react'
import * as H from 'history'
import { QueryState } from '../helpers'
import { SearchPatternType } from '../../../../shared/src/graphql/schema'
import { Form } from '../../components/Form'
import { QueryInput } from './QueryInput'
import { SearchNavbarItem } from './SearchNavbarItem'
import InteractiveModeAddFilterRow, { DefaultFilterTypes } from './InteractiveModeAddFilterRow'
import InteractiveModeSelectedFiltersRow from './InteractiveModeSelectedFiltersRow'

interface InteractiveModeProps {
    location: H.Location
    history: H.History
    navbarSearchState: QueryState
    onNavbarQueryChange: (userQuery: QueryState) => void
    patternType: SearchPatternType
    togglePatternType: () => void
}

interface InteractiveInputState {
    // This query compiles the raw query + individual selected filter
    // queries so we can build the URL.
    finalInteractiveQuery: string
    // This is the source of truth for the selected filters. The key is a unique key to match
    // the particular selected filter with its value. This is important to be unique because we
    // will need to edit and delete selected filters. The type is the raw type of filter, as listed
    // in SuggestionTypes. The value is the current value of that particular filter.
    fieldValues: { [key: string]: { type: string; value: string } }
}

// INTERACTIVE_SEARCH_TODO: This component is being built for the navbar use case.
// Need to add a mode for search page.
export default class InteractiveModeInput extends React.Component<InteractiveModeProps, InteractiveInputState> {
    private numFieldValuesAdded = 0

    constructor(props: InteractiveModeProps) {
        super(props)
        this.state = {
            finalInteractiveQuery: '',
            fieldValues: {},
        }
    }

    public componentDidMount(): void {}

    private addNewFilter = (filterType: DefaultFilterTypes): void => {
        const filterKey = `${filterType} ${this.numFieldValuesAdded}`
        this.numFieldValuesAdded++
        this.setState(state => ({
            fieldValues: { ...state.fieldValues, [filterKey]: { type: filterType, value: '' } },
        }))
    }

    private onFilterEdited = (filterKey: string, value: string): void => {
        this.setState(state => ({
            fieldValues: { ...state.fieldValues, [filterKey]: { ...state.fieldValues[filterKey], value } },
        }))
    }

    public render(): JSX.Element | null {
        return (
            <Form
                onSubmit={() => {
                    console.log('submitted')
                }}
            >
                <QueryInput
                    location={this.props.location}
                    history={this.props.history}
                    value={this.props.navbarSearchState}
                    hasGlobalQueryBehavior={true}
                    onChange={this.props.onNavbarQueryChange}
                    patternType={this.props.patternType}
                    togglePatternType={this.props.togglePatternType}
                />
                <InteractiveModeSelectedFiltersRow
                    fieldValues={this.state.fieldValues}
                    onFilterEdited={this.onFilterEdited}
                    onFilterDeleted={() => {
                        console.log('deleted')
                    }}
                />
                <InteractiveModeAddFilterRow onAddNewFilter={this.addNewFilter} />
            </Form>
        )
    }
}
