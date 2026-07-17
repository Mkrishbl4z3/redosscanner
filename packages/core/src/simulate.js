// simulate.js
// Simulates an NFA against an input string (subset construction on the fly).

const { EPSILON } = require("./nfa");

/**
 * Computes the epsilon-closure of a set of states:
 * all states reachable from `states` using only epsilon transitions.
 */
function epsilonClosure(nfa, states) {
  const closure = new Set(states);
  const stack = [...states];

  while (stack.length > 0) {
    const stateId = stack.pop();
    const state = nfa.getState(stateId);
    const epsTargets = state.transitions.get(EPSILON);
    if (epsTargets) {
      for (const target of epsTargets) {
        if (!closure.has(target)) {
          closure.add(target);
          stack.push(target);
        }
      }
    }
  }

  return closure;
}

/**
 * Given a set of current states and an input symbol, returns the set of
 * states reachable by consuming that symbol.
 */
function step(nfa, states, symbol) {
  const result = new Set();
  for (const stateId of states) {
    const state = nfa.getState(stateId);
    const targets = state.transitions.get(symbol);
    if (targets) {
      for (const target of targets) {
        result.add(target);
      }
    }
  }
  return result;
}

/**
 * Tests whether `input` is accepted by `nfa`.
 */
function matches(nfa, input) {
  let currentStates = epsilonClosure(nfa, new Set([nfa.start]));

  for (const char of input) {
    const nextStates = step(nfa, currentStates, char);
    currentStates = epsilonClosure(nfa, nextStates);
    if (currentStates.size === 0) {
      return false; // dead end, no valid path forward
    }
  }

  return currentStates.has(nfa.accept);
}

module.exports = { matches, epsilonClosure, step };