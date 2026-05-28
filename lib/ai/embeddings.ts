/**
 * Main-thread API for the embeddings Web Worker.
 * All heavy computation (model loading, inference, cosine similarity)
 * runs in the worker — this module is just a postMessage bridge.
 */

// ── Shared Types ──────────────────────────────────────────────────────

export type MatchResult = {
  optionA: string;
  optionB: string;
  similarity: number;
};

type WorkerResponse =
  | { type: "warmup"; ok: boolean; error?: string }
  | { type: "result"; match: MatchResult | null; bestSimilarity: number }
  | { type: "error"; error: string }
  | { type: "progress"; status: string };

// ── Worker Singleton ──────────────────────────────────────────────────

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("./embeddings.worker.ts", import.meta.url),
    );
  }
  return worker;
}

// ── Public API ────────────────────────────────────────────────────────

/** Pre-load the 22MB model so Tiebreaker is instant when needed. */
export function warmupModel(): void {
  if (typeof window === "undefined") return;
  getWorker().postMessage({ type: "warmup" });
}

/** Subscribe to progress updates from the worker (e.g. "Loading AI model…"). */
export function onProgress(callback: (status: string) => void): () => void {
  const w = getWorker();
  const handler = (event: MessageEvent<WorkerResponse>) => {
    if (event.data.type === "progress") {
      callback(event.data.status);
    }
  };
  w.addEventListener("message", handler);
  return () => w.removeEventListener("message", handler);
}

/**
 * Find the best matching pair between two sets of inputs.
 * Returns the pair with the highest cosine similarity (≥0.85), or null.
 */
export function findBestMatch(
  userAInputs: string[],
  userBInputs: string[],
): Promise<{ match: MatchResult | null; bestSimilarity: number }> {
  return new Promise((resolve, reject) => {
    const w = getWorker();

    const handler = (event: MessageEvent<WorkerResponse>) => {
      const { data } = event;

      if (data.type === "result") {
        w.removeEventListener("message", handler);
        resolve({ match: data.match, bestSimilarity: data.bestSimilarity });
      } else if (data.type === "error") {
        w.removeEventListener("message", handler);
        reject(new Error(data.error));
      }
      // "progress" events are ignored here — use onProgress() for those
    };

    w.addEventListener("message", handler);
    w.postMessage({ type: "findBestMatch", userAInputs, userBInputs });
  });
}

/**
 * AI Judge: Evaluates the similarity between a rule and the charge note.
 * Returns the cosine similarity (0 to 1).
 */
export async function evaluateDispute(ruleText: string, chargeNote: string): Promise<number> {
  const result = await findBestMatch([ruleText], [chargeNote]);
  return result.bestSimilarity;
}
