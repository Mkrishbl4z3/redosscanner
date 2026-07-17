// nfa.test.js
const { parse } = require("../src/parser.js");
const { astToNFA } = require("../src/nfa.js");
const { matches } = require("../src/simulate.js");

function buildAndMatch(regex, input) {
  const nfa = astToNFA(parse(regex));
  return matches(nfa, input);
}

describe("NFA matching via Thompson's construction", () => {
  test("matches a simple literal", () => {
    expect(buildAndMatch("a", "a")).toBe(true);
    expect(buildAndMatch("a", "b")).toBe(false);
  });

  test("matches concatenation", () => {
    expect(buildAndMatch("ab", "ab")).toBe(true);
    expect(buildAndMatch("ab", "a")).toBe(false);
    expect(buildAndMatch("ab", "abc")).toBe(false); // full match required
  });

  test("matches alternation", () => {
    expect(buildAndMatch("a|b", "a")).toBe(true);
    expect(buildAndMatch("a|b", "b")).toBe(true);
    expect(buildAndMatch("a|b", "c")).toBe(false);
  });

  test("matches star (zero or more)", () => {
    expect(buildAndMatch("a*", "")).toBe(true);
    expect(buildAndMatch("a*", "a")).toBe(true);
    expect(buildAndMatch("a*", "aaaa")).toBe(true);
    expect(buildAndMatch("a*", "b")).toBe(false);
  });

  test("matches plus (one or more)", () => {
    expect(buildAndMatch("a+", "")).toBe(false);
    expect(buildAndMatch("a+", "a")).toBe(true);
    expect(buildAndMatch("a+", "aaaa")).toBe(true);
  });

  test("matches question (zero or one)", () => {
    expect(buildAndMatch("a?", "")).toBe(true);
    expect(buildAndMatch("a?", "a")).toBe(true);
    expect(buildAndMatch("a?", "aa")).toBe(false);
  });

  test("matches complex combined pattern a(b|c)*", () => {
    expect(buildAndMatch("a(b|c)*", "a")).toBe(true);
    expect(buildAndMatch("a(b|c)*", "abc")).toBe(true);
    expect(buildAndMatch("a(b|c)*", "abcbcb")).toBe(true);
    expect(buildAndMatch("a(b|c)*", "ad")).toBe(false);
    expect(buildAndMatch("a(b|c)*", "")).toBe(false);
  });

  test("matches nested groups", () => {
    expect(buildAndMatch("(a(b|c))+", "ab")).toBe(true);
    expect(buildAndMatch("(a(b|c))+", "abac")).toBe(true);
    expect(buildAndMatch("(a(b|c))+", "a")).toBe(false);
  });
});
