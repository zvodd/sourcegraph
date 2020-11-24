import React from 'react'
import { WebStory } from '../components/WebStory'
import { SearchContextsDropdown } from './SearchContextsDropdown'

export default {
    title: 'web/search-contexts/SearchContextsDropdown',
    component: SearchContextsDropdown,
    decorators: [(story: () => React.ReactElement<any, any> | null) => <WebStory>{webProps => story()}</WebStory>],
}
export const Context = () => <SearchContextsDropdown />
