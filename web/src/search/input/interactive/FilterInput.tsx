import * as React from 'react'
import { Form } from '../../../components/Form'
import CloseIcon from 'mdi-react/CloseIcon'
import { Subscription, Subject } from 'rxjs'
import { distinctUntilChanged, switchMap, map, filter, toArray, catchError, repeat, debounceTime } from 'rxjs/operators'
import { createSuggestion, Suggestion, SuggestionItem } from '../Suggestion'
import { fetchSuggestions } from '../../backend'
import { ComponentSuggestions, noSuggestions, typingDebounceTime, focusQueryInput } from '../QueryInput'
import { isDefined } from '../../../../../shared/src/util/types'
import Downshift from 'downshift'
import { generateFiltersQuery } from '../helpers'
import { QueryState, interactiveFormatQueryForFuzzySearch } from '../../helpers'
import { dedupeWhitespace } from '../../../../../shared/src/util/strings'
import { FiltersToTypeAndValue } from '../../../../../shared/src/search/interactive/util'
import { SuggestionTypes } from '../../../../../shared/src/search/suggestions/util'

interface Props {
    filtersInQuery: FiltersToTypeAndValue
    navbarQuery: QueryState
    /** The key of this filter in the top-level filtersInQuery map. */
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
    active: boolean
    suggestions: ComponentSuggestions
}

export default class FilterInput extends React.Component<Props, State> {
    private subscriptions = new Subscription()
    private inputValues = new Subject<string>()
    private componentUpdates = new Subject<Props>()
    private inputEl = React.createRef<HTMLInputElement>()

    constructor(props: Props) {
        super(props)

        this.state = {
            active: document.activeElement === this.inputEl.current,
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
                        let fullQuery = `${props.navbarQuery.query} ${generateFiltersQuery({
                            ...props.filtersInQuery,
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

    public componentDidMount(): void {
        if (this.inputEl.current) {
            this.inputEl.current.focus()
        }
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
        focusQueryInput.next()
        this.setState({ active: false })
    }

    private onClickSelected = (): void => {
        if (this.inputEl.current) {
            this.inputEl.current.focus()
        }
        this.setState({ active: true })
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

    private onInputFocus = (): void => this.setState({ active: true })
    private onInputBlur = (): void => this.setState({ active: false, suggestions: noSuggestions })

    public render(): JSX.Element | null {
        const showSuggestions = this.state.suggestions.values.length > 0

        return (
            <div className={`filter-input ${this.state.active ? 'filter-input--active' : ''}`}>
                {this.props.editable ? (
                    <Form onSubmit={this.onSubmitInput}>
                        <Downshift onSelect={this.onSuggestionSelect} itemToString={this.downshiftItemToString}>
                            {({ getInputProps, getItemProps, getMenuProps, highlightedIndex }) => {
                                const { onKeyDown } = getInputProps()
                                return (
                                    <div>
                                        <div className="filter-input__form">
                                            <div className="filter-input__input-wrapper">
                                                <input
                                                    ref={this.inputEl}
                                                    className="form-control filter-input__input-field"
                                                    value={this.props.value}
                                                    onChange={this.onInputUpdate}
                                                    placeholder={this.props.filterType}
                                                    onKeyDown={onKeyDown}
                                                    required={true}
                                                    autoFocus={true}
                                                    onFocus={this.onInputFocus}
                                                    onBlur={this.onInputBlur}
                                                />
                                                {showSuggestions && (
                                                    <ul
                                                        className="filter-input__suggestions e2e-query-suggestions"
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
                                            <button type="button" onClick={this.onClickDelete} className="btn btn-icon">
                                                <CloseIcon />
                                            </button>
                                        </div>
                                    </div>
                                )
                            }}
                        </Downshift>
                    </Form>
                ) : (
                    <div className="filter-input--uneditable d-flex">
                        <button
                            type="button"
                            className="filter-input__button-text btn text-nowrap"
                            onClick={this.onClickSelected}
                            tabIndex={0}
                        >
                            {this.props.filterType}:{this.props.value}
                        </button>
                        <button type="button" onClick={this.onClickDelete} className="btn btn-icon">
                            <CloseIcon />
                        </button>
                    </div>
                )}
            </div>
        )
    }
}
