import classNames from 'classnames'
import React, { useCallback, useMemo, useState } from 'react'
import { Key } from 'ts-key-enum'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import TooltipPopoverWrapper from 'reactstrap/lib/TooltipPopoverWrapper'
import { sortBy, uniqueId } from 'lodash'
import stringScore from 'string-score'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import { ButtonLink } from '../../../shared/src/components/LinkOrButton'

interface Context {
    name: string
    description: string
    isDefault?: boolean
}
export const SearchContextsDropdown: React.FunctionComponent = () => {
    const contexts: Context[] = useMemo(
        () => [
            { name: 'my-repos', description: 'Your repositories on Sourcegraph', isDefault: true },
            { name: 'global', description: 'All repositories on Sourcegraph' },
            { name: 'Nutnx-0.0.1', description: 'Release used by Customer A' },
            { name: 'Nutnx-0.0.2', description: 'Release used by Customer X' },
            { name: 'Nutnx-0.0.3', description: 'Release used by Customer Z' },
            { name: 'Nutnx-0.0.4', description: 'Dev version for poc candidate 1' },
            { name: 'Nutnx-0.0.5', description: 'Dev version for poc candidate 2' },
        ],
        []
    )
    const [currentValue, setCurrentValue] = useState<Context['name'] | undefined>(
        contexts.filter(context => context.isDefault)![0].name
    )
    const [selectedIndex, setSelectedIndex] = useState(0)

    const disableValue = useCallback((): void => {
        setCurrentValue(undefined)
    }, [setCurrentValue])

    const [filterInput, setFilterInput] = useState('')
    const onFilterInputchange: React.ChangeEventHandler = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            setFilterInput(event.target.value)
        },
        [setFilterInput]
    )

    const setIndex = useCallback(
        (delta: number): void => {
            setSelectedIndex(previousSelectedIndex => previousSelectedIndex + delta)
        },
        [setSelectedIndex]
    )

    const [isOpen, setIsOpen] = useState(false)
    // const close = useCallback(() => {
    //     console.log('close')
    //     setIsOpen(false)
    // }, [setIsOpen])
    const toggleIsOpen = useCallback(() => setIsOpen(!isOpen), [isOpen])
    const id = useMemo(() => uniqueId('command-list-popover-button-'), [])
    const [autofocus, setAutofocus] = useState(true)

    const query = useMemo(() => filterInput.trim(), [filterInput])
    const filteredAndRankedContexts = useMemo(() => filterItems(contexts, query), [contexts, query])
    const wrappedSelectedIndex = useMemo(
        () =>
            ((selectedIndex % filteredAndRankedContexts.length) + filteredAndRankedContexts.length) %
            filteredAndRankedContexts.length,
        [selectedIndex, filteredAndRankedContexts.length]
    )

    const onInputKeyDown: React.KeyboardEventHandler<HTMLInputElement> = useCallback(
        event => {
            switch (event.key) {
                case Key.ArrowDown: {
                    event.preventDefault()
                    setIndex(1)
                    break
                }
                case Key.ArrowUp: {
                    event.preventDefault()
                    setIndex(-1)
                    break
                }
                case Key.Enter: {
                    console.log(filteredAndRankedContexts[selectedIndex].name)
                    setCurrentValue(filteredAndRankedContexts[selectedIndex].name)
                    setIsOpen(false)
                    break
                }
            }
        },
        [setIndex, filteredAndRankedContexts, selectedIndex]
    )

    const onClickedItem = useCallback(
        (name: string) => (event: React.MouseEvent<HTMLElement, MouseEvent> | React.KeyboardEvent<HTMLElement>) => {
            toggleIsOpen()
            // setIsOpen(false)
            console.log(name)
            setCurrentValue(name)
        },
        [setCurrentValue, toggleIsOpen]
    )
    return (
        <div className="search-contexts-dropdown__container">
            <div
                role="button"
                className={classNames({
                    'search-contexts-dropdown__button btn testtt': true,
                    'search-contexts-dropdown__button--active': isOpen,
                })}
                // isOpen ? buttonOpenClassName : ''
                id={id}
                onClick={toggleIsOpen}
                // onSelect={toggleIsOpen}
                tabIndex={0}
            >
                <span className="context-label">context:</span>
                {currentValue}
                <TooltipPopoverWrapper
                    isOpen={isOpen}
                    toggle={toggleIsOpen}
                    popperClassName="popover popovertest"
                    // innerClassName={classNames('overflow-hidden')}
                    placement="bottom-start"
                    target={id}
                    trigger="legacy"
                    delay={0}
                    fade={false}
                    hideArrow={true}
                >
                    <div className="search-contexts-dropdown__popover version-context-dropdown__popover">
                        <header>
                            {/* eslint-disable-next-line react/forbid-elements */}
                            {/* <form className={this.props.formClassName} onSubmit={this.onSubmit}> */}
                            <label className="sr-only" htmlFor="command-list-input">
                                Command
                            </label>
                            <div className="d-flex align-items-center search-contexts-dropdown__input-row">
                                <div className="search-contexts-dropdown__icon-container">
                                    <ChevronRightIcon className="icon-inline search-contexts-dropdown__chevron" />
                                </div>
                                <input
                                    id="command-list-input"
                                    ref={input => autofocus && input?.focus({ preventScroll: true })}
                                    type="text"
                                    className="search-contexts-dropdown__filter-input form-control px-0 py-0 rounded-0 border-0"
                                    value={filterInput}
                                    placeholder="Find a context..."
                                    spellCheck={false}
                                    autoCorrect="off"
                                    autoComplete="off"
                                    onChange={onFilterInputchange}
                                    onKeyDown={onInputKeyDown}
                                />
                            </div>
                            {/* </form> */}
                        </header>
                        <div>
                            <ul className="search-contexts-dropdown__list list-group list-group-flush list-unstyled">
                                {filteredAndRankedContexts.length > 0 ? (
                                    filteredAndRankedContexts.map((item, index) => (
                                        <ButtonLink
                                            key={item.name}
                                            onSelect={onClickedItem(item.name)}
                                            className={classNames({
                                                'search-contexts-dropdown__option--active':
                                                    wrappedSelectedIndex === index,
                                            })}
                                        >
                                            <li
                                                // className={classNames(
                                                //     this.props.listItemClassName,
                                                //     index === selectedIndex && this.props.selectedListItemClassName
                                                // )}

                                                className={classNames(
                                                    'search-contexts-dropdown__option list-group-item-action border-0'
                                                )}
                                                key={item.name}
                                                value={item.name}
                                            >
                                                <SearchContextInfoRow
                                                    name={item.name}
                                                    description={item.description || ''}
                                                    isDefault={item.isDefault}
                                                    isActive={wrappedSelectedIndex === index}
                                                    onDisableValue={disableValue}
                                                    // className="search-contexts-dropdown__option"
                                                />
                                            </li>
                                        </ButtonLink>
                                    ))
                                ) : filterInput.length > 0 ? (
                                    <li className="search-contexts-dropdown__no-results">No matching contexts</li>
                                ) : (
                                    <div>Empty</div>
                                )}
                            </ul>
                            <div className="search-contexts-dropdown__link-row d-flex justify-content-between">
                                <a>Reset to default</a>
                                <a>Manage search contexts</a>
                            </div>
                        </div>
                    </div>
                </TooltipPopoverWrapper>
            </div>
        </div>
    )
}

export const SearchContextInfoRow: React.FunctionComponent<{
    name: string
    description: string
    isActive: boolean
    onDisableValue: () => void
    isDefault?: boolean
}> = ({ name, description, isActive, onDisableValue, isDefault }) => (
    <>
        {/* <div>
            {isActive && (
                <button
                    type="button"
                    className="btn btn-icon"
                    onClick={onDisableValue}
                    aria-label="Disable version context"
                >
                    x
                </button>
            )}
        </div> */}

        <span className="search-contexts-dropdown__option-name d-flex align-items-center">{name}</span>
        <span className="search-contexts-dropdown__option-description text-muted d-flex align-items-center">
            {description}
        </span>
        <span
            className={classNames(
                { 'd-none': !isDefault },
                {
                    'd-flex align-items-center px-1 justify-content-center search-contexts-dropdown__option-default-tag': isDefault,
                },
                { 'search-contexts-dropdown__option-default-tag--active': isActive }
            )}
        >
            {isDefault && <span className="tag">Default</span>}
        </span>
    </>
)

export function filterItems(items: Context[], query: string): Context[] {
    if (!query) {
        // Already alphabetically sorted
        return items
    }

    // Memoize labels and scores.
    const labels: string[] = new Array(items.length)
    const scores: number[] = new Array(items.length)
    const scoredItems = items
        .filter((item, index) => {
            let label = labels[index]
            if (label === undefined) {
                label = item.name
                labels[index] = label
            }
            if (scores[index] === undefined) {
                scores[index] = stringScore(label, query, 0)
            }
            return scores[index] > 0
        })
        .map((item, index) =>
            // const recentIndex = recentActions?.indexOf(item.action.id)
            ({ item, score: scores[index] })
        )
    return sortBy(scoredItems, 'recentIndex', 'score', ({ item }) => item.name).map(({ item }) => item)
}
