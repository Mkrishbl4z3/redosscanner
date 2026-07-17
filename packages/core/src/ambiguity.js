// ambiguity.js
// Detects ReDoS-prone ambiguity in quantified sub-expressions (STAR/PLUS)
// using two complementary passes:
//
// Pass 1 (NFA-level): catches immediate forks like (a|a)* — where the
// SAME next symbol can be consumed via 2+ distinct states that can both
// still complete the loop.
//
// Pass 2 (AST-structural): catches nested quantifiers like (a+)+ — where
// the ambiguity comes from the same consumed substring being partitionable
// across an outer and inner loop in exponentially many ways. This kind of
// ambiguity spans multiple characters, so it can't be seen by a one-step
// NFA check and needs to be caught structurally instead.

const { NFA, EPSILON } = require("./nfa");
const { epsilonClosure } = require("./simulate");

// Mirrors buildFragment from nfa.js, but also records quantifier fragments
// (start/accept of the loop wrapper, and start/accept of the loop body)
// so the ambiguity checker can analyze each loop in isolation.
function buildTrackedNFA(ast) {
  const nfa = new NFA();
  const quantifiers = []; // { type: 'STAR'|'PLUS', start, accept, bodyStart, bodyAccept }

  function build(node) {
    switch (node.type) {
      case "LITERAL": {
        const start = nfa.createState();
        const accept = nfa.createState();
        nfa.addTransition(start, node.value, accept);
        return { start, accept };
      }
      case "EPSILON": {
        const start = nfa.createState();
        const accept = nfa.createState();
        nfa.addTransition(start, EPSILON, accept);
        return { start, accept };
      }
      case "CONCAT": {
        const left = build(node.left);
        const right = build(node.right);
        nfa.addTransition(left.accept, EPSILON, right.start);
        return { start: left.start, accept: right.accept };
      }
      case "ALTERNATION": {
        const left = build(node.left);
        const right = build(node.right);
        const start = nfa.createState();
        const accept = nfa.createState();
        nfa.addTransition(start, EPSILON, left.start);
        nfa.addTransition(start, EPSILON, right.start);
        nfa.addTransition(left.accept, EPSILON, accept);
        nfa.addTransition(right.accept, EPSILON, accept);
        return { start, accept };
      }
      case "STAR": {
        const inner = build(node.child);
        const start = nfa.createState();
        const accept = nfa.createState();
        nfa.addTransition(start, EPSILON, inner.start);
        nfa.addTransition(start, EPSILON, accept);
        nfa.addTransition(inner.accept, EPSILON, inner.start);
        nfa.addTransition(inner.accept, EPSILON, accept);
        quantifiers.push({
          type: "STAR",
          start,
          accept,
          bodyStart: inner.start,
          bodyAccept: inner.accept,
        });
        return { start, accept };
      }
      case "PLUS": {
        const inner = build(node.child);
        const start = nfa.createState();
        const accept = nfa.createState();
        nfa.addTransition(start, EPSILON, inner.start);
        nfa.addTransition(inner.accept, EPSILON, inner.start);
        nfa.addTransition(inner.accept, EPSILON, accept);
        quantifiers.push({
          type: "PLUS",
          start,
          accept,
          bodyStart: inner.start,
          bodyAccept: inner.accept,
        });
        return { start, accept };
      }
      case "QUESTION": {
        const inner = build(node.child);
        const start = nfa.createState();
        const accept = nfa.createState();
        nfa.addTransition(start, EPSILON, inner.start);
        nfa.addTransition(start, EPSILON, accept);
        nfa.addTransition(inner.accept, EPSILON, accept);
        return { start, accept };
      }
      default:
        throw new Error(`Unknown AST node type: ${node.type}`);
    }
  }

  const { start, accept } = build(ast);
  nfa.start = start;
  nfa.accept = accept;
  return { nfa, quantifiers };
}

/**
 * BFS reachability check: can we get from `fromId` to `toId` following
 * ANY transition (symbol or epsilon)?
 */
function canReach(nfa, fromId, toId) {
  if (fromId === toId) return true;
  const visited = new Set([fromId]);
  const queue = [fromId];

  while (queue.length > 0) {
    const current = queue.shift();
    const state = nfa.getState(current);
    for (const targets of state.transitions.values()) {
      for (const target of targets) {
        if (target === toId) return true;
        if (!visited.has(target)) {
          visited.add(target);
          queue.push(target);
        }
      }
    }
  }
  return false;
}

/**
 * Groups the non-epsilon, one-symbol-away transitions reachable from a
 * set of states (after epsilon closure). Returns Map<symbol, Set<targetStateId>>.
 */
function groupTransitionsBySymbol(nfa, fromStates) {
  const closure = epsilonClosure(nfa, fromStates);
  const bySymbol = new Map();

  for (const stateId of closure) {
    const state = nfa.getState(stateId);
    for (const [symbol, targets] of state.transitions) {
      if (symbol === EPSILON) continue;
      if (!bySymbol.has(symbol)) bySymbol.set(symbol, new Set());
      for (const t of targets) bySymbol.get(symbol).add(t);
    }
  }

  return bySymbol;
}

/**
 * Checks whether a single quantifier loop is ambiguous at the NFA level.
 * Ambiguous = from the loop body's start, some symbol can be consumed
 * via 2+ distinct states, AND at least two of those distinct states can
 * both independently go on to complete the loop (reach bodyAccept).
 */
function isLoopAmbiguous(nfa, quantifier) {
  const { bodyStart, bodyAccept } = quantifier;
  const bySymbol = groupTransitionsBySymbol(nfa, new Set([bodyStart]));

  for (const [symbol, targets] of bySymbol) {
    const viableTargets = [...targets].filter((t) => canReach(nfa, t, bodyAccept));
    if (viableTargets.length >= 2) {
      return { ambiguous: true, symbol, targets: viableTargets };
    }
  }

  return { ambiguous: false };
}

/**
 * Structural check: detects "nested quantifiers" — a STAR/PLUS whose
 * body itself contains another STAR/PLUS (possibly through CONCAT or
 * ALTERNATION). This is the classic (a+)+ / (a*)* / (a+)* pattern,
 * whose exponential blowup comes from ambiguity ACROSS repetitions
 * (multiple ways to partition the same consumed substring between
 * the outer and inner loop), not from a single-step fork — so it
 * needs to be caught structurally rather than via the NFA-level check.
 */
function findNestedQuantifiers(node, insideQuantifier = false, findings = []) {
  if (!node || typeof node !== "object") return findings;

  const isQuantifier = node.type === "STAR" || node.type === "PLUS";

  if (isQuantifier && insideQuantifier) {
    findings.push({
      quantifierType: node.type,
      message: `Nested quantifier detected: a ${node.type} appears inside another quantifier's body. This is the classic catastrophic-backtracking pattern (e.g. (a+)+), since the same input can be partitioned across the outer and inner loop in exponentially many ways.`,
    });
  }

  const nextInsideQuantifier = insideQuantifier || isQuantifier;

  if (node.child) findNestedQuantifiers(node.child, nextInsideQuantifier, findings);
  if (node.left) findNestedQuantifiers(node.left, nextInsideQuantifier, findings);
  if (node.right) findNestedQuantifiers(node.right, nextInsideQuantifier, findings);

  return findings;
}

/**
 * Analyzes a full AST and returns a list of ambiguity findings (from both
 * passes), plus an overall severity verdict.
 *
 * Severity levels:
 *  - "safe": no ambiguity detected.
 *  - "polynomial": single-fork ambiguity found (e.g. (a|a)*) — risky,
 *    but growth is typically bounded/polynomial rather than exponential.
 *  - "exponential": a nested quantifier was found (e.g. (a+)+) — the
 *    textbook catastrophic-backtracking case, true exponential blowup.
 */
function analyzeAmbiguity(regexSource, ast) {
  const { nfa, quantifiers } = buildTrackedNFA(ast);
  const findings = [];

  // Pass 1: single-step NFA ambiguity (catches (a|a)* style forks)
  for (const q of quantifiers) {
    const result = isLoopAmbiguous(nfa, q);
    if (result.ambiguous) {
      findings.push({
        quantifierType: q.type,
        symbol: String(result.symbol),
        message: `Ambiguous ${q.type} loop: multiple distinct paths can consume '${String(
          result.symbol
        )}' and still complete the loop, which risks catastrophic backtracking.`,
      });
    }
  }

  // Pass 2: structural nested-quantifier check (catches (a+)+ style nesting)
  findNestedQuantifiers(ast, false, findings);

  const hasNestedQuantifier = findings.some((f) =>
    f.message.startsWith("Nested quantifier")
  );

  const severity =
    findings.length === 0
      ? "safe"
      : hasNestedQuantifier
      ? "exponential"
      : "polynomial";

  return {
    regex: regexSource,
    severity,
    findings,
  };
}

module.exports = {
  analyzeAmbiguity,
  buildTrackedNFA,
  canReach,
  isLoopAmbiguous,
  findNestedQuantifiers,
};