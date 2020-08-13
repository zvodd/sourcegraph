import * as H from 'history'
import * as GQL from '../../../../shared/src/graphql/schema'
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { InteractiveModeInput } from './interactive/InteractiveModeInput'
import { Form } from 'reactstrap'
import { SearchModeToggle } from './interactive/SearchModeToggle'
import { VersionContextDropdown } from '../../nav/VersionContextDropdown'
import { LazyMonacoQueryInput } from './LazyMonacoQueryInput'
import { QueryInput } from './QueryInput'
import { KEYBOARD_SHORTCUT_FOCUS_SEARCHBAR, KeyboardShortcutsProps } from '../../keyboardShortcuts/keyboardShortcuts'
import { SearchButton } from './SearchButton'
import { Link } from '../../../../shared/src/components/Link'
import { SearchScopes } from './SearchScopes'
import { QuickLinks } from '../QuickLinks'
import { Notices } from '../../global/Notices'
import { SettingsCascadeProps, isSettingsValid } from '../../../../shared/src/settings/settings'
import { Settings } from '../../schema/settings.schema'
import { ThemeProps } from '../../../../shared/src/theme'
import { ThemePreferenceProps } from '../../theme'
import { ActivationProps } from '../../../../shared/src/components/activation/Activation'
import {
    PatternTypeProps,
    CaseSensitivityProps,
    InteractiveSearchProps,
    SmartSearchFieldProps,
    CopyQueryButtonProps,
    OnboardingTourProps,
} from '..'
import { EventLoggerProps } from '../../tracking/eventLogger'
import { ExtensionsControllerProps } from '../../../../shared/src/extensions/controller'
import { PlatformContextProps } from '../../../../shared/src/platform/context'
import { VersionContextProps } from '../../../../shared/src/search/util'
import { VersionContext } from '../../schema/site.schema'
import { submitSearch, SubmitSearchParams } from '../helpers'
import { searchOnboardingTour, generateStep, generateStep1, stepCallbacks } from './SearchOnboardingTour'
import { useLocalStorage } from '../../util/useLocalStorage'

interface Props
    extends SettingsCascadeProps<Settings>,
        ThemeProps,
        ThemePreferenceProps,
        ActivationProps,
        PatternTypeProps,
        CaseSensitivityProps,
        KeyboardShortcutsProps,
        EventLoggerProps,
        ExtensionsControllerProps<'executeCommand' | 'services'>,
        PlatformContextProps<'forceUpdateTooltip' | 'settings'>,
        InteractiveSearchProps,
        SmartSearchFieldProps,
        CopyQueryButtonProps,
        Pick<SubmitSearchParams, 'source'>,
        VersionContextProps,
        OnboardingTourProps {
    authenticatedUser: GQL.IUser | null
    location: H.Location
    history: H.History
    isSourcegraphDotCom: boolean
    setVersionContext: (versionContext: string | undefined) => void
    availableVersionContexts: VersionContext[] | undefined
    /** Whether globbing is enabled for filters. */
    globbing: boolean
    /** Whether to display the interactive mode input centered on the page, as on the search homepage. */
    interactiveModeHomepageMode?: boolean
    /** A query fragment to appear at the beginning of the input. */
    queryPrefix?: string
    autoFocus?: boolean
    endFirstStep?: () => void
    endLangInputStep?: (query: string) => void

    // For NavLinks
    authRequired?: boolean
    showCampaigns: boolean
}

export const SearchPageInput: React.FunctionComponent<Props> = (props: Props) => {
    /** The query cursor position and value entered by the user in the query input */
    const [userQueryState, setUserQueryState] = useState({
        query: props.queryPrefix ? props.queryPrefix : '',
        cursorPosition: props.queryPrefix ? props.queryPrefix.length : 0,
    })

    useEffect(() => {
        setUserQueryState({ query: props.queryPrefix || '', cursorPosition: props.queryPrefix?.length || 0 })
    }, [props.queryPrefix])

    const [hasSeenTour, setHasSeenTour] = useLocalStorage('has-seen-onboarding-tour', false)
    const [hasCancelledTour, setHasCancelledTour] = useLocalStorage('has-cancelled-onboarding-tour', false)

    useEffect(() => {
        searchOnboardingTour.addSteps([
            {
                id: 'step-1',
                text: generateStep1(
                    () => {
                        setUserQueryState({ query: 'lang:', cursorPosition: 'lang:'.length })
                        searchOnboardingTour.show('step-2-lang')
                    },
                    () => {
                        setUserQueryState({ query: 'repo:', cursorPosition: 'repo:'.length })
                        searchOnboardingTour.show('step-2-repo')
                    }
                ),
                attachTo: {
                    element: '.search-page__input-container',
                    on: 'bottom',
                },
            },
            {
                id: 'step-2-lang',
                text: generateStep(2, '<h4>Type to filter the language autocomplete</h4>', () =>
                    setHasCancelledTour(true)
                ),
                attachTo: {
                    element: '.search-page__input-container',
                    on: 'top',
                },
            },
            {
                id: 'step-2-repo',
                text: generateStep(
                    2,
                    "Type the name of a repository you've used recently to filter the autocomplete list",
                    () => setHasCancelledTour(true)
                ),
                attachTo: {
                    element: '.search-page__input-container',
                    on: 'top',
                },
            },
            // This step requires examples based on the language selected by the user,
            // so the text is generated when the previous step ends.
            {
                id: 'step-3',
                attachTo: {
                    element: '.search-page__input-container',
                    on: 'bottom',
                },
            },
            {
                id: 'step-4',
                text: generateStep(4, '<h4>Review the search reference</h4>', () => {}),
                attachTo: {
                    element: '.search-help-dropdown-button',
                    on: 'bottom',
                },
                advanceOn: { selector: '.search-help-dropdown-button', event: 'click' },
            },
            {
                id: 'final-step',
                text: generateStep(5, "<h4>Use the 'return' key or the search button to run your search</h4>", () =>
                    setHasCancelledTour(true)
                ),
                attachTo: {
                    element: '.search-button',
                    on: 'top',
                },
                advanceOn: { selector: '.search-button__btn', event: 'click' },
            },
        ])
    }, [setHasCancelledTour])

    useEffect(() => {
        if (props.showOnboardingTour && !hasCancelledTour && !hasSeenTour) {
            searchOnboardingTour.start()
        }
        return
    }, [props.showOnboardingTour, hasCancelledTour, hasSeenTour])

    useEffect(
        () => () => {
            // End tour on unmount.
            searchOnboardingTour.complete()
        },
        []
    )

    useMemo(() => {
        searchOnboardingTour.on('complete', () => {
            setHasSeenTour(true)
        })
        searchOnboardingTour.on('cancel', () => {
            setHasCancelledTour(true)
        })
    }, [setHasSeenTour, setHasCancelledTour])

    const quickLinks =
        (isSettingsValid<Settings>(props.settingsCascade) && props.settingsCascade.final.quicklinks) || []

    const onSubmit = useCallback(
        (event?: React.FormEvent<HTMLFormElement>): void => {
            // False positive
            // eslint-disable-next-line no-unused-expressions
            event?.preventDefault()

            submitSearch({ ...props, query: userQueryState.query, source: 'home' })
        },
        [props, userQueryState.query]
    )

    return (
        <div className="d-flex flex-row flex-shrink-past-contents">
            {props.splitSearchModes && props.interactiveSearchMode ? (
                <InteractiveModeInput
                    {...props}
                    navbarSearchState={userQueryState}
                    onNavbarQueryChange={setUserQueryState}
                    toggleSearchMode={props.toggleSearchMode}
                    lowProfile={false}
                    homepageMode={props.interactiveModeHomepageMode}
                />
            ) : (
                <>
                    <Form className="flex-grow-1 flex-shrink-past-contents" onSubmit={onSubmit}>
                        <div className="search-page__input-container">
                            {props.splitSearchModes && (
                                <SearchModeToggle {...props} interactiveSearchMode={props.interactiveSearchMode} />
                            )}
                            <VersionContextDropdown
                                history={props.history}
                                caseSensitive={props.caseSensitive}
                                patternType={props.patternType}
                                navbarSearchQuery={userQueryState.query}
                                versionContext={props.versionContext}
                                setVersionContext={props.setVersionContext}
                                availableVersionContexts={props.availableVersionContexts}
                            />
                            {props.smartSearchField ? (
                                <LazyMonacoQueryInput
                                    {...props}
                                    hasGlobalQueryBehavior={true}
                                    queryState={userQueryState}
                                    onChange={setUserQueryState}
                                    onSubmit={onSubmit}
                                    autoFocus={props.autoFocus !== false}
                                    // TODO farhan: Could we combine this to one callback, and then we just
                                    // advance based on what the current step is?
                                    tourAdvanceStepCallbacks={stepCallbacks}
                                />
                            ) : (
                                <QueryInput
                                    {...props}
                                    value={userQueryState}
                                    onChange={setUserQueryState}
                                    // We always want to set this to 'cursor-at-end' when true.
                                    autoFocus={props.autoFocus ? 'cursor-at-end' : props.autoFocus}
                                    hasGlobalQueryBehavior={true}
                                    patternType={props.patternType}
                                    setPatternType={props.setPatternType}
                                    withSearchModeToggle={props.splitSearchModes}
                                    keyboardShortcutForFocus={KEYBOARD_SHORTCUT_FOCUS_SEARCHBAR}
                                />
                            )}
                            <SearchButton />
                        </div>
                        <div className="search-page__input-sub-container">
                            {!props.splitSearchModes && (
                                <Link className="btn btn-link btn-sm pl-0" to="/search/query-builder">
                                    Query builder
                                </Link>
                            )}
                            <SearchScopes
                                history={props.history}
                                query={userQueryState.query}
                                authenticatedUser={props.authenticatedUser}
                                settingsCascade={props.settingsCascade}
                                patternType={props.patternType}
                                versionContext={props.versionContext}
                            />
                        </div>
                        <QuickLinks quickLinks={quickLinks} className="search-page__input-sub-container" />
                        <Notices
                            className="my-3"
                            location="home"
                            settingsCascade={props.settingsCascade}
                            history={props.history}
                        />
                    </Form>
                </>
            )}
        </div>
    )
}
