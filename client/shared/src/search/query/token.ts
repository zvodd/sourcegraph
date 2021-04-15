/**
 * Represents a zero-indexed character range in a single-line search query.
 */
export interface CharacterRange {
    /** Zero-based character on the line */
    start: number
    /** Zero-based character on the line */
    end: number
}

/**
 * Defines common properties for tokens.
 */
export interface BaseToken {
    type: Token['type']
    range: CharacterRange
}

/**
 * All recognized tokens.
 */
export type Token = Whitespace | OpeningParen | ClosingParen | Keyword | Comment | Literal | Field

/**
 * Represents a value in a search query. E.g., either a quoted or unquoted pattern or field value.
 *
 * Example: `Conn`.
 */
export interface Literal extends BaseToken {
    type: 'literal'
    value: string
    kind: string
    quoted: boolean
}

/*
 * Represents a recognized field in a search query, e.g., the `repo` part of `repo:<literal>`
 */
export interface Field extends BaseToken {
    type: 'field'
    value: string
    negated: boolean
}

export enum KeywordKind {
    Or = 'or',
    And = 'and',
    Not = 'not',
}

/**
 * Represents a keyword in a search query.
 *
 * Current keywords are: AND, and, OR, or, NOT, not.
 */
export interface Keyword extends BaseToken {
    type: 'keyword'
    value: string
    kind: KeywordKind
}

/**
 * Represents a C-style comment, terminated by a newline.
 *
 * Example: `// Oh hai`
 */
export interface Comment extends BaseToken {
    type: 'comment'
    value: string
}

export interface Whitespace extends BaseToken {
    type: 'whitespace'
}

export interface OpeningParen extends BaseToken {
    type: 'openingParen'
}

export interface ClosingParen extends BaseToken {
    type: 'closingParen'
}

export const createLiteral = (value: string, range: CharacterRange, quoted = false, kind: string): Literal => ({
    type: 'literal',
    value,
    range,
    quoted,
    kind,
})
