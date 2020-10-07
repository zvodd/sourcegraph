import React, { useMemo, useCallback, useEffect, useState } from 'react'
import * as H from 'history'
import * as Monaco from 'monaco-editor'
import { isPlainObject } from 'lodash'
import { MonacoEditor } from '../../components/MonacoEditor'
import { QueryState } from '../helpers'
import { getProviders } from '../../../../shared/src/search/parser/providers'
import { Subscription, Observable, Unsubscribable, BehaviorSubject } from 'rxjs'
import { fetchSuggestions } from '../backend'
import { Omit } from 'utility-types'
import { ThemeProps } from '../../../../shared/src/theme'
import { CaseSensitivityProps, PatternTypeProps, CopyQueryButtonProps } from '..'
import { Toggles, TogglesProps } from './toggles/Toggles'
import { hasProperty } from '../../../../shared/src/util/types'
import { KeyboardShortcut } from '../../../../shared/src/keyboardShortcuts'
import { KEYBOARD_SHORTCUT_FOCUS_SEARCHBAR } from '../../keyboardShortcuts/keyboardShortcuts'
import { observeResize } from '../../util/dom'
import Shepherd from 'shepherd.js'
import {
    advanceLangStep,
    advanceRepoStep,
    isCurrentTourStep,
    isValidLangQuery,
    runAdvanceLangOrRepoStep,
} from './SearchOnboardingTour'
import { SearchPatternType } from '../../graphql-operations'

export interface MonacoQueryInputProps
    extends Omit<TogglesProps, 'navbarSearchQuery' | 'filtersInQuery'>,
        ThemeProps,
        CaseSensitivityProps,
        PatternTypeProps,
        CopyQueryButtonProps {
    location: H.Location
    history: H.History
    queryState: QueryState
    onChange: (newState: QueryState) => void
    onSubmit: () => void
    autoFocus?: boolean
    keyboardShortcutForFocus?: KeyboardShortcut
    /**
     * The current onboarding tour instance
     */
    tour?: Shepherd.Tour

    // Whether globbing is enabled for filters.
    globbing: boolean

    // Whether comments are parsed and highlighted
    interpretComments?: boolean
}

const SOURCEGRAPH_SEARCH = 'sourcegraphSearch' as const

/**
 * Maps a Monaco IDisposable to an rxjs Unsubscribable.
 */
const toUnsubscribable = (disposable: Monaco.IDisposable): Unsubscribable => ({
    unsubscribe: () => disposable.dispose(),
})
/**
 * Adds code intelligence for the Sourcegraph search syntax to Monaco.
 *
 * @returns Subscription
 */
export function addSourcegraphSearchCodeIntelligence(
    monaco: typeof Monaco,
    searchQueries: Observable<string>,
    options: {
        patternType: SearchPatternType
        globbing: boolean
        interpretComments?: boolean
    }
): Subscription {
    const subscriptions = new Subscription()

    // Register language ID
    monaco.languages.register({ id: SOURCEGRAPH_SEARCH })

    // Register providers
    const providers = getProviders(searchQueries, fetchSuggestions, options)
    subscriptions.add(toUnsubscribable(monaco.languages.setTokensProvider(SOURCEGRAPH_SEARCH, providers.tokens)))
    subscriptions.add(toUnsubscribable(monaco.languages.registerHoverProvider(SOURCEGRAPH_SEARCH, providers.hover)))
    subscriptions.add(
        toUnsubscribable(monaco.languages.registerCompletionItemProvider(SOURCEGRAPH_SEARCH, providers.completion))
    )

    subscriptions.add(
        providers.diagnostics.subscribe(markers => {
            monaco.editor.setModelMarkers(monaco.editor.getModels()[0], 'diagnostics', markers)
        })
    )

    return subscriptions
}

/**
 * HACK: this interface and the below type guard are used to free default Monaco
 * keybindings (such as cmd + F, cmd + L) by unregistering them from the private
 * `_standaloneKeybindingService`.
 *
 * This is necessary as simply registering a noop command with editor.addCommand(keybinding, noop)
 * prevents the default Monaco behaviour, but doesn't free the keybinding, and thus still blocks the
 * default browser action (eg. select location with cmd + L).
 *
 * See upstream issues:
 * - https://github.com/microsoft/monaco-editor/issues/287
 * - https://github.com/microsoft/monaco-editor/issues/102 (main tracking issue)
 */
interface MonacoEditorWithKeybindingsService extends Monaco.editor.IStandaloneCodeEditor {
    _actions: {
        [id: string]: {
            id: string
            alias: string
            label: string
        }
    }
    _standaloneKeybindingService: {
        addDynamicKeybinding(keybinding: string): void
    }
}

const hasKeybindingService = (
    editor: Monaco.editor.IStandaloneCodeEditor
): editor is MonacoEditorWithKeybindingsService =>
    hasProperty('_actions')(editor) &&
    isPlainObject(editor._actions) &&
    hasProperty('_standaloneKeybindingService')(editor) &&
    typeof (editor._standaloneKeybindingService as MonacoEditorWithKeybindingsService['_standaloneKeybindingService'])
        .addDynamicKeybinding === 'function'

/**
 * HACK: this interface and the below type guard are used to add a custom command
 * to the editor. There is no public API to add a command with a specified ID and handler,
 * hence we need to use the private _commandService API.
 *
 * See upstream issue:
 * - https://github.com/Microsoft/monaco-editor/issues/900#issue-327455729
 * */
interface MonacoEditorWithCommandService extends Monaco.editor.IStandaloneCodeEditor {
    _commandService: {
        addCommand: (command: { id: string; handler: () => void }) => void
    }
}

const hasCommandService = (editor: Monaco.editor.IStandaloneCodeEditor): editor is MonacoEditorWithCommandService =>
    hasProperty('_commandService')(editor) &&
    typeof (editor._commandService as MonacoEditorWithCommandService['_commandService']).addCommand === 'function'

/**
 * A search query input backed by the Monaco editor, allowing it to provide
 * syntax highlighting, hovers, completions and diagnostics for search queries.
 *
 * This component should not be imported directly: use {@link LazyMonacoQueryInput} instead
 * to avoid bundling the Monaco editor on every page.
 */
export const MonacoQueryInput: React.FunctionComponent<MonacoQueryInputProps> = ({
    onSubmit,
    onChange: onQueryStateChange,
    tour,
    ...props
}) => {
    const searchQueries = useMemo(() => new BehaviorSubject<string>(''), [])
    useEffect(() => {
        console.log('Next search query', props.queryState.query)
        searchQueries.next(props.queryState.query)
    }, [props.queryState.query, searchQueries])
    const onChange = useCallback(
        (query: string) => {
            console.log('Change', query)
            onQueryStateChange({ query, cursorPosition: 0 })
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [onQueryStateChange]
    )

    const [monacoInstance, setMonacoInstance] = useState<typeof Monaco>()
    // Register themes and code intelligence providers.
    const { patternType, globbing } = props
    useEffect(() => {
        console.log(1)
        if (!monacoInstance) {
            return
        }
        const subscriptions = addSourcegraphSearchCodeIntelligence(monacoInstance, searchQueries, {
            patternType,
            globbing,
        })
        return () => subscriptions.unsubscribe()
    }, [monacoInstance, searchQueries, patternType, globbing])
    const [editorInstance, setEditorInstance] = useState<Monaco.editor.IStandaloneCodeEditor>()

    const triggerSuggestions = useCallback(() => {
        if (!editorInstance) {
            return
        }
        editorInstance.trigger('triggerSuggestions', 'editor.action.triggerSuggest', {})
    }, [editorInstance])

    // Focus the editor with cursor at end, and reveal that position.
    useEffect(() => {
        console.log(2)
        if (!editorInstance) {
            return
        }
        if (props.queryState.fromUserInput) {
            return
        }
        editorInstance.focus()
        const position = {
            // +2 as Monaco is 1-indexed, and the cursor should be placed after the query.
            column: editorInstance.getValue().length + 2,
            lineNumber: 1,
        }
        editorInstance.setPosition(position)
        editorInstance.revealPosition(position)
    }, [editorInstance, props.queryState.fromUserInput, props.queryState.query])

    const [containerReference, setContainerReference] = useState<HTMLElement | null>()
    // Trigger a layout of the Monaco editor when its container gets resized.
    // The Monaco editor doesn't auto-resize with its container:
    // https://github.com/microsoft/monaco-editor/issues/28
    useEffect(() => {
        console.log(3)
        if (!editorInstance || !containerReference) {
            return
        }
        const subscription = observeResize(containerReference).subscribe(() => {
            editorInstance.layout()
        })
        return () => subscription.unsubscribe()
    }, [editorInstance, containerReference])

    useEffect(() => {
        console.log(4)
        if (!editorInstance) {
            return
        }
        const subscriptions = new Subscription()
        // Accessibility: allow tab usage to move focus to
        // next previous focusable element (and not to insert the tab character).
        // - Cannot be set through IEditorOptions
        // - Cannot be called synchronously (otherwise risks being overridden by Monaco defaults)
        subscriptions.add(
            toUnsubscribable(
                editorInstance.onDidFocusEditorText(() => {
                    editorInstance.createContextKey('editorTabMovesFocus', true)
                })
            )
        )

        // Prevent newline insertion in model, and surface query changes with stripped newlines.
        subscriptions.add(
            toUnsubscribable(
                editorInstance.onDidChangeModelContent(() => {
                    onChange(editorInstance.getValue().replace(/[\n\r↵]/g, ''))
                })
            )
        )

        // Submit on enter, hiding the suggestions widget if it's visible.
        subscriptions.add(
            toUnsubscribable(
                editorInstance.addAction({
                    id: 'submitOnEnter',
                    label: 'submitOnEnter',
                    keybindings: [Monaco.KeyCode.Enter],
                    run: () => {
                        onSubmit()
                        editorInstance.trigger('submitOnEnter', 'hideSuggestWidget', [])
                    },
                })
            )
        )

        // Disable default Monaco keybindings
        if (!hasKeybindingService(editorInstance)) {
            // Throw an error if hasKeybindingService() returns false,
            // to surface issues with this workaround when upgrading Monaco.
            throw new Error('Cannot unbind default Monaco keybindings')
        }
        for (const action of Object.keys(editorInstance._actions)) {
            // Keep ctrl+space to show all available completions. Keep ctrl+k to delete text on right of cursor.
            if (action === 'editor.action.triggerSuggest' || action === 'deleteAllRight') {
                continue
            }
            // Prefixing action ids with `-` to unbind the default actions.
            editorInstance._standaloneKeybindingService.addDynamicKeybinding(`-${action}`)
        }
        // Free CMD+L keybinding, which is part of Monaco's CoreNavigationCommands, and
        // not exposed on editor._actions.
        editorInstance._standaloneKeybindingService.addDynamicKeybinding('-expandLineSelection')
        return () => subscriptions.unsubscribe()
    }, [editorInstance, onChange, onSubmit])

    // When a suggestion gets selected, advance the tour.
    useEffect(() => {
        console.log(5)
        if (!tour || !editorInstance) {
            return
        }
        const subscriptions = new Subscription()
        if (hasCommandService(editorInstance)) {
            subscriptions.add(
                editorInstance._commandService.addCommand({
                    id: 'completionItemSelected',
                    handler: () => {
                        runAdvanceLangOrRepoStep(props.queryState.query, tour)
                    },
                })
            )
        } else {
            throw new Error('Cannot add completionItemSelected command')
        }
        return () => subscriptions.unsubscribe()
    }, [tour, editorInstance, props.queryState.query])

    // Handle advancing the Tour's repo and language steps
    useEffect(() => {
        console.log(6)
        if (!tour || !editorInstance || !props.queryState.fromUserInput) {
            return
        }
        // Trigger the suggestions popup for `repo:` and `lang:` fields
        if (
            (isCurrentTourStep('filter-repository', tour) && props.queryState.query === 'repo:') ||
            (isCurrentTourStep('filter-lang', tour) && props.queryState.query === 'lang:')
        ) {
            triggerSuggestions()
        }

        if (
            isCurrentTourStep('filter-repository', tour) &&
            tour.getById('filter-repository').isOpen() &&
            props.queryState.query !== 'repo:' &&
            props.queryState.query.endsWith(' ')
        ) {
            advanceRepoStep(props.queryState.query, tour)
        } else if (
            isCurrentTourStep('filter-lang', tour) &&
            tour.getById('filter-lang').isOpen() &&
            props.queryState.query !== 'lang:' &&
            isValidLangQuery(props.queryState.query.trim()) &&
            props.queryState.query.endsWith(' ')
        ) {
            advanceLangStep(props.queryState.query, tour)
        }
    }, [tour, editorInstance, props.queryState.fromUserInput, props.queryState.query, triggerSuggestions])

    // Handle advancing the search tour when on the add query term step.
    useEffect(() => {
        console.log(7)
        if (!tour) {
            return
        }
        if (!isCurrentTourStep('add-query-term', tour)) {
            return
        }
        if (
            tour.getById('add-query-term').isOpen() &&
            props.queryState.query !== 'repo:' &&
            props.queryState.query !== 'lang:'
        ) {
            tour.show('submit-search')
        }
    }, [tour, props.queryState.query])

    const options: Monaco.editor.IEditorOptions = {
        readOnly: false,
        lineNumbers: 'off',
        lineHeight: 16,
        // Match the query input's height for suggestion items line height.
        suggestLineHeight: 34,
        minimap: {
            enabled: false,
        },
        scrollbar: {
            vertical: 'hidden',
            horizontal: 'hidden',
        },
        glyphMargin: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        overviewRulerBorder: false,
        folding: false,
        rulers: [],
        overviewRulerLanes: 0,
        wordBasedSuggestions: false,
        quickSuggestions: false,
        fixedOverflowWidgets: true,
        contextmenu: false,
        links: false,
        // Display the cursor as a 1px line.
        cursorStyle: 'line',
        cursorWidth: 1,
    }
    return (
        <>
            <div ref={setContainerReference} className="monaco-query-input-container">
                <div className="flex-grow-1 flex-shrink-past-contents">
                    <MonacoEditor
                        id="monaco-query-input"
                        language={SOURCEGRAPH_SEARCH}
                        value={props.queryState.query}
                        height={16}
                        isLightTheme={props.isLightTheme}
                        editorWillMount={setMonacoInstance}
                        onEditorCreated={setEditorInstance}
                        options={options}
                        border={false}
                        keyboardShortcutForFocus={KEYBOARD_SHORTCUT_FOCUS_SEARCHBAR}
                        className="test-query-input"
                    />
                </div>
                <Toggles
                    {...props}
                    navbarSearchQuery={props.queryState.query}
                    className="monaco-query-input-container__toggle-container"
                />
            </div>
        </>
    )
}
