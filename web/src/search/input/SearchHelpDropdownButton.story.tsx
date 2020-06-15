import { storiesOf } from '@storybook/react'
import React from 'react'
import webStyles from '../../SourcegraphWebApp.scss'
import bootstrapStyles from 'bootstrap/scss/bootstrap.scss'
import { SearchHelpDropdownButton } from './SearchHelpDropdownButton'

const { add } = storiesOf('web/SearchHelpDropdown', module).addDecorator(story => (
    <>
        <style>{bootstrapStyles}</style>
        <style>{webStyles}</style>
        <div className="theme-light">{story()}</div>
    </>
))

add('SearchHelpDropdown', () => <SearchHelpDropdownButton />)
