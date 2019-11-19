import * as React from 'react'
import { Subject, Subscription } from 'rxjs'
import { Form } from '../../components/Form'
import CloseIcon from 'mdi-react/CloseIcon'

interface Props {
    mapKey: string
    onFilterEdited: (filterKey: string, value: string) => void
    onFilterDeleted: (filterKey: string) => void
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

    private onSubmitInput = (): void => {
        this.setState({ editable: false })
    }

    private onClickSelected = (): void => {
        this.setState({ editable: true })
    }

    private onClickDelete = (): void => {
        this.props.onFilterDeleted(this.props.mapKey)
    }

    public render(): JSX.Element | null {
        return (
            <>
                {this.state.editable ? (
                    <Form onSubmit={this.onSubmitInput}>
                        <div>
                            <input onChange={this.onInputUpdate} value={this.props.value} />
                            <div onClick={this.onClickDelete}>
                                <CloseIcon />
                            </div>
                        </div>
                    </Form>
                ) : (
                    <div className="d-flex">
                        <div onClick={this.onClickSelected}>{this.props.value}</div>
                        <div onClick={this.onClickDelete}>
                            <CloseIcon />
                        </div>
                    </div>
                )}
            </>
        )
    }
}
