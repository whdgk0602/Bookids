import { llmConfigured } from "@/lib/ai/gemini";
import { nextTurn } from "@/lib/story/engine";
import type { TurnRequest } from "@/lib/story/types";

const MAX_ANSWER_CHARS = 500;
const MAX_PAGES = 20;

// 아이 대답을 받아 되받기·그림책 문장·다음 질문을 돌려준다 (DLG-01~04)
export async function POST(request: Request) {
  if (!llmConfigured()) return Response.json({ mode: "mock" });

  const body = (await request.json()) as Partial<TurnRequest>;
  if (!isTurnRequest(body)) {
    return Response.json({ error: "요청 형식이 올바르지 않습니다" }, { status: 400 });
  }

  const started = performance.now();
  const { result, usage } = await nextTurn(body);
  return Response.json({ mode: "live", result, usage, ms: Math.round(performance.now() - started) });
}

function isTurnRequest(b: Partial<TurnRequest>): b is TurnRequest {
  return (
    typeof b.answer === "string" &&
    b.answer.length <= MAX_ANSWER_CHARS &&
    Array.isArray(b.pages) &&
    b.pages.length <= MAX_PAGES &&
    Array.isArray(b.history) &&
    (b.question === null || typeof b.question === "string") &&
    typeof b.scaffold === "object" &&
    b.scaffold !== null
  );
}
