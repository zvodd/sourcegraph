import React from 'react'
import { FilterInput } from './FilterInput'
import { FilterTypes, FiltersToTypeAndValue } from '../../../../../shared/src/search/interactive/util'
import sinon from 'sinon'
import { render, fireEvent, cleanup, getByText, getByDisplayValue } from '@testing-library/react'

const defaultFiltersInQuery: FiltersToTypeAndValue = {
    fork: {
        type: FilterTypes.fork,
        value: 'no',
        editable: false,
        negated: false,
    },
}
const defaultProps = {
    filtersInQuery: defaultFiltersInQuery,
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
    afterAll(cleanup)
    let container: HTMLElement
    let rerender: (ui: React.ReactElement) => void
    beforeEach(() => {
        ;({ rerender, container } = render(<FilterInput {...defaultProps} editable={true} />))
    })
    // test('normal', () => expect(renderer.create(<FilterInput {...defaultProps} />).toJSON()).toMatchSnapshot())
    it('filter input for content filters get auto-quoted', () => {
        let nextFiltersInQuery = {}
        let nextValue = ''
        const filterHandler = (newFiltersInQuery: FiltersToTypeAndValue, value: string) => {
            nextFiltersInQuery = newFiltersInQuery
            nextValue = value
        }

        const onFilterEdited = async (filterKey: string, inputValue: string) => {
            const newFiltersInQuery = {
                ...defaultFiltersInQuery,
                [filterKey]: {
                    ...defaultFiltersInQuery[filterKey],
                    inputValue,
                    editable: false,
                },
            }
            await filterHandler(newFiltersInQuery, `${inputValue}`)
        }
        ;({ rerender, container } = render(
            <FilterInput
                {...defaultProps}
                mapKey="content"
                filterType={FilterTypes.content}
                onFilterEdited={onFilterEdited}
                editable={true}
            />
        ))

        const inputEl = container.querySelector('.filter-input__input-field')
        expect(inputEl).toBeTruthy()
        fireEvent.click(inputEl!)
        fireEvent.change(inputEl!, { target: { value: 'test query' } })
        const confirmBtn = container.querySelector('.check-button__btn')
        expect(confirmBtn).toBeTruthy()
        fireEvent.click(confirmBtn!)
        ;({ container } = render(
            <FilterInput
                {...defaultProps}
                mapKey="content"
                filtersInQuery={nextFiltersInQuery}
                filterType={FilterTypes.content}
                value={nextValue}
                onFilterEdited={onFilterEdited}
                editable={false}
            />
        ))
        expect(getByText(container, 'content:"test query"')).toBeTruthy()
    })

    // test('filter input for message filters get auto-quoted', () =>
    //     expect(renderer.create(<FilterInput {...defaultProps} />).toJSON()).toMatchSnapshot())
    // test('Updating type filter works when inputting an empty value', () =>
    //     expect(renderer.create(<FilterInput {...defaultProps} />).toJSON()).toMatchSnapshot())
})
