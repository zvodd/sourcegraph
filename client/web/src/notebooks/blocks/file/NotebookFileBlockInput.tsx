import {
    Combobox,
    ComboboxInput,
    ComboboxOption,
    ComboboxPopover,
    ComboboxOptionText,
    ComboboxList,
} from '@reach/combobox'
import classNames from 'classnames'
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'

import { isMacPlatform as isMacPlatformFn } from '@sourcegraph/common'

import { isModifierKeyPressed } from '../useBlockShortcuts'

import styles from './NotebookFileBlockInput.module.scss'

interface NotebookFileBlockInputProps {
    id?: string
    className?: string
    inputClassName?: string
    placeholder: string
    value: string
    onChange: (value: string) => void
    onFocus: (event: React.FocusEvent<HTMLInputElement>) => void
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => void
    suggestions?: string[]
    suggestionsIcon?: JSX.Element
    isValid?: boolean
    focusInput?: boolean
    dataTestId?: string
}

export const NotebookFileBlockInput: React.FunctionComponent<NotebookFileBlockInputProps> = ({
    id,
    className,
    inputClassName,
    placeholder,
    value,
    onChange,
    onFocus,
    onBlur,
    suggestions,
    suggestionsIcon,
    isValid,
    focusInput,
    dataTestId,
}) => {
    const [inputValue, setInputValue] = useState(value)
    const isMacPlatform = useMemo(() => isMacPlatformFn(), [])
    const onSelect = useCallback(
        (value: string) => {
            setInputValue(value)
            onChange(value)
        },
        [onChange, setInputValue]
    )

    const inputReference = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (focusInput) {
            inputReference.current?.focus()
        }
        // Only focus input on the initial render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputReference])

    useEffect(() => setInputValue(value), [setInputValue, value])

    const popoverReference = useRef<HTMLDivElement>(null)
    const onKeyDown = (event: React.KeyboardEvent): void => {
        // Reach Combobox does not automatically scroll the popover when moving the selected item with a keyboard.
        // We have to do it manually by finding the currently selected option and scrolling the popover container
        // to make it visible. We are using requestAnimationFrame to prevent triggering reflows because we are
        // referencing element sizes and scroll positions.
        // Code adapted from: https://github.com/reach/reach-ui/issues/357
        window.requestAnimationFrame(() => {
            const container = popoverReference.current
            if (!container) {
                return
            }
            const element = container.querySelector<HTMLElement>('[aria-selected=true]')
            if (!element) {
                return
            }
            const top = element.offsetTop - container.scrollTop
            const bottom = container.scrollTop + container.clientHeight - (element.offsetTop + element.clientHeight)
            if (bottom < 0) {
                container.scrollTop -= bottom
            }
            if (top < 0) {
                container.scrollTop += top
            }
        })

        if (event.key === 'Escape') {
            const target = event.target as HTMLElement
            target.blur()
        } else if (event.key === 'Tab' && !event.shiftKey) {
            // Reach does not support 'Tab' as a select trigger, so we have to manually select the currently highlighted suggestion.
            const element = popoverReference.current?.querySelector<HTMLElement>(
                '[aria-selected=true] [data-suggestion-value]'
            )
            if (element?.dataset.suggestionValue) {
                event.preventDefault()
                onSelect(element.dataset.suggestionValue)
            }
        } else if (
            // Allow cmd+Enter/ctrl+Enter to propagate to run the block, stop all other events
            !(event.key === 'Enter' && isModifierKeyPressed(event.metaKey, event.ctrlKey, isMacPlatform))
        ) {
            event.stopPropagation()
        }
    }

    return (
        <Combobox openOnFocus={true} onSelect={onSelect} className={className} onKeyDown={onKeyDown}>
            <ComboboxInput
                id={id}
                ref={inputReference}
                className={classNames(
                    inputClassName,
                    'form-control',
                    isValid === true && 'is-valid',
                    isValid === false && 'is-invalid'
                )}
                value={inputValue}
                placeholder={placeholder}
                onChange={event => onSelect(event.target.value)}
                onFocus={onFocus}
                onBlur={onBlur}
                onPaste={event => event.stopPropagation()}
                data-testid={dataTestId}
            />
            {/* Only show suggestions popover for the latest input value and if it does not contain an exact match.
                This is to prevent opening the suggestions popover when a file URL is pasted into the file block. */}
            {suggestions && value === inputValue && !suggestions.includes(inputValue) && (
                <ComboboxPopover ref={popoverReference} className={styles.suggestionsPopover}>
                    <ComboboxList className={styles.suggestionsList}>
                        {suggestions.map(suggestion => (
                            <ComboboxOption className={styles.suggestionsOption} key={suggestion} value={suggestion}>
                                <span data-suggestion-value={suggestion}>
                                    {suggestionsIcon}
                                    <ComboboxOptionText />
                                </span>
                            </ComboboxOption>
                        ))}
                    </ComboboxList>
                </ComboboxPopover>
            )}
        </Combobox>
    )
}
