// parser.js
// Recursive descent parser: tokens -> AST
// Grammar (loosest to tightest):
//   Alternation -> Concat ('|' Concat)*
//   Concat      -> Repetition*
//   Repetition  -> Atom ('*' | '+' | '?')?
//   Atom        -> LITERAL | '(' Alternation ')'

const { tokenize, TokenType } = require("./tokenizer");

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume() {
    return this.tokens[this.pos++];
  }

  parse() {
    const ast = this.parseAlternation();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token at position ${this.pos}: ${JSON.stringify(this.peek())}`);
    }
    return ast;
  }

  parseAlternation() {
    let left = this.parseConcat();
    while (this.peek() && this.peek().type === TokenType.PIPE) {
      this.consume(); // eat '|'
      const right = this.parseConcat();
      left = { type: "ALTERNATION", left, right };
    }
    return left;
  }

  parseConcat() {
    const nodes = [];
    while (
      this.peek() &&
      this.peek().type !== TokenType.PIPE &&
      this.peek().type !== TokenType.RPAREN
    ) {
      nodes.push(this.parseRepetition());
    }

    if (nodes.length === 0) {
      return { type: "EPSILON" }; // empty match, e.g. inside "a|" or "()"
    }
    if (nodes.length === 1) {
      return nodes[0];
    }
    return nodes.reduce((left, right) => ({ type: "CONCAT", left, right }));
  }

  parseRepetition() {
    let atom = this.parseAtom();
    while (
      this.peek() &&
      (this.peek().type === TokenType.STAR ||
        this.peek().type === TokenType.PLUS ||
        this.peek().type === TokenType.QUESTION)
    ) {
      const op = this.consume().type;
      atom = { type: op, child: atom }; // STAR, PLUS, or QUESTION node
    }
    return atom;
  }

  parseAtom() {
    const token = this.peek();
    if (!token) {
      throw new Error("Unexpected end of input");
    }

    if (token.type === TokenType.LITERAL) {
      this.consume();
      return { type: "LITERAL", value: token.value };
    }

    if (token.type === TokenType.LPAREN) {
      this.consume(); // eat '('
      const inner = this.parseAlternation();
      if (!this.peek() || this.peek().type !== TokenType.RPAREN) {
        throw new Error("Expected closing ')'");
      }
      this.consume(); // eat ')'
      return inner;
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
  }
}

function parse(regex) {
  const tokens = tokenize(regex);
  const parser = new Parser(tokens);
  return parser.parse();
}

module.exports = { parse, Parser };