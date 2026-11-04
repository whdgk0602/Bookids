import "server-only";

import type { JsonSchema, Usage } from "./gemini";

// Groq 대화 모델 (OpenAI 호환 API). 무료 등급이 빠르다 (한 턴 약 1~2초).
// 무료 한도: 분당 30회·하루 1,000회, 분당 8,000토큰·하루 200,000토큰 (2026년 11월 기준, 계정 단위)

const URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 12_000;

export const GROQ_TURN_MODEL = "openai/gpt-oss-120b";

export function groqChatConfigured() {
  return !!process.env.GROQ_API_KEY;
}

type Options = { model: string; system: string; prompt: string; schema: JsonSchema; temperature?: number };

type ChatResponse = {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
};

export async function groqGenerateJson<T>(options: Options): Promise<{ data: T; usage: Usage }> {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: options.model,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.prompt },
      ],
      temperature: options.temperature,
      // 생각을 짧게 해서 아이가 기다리는 시간을 줄인다
      reasoning_effort: "low",
      response_format: { type: "json_schema", json_schema: { name: "turn", schema: toStrictSchema(options.schema), strict: true } },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Groq 요청 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`);

  const json = (await res.json()) as ChatResponse;
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq 응답 없음");
  const reasoning = json.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
  return {
    data: JSON.parse(text) as T,
    usage: {
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: (json.usage?.completion_tokens ?? 0) - reasoning,
      thoughtTokens: reasoning,
    },
  };
}

// Groq의 엄격(strict) 모드는 모든 객체에 additionalProperties: false가 있어야 하고
// 개수 제한(maxItems 등)을 받지 않는다. 개수는 받은 뒤에 코드에서 자른다.
export function toStrictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toStrictSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "maxItems" || key === "minItems" || key === "description") continue;
    out[key] = toStrictSchema(value);
  }
  if (out.type === "object") out.additionalProperties = false;
  return out;
}
