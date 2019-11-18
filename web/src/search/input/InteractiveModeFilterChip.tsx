import * as React from 'react'
import { Form } from '../../components/Form'

interface Props {
    mapKey: string
    onFilterEdited: (filterKey: string, value: string) => void
    onFilterDeleted: () => void
    value: string
    filterType: string
}

interface State {
    editable: boolean
}

export default class InteractiveModeFilterChip extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            editable: true,
        }
    }

    private onInputUpdate = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.props.onFilterEdited(this.props.mapKey, e.target.value)
    }

    private onSubmitInput = (e: React.FormEvent<HTMLFormElement>): void => {
        this.setState({ editable: false })
    }

    public render(): JSX.Element | null {
        return (
            <>
                {this.state.editable ? (
                    <Form onSubmit={this.onSubmitInput}>
                        <div>
                            <input onChange={this.onInputUpdate} value={this.props.value} />
                        </div>
                    </Form>
                ) : (
                    <div>
                        <div>{this.props.value}</div>
                    </div>
                )}
            </>
        )
    }
}
