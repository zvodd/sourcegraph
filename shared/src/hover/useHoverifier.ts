import { useEffect, useCallback, useState, useMemo } from 'react'
import { Subscription, Subject, combineLatest, BehaviorSubject } from 'rxjs'
import { Hoverifier, HoverState, createHoverifier, HoverifierOptions } from '@sourcegraph/codeintellify'
import { filter, map, tap } from 'rxjs/operators'
import { property, isDefined } from '../util/types'

export function useHoverifier<C extends {}, D, A>({
    getHover,
    getActions,
    getDocumentHighlights,
}: Pick<HoverifierOptions<C, D, A>, 'getHover' | 'getActions' | 'getDocumentHighlights'>): {
    hoverifier: Hoverifier<C, D, A>
    nextRelativeElement: (element: HTMLElement | null) => void
    nextHoverOverlayElement: (element: HTMLElement | null) => void
    nextCloseButtonClick: (event: MouseEvent) => void
    hoverState: HoverState<C, D, A>
} {
    /** Emits whenever the ref callback for the hover element is called */
    const hoverOverlayElements = useMemo(() => new BehaviorSubject<HTMLElement | null>(null), [])
    const nextHoverOverlayElement = useCallback(
        (element: HTMLElement | null) => {
            console.log('nextHoverOverlayElement', element)
            hoverOverlayElements.next(element)
        },
        [hoverOverlayElements]
    )

    /** Emits whenever the ref callback for the hover element is called */
    const relativeElements = useMemo(() => new BehaviorSubject<HTMLElement | null>(null), [])
    const nextRelativeElement = useCallback(
        (element: HTMLElement | null) => {
            console.log('nextRelativeElement', element)
            relativeElements.next(element)
        },
        [relativeElements]
    )

    const closeButtonClicks = new Subject<MouseEvent>()
    const nextCloseButtonClick = useCallback((event: MouseEvent) => closeButtonClicks.next(event), [closeButtonClicks])

    const hoverifier = useMemo(
        () =>
            createHoverifier<C, D, A>({
                closeButtonClicks,
                hoverOverlayElements,
                hoverOverlayRerenders: combineLatest([hoverOverlayElements, relativeElements]).pipe(
                    tap(([hoverOverlayElement, relativeElement]) =>
                        console.log({ hoverOverlayElement, relativeElement })
                    ),
                    map(([hoverOverlayElement, relativeElement]) => ({ hoverOverlayElement, relativeElement })),
                    filter(property('relativeElement', isDefined)),
                    filter(property('hoverOverlayElement', isDefined))
                ),
                getHover,
                getDocumentHighlights,
                getActions,
                pinningEnabled: true,
            }),
        [closeButtonClicks, getActions, getDocumentHighlights, getHover, hoverOverlayElements, relativeElements]
    )
    const [hoverState, setHoverState] = useState<HoverState<C, D, A>>(hoverifier.hoverState)
    useEffect(() => {
        const subscriptions = new Subscription()
        subscriptions.add(hoverifier)
        console.log('subscribe to hover state updates')
        subscriptions.add(hoverifier.hoverStateUpdates.subscribe(hoverState => setHoverState(hoverState)))
        return () => subscriptions.unsubscribe()
    }, [hoverifier, setHoverState])

    return {
        hoverState,
        hoverifier,
        nextHoverOverlayElement,
        nextRelativeElement,
        nextCloseButtonClick,
    }
}
