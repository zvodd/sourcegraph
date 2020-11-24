import {
    ListboxButton,
    ListboxGroupLabel,
    ListboxInput,
    ListboxList,
    ListboxOption,
    ListboxPopover,
} from '@reach/listbox'
import classNames from 'classnames'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Key } from 'ts-key-enum'
import { EmptyCommandList } from '../../../shared/src/commandPalette/EmptyCommandList'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import TooltipPopoverWrapper from 'reactstrap/lib/TooltipPopoverWrapper'
import { uniqueId } from 'lodash'

interface Context {
    name: string
    description: string
    isDefault?: boolean
}
export const SearchContextsDropdown: React.FunctionComponent = () => {
    const contexts: Context[] = [
        { name: 'my-repos', description: 'Your repositories on Sourcegraph', isDefault: true },
        { name: 'global', description: 'All repositories on Sourcegraph' },
    ]
    const [currentValue, setCurrentValue] = useState<Context['name'] | undefined>('hello world')
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

    const onInputKeyDown: React.KeyboardEventHandler<HTMLInputElement> = useCallback(
        event => {
            console.log('onkeydown')
            switch (event.key) {
                case Key.ArrowDown: {
                    // event.preventDefault()
                    setIndex(1)
                    break
                }
                case Key.ArrowUp: {
                    // event.preventDefault()
                    setIndex(-1)
                    break
                }
                case Key.Enter: {
                    // if (this.selectedItem) {
                    //     this.selectedItem.runAction(event)
                    // }
                    break
                }
            }
        },
        [setIndex]
    )
    const wrappedSelectedIndex = useMemo(
        () => ((selectedIndex % contexts.length) + contexts.length) % contexts.length,
        [selectedIndex, contexts.length]
    )

    const [isOpen, setIsOpen] = useState(false)
    const close = useCallback(() => setIsOpen(false), [])
    const toggleIsOpen = useCallback(() => setIsOpen(!isOpen), [isOpen])
    const id = useMemo(() => uniqueId('command-list-popover-button-'), [])
    const [autofocus, setAutofocus] = useState(true)

    return (
        // <>
        //     <div>
        //         <div className="search-contexts-dropdown text-nowrap">
        //             <ListboxInput value={wrappedSelectedIndex} onChange={setIndex}>
        //                 {({ isExpanded }) => (
        //                     <>
        //                         <ListboxButton
        //                             className="search-contexts-dropdown__button btn btn-transparent"
        //                             arrow={false}
        //                         >
        //                             {!currentValue || currentValue === 'default' ? (
        //                                 <span className={classNames('ml-2 mr-1')}>Select context</span>
        //                             ) : (
        //                                 <span className="ml-2 mr-1">{currentValue}</span>
        //                             )}
        //                         </ListboxButton>
        //                         <ListboxPopover
        //                             className={classNames(
        //                                 'search-contexts-dropdown__popover version-context-dropdown__popover dropdown-menu',
        //                                 {
        //                                     show: isExpanded,
        //                                 }
        //                             )}
        //                             portal={true}
        //                         >
        //                             <ListboxList className="search-contexts-dropdown__list">
        //                                 <ListboxGroupLabel disabled={true} value="title">
        //                                     <input
        //                                         id="command-list-input"
        //                                         ref={input => input?.focus({ preventScroll: true })}
        //                                         type="text"
        //                                         className="form-control px-2 py-1 rounded-0"
        //                                         value={filterInput}
        //                                         placeholder="Find a search context"
        //                                         spellCheck={false}
        //                                         autoCorrect="off"
        //                                         autoComplete="off"
        //                                         onChange={onFilterInputchange}
        //                                         onKeyDown={onInputKeyDown}
        //                                         tabIndex={-1}
        //                                     />
        //                                 </ListboxGroupLabel>
        //                                 {contexts
        //                                     // Render the current version context at the top, then other available version
        //                                     // contexts in alphabetical order.
        //                                     ?.sort((a, b) => {
        //                                         if (a.name === currentValue) {
        //                                             return -1
        //                                         }
        //                                         if (b.name === currentValue) {
        //                                             return 1
        //                                         }
        //                                         return a.name > b.name ? 1 : -1
        //                                     })
        //                                     .map((versionContext, index) => (
        //                                         <ListboxOption
        //                                             key={versionContext.name}
        //                                             value={index.toString()}
        //                                             label={versionContext.name}
        //                                             className="search-contexts-dropdown__option"
        //                                         >
        //                                             <SearchContextInfoRow
        //                                                 name={versionContext.name}
        //                                                 description={versionContext.description || ''}
        //                                                 isDefault={versionContext.isDefault}
        //                                                 isActive={wrappedSelectedIndex === index}
        //                                                 onDisableValue={disableValue}
        //                                             />
        //                                         </ListboxOption>
        //                                     ))}
        //                             </ListboxList>
        //                             <div className="search-contexts-dropdown__link-row d-flex justify-content-between">
        //                                 <a>Reset to default</a>
        //                                 <a>Manage search contexts</a>
        //                             </div>
        //                         </ListboxPopover>
        //                     </>
        //                 )}
        //             </ListboxInput>
        //         </div>
        //     </div>
        // </>
        <>
            <span
                role="button"
                className="search-contexts-dropdown__button btn"
                // isOpen ? buttonOpenClassName : ''
                id={id}
                onClick={toggleIsOpen}
            >
                {currentValue}
                <TooltipPopoverWrapper
                    isOpen={isOpen}
                    toggle={toggleIsOpen}
                    popperClassName="popover"
                    innerClassName={classNames('popover-inner', 'border rounded overflow-hidden')}
                    placement="bottom-end"
                    target={id}
                    trigger="legacy"
                    delay={0}
                    fade={false}
                    hideArrow={true}
                >
                    <div className="search-contexts-dropdown search-contexts-dropdown__popover version-context-dropdown__popover">
                        <header>
                            {/* eslint-disable-next-line react/forbid-elements */}
                            {/* <form className={this.props.formClassName} onSubmit={this.onSubmit}> */}
                            <label className="sr-only" htmlFor="command-list-input">
                                Command
                            </label>
                            <input
                                id="command-list-input"
                                ref={input => autofocus && input?.focus({ preventScroll: true })}
                                type="text"
                                className="form-control px-2 py-1 rounded-0"
                                value={filterInput}
                                placeholder="Run Sourcegraph action..."
                                spellCheck={false}
                                autoCorrect="off"
                                autoComplete="off"
                                onChange={onFilterInputchange}
                                onKeyDown={onInputKeyDown}
                            />
                            {/* </form> */}
                        </header>
                        <div className="search-contexts-dropdown__list">
                            <ul className="list-group list-group-flush list-unstyled">
                                {contexts.length > 0 ? (
                                    contexts.map((item, index) => (
                                        <li
                                            // className={classNames(
                                            //     this.props.listItemClassName,
                                            //     index === selectedIndex && this.props.selectedListItemClassName
                                            // )}

                                            className={classNames(
                                                'search-contexts-dropdown__option list-group-item list-group-item-action px-2',
                                                { 'active border-primary': wrappedSelectedIndex === index }
                                            )}
                                            key={item.name}
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
                                    ))
                                ) : filterInput.length > 0 ? (
                                    // <li className={this.props.noResultsClassName}>No matching commands</li>
                                    <li>No matching commands</li>
                                ) : (
                                    // <EmptyCommandList
                                    //     settingsCascade={this.state.settingsCascade}
                                    //     sourcegraphURL={this.props.platformContext.sourcegraphURL}
                                    // />
                                    <div>Empty</div>
                                )}
                            </ul>
                        </div>
                    </div>
                </TooltipPopoverWrapper>
            </span>
        </>
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
                    test
                </button>
            )}
        </div> */}
        <span className="search-contexts-dropdown__option-name d-flex align-items-center">{name}</span>
        <span className="search-contexts-dropdown__option-description text-muted d-flex align-items-center">
            {description}
        </span>
        <span
            className={classNames(
                { 'search-contexts-dropdown__option-default-tag': isDefault },
                { 'search-contexts-dropdown__option-default-tag--active': isActive },
                'd-flex align-items-center px-1 justify-content-center'
            )}
        >
            {isDefault && 'Default'}
        </span>
    </>
)
{
    /* // <ActionItem
//     {...this.props}
//     className={classNames(
//         this.props.actionItemClassName,
//         index === selectedIndex && this.props.selectedActionItemClassName
//     )}
//     {...item}
//     ref={index === selectedIndex ? this.setSelectedItem : undefined}
//     title={
//         <HighlightedMatches
//             text={[item.action.category, item.action.title || item.action.command]
//                 .filter(Boolean)
//                 .join(': ')}
//             pattern={query}
//         />
//     }
//     onDidExecute={this.onActionDidExecute}
// /> */
}
