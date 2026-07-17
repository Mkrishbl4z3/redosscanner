// tokenizer.js
// Converts a regex string into a list of tokens.

const TokenType = {
  LITERAL: "LITERAL",
  STAR: "STAR",
  PLUS: "PLUS",
  QUESTION: "QUESTION",
  PIPE: "PIPE",
  LPAREN: "LPAREN",
  RPAREN: "RPAREN",
};

function tokenize(regex) {
  const tokens = [];

  for (let i = 0; i < regex.length; i++) {
    const char = regex[i];

    switch (char) {
      case "*":
        tokens.push({ type: TokenType.STAR });
        break;
      case "+":
        tokens.push({ type: TokenType.PLUS });
        break;
      case "?":
        tokens.push({ type: TokenType.QUESTION });
        break;
      case "|":
        tokens.push({ type: TokenType.PIPE });
        break;
      case "(":
        tokens.push({ type: TokenType.LPAREN });
        break;
      case ")":
        tokens.push({ type: TokenType.RPAREN });
        break;
      default:
        // treat anything else as a literal character
        tokens.push({ type: TokenType.LITERAL, value: char });
    }
  }

  return tokens;
}

module.exports = { tokenize, TokenType };