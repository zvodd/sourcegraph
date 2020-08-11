import Shepherd from 'shepherd.js'

export const searchOnboardingTour = new Shepherd.Tour({
    useModalOverlay: false,
    defaultStepOptions: {
        arrow: true,
        classes: 'card p-2 rounded',
        popperOptions: {
            modifiers: [
                {
                    name: 'focusAfterRender',
                    enabled: false,
                },
            ],
        },
        scrollTo: false,
    },
})
