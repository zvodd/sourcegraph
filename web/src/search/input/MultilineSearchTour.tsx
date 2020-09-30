import React, { useCallback, useEffect, useMemo, useState } from 'react'

interface MultilineSearchTourProps {
    nextSearchQuery: (query: string) => void
}

const SEARCH_TOUR_STEPS: string[] = [
    `
# Set a repo: filter to narrow down search results
repo:gorilla/mux
`,
    `
# Repository filters support full regex syntax.
# The filter below will match three repositories:
# - github.com/gorilla/mux
# - github.com/gorilla/muxy
# - github.com/gorilla/websocket
repo:^github.com/gorilla/(muxy?|websocket)$
`,
    `
# Use file: filters to match file paths
`,
]

export const MultilineSearchTour: React.FunctionComponent<MultilineSearchTourProps> = ({ nextSearchQuery }) => {
    const [takingSearchTour, setTakingSearchTour] = useState(false)
    const startSearchTour = useCallback(() => setTakingSearchTour(true), [setTakingSearchTour])
    const stopSearchTour = useCallback(() => setTakingSearchTour(false), [setTakingSearchTour])
    const [currentStep, setCurrentStep] = useState(0)
    const previousSearchTourStep = useCallback(() => {
        setCurrentStep(currentStep => (currentStep === 0 ? currentStep : currentStep - 1))
    }, [setCurrentStep])
    const nextSearchTourStep = useCallback(() => {
        setCurrentStep(currentStep => (currentStep + 1 === SEARCH_TOUR_STEPS.length ? currentStep : currentStep + 1))
    }, [setCurrentStep])
    useEffect(() => {
        if (!setTakingSearchTour) {
            nextSearchQuery('')
        } else {
            nextSearchQuery(SEARCH_TOUR_STEPS[currentStep])
        }
    }, [nextSearchQuery, currentStep])
    return (
        <>
            {takingSearchTour ? (
                <div className="d-flex">
                    <button type="button" onClick={previousSearchTourStep}>
                        {'<'}
                    </button>
                    <button type="button" onClick={nextSearchTourStep}>
                        {'>'}
                    </button>
                    <button type="button" onClick={stopSearchTour}>
                        Stop
                    </button>
                </div>
            ) : (
                <button type="button" onClick={startSearchTour}>
                    Explore search
                </button>
            )}
        </>
    )
}
