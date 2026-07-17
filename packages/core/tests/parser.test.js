// parser.test.js
const { parse } = require("../src/parser.js");

test("parses a simple literal", () => {
  expect(parse("a")).toEqual({ type: "LITERAL", value: "a" });
});

test("parses concatenation", () => {
  expect(parse("ab")).toEqual({
    type: "CONCAT",
    left: { type: "LITERAL", value: "a" },
    right: { type: "LITERAL", value: "b" },
  });
});

test("parses alternation with correct precedence (ab|c)", () => {
  expect(parse("ab|c")).toEqual({
    type: "ALTERNATION",
    left: {
      type: "CONCAT",
      left: { type: "LITERAL", value: "a" },
      right: { type: "LITERAL", value: "b" },
    },
    right: { type: "LITERAL", value: "c" },
  });
});

test("parses star repetition", () => {
  expect(parse("a*")).toEqual({
    type: "STAR",
    child: { type: "LITERAL", value: "a" },
  });
});

test("parses plus and question", () => {
  expect(parse("a+")).toEqual({
    type: "PLUS",
    child: { type: "LITERAL", value: "a" },
  });
  expect(parse("a?")).toEqual({
    type: "QUESTION",
    child: { type: "LITERAL", value: "a" },
  });
});

test("parses grouping with alternation and star", () => {
  expect(parse("a(b|c)*")).toEqual({
    type: "CONCAT",
    left: { type: "LITERAL", value: "a" },
    right: {
      type: "STAR",
      child: {
        type: "ALTERNATION",
        left: { type: "LITERAL", value: "b" },
        right: { type: "LITERAL", value: "c" },
      },
    },
  });
});

test("throws on unmatched parenthesis", () => {
  expect(() => parse("(a")).toThrow();
});

test("throws on unexpected closing paren", () => {
  expect(() => parse("a)")).toThrow();
});

test("handles nested groups", () => {
  expect(parse("((a))")).toEqual({ type: "LITERAL", value: "a" });
});