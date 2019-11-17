import * as React from 'react'
import * as H from 'history'
import { QueryState } from '../helpers'
import { SearchPatternType } from '../../../../shared/src/graphql/schema'
import { Form } from '../../components/Form'
import { QueryInput } from './QueryInput'
import { SearchNavbarItem } from './SearchNavbarItem'
import InteractiveModeAddFilterRow from './InteractiveModeAddFilterRow'

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
    fieldValues: { [key: string]: { type: string; value: string } }
}

// INTERACTIVE_SEARCH_TODO: This component is being built for the navbar use case.
// Need to add a mode for search page.
export default class InteractiveModeInput extends React.Component<InteractiveModeProps, InteractiveInputState> {
    constructor(props: InteractiveModeProps) {
        super(props)
        this.state = {
            finalInteractiveQuery: '',
            fieldValues: {},
        }
    }

    public componentDidMount(): void {}

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
                <InteractiveModeAddFilterRow
                    onAddNewFilter={() => {
                        console.log('add filter')
                    }}
                />
            </Form>
        )
    }
}
