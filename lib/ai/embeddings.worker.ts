/**
 * Web Worker for Transformers.js inference.
 * Runs off the main thread to keep the React UI responsive.
 *
 * Handles:
 *  - warmup: preload the model into memory
 *  - findBestMatch: generate embeddings for 6 inputs, return best cosine pair
 */

// ── Types ─────────────────────────────────────────────────────────────

type MatchResult = {
  optionA: string;
  optionB: string;
  similarity: number;
};

type IncomingMessage =
  | { type: "warmup" }
  | { type: "findBestMatch"; userAInputs: string[]; userBInputs: string[] };

type OutgoingMessage =
  | { type: "warmup"; ok: boolean; error?: string }
  | { type: "result"; match: MatchResult | null; bestSimilarity: number }
  | { type: "error"; error: string }
  | { type: "progress"; status: string };

// ── Model Singleton ───────────────────────────────────────────────────

// eslint-disable-next-line
let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    // Dynamic import so the 22MB model only loads inside this worker
    const { pipeline } = await import("@xenova/transformers");
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
  }
  return extractor;
}

// ── Math Helpers ──────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function getEmbedding(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = await ext(text, { pooling: "mean", normalize: true });
  // output.data is a Float32Array — convert to plain number[]
  return Array.from(output.data as Float32Array);
}

// ── Message Handler ───────────────────────────────────────────────────

// Worker global scope type (DOM lib doesn't include worker types)
interface WorkerGlobalScope {
  onmessage: ((event: MessageEvent<IncomingMessage>) => void) | null;
  postMessage(message: OutgoingMessage): void;
}

const ctx = self as unknown as WorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;

  if (msg.type === "warmup") {
    try {
      ctx.postMessage({ type: "progress", status: "Loading AI model…" } satisfies OutgoingMessage);
      await getExtractor();
      ctx.postMessage({ type: "warmup", ok: true } satisfies OutgoingMessage);
    } catch (err) {
      ctx.postMessage({
        type: "warmup",
        ok: false,
        error: String(err),
      } satisfies OutgoingMessage);
    }
    return;
  }

  if (msg.type === "findBestMatch") {
    try {
      const { userAInputs, userBInputs } = msg;

      ctx.postMessage({ type: "progress", status: "Generating embeddings…" } satisfies OutgoingMessage);

      // Generate embeddings for all 6 inputs
      const allInputs = [...userAInputs, ...userBInputs];
      const embeddings = await Promise.all(allInputs.map(getEmbedding));

      const embA = embeddings.slice(0, userAInputs.length);
      const embB = embeddings.slice(userAInputs.length);

      ctx.postMessage({ type: "progress", status: "Finding best match…" } satisfies OutgoingMessage);

      // Build 3×3 cosine similarity matrix, find best pair
      let bestSimilarity = -1;
      let bestPair: MatchResult = { optionA: "", optionB: "", similarity: 0 };

      for (let i = 0; i < embA.length; i++) {
        for (let j = 0; j < embB.length; j++) {
          const sim = cosineSimilarity(embA[i], embB[j]);
          if (sim > bestSimilarity) {
            bestSimilarity = sim;
            bestPair = {
              optionA: userAInputs[i],
              optionB: userBInputs[j],
              similarity: sim,
            };
          }
        }
      }

      // Threshold: only report a match if similarity ≥ 0.85
      const match = bestSimilarity >= 0.85 ? bestPair : null;
      ctx.postMessage({
        type: "result",
        match,
        bestSimilarity,
      } satisfies OutgoingMessage);
    } catch (err) {
      ctx.postMessage({ type: "error", error: String(err) } satisfies OutgoingMessage);
    }
  }
};
