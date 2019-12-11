import * as H from 'history'
import * as React from 'react'
import { fromEvent, Subject, Subscription } from 'rxjs'
import { distinctUntilChanged, filter, startWith } from 'rxjs/operators'
import { eventLogger } from '../../../tracking/eventLogger'
import { Suggestion } from '../Suggestion'
import RegexpToggle from '../RegexpToggle'
import { SearchPatternType } from '../../../../../shared/src/graphql/schema'
import { PatternTypeProps } from '../..'
import { QueryState } from '../../helpers'
import { once } from 'lodash'
import { FiltersToTypeAndValue } from '../../../../../shared/src/search/interactive/util'

/**
 * The query input field is clobbered and updated to contain this subject's values, as
 * they are received. This is used to trigger an update; the source of truth is still the URL.
 */
export const queryUpdates = new Subject<string>()

interface Props extends PatternTypeProps {
    location: H.Location
    history: H.History

    /** The value of the query input */
    value: QueryState

    /** Called when the value changes */
    onChange: (newValue: QueryState) => void

    /**
     * A string that is appended to the query input's query before
     * fetching suggestions.
     */
    prependQueryForSuggestions?: string

    /** Whether the input should be autofocused (and the behavior thereof) */
    autoFocus?: true | 'cursor-at-end'

    /** The input placeholder, if different from the default is desired. */
    placeholder?: string

    /**
     * Whether this input should behave like the global query input: (1)
     * pressing the '/' key focuses it and (2) other components contribute a
     * query to it with their context (such as the repository area contributing
     * 'repo:foo@bar' for the current repository and revision).
     *
     * At most one query input per page should have this behavior.
     */
    hasGlobalQueryBehavior?: boolean

    /**
     * The filters in the query when in interactive search mode.
     */
    filterQuery?: FiltersToTypeAndValue
}

/**
 * The search suggestions and cursor position of where the last character was inserted.
 * Cursor position is used to correctly insert the suggestion when it's selected.
 */
export interface ComponentSuggestions {
    values: Suggestion[]
    cursorPosition: number
}

// Used for fetching suggestions and updating query history (undo/redo)
export const typingDebounceTime = 300

export class SimpleQueryInput extends React.Component<Props> {
    private componentUpdates = new Subject<Props>()

    /** Subscriptions to unsubscribe from on component unmount */
    private subscriptions = new Subscription()

    /** Emits new input values */
    private inputValues = new Subject<QueryState>()

    /** Only used for selection and focus management */
    private inputElement = React.createRef<HTMLInputElement>()

    constructor(props: Props) {
        super(props)

        // Update parent component
        // (will be used in next PR to push to queryHistory (undo/redo))
        this.subscriptions.add(this.inputValues.subscribe(queryState => this.props.onChange(queryState)))

        if (this.props.hasGlobalQueryBehavior) {
            // Quick-Open hotkeys
            this.subscriptions.add(
                fromEvent<KeyboardEvent>(window, 'keydown')
                    .pipe(
                        filter(
                            event =>
                                // Cmd/Ctrl+Shift+F
                                (event.metaKey || event.ctrlKey) &&
                                event.shiftKey &&
                                event.key.toLowerCase() === 'f' &&
                                !!document.activeElement &&
                                !['INPUT', 'TEXTAREA'].includes(document.activeElement.nodeName)
                        )
                    )
                    .subscribe(() => {
                        const selection = String(window.getSelection() || '')
                        this.inputValues.next({ query: selection, cursorPosition: selection.length })
                        if (this.inputElement.current) {
                            this.inputElement.current.focus()
                            // Select whole input text
                            this.inputElement.current.setSelectionRange(0, this.inputElement.current.value.length)
                        }
                    })
            )

            // Allow other components to update the query (e.g., to be relevant to what the user is
            // currently viewing).
            this.subscriptions.add(
                queryUpdates.pipe(distinctUntilChanged()).subscribe(query =>
                    this.inputValues.next({
                        query,
                        cursorPosition: query.length,
                    })
                )
            )

            /** Whenever the URL query has a "focus" property, remove it and focus the query input. */
            this.subscriptions.add(
                this.componentUpdates
                    .pipe(
                        startWith(props),
                        filter(({ location }) => new URLSearchParams(location.search).get('focus') !== null)
                    )
                    .subscribe(props => {
                        this.focusInputAndPositionCursorAtEnd()
                        const q = new URLSearchParams(props.location.search)
                        q.delete('focus')
                        this.props.history.replace({ search: q.toString() })
                    })
            )
        }
    }

    public componentDidMount(): void {
        switch (this.props.autoFocus) {
            case 'cursor-at-end':
                this.focusInputAndPositionCursorAtEnd()
                break
        }
    }

    public componentWillUnmount(): void {
        this.subscriptions.unsubscribe()
    }

    public componentDidUpdate(prevProps: Props): void {
        if (this.props.value.cursorPosition && prevProps.value.cursorPosition !== this.props.value.cursorPosition) {
            this.focusInputAndPositionCursor(this.props.value.cursorPosition)
        }
        this.componentUpdates.next(this.props)
    }

    public render(): JSX.Element | null {
        return (
            <div className="query-input2">
                <div>
                    <input
                        className="form-control query-input2__input rounded-left e2e-query-input"
                        value={this.props.value.query}
                        autoFocus={this.props.autoFocus === true}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                            this.onInputChange(event)
                        }}
                        spellCheck={false}
                        autoCapitalize="off"
                        placeholder={this.props.placeholder === undefined ? 'Search code...' : this.props.placeholder}
                        ref={this.inputElement}
                        name="query"
                        autoComplete="off"
                    />
                    <RegexpToggle
                        {...this.props}
                        toggled={this.props.patternType === SearchPatternType.regexp}
                        navbarSearchQuery={this.props.value.query}
                        filtersInQuery={this.props.filterQuery}
                    />
                </div>
            </div>
        )
    }

    private focusInputAndPositionCursor(cursorPosition: number): void {
        if (this.inputElement.current) {
            this.inputElement.current.focus()
            this.inputElement.current.setSelectionRange(cursorPosition, cursorPosition)
        }
    }

    private focusInputAndPositionCursorAtEnd(): void {
        if (this.inputElement.current) {
            this.focusInputAndPositionCursor(this.inputElement.current.value.length)
        }
    }

    /** Only log when user has typed the first character into the input. */
    private logFirstInput = once((): void => {
        eventLogger.log('SearchInitiated')
    })

    private onInputChange: React.ChangeEventHandler<HTMLInputElement> = event => {
        this.logFirstInput()
        this.inputValues.next({
            fromUserInput: true,
            query: event.currentTarget.value,
            cursorPosition: event.currentTarget.selectionStart || 0,
        })
    }
}
