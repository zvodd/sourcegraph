import * as React from 'react'
import * as H from 'history'
import { QueryState, submitSearch } from '../helpers'
import * as GQL from '../../../../shared/src/graphql/schema'
import { Form } from '../../components/Form'
import { QueryInput } from './QueryInput'
import { InteractiveModeAddFilterRow, DefaultFilterTypes } from './InteractiveModeAddFilterRow'
import { InteractiveModeSelectedFiltersRow } from './InteractiveModeSelectedFiltersRow'
import { SearchButton } from './SearchButton'
import { Subscription, Subject } from 'rxjs'
import { ThemeProps } from '../../../../shared/src/theme'
import { Link } from '../../../../shared/src/components/Link'
import { NavLinks } from '../../nav/NavLinks'
import { showDotComMarketing } from '../../util/features'
import { SettingsCascadeProps } from '../../../../shared/src/settings/settings'
import { KeyboardShortcutsProps } from '../../keyboardShortcuts/keyboardShortcuts'
import { ExtensionsControllerProps } from '../../../../shared/src/extensions/controller'
import { PlatformContextProps } from '../../../../shared/src/platform/context'
import { ThemePreferenceProps } from '../theme'
import { EventLoggerProps } from '../../tracking/eventLogger'
import { ActivationProps } from '../../../../shared/src/components/activation/Activation'
import { generateFieldsQuery } from './helpers'
import { FiltersToTypeAndValue } from '../../../../shared/src/search/interactive/util'
import { SuggestionTypes, SuggestionTypeKeys } from '../../../../shared/src/search/suggestions/util'

interface InteractiveModeProps
    extends SettingsCascadeProps,
        KeyboardShortcutsProps,
        ExtensionsControllerProps<'executeCommand' | 'services'>,
        PlatformContextProps<'forceUpdateTooltip'>,
        ThemeProps,
        ThemePreferenceProps,
        EventLoggerProps,
        ActivationProps {
    location: H.Location
    history: H.History
    navbarSearchState: QueryState
    onNavbarQueryChange: (userQuery: QueryState) => void
    patternType: GQL.SearchPatternType
    togglePatternType: () => void

    // For NavLinks
    authRequired?: boolean
    authenticatedUser: GQL.IUser | null
    showDotComMarketing: boolean
    showCampaigns: boolean
    isSourcegraphDotCom: boolean
}

interface InteractiveInputState {
    // This is the source of truth for the selected filters. The key is a unique key to match
    // the particular selected filter with its value. This is important to be unique because we
    // will need to edit and delete selected filters. The type is the raw type of filter, as listed
    // in SuggestionTypes. The value is the current value of that particular filter.
    fieldValues: FiltersToTypeAndValue
}

// INTERACTIVE_SEARCH_TODO: This component is being built for the navbar use case.
// Need to add a mode for search page.
export default class InteractiveModeInput extends React.Component<InteractiveModeProps, InteractiveInputState> {
    private numFieldValuesAdded = 0
    private subscriptions = new Subscription()
    private componentUpdates = new Subject<InteractiveModeProps>()

    constructor(props: InteractiveModeProps) {
        super(props)

        this.state = {
            fieldValues: {},
        }
        this.subscriptions.add(
            this.componentUpdates.subscribe(props => {
                const searchParams = new URLSearchParams(props.location.search)
                const fieldValues: FiltersToTypeAndValue = {}
                for (const t of SuggestionTypeKeys) {
                    const itemsOfType = searchParams.getAll(t)
                    itemsOfType.map((item, i) => {
                        fieldValues[`${t} ${i}`] = { type: t, value: item, editable: false }
                    })
                }
                this.numFieldValuesAdded = Object.keys(fieldValues).length
                this.setState({ fieldValues })
            })
        )
    }

    public componentDidMount(): void {
        this.componentUpdates.next(this.props)
    }

    public componentDidUnmount(): void {
        this.subscriptions.unsubscribe()
    }

    /**
     * Adds a new filter to the fieldValues state field.
     * We use the filter name and the number of values added as the key.
     * Keys must begin with the filter name, as defined in `SuggestionTypes`.
     * We use this to identify filter values when building
     * the search URL in {@link interactiveBuildSearchURLQuery}.
     */
    private addNewFilter = (filterType: SuggestionTypes): void => {
        const filterKey = `${filterType} ${this.numFieldValuesAdded}`
        this.numFieldValuesAdded++
        this.setState(state => ({
            fieldValues: { ...state.fieldValues, [filterKey]: { type: filterType, value: '', editable: true } },
        }))
    }

    private onFilterEdited = (filterKey: string, value: string): void => {
        this.setState(state => ({
            fieldValues: {
                ...state.fieldValues,
                [filterKey]: {
                    ...state.fieldValues[filterKey],
                    value,
                    editable: state.fieldValues[filterKey].editable,
                },
            },
        }))
    }

    private onFilterDeleted = (filterKey: string): void => {
        this.setState(state => {
            const newState = state.fieldValues
            delete newState[filterKey]
            return { fieldValues: newState }
        })
    }

    private toggleFilterEditable = (filterKey: string): void => {
        this.setState(state => ({
            fieldValues: {
                ...state.fieldValues,
                [filterKey]: { ...state.fieldValues[filterKey], editable: !state.fieldValues[filterKey].editable },
            },
        }))
    }

    private onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault()

        submitSearch(
            this.props.history,
            this.props.navbarSearchState.query,
            'nav',
            this.props.patternType,
            undefined,
            true,
            this.state.fieldValues
        )
    }

    public render(): JSX.Element | null {
        let logoSrc = '/.assets/img/sourcegraph-mark.svg'
        let logoLinkClassName = 'global-navbar__logo-link global-navbar__logo-animated'

        const { branding } = window.context
        if (branding) {
            if (this.props.isLightTheme) {
                if (branding.light && branding.light.symbol) {
                    logoSrc = branding.light.symbol
                }
            } else if (branding.dark && branding.dark.symbol) {
                logoSrc = branding.dark.symbol
            }
            if (branding.disableSymbolSpin) {
                logoLinkClassName = 'global-navbar__logo-link'
            }
        }

        const logo = <img className="global-navbar__logo" src={logoSrc} />

        return (
            <div className="interactive-mode-input">
                <div className="interactive-mode-input__top-nav">
                    {this.props.authRequired ? (
                        <div className={logoLinkClassName}>{logo}</div>
                    ) : (
                        <Link to="/search" className={logoLinkClassName}>
                            {logo}
                        </Link>
                    )}
                    <div className="global-navbar__search-box-container d-none d-sm-flex">
                        <Form onSubmit={this.onSubmit}>
                            <div className="d-flex align-items-start">
                                <QueryInput
                                    location={this.props.location}
                                    history={this.props.history}
                                    value={this.props.navbarSearchState}
                                    hasGlobalQueryBehavior={true}
                                    onChange={this.props.onNavbarQueryChange}
                                    patternType={this.props.patternType}
                                    togglePatternType={this.props.togglePatternType}
                                />
                                <SearchButton />
                            </div>
                        </Form>
                    </div>
                    {!this.props.authRequired && <NavLinks {...this.props} showDotComMarketing={showDotComMarketing} />}
                </div>
                <div>
                    <InteractiveModeSelectedFiltersRow
                        fieldValues={this.state.fieldValues}
                        navbarQuery={this.props.navbarSearchState}
                        onFilterEdited={this.onFilterEdited}
                        onFilterDeleted={this.onFilterDeleted}
                        toggleFilterEditable={this.toggleFilterEditable}
                    />
                    <InteractiveModeAddFilterRow onAddNewFilter={this.addNewFilter} />
                </div>
            </div>
        )
    }
}
