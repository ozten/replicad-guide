/**
 * CI freshness gate — re-runs EVERY registered example through the render
 * engine against the pinned replicad ref and exits non-zero on any breakage,
 * naming the example (R9/R15).
 *
 * Failure detection mirrors the render engine's return-value model, plus one
 * CI-only rule: anything an example's render writes to console.error fails
 * the check attributed to that example — the evaluator swallows some render
 * errors into console.error only (e.g. highlight-find failures), and those
 * must not pass silently. A thrown failure is not double-reported: its
 * captured console output is attached as context.
 *
 * v1 renders ALL examples on every run (dozens; fast). Incremental caching
 * and the shuffled-order leakage check are deferred to v1.1 (U8).
 */
import { format } from "node:util";
import { fileURLToPath } from "node:url";
import { examples, type Example } from "../src/examples/index";
import { renderExample } from "../src/lib/render-engine";

export type ExampleCheck = {
  id: string;
  problems: string[];
};

export async function checkExamples(
  list: Example[],
  onExample?: (id: string, ok: boolean) => void,
): Promise<ExampleCheck[]> {
  const failures: ExampleCheck[] = [];

  for (const example of list) {
    const errorLines: string[] = [];
    const warnLines: string[] = [];
    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = (...args: unknown[]) => {
      errorLines.push(format(...args));
    };
    console.warn = (...args: unknown[]) => {
      warnLines.push(format(...args));
    };

    let thrown: string | null = null;
    try {
      await renderExample(example.id, example.code, example.annotations);
    } catch (error: any) {
      thrown = error?.message || String(error);
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }

    const failed = thrown !== null || errorLines.length > 0;
    onExample?.(example.id, !failed);
    if (!failed) continue;

    const problems: string[] = [];
    if (thrown) problems.push(thrown);
    problems.push(...errorLines.map((line) => `console.error: ${line}`));
    problems.push(...warnLines.map((line) => `console.warn: ${line}`));
    failures.push({ id: example.id, problems });
  }

  return failures;
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const failures = await checkExamples(examples, (id, ok) => {
    console.log(`${ok ? "✓" : "✗"} ${id}`);
  });

  if (failures.length > 0) {
    console.error(
      `\n✗ ${failures.length} of ${examples.length} example(s) failed against the pinned replicad ref:`,
    );
    for (const failure of failures) {
      console.error(`\n  ${failure.id}`);
      for (const problem of failure.problems) {
        console.error(`    - ${problem}`);
      }
    }
    process.exit(1);
  }

  console.log(
    `\n✓ all ${examples.length} example(s) render against the pinned replicad ref`,
  );
}
