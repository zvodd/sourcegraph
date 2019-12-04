import * as React from 'react'
import { Form } from '../../components/Form'
import CloseIcon from 'mdi-react/CloseIcon'
import { Subscription, Subject } from 'rxjs'
import { distinctUntilChanged, switchMap, map, filter, toArray, catchError, repeat, debounceTime } from 'rxjs/operators'
import { createSuggestion, Suggestion, SuggestionItem, SuggestionTypes } from './Suggestion'
import { fetchSuggestions } from '../backend'
import { ComponentSuggestions, noSuggestions, typingDebounceTime } from './QueryInput'
import { isDefined } from '../../../../shared/src/util/types'
import Downshift from 'downshift'
import { FiltersToTypeAndValue } from './InteractiveModeInput'
import { generateFieldsQuery } from './helpers'
import { QueryState, interactiveFormatQueryForFuzzySearch } from '../helpers'
import { dedupeWhitespace } from '../../../../shared/src/util/strings'

interface Props {
    fieldValues: FiltersToTypeAndValue
    navbarQuery: QueryState
    /** The key of this filter in the top-level fieldValues map. */
    mapKey: string
    value: string
    // INTERACTIVE TODO: this should be SuggestionTypes enum
    filterType: SuggestionTypes
    editable: boolean
    onFilterEdited: (filterKey: string, value: string) => void
    onFilterDeleted: (filterKey: string) => void
    toggleFilterEditable: (filterKey: string) => void
}

interface State {
    suggestions: ComponentSuggestions
}

export default class InteractiveModeFilterInput extends React.Component<Props, State> {
    private subscriptions = new Subscription()
    private inputValues = new Subject<string>()
    private componentUpdates = new Subject<Props>()

    constructor(props: Props) {
        super(props)

        this.state = {
            suggestions: noSuggestions,
        }

        this.subscriptions.add(this.inputValues.subscribe(query => this.props.onFilterEdited(this.props.mapKey, query)))

        this.subscriptions.add(
            this.componentUpdates
                .pipe(
                    debounceTime(typingDebounceTime),
                    distinctUntilChanged(
                        (previous, current) => dedupeWhitespace(previous.value) === dedupeWhitespace(current.value)
                    ),
                    switchMap(props => {
                        if (props.value.length === 0) {
                            return [{ suggestions: noSuggestions }]
                        }
                        const filterType = props.filterType
                        let fullQuery = `${props.navbarQuery.query} ${generateFieldsQuery({
                            ...props.fieldValues,
                        })}`

                        fullQuery = interactiveFormatQueryForFuzzySearch(fullQuery, filterType, props.value)
                        return fetchSuggestions(fullQuery).pipe(
                            map(createSuggestion),
                            filter(isDefined),
                            map((suggestion): Suggestion => ({ ...suggestion, fromFuzzySearch: true })),
                            filter(suggestion => suggestion.type === filterType),
                            toArray(),
                            map(suggestions => ({
                                suggestions: { values: suggestions, cursorPosition: this.props.value.length },
                            })),
                            catchError(error => {
                                console.error(error)
                                return [{ suggestions: noSuggestions }]
                            })
                        )
                    }),
                    // Abort suggestion display on route change or suggestion hiding
                    // But resubscribe afterwards
                    repeat()
                )
                .subscribe(state => this.setState(state))
        )
    }

    public componentDidUpdate(): void {
        this.componentUpdates.next(this.props)
    }
    public componentWillUnmount(): void {
        this.subscriptions.unsubscribe()
    }

    private onInputUpdate: React.ChangeEventHandler<HTMLInputElement> = e => {
        this.inputValues.next(e.target.value)
    }

    private onSubmitInput = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault()
        e.stopPropagation()

        this.props.toggleFilterEditable(this.props.mapKey)
    }

    private onClickSelected = (): void => {
        this.props.toggleFilterEditable(this.props.mapKey)
    }

    private onClickDelete = (): void => {
        this.props.onFilterDeleted(this.props.mapKey)
    }

    private onSuggestionSelect = (suggestion: Suggestion | undefined): void => {
        // Insert value into filter input. For any suggestion selected, the whole value should be updated,
        // not just appended.
        if (suggestion) {
            this.inputValues.next(suggestion.value)
        }

        this.setState({ suggestions: noSuggestions })
    }

    private downshiftItemToString = (suggestion?: Suggestion): string => (suggestion ? suggestion.value : '')

    public render(): JSX.Element | null {
        const showSuggestions = this.state.suggestions.values.length > 0

        return (
            <div className="interactive-mode-filter-input">
                {this.props.editable ? (
                    <Form onSubmit={this.onSubmitInput}>
                        <Downshift onSelect={this.onSuggestionSelect} itemToString={this.downshiftItemToString}>
                            {({ getInputProps, getItemProps, getMenuProps, highlightedIndex }) => {
                                const { onKeyDown } = getInputProps()
                                return (
                                    <div>
                                        <div className="interactive-mode-filter-input__form">
                                            <input
                                                onChange={this.onInputUpdate}
                                                value={this.props.value}
                                                required={true}
                                                placeholder={this.props.filterType}
                                                onKeyDown={onKeyDown}
                                                className="form-control interactive-mode-filter-input__input-field"
                                            />
                                            <div onClick={this.onClickDelete} className="icon-inline">
                                                <CloseIcon />
                                            </div>
                                        </div>
                                        {showSuggestions && (
                                            <ul
                                                className="interactive-mode-filter-input__suggestions e2e-query-suggestions"
                                                {...getMenuProps()}
                                            >
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
                                                            showUrlLabel={false}
                                                        />
                                                    )
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                )
                            }}
                        </Downshift>
                    </Form>
                ) : (
                    <div className="d-flex">
                        <div onClick={this.onClickSelected}>
                            {this.props.filterType}:{this.props.value}
                        </div>
                        <div onClick={this.onClickDelete} className="icon-inline">
                            <CloseIcon />
                        </div>
                    </div>
                )}
            </div>
        )
    }
}
