import { SuggestionTypes } from '../suggestions/util'

export interface FiltersToTypeAndValue {
    [key: string]: { type: SuggestionTypes; value: string; editable: boolean }
}
