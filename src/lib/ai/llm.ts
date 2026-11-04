import "server-only";

import { generateJson as geminiGenerateJson, type JsonSchema, type Usage } from "./gemini";
import { GROQ_TURN_MODEL, groqChatConfigured, groqGenerateJson } from "./groq-chat";

// 대화 한 턴을 만들 LLM 고르기. LLM_PROVIDERS 순서대로 시도하고, 실패하면 다음 공급자로 넘어간다.
// 무료 등급은 시간대에 따라 느려지거나(Gemini 무료가 한 턴 16~33초 걸린 적 있음) 한도에 걸리므로
// 시연 중에 멈추지 않게 예비 공급자를 둔다.

type Provider = "groq" | "gemini";

const GEMINI_TURN_MODEL = "gemini-3.5-flash-lite";

type Options = { system: string; prompt: string; schema: JsonSchema; temperature?: number };

export type LlmResult<T> = { data: T; usage: Usage; provider: Provider };

function providers(): Provider[] {
  const order = (process.env.LLM_PROVIDERS ?? "groq,gemini").split(",").map((p) => p.trim());
  return order.filter((p): p is Provider => (p === "groq" && groqChatConfigured()) || (p === "gemini" && !!process.env.GEMINI_API_KEY));
}

export function turnLlmConfigured() {
  return process.env.AI_MODE === "live" && providers().length > 0;
}

export async function generateTurnJson<T>(options: Options): Promise<LlmResult<T>> {
  let lastError: unknown = new Error("사용할 수 있는 LLM 공급자가 없습니다");
  for (const provider of providers()) {
    try {
      const res =
        provider === "groq"
          ? await groqGenerateJson<T>({ model: GROQ_TURN_MODEL, ...options })
          : await geminiGenerateJson<T>({ model: GEMINI_TURN_MODEL, system: options.system, parts: [{ text: options.prompt }], schema: options.schema, temperature: options.temperature });
      return { ...res, provider };
    } catch (error) {
      console.warn(`[llm] ${provider} 실패, 다음 공급자로`, error instanceof Error ? error.message : error);
      lastError = error;
    }
  }
  throw lastError;
}
