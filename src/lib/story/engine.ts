import "server-only";

import { generateJson, imagePart, type JsonSchema, type Usage } from "@/lib/ai/gemini";
import { generateTurnJson } from "@/lib/ai/llm";
import { isUnsafe } from "./safety";
import { decide, type ScaffoldDecision } from "./scaffold";
import type { AiTurn, Choice, DrawingInfo, QuestionType, ScaffoldStage, Scene, TurnRequest, TurnResult } from "./types";

// 그림 인식은 이미지를 읽을 수 있는 Gemini. 대화 모델은 src/lib/ai/llm.ts에서 고른다
export const VISION_MODEL = "gemini-3.5-flash";

const CHARACTER = `너는 만 4~5세 아이와 함께 그림책을 만드는 여우 캐릭터 "토리"야.
- 다정한 반말로, 짧고 쉬운 낱말만 써. 한 문장은 25자 안팎.
- 이야기는 아이가 만든다. 아이가 말하지 않은 사건이나 인물을 새로 지어내지 마.
- 사람 이름을 지어내지 마. 아이를 이름이나 별명으로 부르지 마.
- 아이가 사는 곳, 가족, 유치원 같은 개인 정보를 묻지 마.
- 무섭거나 잔인한 묘사, 어른 이야기는 하지 마. 아이가 무서운 이야기를 하면 부드럽게 받아 줘.
- 아이를 평가하거나 고치려 하지 마.`;

// ── 그림 인식 (INP-03) ──────────────────────────────────────────

const DRAWING_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string", description: "그림을 설명하는 쉬운 한국어 한 문장" },
    elements: {
      type: "array",
      items: { type: "string" },
      maxItems: 6,
      description: "그림 속 인물·동물·사물·배경. 쉬운 낱말 하나씩",
    },
  },
  required: ["summary", "elements"],
};

export async function describeDrawing(dataUrl: string): Promise<{ info: DrawingInfo; usage: Usage }> {
  const { data, usage } = await generateJson<DrawingInfo>({
    model: VISION_MODEL,
    thinking: "low",
    system: `${CHARACTER}
지금은 아이가 그린 그림을 보고 무엇이 있는지 알아보는 일을 해.
아이 그림은 서툴 수 있으니 아이가 무엇을 그리려 했는지 너그럽게 추측해. 정말 모르겠으면 "동그라미"처럼 모양으로 말해.`,
    parts: [{ text: "이 그림에 무엇이 있는지 알려 줘." }, imagePart(dataUrl)],
    schema: DRAWING_SCHEMA,
  });
  return { info: { summary: data.summary, elements: data.elements.slice(0, 6) }, usage };
}

// ── 대화 한 턴 (DLG-01~04) ──────────────────────────────────────

type TurnOutput = {
  echo: string;
  pageText: string;
  sceneEmojis: string[];
  sceneDescription: string;
  question: string;
  choices: Choice[];
  title: string;
};

const TURN_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    echo: { type: "string" },
    pageText: { type: "string" },
    sceneEmojis: { type: "array", items: { type: "string" }, maxItems: 4 },
    sceneDescription: { type: "string" },
    question: { type: "string" },
    choices: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: { emoji: { type: "string" }, label: { type: "string" } },
        required: ["emoji", "label"],
      },
    },
    title: { type: "string" },
  },
  required: ["echo", "pageText", "sceneEmojis", "sceneDescription", "question", "choices", "title"],
};

const TYPE_GUIDE: Record<QuestionType, string> = {
  사건: "다음에 무슨 일이 일어났는지, 누구를 만났는지, 무엇을 했는지",
  원인: "왜 그랬는지, 어떻게 그렇게 됐는지",
  감정: "이야기 속 인물의 기분이나 마음 (아이 자신의 기분이 아니라 등장인물의 기분)",
  결말: "이야기가 어떻게 끝나면 좋을지",
};

const STAGE_GUIDE: Record<ScaffoldStage, string> = {
  open: "답이 정해지지 않은 열린 질문 하나. choices는 빈 배열.",
  narrowed:
    "떠올리기 쉽게 범위를 좁힌 질문 하나. 그림 속 요소나 앞 이야기를 하나 짚어서 '누가/무엇을/어디서'로 물어 (예: '토끼 가방에는 뭐가 들어 있었을까?'). 보기를 주는 질문('~일까, ~일까?')과 '응/아니'로 답하는 질문은 안 돼. choices는 빈 배열.",
  choice:
    "2~3가지 중에서 고르는 질문 하나. 질문은 소리로 들려주므로 보기를 질문 안에 '~일까, ~일까?'처럼 모두 말해. 같은 보기를 choices에 담아. label은 그 질문에 대한 아이의 대답으로 그대로 읽히는 짧은 말 (예: '배가 고파서', '기뻤어'), 이모지는 하나.",
};

// AI 응답이 실패하거나 걸러졌을 때 쓰는 안전한 대체 질문
const FALLBACK_QUESTION: Record<QuestionType, string> = {
  사건: "그다음에는 무슨 일이 있었을까?",
  원인: "왜 그랬을까?",
  감정: "그때 기분이 어땠을까?",
  결말: "이야기가 어떻게 끝나면 좋을까?",
};

// 대답이 어려웠을 때의 다독임은 코드가 돌아가며 고른다 (LLM은 같은 문장을 반복하는 경향이 있음)
const ENCOURAGEMENTS = [
  "괜찮아, 같이 생각해 보자!",
  "천천히 생각해도 돼.",
  "생각이 안 나도 괜찮아.",
  "음, 어려웠구나. 다르게 물어볼게!",
  "괜찮아, 토리가 도와줄게.",
];
const GENTLE_CLOSING = "오늘은 여기까지 해 볼까? 이야기를 함께 만들어 줘서 고마워!";
const KID_ENDED_CLOSING = "그래, 이야기 끝! 멋진 이야기를 함께 만들어 줘서 고마워!";

const SCENE_COLORS: [string, string][] = [
  ["#d9f99d", "#86efac"],
  ["#fef08a", "#fdba74"],
  ["#bae6fd", "#a5b4fc"],
  ["#fed7aa", "#fb923c"],
  ["#fbcfe8", "#c4b5fd"],
  ["#ccfbf1", "#5eead4"],
];

function buildTurnPrompt(req: TurnRequest, decision: ScaffoldDecision): string {
  const lines: string[] = [];
  if (req.drawing) lines.push(`[아이 그림] ${req.drawing.summary} (보이는 것: ${req.drawing.elements.join(", ")})`);
  if (req.scenes?.length) lines.push(`[앞 장면 삽화 설명]\n${req.scenes.slice(-4).join("\n")}`);
  lines.push(req.pages.length ? `[지금까지 이야기]\n${req.pages.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : "[지금까지 이야기] 아직 없음");
  if (req.history.length) {
    lines.push(`[최근 대화]\n${req.history.slice(-4).map((h) => `토리: ${h.question}\n아이: ${h.answer || "(대답 없음)"}`).join("\n")}`);
  }
  lines.push(`[방금 질문] ${req.question ?? "어떤 그림이야? 그림 이야기를 들려줘!"}`);
  lines.push(`[아이 대답] ${req.answer.trim() || "(대답 없음)"}`);

  const tasks: string[] = [];
  if (decision.makesPage) {
    tasks.push(
      "echo: 아이 말을 그대로 따라 하지 말고, 빠진 낱말·조사·어미를 채운 완성된 문장으로 다듬어 되받아 확인해 (예: 아이 '곰' → '숲에서 곰을 만났구나!'). 아이가 쓴 낱말은 살리고, 아이가 말하지 않은 새 내용은 더하지 마. '~구나!'로 끝내.",
    );
    tasks.push("pageText: 아이 대답을 그림책 문장 하나로. '~했어요' 같은 해요체 과거형. 아이 낱말을 살리고 새 사건은 넣지 마. 40자 이내.");
    tasks.push("sceneEmojis: 이 장면을 나타내는 이모지 2~4개.");
    tasks.push(
      "sceneDescription: 이 장면의 삽화를 그리기 위한 **영어** 한 문장 (who, doing what, where). 이 장면에 나오는 인물을 한 명도 빠짐없이 적고, 인물마다 [앞 장면 삽화 설명]과 똑같은 생김새 표현을 써 (예: 'the white rabbit', 'the brown bear'). 처음 나오는 인물은 색과 생김새를 정해서 적어. 인물마다 이 장면의 표정도 적어 (예: 'the smiling brown bear').",
    );
  } else {
    // 다독임 문장은 코드가 정한다 (encourage)
    tasks.push("echo, pageText, sceneDescription은 빈 문자열, sceneEmojis는 빈 배열.");
  }

  if (decision.done) {
    if (decision.makesPage) tasks.push("echo 끝에 이야기를 함께 만들어 줘서 고맙다는 짧은 마무리 인사를 덧붙여.");
    tasks.push("question은 빈 문자열, choices는 빈 배열.");
    tasks.push("title: 지금까지 이야기에 어울리는 그림책 제목. 10자 안팎.");
  } else {
    const { type, stage } = decision.next;
    const reask = !decision.makesPage ? " 방금 질문과 같은 내용을 더 쉬운 말로 다시 물어." : "";
    tasks.push(`question: [${type}] 질문 — ${TYPE_GUIDE[type]}에 대해 묻기. ${STAGE_GUIDE[stage]}${reask}`);
    tasks.push("title은 빈 문자열.");
  }

  return `${lines.join("\n\n")}\n\n[할 일]\n${tasks.map((t) => `- ${t}`).join("\n")}`;
}

export async function nextTurn(req: TurnRequest): Promise<{ result: TurnResult; usage: Usage | null; provider: string | null }> {
  // 부적절한 말은 이야기에 넣지 않고, 같은 질문을 다시 한다 (SAF-01)
  if (isUnsafe(req.answer)) {
    const turn = currentTurn(req);
    return {
      result: { echo: "음, 다른 말로 이야기해 볼까?", page: null, next: turn, done: false, title: null, scaffold: req.scaffold },
      usage: null,
      provider: null,
    };
  }

  const decision = decide(req.scaffold, req.answer);
  let output: TurnOutput;
  let usage: Usage | null = null;
  let provider: string | null = null;
  try {
    const res = await generateTurnJson<TurnOutput>({
      system: CHARACTER,
      prompt: buildTurnPrompt(req, decision),
      schema: TURN_SCHEMA,
      temperature: 0.8,
    });
    output = res.data;
    usage = res.usage;
    provider = res.provider;
  } catch (error) {
    console.error(error);
    output = fallbackOutput(req, decision);
  }

  if (isUnsafe(Object.values(output).flat().map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" "))) {
    output = fallbackOutput(req, decision);
  }

  return { result: toResult(req, decision, output), usage, provider };
}

// 대화가 한 번 오갈 때마다 다음 문장으로 넘어가 연달아 같은 말을 하지 않는다
function encourage(req: TurnRequest): string {
  return ENCOURAGEMENTS[req.history.length % ENCOURAGEMENTS.length];
}

function currentTurn(req: TurnRequest): AiTurn {
  const { type, stage } = req.scaffold;
  return { question: req.question ?? FALLBACK_QUESTION[type], type, stage };
}

function fallbackOutput(req: TurnRequest, decision: ScaffoldDecision): TurnOutput {
  const answer = req.answer.trim();
  return {
    echo: decision.makesPage ? `${answer}, 그랬구나!` : "",
    pageText: decision.makesPage ? answer : "",
    sceneEmojis: decision.makesPage ? ["📖", "✨"] : [],
    sceneDescription: decision.makesPage ? answer : "",
    question: decision.done ? "" : FALLBACK_QUESTION[decision.next.type],
    choices: [],
    title: decision.done ? "우리가 만든 이야기" : "",
  };
}

function toResult(req: TurnRequest, decision: ScaffoldDecision, out: TurnOutput): TurnResult {
  const scene: Scene = {
    emojis: out.sceneEmojis.length ? out.sceneEmojis.slice(0, 4) : ["📖", "✨"],
    colors: SCENE_COLORS[req.pages.length % SCENE_COLORS.length],
  };
  const page = decision.makesPage
    ? { text: out.pageText.trim() || req.answer.trim(), scene, sceneDescription: out.sceneDescription.trim() || undefined }
    : null;

  let next: AiTurn | null = null;
  if (!decision.done) {
    const { type, stage } = decision.next;
    const choices = stage === "choice" ? out.choices.filter((c) => c.label.trim()).slice(0, 3) : undefined;
    next = {
      question: out.question.trim() || FALLBACK_QUESTION[type],
      type,
      stage,
      // 선택지 단계인데 보기가 모자라면 카드 없이 질문만 한다 (아이는 말로 대답할 수 있다)
      choices: choices && choices.length >= 2 ? choices : undefined,
    };
  }

  return {
    echo: decision.makesPage
      ? out.echo.trim() || "그랬구나!"
      : decision.done
        ? decision.kind === "end"
          ? KID_ENDED_CLOSING
          : GENTLE_CLOSING
        : encourage(req),
    page,
    next,
    done: decision.done,
    title: decision.done ? out.title.trim() || "우리가 만든 이야기" : null,
    scaffold: decision.next,
  };
}
