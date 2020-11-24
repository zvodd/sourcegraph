import { ListboxButton, ListboxInput, ListboxList, ListboxOption, ListboxPopover } from '@reach/listbox'
import classNames from 'classnames'
import React, { useCallback, useState } from 'react'

interface Context {
    name: string
    description: string
}
export const SearchContextsDropdown: React.FunctionComponent = () => {
    const contexts: Context[] = [
        { name: 'hello world', description: 'hello' },
        { name: 'test', description: 'test' },
    ]
    const [currentValue, setCurrentValue] = useState<Context['name'] | undefined>('hello world')

    const disableValue = useCallback((): void => {
        setCurrentValue(undefined)
    }, [setCurrentValue])

    return (
        <>
            <div>
                <div className="search-contexts-dropdown text-nowrap">
                    <ListboxInput value={currentValue} onChange={setCurrentValue}>
                        {({ isExpanded }) => (
                            <>
                                <ListboxButton
                                    className="search-contexts-dropdown__button btn btn-transparent"
                                    arrow={false}
                                >
                                    {!currentValue || currentValue === 'default' ? (
                                        <span
                                            className={classNames(
                                                'ml-2 mr-1'
                                                // If the info blurb hasn't been dismissed, still show the label on non-small screens.
                                                // { 'd-sm-none d-md-block': !hasDismissedInfo },
                                                // If the info blurb has been dismissed, never show this label.
                                                // { 'd-none': hasDismissedInfo }
                                            )}
                                        >
                                            Select context
                                        </span>
                                    ) : (
                                        <span className="ml-2 mr-1">{currentValue}</span>
                                    )}
                                </ListboxButton>
                                <ListboxPopover
                                    className={classNames(
                                        'search-contexts-dropdown__popover version-context-dropdown__popover dropdown-menu',
                                        {
                                            show: isExpanded,
                                        }
                                    )}
                                    portal={true}
                                >
                                    <ListboxList className="search-contexts-dropdown__list">
                                        {contexts
                                            // Render the current version context at the top, then other available version
                                            // contexts in alphabetical order.
                                            ?.sort((a, b) => {
                                                if (a.name === currentValue) {
                                                    return -1
                                                }
                                                if (b.name === currentValue) {
                                                    return 1
                                                }
                                                return a.name > b.name ? 1 : -1
                                            })
                                            .map(versionContext => (
                                                <ListboxOption
                                                    key={versionContext.name}
                                                    value={versionContext.name}
                                                    label={versionContext.name}
                                                    className="version-context-dropdown__option"
                                                >
                                                    <SearchContextInfoRow
                                                        name={versionContext.name}
                                                        description={versionContext.description || ''}
                                                        isActive={currentValue === versionContext.name}
                                                        onDisableValue={disableValue}
                                                    />
                                                </ListboxOption>
                                            ))}
                                    </ListboxList>
                                </ListboxPopover>
                            </>
                        )}
                    </ListboxInput>
                </div>
                {/* <ul>
                    {contexts.map(context => (
                        <li key={context}>{context}</li>
                    ))}
                </ul> */}
            </div>
        </>
    )
}

export const SearchContextInfoRow: React.FunctionComponent<{
    name: string
    description: string
    isActive: boolean
    onDisableValue: () => void
}> = ({ name, description, isActive, onDisableValue }) => (
    <>
        <div>
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
        </div>
        <span className="version-context-dropdown__option-name">{name}</span>
        <span className="version-context-dropdown__option-description">{description}</span>
    </>
)
