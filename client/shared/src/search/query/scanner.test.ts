import { SearchPatternType } from '../../graphql-operations'

import { scanSearchQuery, scanBalancedLiteral, toPatternResult } from './scanner'

expect.addSnapshotSerializer({
    serialize: value => JSON.stringify(value),
    test: () => true,
})

describe('scanBalancedPattern()', () => {
    const scanBalancedPattern = toPatternResult(scanBalancedLiteral, 'pattern-literal')
    test('balanced, scans up to whitespace', () => {
        expect(scanBalancedPattern('foo OR bar', 0)).toMatchInlineSnapshot(
            '{"type":"success","term":{"type":"literal","range":{"start":0,"end":3},"kind":"pattern-literal","value":"foo","quoted":false}}'
        )
    })

    test('balanced, consumes spaces', () => {
        expect(scanBalancedPattern('(hello there)', 0)).toMatchInlineSnapshot(
            '{"type":"success","term":{"type":"literal","range":{"start":0,"end":13},"kind":"pattern-literal","value":"(hello there)","quoted":false}}'
        )
    })

    test('balanced, consumes unrecognized filter-like value', () => {
        expect(scanBalancedPattern('( general:kenobi )', 0)).toMatchInlineSnapshot(
            '{"type":"success","term":{"type":"literal","range":{"start":0,"end":18},"kind":"pattern-literal","value":"( general:kenobi )","quoted":false}}'
        )
    })

    test('not recognized, contains not keyword', () => {
        expect(scanBalancedPattern('(foo not bar)', 0)).toMatchInlineSnapshot(
            '{"type":"error","expected":"no recognized filter or keyword","at":5}'
        )
    })

    test('not recognized, starts with a not keyword', () => {
        expect(scanBalancedPattern('(not chocolate)', 0)).toMatchInlineSnapshot(
            '{"type":"error","expected":"no recognized filter or keyword","at":1}'
        )
    })

    test('not recognized, contains an or keyword', () => {
        expect(scanBalancedPattern('(foo OR bar)', 0)).toMatchInlineSnapshot(
            '{"type":"error","expected":"no recognized filter or keyword","at":5}'
        )
    })

    test('not recognized, contains an and keyword', () => {
        expect(scanBalancedPattern('repo:foo AND bar', 0)).toMatchInlineSnapshot(
            '{"type":"error","expected":"no recognized filter or keyword","at":0}'
        )
    })

    test('not recognized, contains a recognized repo field', () => {
        expect(scanBalancedPattern('repo:foo bar', 0)).toMatchInlineSnapshot(
            '{"type":"error","expected":"no recognized filter or keyword","at":0}'
        )
    })

    test('balanced, no conflicting tokens', () => {
        expect(scanBalancedPattern('(bor band )', 0)).toMatchInlineSnapshot(
            '{"type":"success","term":{"type":"literal","range":{"start":0,"end":11},"kind":"pattern-literal","value":"(bor band )","quoted":false}}'
        )
    })

    test('not recognized, unbalanced', () => {
        expect(scanBalancedPattern('foo(', 0)).toMatchInlineSnapshot(
            '{"type":"error","expected":"no unbalanced parentheses","at":4}'
        )
    })
})

describe('scanSearchQuery() for literal search', () => {
    test('empty', () => expect(scanSearchQuery('')).toMatchInlineSnapshot('{"type":"success","term":[]}'))

    test('whitespace', () =>
        expect(scanSearchQuery('  ')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"whitespace","range":{"start":0,"end":2}}]}'
        ))

    test('literal', () =>
        expect(scanSearchQuery('a')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"literal","range":{"start":0,"end":1},"kind":"pattern-literal","value":"a","quoted":false}]}'
        ))

    test('triple quotes', () => {
        expect(scanSearchQuery('"""')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"literal","range":{"start":0,"end":3},"kind":"pattern-literal","value":"\\"\\"\\"","quoted":false}]}'
        )
    })

    test('filter', () =>
        expect(scanSearchQuery('f:b')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"field","range":{"start":0,"end":1},"value":"f","negated":false},{"type":"literal","value":":","range":{"start":1,"end":2},"quoted":false,"kind":"separator"},{"type":"literal","value":"b","range":{"start":2,"end":3},"quoted":false,"kind":"f-balanced-literal"}]}'
        ))

    test('negated filter', () =>
        expect(scanSearchQuery('-f:b')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"field","range":{"start":0,"end":2},"value":"-f","negated":true},{"type":"literal","value":":","range":{"start":2,"end":3},"quoted":false,"kind":"separator"},{"type":"literal","value":"b","range":{"start":3,"end":4},"quoted":false,"kind":"-f-balanced-literal"}]}'
        ))

    test('filter with quoted value', () => {
        expect(scanSearchQuery('f:"b"')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"field","range":{"start":0,"end":1},"value":"f","negated":false},{"type":"literal","value":":","range":{"start":1,"end":2},"quoted":false,"kind":"separator"},{"type":"literal","value":"b","range":{"start":2,"end":5},"quoted":true,"kind":"f-quoted"}]}'
        )
    })

    test('filter with a value ending with a colon', () => {
        expect(scanSearchQuery('f:a:')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"field","range":{"start":0,"end":1},"value":"f","negated":false},{"type":"literal","value":":","range":{"start":1,"end":2},"quoted":false,"kind":"separator"},{"type":"literal","value":"a:","range":{"start":2,"end":4},"quoted":false,"kind":"f-balanced-literal"}]}'
        )
    })

    test('filter where the value is a colon', () => {
        expect(scanSearchQuery('f:a:')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"field","range":{"start":0,"end":1},"value":"f","negated":false},{"type":"literal","value":":","range":{"start":1,"end":2},"quoted":false,"kind":"separator"},{"type":"literal","value":"a:","range":{"start":2,"end":4},"quoted":false,"kind":"f-balanced-literal"}]}'
        )
    })

    test('quoted, double quotes', () =>
        expect(scanSearchQuery('"a:b"')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"literal","value":"a:b","range":{"start":0,"end":5},"quoted":true,"kind":"quoted"}]}'
        ))

    test('quoted, single quotes', () =>
        expect(scanSearchQuery("'a:b'")).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"literal","value":"a:b","range":{"start":0,"end":5},"quoted":true,"kind":"quoted"}]}'
        ))

    test('quoted (escaped quotes)', () =>
        expect(scanSearchQuery('"-\\"a\\":b"')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"literal","value":"-\\\\\\"a\\\\\\":b","range":{"start":0,"end":10},"quoted":true,"kind":"quoted"}]}'
        ))

    test('complex query', () =>
        expect(scanSearchQuery('repo:^github\\.com/gorilla/mux$ lang:go -file:mux.go Router')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"field","range":{"start":0,"end":4},"value":"repo","negated":false},{"type":"literal","value":":","range":{"start":4,"end":5},"quoted":false,"kind":"separator"},{"type":"literal","value":"^github\\\\.com/gorilla/mux$","range":{"start":5,"end":30},"quoted":false,"kind":"repo-balanced-literal"},{"type":"whitespace","range":{"start":30,"end":31}},{"type":"field","range":{"start":31,"end":35},"value":"lang","negated":false},{"type":"literal","value":":","range":{"start":35,"end":36},"quoted":false,"kind":"separator"},{"type":"literal","value":"go","range":{"start":36,"end":38},"quoted":false,"kind":"lang-balanced-literal"},{"type":"whitespace","range":{"start":38,"end":39}},{"type":"field","range":{"start":39,"end":44},"value":"-file","negated":true},{"type":"literal","value":":","range":{"start":44,"end":45},"quoted":false,"kind":"separator"},{"type":"literal","value":"mux.go","range":{"start":45,"end":51},"quoted":false,"kind":"-file-balanced-literal"},{"type":"whitespace","range":{"start":51,"end":52}},{"type":"literal","range":{"start":52,"end":58},"kind":"pattern-literal","value":"Router","quoted":false}]}'
        ))

    test('parenthesized parameters', () => {
        expect(scanSearchQuery('repo:a (file:b and c)')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"field","range":{"start":0,"end":4},"value":"repo","negated":false},{"type":"literal","value":":","range":{"start":4,"end":5},"quoted":false,"kind":"separator"},{"type":"literal","value":"a","range":{"start":5,"end":6},"quoted":false,"kind":"repo-balanced-literal"},{"type":"whitespace","range":{"start":6,"end":7}},{"type":"openingParen","range":{"start":7,"end":8}},{"type":"field","range":{"start":8,"end":12},"value":"file","negated":false},{"type":"literal","value":":","range":{"start":12,"end":13},"quoted":false,"kind":"separator"},{"type":"literal","value":"b","range":{"start":13,"end":14},"quoted":false,"kind":"file-balanced-literal"},{"type":"whitespace","range":{"start":14,"end":15}},{"type":"keyword","value":"and","range":{"start":15,"end":18},"kind":"and"},{"type":"whitespace","range":{"start":18,"end":19}},{"type":"literal","range":{"start":19,"end":20},"kind":"pattern-literal","value":"c","quoted":false},{"type":"closingParen","range":{"start":20,"end":21}}]}'
        )
    })

    test('nested parenthesized parameters', () => {
        expect(scanSearchQuery('(a and (b or c) and d)')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"openingParen","range":{"start":0,"end":1}},{"type":"literal","range":{"start":1,"end":2},"kind":"pattern-literal","value":"a","quoted":false},{"type":"whitespace","range":{"start":2,"end":3}},{"type":"keyword","value":"and","range":{"start":3,"end":6},"kind":"and"},{"type":"whitespace","range":{"start":6,"end":7}},{"type":"openingParen","range":{"start":7,"end":8}},{"type":"literal","range":{"start":8,"end":9},"kind":"pattern-literal","value":"b","quoted":false},{"type":"whitespace","range":{"start":9,"end":10}},{"type":"keyword","value":"or","range":{"start":10,"end":12},"kind":"or"},{"type":"whitespace","range":{"start":12,"end":13}},{"type":"literal","range":{"start":13,"end":14},"kind":"pattern-literal","value":"c","quoted":false},{"type":"closingParen","range":{"start":14,"end":15}},{"type":"whitespace","range":{"start":15,"end":16}},{"type":"keyword","value":"and","range":{"start":16,"end":19},"kind":"and"},{"type":"whitespace","range":{"start":19,"end":20}},{"type":"literal","range":{"start":20,"end":21},"kind":"pattern-literal","value":"d","quoted":false},{"type":"closingParen","range":{"start":21,"end":22}}]}'
        )
    })

    test('do not treat links as filters', () => {
        expect(scanSearchQuery('http://example.com repo:a')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"literal","range":{"start":0,"end":18},"kind":"pattern-literal","value":"http://example.com","quoted":false},{"type":"whitespace","range":{"start":18,"end":19}},{"type":"field","range":{"start":19,"end":23},"value":"repo","negated":false},{"type":"literal","value":":","range":{"start":23,"end":24},"quoted":false,"kind":"separator"},{"type":"literal","value":"a","range":{"start":24,"end":25},"quoted":false,"kind":"repo-balanced-literal"}]}'
        )
    })
})

describe('scanSearchQuery() for regexp', () => {
    test('interpret regexp pattern with match groups', () => {
        expect(
            scanSearchQuery('((sauce|graph)(\\s)?)is best(g*r*a*p*h*)', false, SearchPatternType.regexp)
        ).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"literal","range":{"start":0,"end":22},"kind":"pattern-regexp","value":"((sauce|graph)(\\\\s)?)is","quoted":false},{"type":"whitespace","range":{"start":22,"end":23}},{"type":"literal","range":{"start":23,"end":39},"kind":"pattern-regexp","value":"best(g*r*a*p*h*)","quoted":false}]}'
        )
    })

    test('interpret regexp pattern with match groups between keywords', () => {
        expect(
            scanSearchQuery('(((sauce|graph)\\s?) or (best)) and (gr|aph)', false, SearchPatternType.regexp)
        ).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"openingParen","range":{"start":0,"end":1}},{"type":"literal","range":{"start":1,"end":19},"kind":"pattern-regexp","value":"((sauce|graph)\\\\s?)","quoted":false},{"type":"whitespace","range":{"start":19,"end":20}},{"type":"keyword","value":"or","range":{"start":20,"end":22},"kind":"or"},{"type":"whitespace","range":{"start":22,"end":23}},{"type":"literal","range":{"start":23,"end":29},"kind":"pattern-regexp","value":"(best)","quoted":false},{"type":"closingParen","range":{"start":29,"end":30}},{"type":"whitespace","range":{"start":30,"end":31}},{"type":"keyword","value":"and","range":{"start":31,"end":34},"kind":"and"},{"type":"whitespace","range":{"start":34,"end":35}},{"type":"literal","range":{"start":35,"end":43},"kind":"pattern-regexp","value":"(gr|aph)","quoted":false}]}'
        )
    })

    test('interpret regexp slash quotes', () => {
        expect(scanSearchQuery('r:a /a regexp \\ pattern/', false, SearchPatternType.regexp)).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"field","range":{"start":0,"end":1},"value":"r","negated":false},{"type":"literal","value":":","range":{"start":1,"end":2},"quoted":false,"kind":"separator"},{"type":"literal","value":"a","range":{"start":2,"end":3},"quoted":false,"kind":"r-balanced-literal"},{"type":"whitespace","range":{"start":3,"end":4}},{"type":"literal","value":"a regexp \\\\ pattern","range":{"start":4,"end":24},"quoted":true,"kind":"quoted"}]}'
        )
    })
})

describe('scanSearchQuery() with comments', () => {
    test('interpret C-style comments', () => {
        const query = `// saucegraph is best graph
repo:sourcegraph
// search for thing
thing`
        expect(scanSearchQuery(query, true)).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"comment","value":"// saucegraph is best graph","range":{"start":0,"end":27}},{"type":"whitespace","range":{"start":27,"end":28}},{"type":"field","range":{"start":28,"end":32},"value":"repo","negated":false},{"type":"literal","value":":","range":{"start":32,"end":33},"quoted":false,"kind":"separator"},{"type":"literal","value":"sourcegraph","range":{"start":33,"end":44},"quoted":false,"kind":"repo-balanced-literal"},{"type":"whitespace","range":{"start":44,"end":45}},{"type":"comment","value":"// search for thing","range":{"start":45,"end":64}},{"type":"whitespace","range":{"start":64,"end":65}},{"type":"literal","range":{"start":65,"end":70},"kind":"pattern-literal","value":"thing","quoted":false}]}'
        )
    })

    test('do not interpret C-style comments', () => {
        expect(scanSearchQuery('// thing')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"literal","range":{"start":0,"end":2},"kind":"pattern-literal","value":"//","quoted":false},{"type":"whitespace","range":{"start":2,"end":3}},{"type":"literal","range":{"start":3,"end":8},"kind":"pattern-literal","value":"thing","quoted":false}]}'
        )
    })
})

describe('scanSearchQuery() with predicate', () => {
    test('recognize predicate', () => {
        expect(scanSearchQuery('repo:contains(file:README.md)')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"field","range":{"start":0,"end":4},"value":"repo","negated":false},{"type":"literal","value":":","range":{"start":4,"end":5},"quoted":false,"kind":"separator"},{"type":"literal","value":"contains(file:README.md)","range":{"start":5,"end":29},"quoted":false,"kind":"repo-predicate"}]}'
        )
    })

    test('recognize multiple predicates over whitespace', () => {
        expect(scanSearchQuery('repo:contains(file:README.md) repo:contains.file(foo)')).toMatchInlineSnapshot(
            '{"type":"success","term":[{"type":"field","range":{"start":0,"end":4},"value":"repo","negated":false},{"type":"literal","value":":","range":{"start":4,"end":5},"quoted":false,"kind":"separator"},{"type":"literal","value":"contains(file:README.md)","range":{"start":5,"end":29},"quoted":false,"kind":"repo-predicate"},{"type":"whitespace","range":{"start":29,"end":30}},{"type":"field","range":{"start":30,"end":34},"value":"repo","negated":false},{"type":"literal","value":":","range":{"start":34,"end":35},"quoted":false,"kind":"separator"},{"type":"literal","value":"contains.file(foo)","range":{"start":35,"end":53},"quoted":false,"kind":"repo-predicate"}]}'
        )
    })
})
