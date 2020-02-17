import React from 'react'
import renderer from 'react-test-renderer'
import { FilterInput } from './FilterInput'
import { FilterTypes } from '../../../../../shared/src/search/interactive/util'
import sinon from 'sinon'

const defaultProps = {
    filtersInQuery: {
        fork: {
            type: FilterTypes.fork,
            value: 'no',
            editable: false,
            negated: false,
        },
    },
    navbarQuery: { query: 'test', cursorPosition: 4 },
    mapKey: 'type',
    value: '',
    filterType: FilterTypes.type,
    editable: true,
    negated: false,
    isHomepage: false,
    onSubmit: sinon.spy(),
    onFilterEdited: sinon.spy(),
    onFilterDeleted: sinon.spy(),
    toggleFilterEditable: sinon.spy(),
    toggleFilterNegated: sinon.spy(),
}

describe('FilterInput', () => {
    test('normal', () => expect(renderer.create(<FilterInput {...defaultProps} />).toJSON()).toMatchSnapshot())
    test('filter input for content filters get auto-quoted', () =>
        expect(renderer.create(<FilterInput {...defaultProps} />).toJSON()).toMatchSnapshot())
    test('filter input for message filters get auto-quoted', () =>
        expect(renderer.create(<FilterInput {...defaultProps} />).toJSON()).toMatchSnapshot())
    test('Updating type filter works when inputting an empty value', () =>
        expect(renderer.create(<FilterInput {...defaultProps} />).toJSON()).toMatchSnapshot())
})
