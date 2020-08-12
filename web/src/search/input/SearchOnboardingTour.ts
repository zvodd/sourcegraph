import Shepherd from 'shepherd.js'

export const searchOnboardingTour = new Shepherd.Tour({
    useModalOverlay: false,
    defaultStepOptions: {
        arrow: true,
        classes: 'web-content tour-card card p-2',
        popperOptions: {
            modifiers: [
                {
                    name: 'focusAfterRender',
                    enabled: false,
                },
            ],
        },
        attachTo: { on: 'bottom' },
        scrollTo: false,
    },
})
