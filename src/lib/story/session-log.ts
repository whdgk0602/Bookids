import type { Usage } from "@/lib/ai/gemini";
import type { QuestionType, ScaffoldStage } from "./types";

// 세션 로그 (LOG-01): 효과 검증과 비용·지연 측정에 쓴다.
// 턴별 아이 발화, 질문 유형·비계 단계, 단계별 응답 시간, AI 사용량을 남긴다.

export type SttMeta = { confidence: number | null; ms: number };

export type TurnLog = {
  at: string; // ISO 시각
  question: string;
  type: QuestionType | null; // 첫 질문(그림 이야기)은 null
  stage: ScaffoldStage | null;
  answer: string;
  via: "voice" | "choice" | "mock";
  stt: SttMeta | null;
  turnMs: number | null;
  // 아이가 손을 떼거나 카드를 누른 순간부터 토리의 되받기가 나오기까지 (목표 3초 이내)
  echoMs: number | null;
  usage: Usage | null;
  provider?: string | null; // 이 턴을 만든 LLM 공급자 (groq, gemini)
  echo: string;
  madePage: boolean;
};

export type IllustrationLog = { page: number; ms: number | null; ok: boolean };

export type SessionLog = {
  version: 1;
  startedAt: string;
  finishedAt: string | null;
  drawing: { summary: string; elements: string[]; describeMs: number | null } | null;
  // 그림 없이 말로만 만든 이야기
  talkOnly?: boolean;
  turns: TurnLog[];
  illustrations: IllustrationLog[];
};

export function newSessionLog(): SessionLog {
  return { version: 1, startedAt: new Date().toISOString(), finishedAt: null, drawing: null, turns: [], illustrations: [] };
}

// 숫자로 보는 요약 (시연·비교용)
export function summarize(log: SessionLog) {
  const answered = log.turns.filter((t) => t.answer.trim());
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  return {
    turns: log.turns.length,
    pages: log.turns.filter((t) => t.madePage).length,
    // 아이가 한 말의 어절 수 (발화량 비교의 가장 단순한 지표)
    kidEojeol: answered.reduce((n, t) => n + t.answer.trim().split(/\s+/).length, 0),
    noAnswerTurns: log.turns.length - answered.length,
    avgSttMs: avg(log.turns.flatMap((t) => (t.stt ? [t.stt.ms] : []))),
    avgTurnMs: avg(log.turns.flatMap((t) => (t.turnMs !== null ? [t.turnMs] : []))),
    avgEchoMs: avg(log.turns.flatMap((t) => (t.echoMs != null ? [t.echoMs] : []))),
    slowEchoTurns: log.turns.filter((t) => t.echoMs != null && t.echoMs > 3000).length,
    avgIllustrationMs: avg(log.illustrations.flatMap((i) => (i.ms !== null ? [i.ms] : []))),
    failedIllustrations: log.illustrations.filter((i) => !i.ok).length,
    tokens: log.turns.reduce((n, t) => n + (t.usage ? t.usage.inputTokens + t.usage.outputTokens + t.usage.thoughtTokens : 0), 0),
  };
}
