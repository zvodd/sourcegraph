import * as H from 'history'
import * as React from 'react'
import { Form } from '../../components/Form'
import { Subject, ObservableInput, Subscription, fromEvent } from 'rxjs'
import { QueryValue, insertSuggestionInQuery } from '../helpers'
import { SuggestionTypes, createSuggestion, SuggestionItem, Suggestion } from './Suggestion'
import { ComponentSuggestions, SuggestionsStateUpdate, hiddenSuggestions } from './QueryInput'
import { fetchSuggestions } from '../backend'
import {
    map,
    filter,
    toArray,
    catchError,
    distinctUntilChanged,
    debounceTime,
    switchMap,
    takeUntil,
    repeat,
} from 'rxjs/operators'
import { isDefined } from '../../../../shared/src/util/types'
import Downshift from 'downshift'
/**
 * InteractiveFilterInputs is a component that allows users to input a value for a particular search filter.
 * Each FilterInput represents the value for a particular search filter.
 */

const fetchFuzzySuggestions = (
    query: string,
    filterBeforeCursor: SuggestionTypes,
    cursorPosition: QueryValue['cursorPosition']
): ObservableInput<SuggestionsStateUpdate> =>
    fetchSuggestions(query).pipe(
        map(createSuggestion),
        filter(isDefined),
        filter(suggestion => {
            switch (filterBeforeCursor) {
                case SuggestionTypes.repo:
                    return suggestion.type === SuggestionTypes.repo
                default:
                    return true
            }
        }),
        toArray(),
        map(suggestions => ({
            suggestions: {
                cursorPosition,
                values: suggestions,
            },
        })),
        catchError(() => [{ suggestions: { cursorPosition: 0, values: [] } }])
    )

interface Props {
    history: H.History
    filter: SuggestionTypes
    onRepoFilterQueryChange: (query: string) => void
}

interface State {
    editable: boolean
    value: string
    /** The suggestions shown to the user */
    suggestions: ComponentSuggestions
}

export default class InteractiveFilterInputs extends React.Component<Props, State> {
    private subscriptions = new Subscription()
    /** Emits new input values */
    private inputUpdates = new Subject<QueryValue>()

    private suggestionsHidden = new Subject<void>()

    private containerElement = React.createRef<HTMLInputElement>()

    constructor(props: Props) {
        super(props)
        this.state = {
            editable: true,
            value: '',
            suggestions: {
                cursorPosition: 0,
                values: [],
            },
        }

        this.subscriptions.add(
            // Trigger new suggestions every time the input field is typed into.
            this.inputUpdates
                .pipe(
                    // tap(queryValue => this.props.onChange(queryValue)),
                    distinctUntilChanged(),
                    debounceTime(200),
                    switchMap(queryValue => {
                        if (queryValue.query.length === 0) {
                            return [{ suggestions: hiddenSuggestions }]
                        }

                        return fetchFuzzySuggestions(queryValue.query, this.props.filter, queryValue.cursorPosition)
                    }),
                    // Abort suggestion display on route change or suggestion hiding
                    takeUntil(this.suggestionsHidden),
                    // But resubscribe afterwards
                    repeat()
                )
                .subscribe(
                    state => {
                        this.setState(state)
                    },
                    err => {
                        console.error(err)
                    }
                )
        )

        this.subscriptions.add(
            fromEvent<MouseEvent>(window, 'click').subscribe(event => {
                if (
                    this.state.suggestions.values.length > 0 &&
                    (!this.containerElement.current || !this.containerElement.current.contains(event.target as Node))
                ) {
                    this.hideSuggestions()
                }
            })
        )
    }

    public componentWillUnmount(): void {
        this.subscriptions.unsubscribe()
    }

    private hideSuggestions = (): void => {
        this.suggestionsHidden.next()
        this.setState({ suggestions: hiddenSuggestions })
    }

    public render(): JSX.Element | null {
        const showSuggestions = this.state.suggestions.values.length > 0
        return this.state.editable ? (
            <Form onSubmit={this.onSubmitInput}>
                <Downshift onSelect={this.onSuggestionSelect} itemToString={this.downshiftItemToString}>
                    {({ getInputProps, getItemProps, getMenuProps, highlightedIndex }) => {
                        const { onChange: downshiftChange, onKeyDown } = getInputProps()
                        return (
                            <div>
                                <div ref={this.containerElement}>
                                    <input
                                        placeholder={`${this.props.filter} filter...`}
                                        key={this.props.filter}
                                        className="form-control"
                                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                            downshiftChange(event)
                                            this.updateValue(event)
                                        }}
                                        onKeyDown={event => {
                                            // this.onInputKeyDown(event)
                                            onKeyDown(event)
                                        }}
                                        value={this.state.value}
                                    />
                                    {showSuggestions && (
                                        <ul className="query-input2__suggestions" {...getMenuProps()}>
                                            {this.state.suggestions.values.map((suggestion, index) => {
                                                const isSelected = highlightedIndex === index
                                                const key = `${index}-${suggestion}`
                                                return (
                                                    <SuggestionItem
                                                        key={key}
                                                        {...getItemProps({
                                                            key,
                                                            index,
                                                            item: suggestion,
                                                        })}
                                                        suggestion={suggestion}
                                                        isSelected={isSelected}
                                                        showUrlLabel={true}
                                                    />
                                                )
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )
                    }}
                </Downshift>
            </Form>
        ) : (
            <div>{`${this.props.filter}:${this.state.value}`}</div>
        )
    }

    private onSubmitInput = (): void => {
        this.props.onRepoFilterQueryChange(`${this.props.filter}:${this.state.value}`)
        this.setState(state => ({
            editable: !state.editable,
        }))
    }

    private updateValue = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.inputUpdates.next({
            query: `${this.props.filter}:${e.currentTarget.value}`,
            cursorPosition: e.currentTarget.selectionStart || 0,
        })

        this.setState({ value: e.target.value })
    }

    private onSuggestionSelect = (suggestion: Suggestion | undefined): void => {
        this.setState(state => {
            if (!suggestion) {
                return {
                    ...state,
                    suggestions: hiddenSuggestions,
                }
            }
            const { cursorPosition } = state.suggestions
            const { query: newQuery } = insertSuggestionInQuery(state.value, suggestion, cursorPosition)
            // We always want to just add the value to the new query, and reset suggestions.
            return {
                value: newQuery,
                suggestions: hiddenSuggestions,
            }
        })
    }

    private downshiftItemToString = (suggestion?: Suggestion): string => (suggestion ? suggestion.value : '')
}
