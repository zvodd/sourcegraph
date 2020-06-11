import HelpCircleOutlineIcon from 'mdi-react/HelpCircleOutlineIcon'
import React from 'react'
import { renderMarkdown } from '../../../../shared/src/util/markdown'
import { pluralize } from '../../../../shared/src/util/strings'
import { QueryFieldExample } from '../queryBuilder/QueryBuilderInputRow'
import Dropdown from 'react-bootstrap/Dropdown'

interface Props {
    title: string
    markdown: string
    examples?: QueryFieldExample[]
}

interface State {
    isOpen: boolean
}

export const InfoDropdown: React.FunctionComponent<Props> = (props: Props) => (
    <Dropdown>
        <Dropdown.Toggle
            id="info-dropdown-toggle"
            variant="link"
            className="pl-2 pr-0 btn btn-link d-flex align-items-center"
        >
            <HelpCircleOutlineIcon className="icon-inline small" />
        </Dropdown.Toggle>
        <Dropdown.Menu>
            <Dropdown.Header>
                <strong>{props.title}</strong>
            </Dropdown.Header>
            <Dropdown.Divider />
            <div className="info-dropdown__content">
                <small dangerouslySetInnerHTML={{ __html: renderMarkdown(props.markdown) }} />
            </div>
            <Dropdown.Divider />
            <div className="info-dropdown__content">
                <small dangerouslySetInnerHTML={{ __html: renderMarkdown(props.markdown) }} />
            </div>

            {props.examples && (
                <>
                    <Dropdown.Divider />
                    <Dropdown.Header>
                        <strong>{pluralize('Example', props.examples.length)}</strong>
                    </Dropdown.Header>
                    <ul className="list-unstyled mb-2">
                        {props.examples.map(example => (
                            <div key={example.value}>
                                <div className="p-2">
                                    <span className="text-muted small">{example.description}: </span>
                                    <code>{example.value}</code>
                                </div>
                            </div>
                        ))}
                    </ul>
                </>
            )}
        </Dropdown.Menu>
    </Dropdown>
)
