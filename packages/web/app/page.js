// app/page.js
"use client";

import { useState } from "react";
import styles from "./page.module.css";

const SEVERITY_CONFIG = {
  safe: { label: "SAFE", color: "var(--color-safe)" },
  polynomial: { label: "RISKY — POLYNOMIAL", color: "var(--color-warning)" },
  exponential: { label: "DANGEROUS — EXPONENTIAL", color: "var(--color-danger)" },
};

const EXAMPLES = [
  { regex: "a(b|c)*", label: "safe" },
  { regex: "(a|a)*", label: "polynomial" },
  { regex: "(a+)+", label: "exponential" },
];

export default function Home() {
  const [regex, setRegex] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleAnalyze(value) {
    const target = value !== undefined ? value : regex;
    if (!target.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regex: target }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Could not reach the analysis engine.");
    } finally {
      setLoading(false);
    }
  }

  function handleExampleClick(example) {
    setRegex(example.regex);
    handleAnalyze(example.regex);
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>STATIC ANALYSIS TOOL</span>
        <h1 className={styles.title}>redos-check</h1>
        <p className={styles.subtitle}>
          Detects catastrophic backtracking in regular expressions before they
          take down your service. Built on Thompson&apos;s construction and
          NFA ambiguity analysis.
        </p>
      </header>

      <section className={styles.inputSection}>
        <div className={styles.inputRow}>
          <span className={styles.slash}>/</span>
          <input
            className={styles.input}
            type="text"
            spellCheck={false}
            placeholder="(a+)+"
            value={regex}
            onChange={(e) => setRegex(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          />
          <span className={styles.slash}>/</span>
          <button
            className={styles.analyzeButton}
            onClick={() => handleAnalyze()}
            disabled={loading}
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.regex}
              className={styles.exampleChip}
              onClick={() => handleExampleClick(ex)}
            >
              {ex.regex}
            </button>
          ))}
        </div>
      </section>

      {error && <div className={styles.errorBox}>{error}</div>}

      {result && (
        <section className={styles.resultSection}>
          <div
            className={styles.verdictBadge}
            style={{ "--verdict-color": SEVERITY_CONFIG[result.severity]?.color }}
          >
            {SEVERITY_CONFIG[result.severity]?.label || result.severity}
          </div>

          {result.findings.length > 0 && (
            <ul className={styles.findingsList}>
              {result.findings.map((f, i) => (
                <li key={i} className={styles.findingItem}>
                  <span className={styles.findingType}>{f.quantifierType}</span>
                  <span className={styles.findingMessage}>{f.message}</span>
                </li>
              ))}
            </ul>
          )}

          {result.findings.length === 0 && (
            <p className={styles.safeMessage}>
              No ambiguous quantifiers or nested repetition detected. This
              pattern should not be vulnerable to catastrophic backtracking.
            </p>
          )}
        </section>
      )}
    </main>
  );
}