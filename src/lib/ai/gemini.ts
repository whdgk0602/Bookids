import "server-only";

// Gemini REST 클라이언트. 공급자를 바꿀 때는 이 파일만 교체한다.

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 20_000;

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export type JsonSchema = Record<string, unknown>;

export type GenerateOptions = {
  model: string;
  system: string;
  parts: Part[];
  schema: JsonSchema;
  thinking?: ThinkingLevel;
  temperature?: number;
};

export type Usage = { inputTokens: number; outputTokens: number; thoughtTokens: number };

export function llmConfigured() {
  return process.env.AI_MODE === "live" && !!process.env.GEMINI_API_KEY;
}

export function imagePart(dataUrl: string): Part {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("이미지는 base64 data URL이어야 합니다");
  return { inline_data: { mime_type: match[1], data: match[2] } };
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: string };
};

export async function generateJson<T>(options: GenerateOptions): Promise<{ data: T; usage: Usage }> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: options.system }] },
    contents: [{ role: "user", parts: options.parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: options.schema,
      thinkingConfig: { thinkingLevel: options.thinking ?? "minimal" },
      ...(options.temperature !== undefined && { temperature: options.temperature }),
    },
  });

  const res = await postWithRetry(`${BASE}/${options.model}:generateContent`, body);
  const json = (await res.json()) as GeminiResponse;
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) {
    const reason = json.promptFeedback?.blockReason ?? json.candidates?.[0]?.finishReason ?? "빈 응답";
    throw new Error(`Gemini 응답 없음: ${reason}`);
  }

  return {
    data: JSON.parse(text) as T,
    usage: {
      inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
      thoughtTokens: json.usageMetadata?.thoughtsTokenCount ?? 0,
    },
  };
}

// 503(서버 혼잡)·429(요청 과다)는 잠깐 쉬고 한 번만 다시 시도한다
async function postWithRetry(url: string, body: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return res;
    if (attempt === 0 && (res.status === 503 || res.status === 429)) {
      await new Promise((r) => setTimeout(r, 800));
      continue;
    }
    throw new Error(`Gemini 요청 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
}
