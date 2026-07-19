// app/api/analyze/route.js
// POST { regex: string } -> { regex, severity, findings, ast, nfa }

import { parse } from "core/src/parser.js";
import { analyzeAmbiguity, buildTrackedNFA } from "core/src/ambiguity.js";
import { EPSILON } from "core/src/nfa.js";

/**
 * Converts the internal NFA (Map-based, with a Symbol for epsilon) into
 * a plain JSON-serializable shape the frontend can render:
 *   { states: [id, ...], start, accept, transitions: [{from, to, symbol}] }
 */
function serializeNFA(nfa) {
  const states = [...nfa.states.keys()];
  const transitions = [];

  for (const [fromId, state] of nfa.states) {
    for (const [symbol, targets] of state.transitions) {
      const label = symbol === EPSILON ? "ε" : symbol;
      for (const toId of targets) {
        transitions.push({ from: fromId, to: toId, symbol: label });
      }
    }
  }

  return { states, start: nfa.start, accept: nfa.accept, transitions };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { regex } = body;

  if (typeof regex !== "string" || regex.trim().length === 0) {
    return Response.json(
      { error: "Missing or empty 'regex' field." },
      { status: 400 }
    );
  }

  let ast;
  try {
    ast = parse(regex);
  } catch (err) {
    return Response.json(
      { error: `Failed to parse regex: ${err.message}` },
      { status: 400 }
    );
  }

  const result = analyzeAmbiguity(regex, ast);
  const { nfa } = buildTrackedNFA(ast);

  return Response.json({
    regex,
    severity: result.severity,
    findings: result.findings,
    ast,
    nfa: serializeNFA(nfa),
  });
}