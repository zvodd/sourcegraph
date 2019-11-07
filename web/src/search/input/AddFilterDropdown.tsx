import * as React from 'react'

export enum FieldOptions {
    Repo = 'repo',
    File = 'file',
}

export const AddFilterDropdown: React.FunctionComponent<{}> = () => (
    <select className="custom-select custom-select-sm e2e-theme-toggle" onChange={() => console.log('onchange')}>
        <option value={FieldOptions.Repo} disabled={true} selected={true}>
            Add filter...
        </option>
        <option value={FieldOptions.Repo}>Repo</option>
        <option value={FieldOptions.File}>File</option>
    </select>
)
