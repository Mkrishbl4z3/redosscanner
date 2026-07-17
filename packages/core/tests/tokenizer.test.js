// tokenizer.test.js
const { tokenize, TokenType } = require("../src/tokenizer.js");

test("tokenizes a simple literal", () => {
  expect(tokenize("a")).toEqual([
    { type: TokenType.LITERAL, value: "a" },
  ]);
});

test("tokenizes alternation and grouping", () => {
  expect(tokenize("a(b|c)*")).toEqual([
    { type: TokenType.LITERAL, value: "a" },
    { type: TokenType.LPAREN },
    { type: TokenType.LITERAL, value: "b" },
    { type: TokenType.PIPE },
    { type: TokenType.LITERAL, value: "c" },
    { type: TokenType.RPAREN },
    { type: TokenType.STAR },
  ]);
});

test("tokenizes plus and question mark", () => {
  expect(tokenize("a+b?")).toEqual([
    { type: TokenType.LITERAL, value: "a" },
    { type: TokenType.PLUS },
    { type: TokenType.LITERAL, value: "b" },
    { type: TokenType.QUESTION },
  ]);
});