import { DOMFunctions } from '@sourcegraph/codeintellify'
import { applyDecorations } from './decorations'

describe('applyDecorations()', () => {
    const dom: DOMFunctions = {
        getCodeElementFromLineNumber: (codeView, lineNumber) => codeView.querySelector(`.line-${lineNumber}`),
        getCodeElementFromTarget: () => {
            throw new Error('Not implemented')
        },
        getLineNumberFromCodeElement: () => {
            throw new Error('Not implemented')
        },
    }

    const createCodeView = () => {
        const codeView = document.createElement('div')
        codeView.className = 'code-view'
        for (const lineNumber of [1, 2, 3, 4]) {
            const line = document.createElement('div')
            line.className = `line-${lineNumber}`
            codeView.appendChild(line)
        }
        document.body.appendChild(codeView)
    }

    beforeEach(() => {
        for (const test of document.querySelectorAll('.code-view')) {
            test.remove()
        }
        createCodeView()
    })

    test('sets the background color', () => {
        const codeView = document.body.querySelector('.code-view') as HTMLElement
        applyDecorations(
            dom,
            codeView,
            [
                {
                    range: {
                        start: {
                            line: 0,
                            character: 0,
                        },
                        end: {
                            line: 0,
                            character: 0,
                        },
                    },
                    backgroundColor: 'red',
                },
            ],
            []
        )
        const firstLine = dom.getCodeElementFromLineNumber(codeView, 1)
        expect(firstLine!.style.backgroundColor).toBe('red')
    })

    test('adds an `after` annotation', () => {
        const codeView = document.querySelector('.code-view') as HTMLElement
        applyDecorations(
            dom,
            codeView,
            [
                {
                    range: {
                        start: {
                            line: 0,
                            character: 0,
                        },
                        end: {
                            line: 0,
                            character: 0,
                        },
                    },
                    after: {
                        contentText: 'foo',
                        hoverMessage: 'bar',
                        linkURL: 'example.org',
                    },
                },
            ],
            []
        )
        const annotation = dom
            .getCodeElementFromLineNumber(codeView, 1)!
            .querySelector('.sourcegraph-extension-element.line-decoration-attachment')
        expect(annotation).toBeInstanceOf(HTMLAnchorElement)
        expect((annotation as HTMLAnchorElement).href).toContain('example.org')
        expect(annotation!.firstChild!.textContent).toBe('foo')
        expect((annotation!.firstChild as HTMLElement).title).toBe('bar')
    })

    test('adds several decorations on the same line', () => {
        const codeView = document.querySelector('.code-view') as HTMLElement
        applyDecorations(
            dom,
            codeView,
            [
                // Set background color
                {
                    range: {
                        start: {
                            line: 0,
                            character: 0,
                        },
                        end: {
                            line: 0,
                            character: 0,
                        },
                    },
                    backgroundColor: 'red',
                },
                // Add a link annotation
                {
                    range: {
                        start: {
                            line: 0,
                            character: 0,
                        },
                        end: {
                            line: 0,
                            character: 0,
                        },
                    },
                    after: {
                        contentText: 'foo',
                        linkURL: 'example.org',
                    },
                },
                // Add a text annotation with a background color
                {
                    range: {
                        start: {
                            line: 0,
                            character: 0,
                        },
                        end: {
                            line: 0,
                            character: 0,
                        },
                    },
                    after: {
                        contentText: 'bar',
                        backgroundColor: 'blue',
                    },
                },
            ],
            []
        )
        const firstLine = dom.getCodeElementFromLineNumber(codeView, 1) as HTMLElement
        expect(firstLine.style.backgroundColor).toBe('red')
        const annotations = firstLine.querySelectorAll('.sourcegraph-extension-element.line-decoration-attachment')
        expect(annotations.length).toBe(2)
        expect(annotations[0]).toBeInstanceOf(HTMLAnchorElement)
        expect(annotations[0].firstChild!.textContent).toBe('foo')
        expect((annotations[0] as HTMLAnchorElement).href).toContain('example.org')
        expect(annotations[1].textContent).toBe('bar')
        expect((annotations[1] as HTMLElement).style.backgroundColor).toBe('blue')
    })

    test('adds decorations on multiple lines', () => {
        const codeView = document.querySelector('.code-view') as HTMLElement
        const decoratedLines = applyDecorations(
            dom,
            codeView,
            [
                {
                    range: {
                        start: {
                            line: 0,
                            character: 0,
                        },
                        end: {
                            line: 0,
                            character: 0,
                        },
                    },
                    backgroundColor: 'red',
                },
                {
                    range: {
                        start: {
                            line: 2,
                            character: 0,
                        },
                        end: {
                            line: 2,
                            character: 0,
                        },
                    },
                    backgroundColor: 'blue',
                },
                {
                    range: {
                        start: {
                            line: 3,
                            character: 0,
                        },
                        end: {
                            line: 3,
                            character: 0,
                        },
                    },
                    backgroundColor: 'yellow',
                },
            ],
            []
        )
        expect(decoratedLines).toEqual([1, 3, 4])
        expect(dom.getCodeElementFromLineNumber(codeView, 1)!.style.backgroundColor).toBe('red')
        expect(dom.getCodeElementFromLineNumber(codeView, 3)!.style.backgroundColor).toBe('blue')
        expect(dom.getCodeElementFromLineNumber(codeView, 4)!.style.backgroundColor).toBe('yellow')
    })

    test('removes preexisting decorations', () => {
        const codeView = document.querySelector('.code-view') as HTMLElement
        const firstLine = codeView.querySelector('.line-1') as HTMLElement
        const thirdLine = codeView.querySelector('.line-3') as HTMLElement
        // Decorate first line
        const decoratedLines = applyDecorations(
            dom,
            codeView,
            [
                {
                    range: {
                        start: {
                            line: 0,
                            character: 0,
                        },
                        end: {
                            line: 0,
                            character: 0,
                        },
                    },
                    backgroundColor: 'red',
                    after: {
                        contentText: 'foo',
                    },
                },
            ],
            []
        )
        expect(firstLine.style.backgroundColor).toBe('red')
        expect(firstLine.querySelectorAll('.sourcegraph-extension-element.line-decoration-attachment').length).toBe(1)
        // Decorate third line, and pass the decorated lines returned by `applyDecorations`
        applyDecorations(
            dom,
            codeView,
            [
                {
                    range: {
                        start: {
                            line: 2,
                            character: 0,
                        },
                        end: {
                            line: 2,
                            character: 0,
                        },
                    },
                    backgroundColor: 'blue',
                },
            ],
            decoratedLines
        )
        // Only third line should be decorated
        expect(firstLine.style.backgroundColor).toBe('')
        expect(firstLine.querySelectorAll('.sourcegraph-extension-element.line-decoration-attachment').length).toBe(0)
        expect(thirdLine.style.backgroundColor).toBe('blue')
    })
})
