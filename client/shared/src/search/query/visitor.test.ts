import { visit, Visitors } from './visitor'
import { parseSearchQuery, ParseSuccess, Node } from './parser'

expect.addSnapshotSerializer({
    serialize: value => JSON.stringify(value, null, 2),
    test: () => true,
})

/**
 * A function that defines a simple visitor to collect visited nodes
 * in a query string, and returns the string result.
 *
 * @param input The input query string.
 */
const collect = (input: string): Node[] => {
    const nodes: Node[] = []
    const visitors: Visitors = {
        visitOperator(operands, kind, range) {
            nodes.push({ type: 'operator', operands, kind, range })
        },
        visitParameter(field, value, negated, range) {
            nodes.push({ type: 'parameter', field, value, negated, range })
        },
        visitPattern(value, kind, negated, quoted, range) {
            nodes.push({ type: 'pattern', value, kind, negated, quoted, range })
        },
    }
    visit((parseSearchQuery(input) as ParseSuccess).nodes, visitors)
    return nodes
}

describe('visit()', () => {
    test('basic visit', () => {
        expect(collect('repo:foo pattern-bar or file:baz')).toMatchInlineSnapshot(`
            [
              {
                "type": "operator",
                "operands": [
                  {
                    "type": "parameter",
                    "field": "repo",
                    "value": "foo",
                    "negated": false,
                    "range": {
                      "start": 0,
                      "end": 8
                    }
                  },
                  {
                    "type": "pattern",
                    "kind": 1,
                    "value": "pattern-bar",
                    "quoted": false,
                    "negated": false,
                    "range": {
                      "start": 9,
                      "end": 20
                    }
                  },
                  {
                    "type": "parameter",
                    "field": "file",
                    "value": "baz",
                    "negated": false,
                    "range": {
                      "start": 24,
                      "end": 32
                    }
                  }
                ],
                "kind": "OR",
                "range": {
                  "start": 0,
                  "end": 32
                }
              },
              {
                "type": "parameter",
                "field": "repo",
                "value": "foo",
                "negated": false,
                "range": {
                  "start": 0,
                  "end": 8
                }
              },
              {
                "type": "pattern",
                "value": "pattern-bar",
                "kind": 1,
                "negated": false,
                "quoted": false,
                "range": {
                  "start": 9,
                  "end": 20
                }
              },
              {
                "type": "parameter",
                "field": "file",
                "value": "baz",
                "negated": false,
                "range": {
                  "start": 24,
                  "end": 32
                }
              }
            ]
        `)
    })
})
