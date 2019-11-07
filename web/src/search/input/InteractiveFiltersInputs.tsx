import * as React from 'react'
import { FieldOptions } from './AddFilterDropdown'
import { Form } from '../../components/Form'
/**
 * InteractiveFilterInputs is a component that allows users to input a value for a particular search filter.
 * Each FilterInput represents the value for a particular search filter.
 */

interface Props {
    filter: FieldOptions
    onInteractiveQueryChange: (query: string) => void
}

interface State {
    editable: boolean
    value: string
}

export default class InteractiveFilterInputs extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            editable: true,
            value: '',
        }
    }

    public render(): JSX.Element | null {
        return this.state.editable ? (
            <Form onSubmit={this.onSubmitInput}>
                <input
                    placeholder={`${this.props.filter} filter...`}
                    key={this.props.filter}
                    className="form-control"
                    onChange={this.updateValue}
                />
            </Form>
        ) : (
            <div>{`${this.props.filter}:${this.state.value}`}</div>
        )
    }

    private onSubmitInput = () => {
        this.props.onInteractiveQueryChange(`${this.props.filter}:${this.state.value}`)
        this.setState(state => ({
            editable: !state.editable,
        }))
    }

    private updateValue = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ value: e.target.value })
    }
}
