import Shepherd from 'shepherd.js'

export const searchOnboardingTour = new Shepherd.Tour({
    defaultStepOptions: {
        classes: 'card p-2',
        scrollTo: false,
    },
})
