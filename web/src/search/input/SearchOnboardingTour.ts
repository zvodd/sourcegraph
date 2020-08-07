import Shepherd from 'shepherd.js'

export const searchOnboardingTour = new Shepherd.Tour({
    useModalOverlay: false,
    defaultStepOptions: {
        classes: 'card p-2',
        scrollTo: false,
    },
})
