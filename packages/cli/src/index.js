#!/usr/bin/env node
// redos-check CLI
// Usage:
//   redos-check "regex-pattern"
//   redos-check --file patterns.txt

const { parse } = require("core/src/parser.js");
const { analyzeAmbiguity } = require("core/src/ambiguity.js");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const SEVERITY_COLORS = {
  safe: chalk.green,
  polynomial: chalk.yellow,
  exponential: chalk.red,
};

const SEVERITY_LABELS = {
  safe: "SAFE",
  polynomial: "RISKY (polynomial)",
  exponential: "DANGEROUS (exponential)",
};

/**
 * Analyzes a single regex string and prints a formatted result.
 */
function checkRegex(regex) {
  let result;
  try {
    const ast = parse(regex);
    result = analyzeAmbiguity(regex, ast);
  } catch (err) {
    console.log(chalk.red(`✗ ${regex}`));
    console.log(chalk.gray(`  Failed to parse: ${err.message}`));
    return { severity: "error" };
  }

  const color = SEVERITY_COLORS[result.severity] || chalk.white;
  const label = SEVERITY_LABELS[result.severity] || result.severity;
  const icon = result.severity === "safe" ? "✓" : "✗";

  console.log(color(`${icon} ${regex}  —  ${label}`));

  for (const finding of result.findings) {
    console.log(chalk.gray(`  • ${finding.message}`));
  }

  return result;
}

/**
 * Reads a file of newline-separated regex patterns and checks each one.
 * Blank lines and lines starting with '#' (comments) are skipped.
 */
function checkFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(chalk.red(`File not found: ${absolutePath}`));
    process.exit(1);
  }

  const lines = fs
    .readFileSync(absolutePath, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  console.log(chalk.bold(`\nScanning ${lines.length} pattern(s) from ${filePath}:\n`));

  const summary = { safe: 0, polynomial: 0, exponential: 0, error: 0 };

  for (const line of lines) {
    const result = checkRegex(line);
    summary[result.severity] = (summary[result.severity] || 0) + 1;
  }

  console.log(chalk.bold("\nSummary:"));
  console.log(chalk.green(`  Safe: ${summary.safe}`));
  console.log(chalk.yellow(`  Polynomial risk: ${summary.polynomial}`));
  console.log(chalk.red(`  Exponential risk: ${summary.exponential}`));
  if (summary.error > 0) {
    console.log(chalk.gray(`  Failed to parse: ${summary.error}`));
  }

  // Exit with a non-zero code if anything dangerous was found —
  // this lets the CLI be used as a CI gate (e.g. fail a build step).
  if (summary.exponential > 0) {
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
${chalk.bold("redos-check")} — detect catastrophic backtracking (ReDoS) risk in regular expressions

${chalk.bold("Usage:")}
  redos-check "<regex>"          Check a single regex pattern
  redos-check --file <path>      Check all patterns in a file (one per line)
  redos-check --help             Show this help message

${chalk.bold("Examples:")}
  redos-check "(a+)+"
  redos-check --file patterns.txt
`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    return;
  }

  if (args[0] === "--file" || args[0] === "-f") {
    const filePath = args[1];
    if (!filePath) {
      console.error(chalk.red("Error: --file requires a path argument."));
      process.exit(1);
    }
    checkFile(filePath);
    return;
  }

  const regex = args[0];
  const result = checkRegex(regex);
  if (result.severity === "exponential") {
    process.exit(1);
  }
}

main();