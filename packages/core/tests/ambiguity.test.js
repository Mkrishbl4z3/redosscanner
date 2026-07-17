// ambiguity.test.js
const { parse } = require("../src/parser.js");
const { analyzeAmbiguity } = require("../src/ambiguity.js");

function analyze(regex) {
  return analyzeAmbiguity(regex, parse(regex));
}

describe("ambiguity detection", () => {
  test("simple star is safe", () => {
    expect(analyze("a*").severity).toBe("safe");
  });

  test("simple plus is safe", () => {
    expect(analyze("a+").severity).toBe("safe");
  });

  test("alternation inside star with no overlap is safe", () => {
    expect(analyze("a(b|c)*").severity).toBe("safe");
  });

  test("concatenated distinct literals is safe", () => {
    expect(analyze("abc").severity).toBe("safe");
  });

  test("(a|a)* is flagged as polynomial (single-fork ambiguity)", () => {
    const result = analyze("(a|a)*");
    expect(result.severity).toBe("polynomial");
    expect(result.findings.length).toBeGreaterThan(0);
  });

  test("(a+)+ is flagged as exponential (nested quantifier)", () => {
    const result = analyze("(a+)+");
    expect(result.severity).toBe("exponential");
    expect(
      result.findings.some((f) => f.message.startsWith("Nested quantifier"))
    ).toBe(true);
  });

  test("(a*)* is flagged as exponential (nested quantifier)", () => {
    const result = analyze("(a*)*");
    expect(result.severity).toBe("exponential");
  });

  test("(a+)* is flagged as exponential (nested quantifier)", () => {
    const result = analyze("(a+)*");
    expect(result.severity).toBe("exponential");
  });

  test("non-overlapping alternation nested in star stays safe", () => {
    // distinct branches, no shared symbol at the fork point
    expect(analyze("(ab|cd)*").severity).toBe("safe");
  });

  test("deeply nested but non-quantified groups stay safe", () => {
    expect(analyze("(((a)))").severity).toBe("safe");
  });
});