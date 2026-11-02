import { INITIAL_SCAFFOLD } from "./scaffold";
import type { AiTurn, Choice, Scene, TurnResult } from "./types";

// 키가 없을 때(mock 모드) 쓰는 고정 시나리오.
// 순서: 첫 문장 → (질문 → 대답) 반복 → 마무리

export const MOCK_TITLE = "토끼와 배고픈 곰";
export const MOCK_DRAWING = "/sample/drawing.svg";

type KidAnswer = {
  text: string;
  echo: string;
  page?: { text: string; scene: Scene };
};

type ChoiceCard = KidAnswer & Choice;

const FIRST_ANSWER: KidAnswer = {
  text: "토끼가 숲에 갔어",
  echo: "토끼가 숲에 갔구나!",
  page: {
    text: "토끼가 숲에 갔어요.",
    scene: { emojis: ["🐰", "🌳", "🌳"], colors: ["#d9f99d", "#86efac"] },
  },
};

const bearChoices: ChoiceCard[] = [
  {
    emoji: "😊",
    label: "기뻤어",
    text: "기뻤어",
    echo: "곰이 토끼를 만나서 기뻤구나!",
    page: {
      text: "곰은 토끼를 만나서 기뻤어요.",
      scene: { emojis: ["🐻", "😊", "🐰"], colors: ["#fef08a", "#fdba74"] },
    },
  },
  {
    emoji: "😨",
    label: "무서웠어",
    text: "무서웠어",
    echo: "곰이 조금 무서웠구나!",
    page: {
      text: "곰은 조금 무서웠어요.",
      scene: { emojis: ["🐻", "😨", "🌲"], colors: ["#c7d2fe", "#a5b4fc"] },
    },
  },
  {
    emoji: "🍯",
    label: "배고팠어",
    text: "배고팠어",
    echo: "곰이 배가 고팠구나!",
    page: {
      text: "곰은 배가 고팠어요.",
      scene: { emojis: ["🐻", "🍯", "💭"], colors: ["#fde68a", "#fbbf24"] },
    },
  },
];

// turns[i]는 AI 질문, spoken은 마이크를 눌렀을 때 아이가 했다고 치는 대답
const TURNS: (AiTurn & { cards?: ChoiceCard[]; spoken: KidAnswer })[] = [
  {
    question: "숲에서 토끼는 누구를 만났을까?",
    type: "사건",
    stage: "open",
    spoken: {
      text: "곰을 만났어",
      echo: "토끼가 숲에서 곰을 만났구나!",
      page: {
        text: "토끼는 숲에서 곰을 만났어요.",
        scene: { emojis: ["🐰", "🐻", "🌳"], colors: ["#bbf7d0", "#4ade80"] },
      },
    },
  },
  {
    question: "곰은 토끼를 보고 어떤 기분이었을까?",
    type: "감정",
    stage: "open",
    // "몰라" → 다음 질문은 선택지 단계로 내려간다 (DLG-03 시연)
    spoken: { text: "몰라", echo: "괜찮아, 같이 생각해 보자!" },
  },
  {
    question: "곰은 기뻤을까, 무서웠을까, 배가 고팠을까?",
    type: "감정",
    stage: "choice",
    cards: bearChoices,
    spoken: bearChoices[2],
  },
  {
    question: "토끼 가방에는 뭐가 들어 있었을까?",
    type: "원인",
    stage: "narrowed",
    spoken: {
      text: "당근이랑 꿀이 있어서 곰한테 나눠 줬어",
      echo: "토끼가 당근이랑 꿀을 곰에게 나눠 줬구나!",
      page: {
        text: "토끼는 가방에 있던 당근이랑 꿀을 곰에게 나눠 줬어요.",
        scene: { emojis: ["🐰", "🥕", "🍯", "🐻"], colors: ["#fed7aa", "#fb923c"] },
      },
    },
  },
  {
    question: "이야기가 어떻게 끝나면 좋을까?",
    type: "결말",
    stage: "open",
    spoken: {
      text: "둘이 친구가 돼서 같이 놀았어",
      echo: "토끼랑 곰이 친구가 됐구나!",
      page: {
        text: "둘은 친구가 되어 같이 신나게 놀았어요.",
        scene: { emojis: ["🐰", "🤝", "🐻", "🌈"], colors: ["#fbcfe8", "#c4b5fd"] },
      },
    },
  },
];

const CLOSING = "정말 멋진 이야기야. 우리 그림책이 완성됐어!";

// step: 아이가 대답한 질문의 순서 (-1이면 그림 이야기에 대한 첫 대답)
export function mockSpoken(step: number): string {
  return step < 0 ? FIRST_ANSWER.text : TURNS[step].spoken.text;
}

export function mockTurn(step: number, said: string): TurnResult {
  const asked = TURNS[step];
  const answer = step < 0 ? FIRST_ANSWER : (asked.cards?.find((c) => c.label === said) ?? asked.spoken);
  const next = TURNS[step + 1];
  return {
    echo: next ? answer.echo : `${answer.echo} ${CLOSING}`,
    page: answer.page ?? null,
    next: next
      ? { question: next.question, type: next.type, stage: next.stage, choices: next.cards?.map(({ emoji, label }) => ({ emoji, label })) }
      : null,
    done: !next,
    title: next ? null : MOCK_TITLE,
    scaffold: INITIAL_SCAFFOLD,
  };
}
