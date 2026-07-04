import { Environment, GoogleGenAI } from "@google/genai";

const COMPUTER_USE_MODEL =
  process.env.GEMINI_COMPUTER_USE_MODEL ?? "gemini-3-flash-preview";
const LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL ?? "gemini-2.5-flash-native-audio-preview-12-2025";
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004";
const REASONING_MODEL = process.env.GEMINI_REASONING_MODEL ?? "gemini-2.0-flash";

let client: GoogleGenAI | null = null;
let computerUseAvailable: boolean | null = null;

export function getGemini(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}

export function geminiModels() {
  return { COMPUTER_USE_MODEL, LIVE_MODEL, EMBEDDING_MODEL, REASONING_MODEL };
}

/** Smoke-test computer use; returns true if billing-linked key works. */
export async function probeComputerUse(): Promise<boolean> {
  if (computerUseAvailable !== null) return computerUseAvailable;
  const ai = getGemini();
  if (!ai) {
    computerUseAvailable = false;
    return false;
  }
  try {
    const tinyPng =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const res = await ai.models.generateContent({
      model: COMPUTER_USE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: "Describe this image in one word." },
            { inlineData: { mimeType: "image/png", data: tinyPng } },
          ],
        },
      ],
      config: {
        tools: [{ computerUse: { environment: Environment.ENVIRONMENT_BROWSER } }],
      },
    });
    const hasFn = JSON.stringify(res).includes("functionCall") || JSON.stringify(res).includes("function_call");
    computerUseAvailable = !!res || hasFn;
    console.log(
      `[gemini] computer use probe (${COMPUTER_USE_MODEL}): ${computerUseAvailable ? "OK" : "limited — will use scripted fallback"}`,
    );
    return computerUseAvailable;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[gemini] computer use unavailable (${COMPUTER_USE_MODEL}): ${msg.slice(0, 120)}`);
    computerUseAvailable = false;
    return false;
  }
}

export async function embedText(text: string): Promise<number[] | null> {
  const ai = getGemini();
  if (!ai) return null;
  try {
    const res = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
    });
    const values = res.embeddings?.[0]?.values;
    return values?.length ? values : null;
  } catch {
    return null;
  }
}

export async function summarize(text: string, prompt: string): Promise<string | null> {
  const ai = getGemini();
  if (!ai) return null;
  try {
    const res = await ai.models.generateContent({
      model: REASONING_MODEL,
      contents: [{ role: "user", parts: [{ text: `${prompt}\n\n${text}` }] }],
    });
    return res.text?.trim() ?? null;
  } catch {
    return null;
  }
}
