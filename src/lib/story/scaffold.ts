import type { QuestionType, ScaffoldStage } from "./types";

// 비계 규칙 (DLG-02, DLG-03, DLG-04)
// 질문 유형과 난이도 단계는 여기서 규칙으로 정하고, LLM은 정해진 유형·단계에 맞는 문장만 만든다.
// 숫자는 docs/spec.md의 초기 가정값이며 프로토타입 테스트로 조정한다.

export const SCAFFOLD_RULES = {
  // 무응답·"몰라"가 이만큼 이어지면 한 단계 쉬운 질문으로 내린다
  weakStreakToStepDown: 2,
  // 이 어절 수 이상으로 대답하면 한 단계 열린 질문으로 올린다
  strongMinEojeol: 5,
  // 이야기 페이지가 이만큼 쌓이면 결말 질문을 한다
  pagesBeforeEnding: 5,
} as const;

const STAGES: ScaffoldStage[] = ["open", "narrowed", "choice"];

// 결말 전까지 돌아가며 묻는 순서. 같은 유형이 연달아 나오지 않는다.
const TYPE_CYCLE: Exclude<QuestionType, "결말">[] = ["사건", "감정", "원인"];

export type ScaffoldState = {
  type: QuestionType;
  stage: ScaffoldStage;
  weakStreak: number; // 연속된 약한 대답 수
  pages: number; // 지금까지 페이지가 된 대답 수
};

export const INITIAL_SCAFFOLD: ScaffoldState = { type: "사건", stage: "open", weakStreak: 0, pages: 0 };

export type AnswerKind = "weak" | "ok" | "strong";

export type ScaffoldDecision = {
  kind: AnswerKind;
  // 이 대답이 그림책 한 페이지가 되는가
  makesPage: boolean;
  // 이야기가 끝났는가 (마지막 인사와 제목을 만든다)
  done: boolean;
  // 다음 질문의 유형·단계 (done이면 의미 없음)
  next: ScaffoldState;
};

// 대답 전체가 이 표현 하나뿐일 때만 해당한다 ("몰라서 곰한테 물어봤어"는 내용 있는 대답)
const DONT_KNOW = /^(몰라\S*|모르\S*|모름|글쎄\S*|음+|어+|으+|흠+|아니\S*|싫어\S*|안\s*해|그냥)[.!?~…\s]*$/;

export function countEojeol(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// 약한 대답: 대답이 없거나 "몰라" 같은 표현뿐인 경우.
// "곰!"처럼 짧아도 내용이 있는 대답은 약한 대답으로 보지 않는다 (유아는 짧게 말하는 것이 정상).
export function classifyAnswer(text: string): AnswerKind {
  const t = text.trim();
  if (!t || DONT_KNOW.test(t)) return "weak";
  return countEojeol(t) >= SCAFFOLD_RULES.strongMinEojeol ? "strong" : "ok";
}

function shift(stage: ScaffoldStage, by: -1 | 1): ScaffoldStage {
  const i = Math.min(STAGES.length - 1, Math.max(0, STAGES.indexOf(stage) - by));
  return STAGES[i];
}

function nextType(type: QuestionType): QuestionType {
  const i = TYPE_CYCLE.indexOf(type as (typeof TYPE_CYCLE)[number]);
  return TYPE_CYCLE[(i + 1) % TYPE_CYCLE.length];
}

export function decide(state: ScaffoldState, answer: string): ScaffoldDecision {
  const kind = classifyAnswer(answer);

  if (kind === "weak") {
    const weakStreak = state.weakStreak + 1;
    if (weakStreak < SCAFFOLD_RULES.weakStreakToStepDown) {
      // 한 번은 같은 질문을 다르게 물어 본다
      return { kind, makesPage: false, done: false, next: { ...state, weakStreak } };
    }
    if (state.stage === "choice") {
      // 선택지로도 대답이 없으면 아이가 지친 것으로 보고 부드럽게 마무리한다 (DLG-07)
      return { kind, makesPage: false, done: state.pages > 0, next: { ...state, weakStreak: 0 } };
    }
    // 같은 내용을 더 쉬운 단계로 다시 묻는다
    return { kind, makesPage: false, done: false, next: { ...state, stage: shift(state.stage, -1), weakStreak: 0 } };
  }

  const pages = state.pages + 1;
  if (state.type === "결말") {
    return { kind, makesPage: true, done: true, next: { ...state, pages, weakStreak: 0 } };
  }

  // 길게 대답했거나 선택지에서 골랐으면 한 단계 열어 준다 (선택지에 머물지 않도록)
  const stage = kind === "strong" || state.stage === "choice" ? shift(state.stage, 1) : state.stage;
  const type = pages >= SCAFFOLD_RULES.pagesBeforeEnding ? "결말" : nextType(state.type);
  return { kind, makesPage: true, done: false, next: { type, stage, weakStreak: 0, pages } };
}
