// nfa.js
// Thompson's Construction: AST -> NFA
//
// Each NFA fragment has exactly one start state and one accept state
// (this invariant is what makes Thompson's construction composable —
// every operator combinator just wires fragments together via epsilon
// transitions, without ever needing to inspect a fragment's internals).

const EPSILON = Symbol("epsilon");

class NFAState {
  constructor(id) {
    this.id = id;
    this.transitions = new Map(); // symbol -> Set<stateId>
  }

  addTransition(symbol, targetId) {
    if (!this.transitions.has(symbol)) {
      this.transitions.set(symbol, new Set());
    }
    this.transitions.get(symbol).add(targetId);
  }
}

class NFA {
  constructor() {
    this.states = new Map(); // id -> NFAState
    this.nextId = 0;
    this.start = null;
    this.accept = null;
  }

  createState() {
    const id = this.nextId++;
    const state = new NFAState(id);
    this.states.set(id, state);
    return id;
  }

  addTransition(fromId, symbol, toId) {
    this.states.get(fromId).addTransition(symbol, toId);
  }

  getState(id) {
    return this.states.get(id);
  }

  // Merge another NFA's states into this one (used when combining fragments).
  // Returns nothing — mutates `this` in place, absorbing `other`'s states.
  absorb(other) {
    for (const [id, state] of other.states) {
      this.states.set(id, state);
    }
    this.nextId = Math.max(this.nextId, other.nextId);
  }
}

/**
 * Builds an NFA fragment for a single AST node using Thompson's construction.
 * Returns { nfa, start, accept } where start/accept are state IDs within `nfa`.
 */
function buildFragment(node, nfa) {
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
      const left = buildFragment(node.left, nfa);
      const right = buildFragment(node.right, nfa);
      // Wire left's accept straight into right's start.
      nfa.addTransition(left.accept, EPSILON, right.start);
      return { start: left.start, accept: right.accept };
    }

    case "ALTERNATION": {
      const left = buildFragment(node.left, nfa);
      const right = buildFragment(node.right, nfa);
      const start = nfa.createState();
      const accept = nfa.createState();
      nfa.addTransition(start, EPSILON, left.start);
      nfa.addTransition(start, EPSILON, right.start);
      nfa.addTransition(left.accept, EPSILON, accept);
      nfa.addTransition(right.accept, EPSILON, accept);
      return { start, accept };
    }

    case "STAR": {
      const inner = buildFragment(node.child, nfa);
      const start = nfa.createState();
      const accept = nfa.createState();
      nfa.addTransition(start, EPSILON, inner.start); // enter the loop
      nfa.addTransition(start, EPSILON, accept);       // skip entirely (0 times)
      nfa.addTransition(inner.accept, EPSILON, inner.start); // repeat
      nfa.addTransition(inner.accept, EPSILON, accept);      // exit after >=1
      return { start, accept };
    }

    case "PLUS": {
      const inner = buildFragment(node.child, nfa);
      const start = nfa.createState();
      const accept = nfa.createState();
      nfa.addTransition(start, EPSILON, inner.start); // must enter at least once
      nfa.addTransition(inner.accept, EPSILON, inner.start); // repeat
      nfa.addTransition(inner.accept, EPSILON, accept);      // exit
      return { start, accept };
    }

    case "QUESTION": {
      const inner = buildFragment(node.child, nfa);
      const start = nfa.createState();
      const accept = nfa.createState();
      nfa.addTransition(start, EPSILON, inner.start); // take it
      nfa.addTransition(start, EPSILON, accept);       // skip it
      nfa.addTransition(inner.accept, EPSILON, accept);
      return { start, accept };
    }

    default:
      throw new Error(`Unknown AST node type: ${node.type}`);
  }
}

/**
 * Builds a complete NFA from an AST produced by parse().
 */
function astToNFA(ast) {
  const nfa = new NFA();
  const { start, accept } = buildFragment(ast, nfa);
  nfa.start = start;
  nfa.accept = accept;
  return nfa;
}

module.exports = { astToNFA, NFA, NFAState, EPSILON };