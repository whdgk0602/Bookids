import type { ScaffoldState } from "./scaffold";

// 질문 유형 (DLG-02)
export type QuestionType = "사건" | "원인" | "감정" | "결말";

// 비계 단계 (DLG-03): 열린 질문 → 범위 축소 → 선택지
export type ScaffoldStage = "open" | "narrowed" | "choice";

// 삽화 자리에 쓰는 장면 정보. 단계 4에서 실제 이미지로 바뀐다.
export type Scene = {
  emojis: string[];
  colors: [string, string];
};

export type Choice = { emoji: string; label: string };

export type AiTurn = {
  question: string;
  type: QuestionType;
  stage: ScaffoldStage;
  choices?: Choice[];
};

export type StoryPage = {
  id: string;
  text: string;
  scene: Scene;
  // 삽화 생성(ILL-01)에 쓸 장면 설명 (영어)
  sceneDescription?: string;
  // 생성된 삽화 (data URL). 없으면 장면 이모지로 대신 보여 준다
  image?: string;
  status: "drawing" | "done";
};

// 그림 인식 결과 (INP-03)
export type DrawingInfo = {
  summary: string;
  elements: string[];
};

export type TurnRequest = {
  drawing: DrawingInfo | null;
  pages: string[];
  // 앞 페이지 삽화 설명 (영어). 장면 설명에서 인물 생김새를 같게 유지하려고 넘긴다
  scenes?: string[];
  history: { question: string; answer: string }[];
  // 아이가 지금 대답한 질문 (첫 대답이면 null)
  question: string | null;
  answer: string;
  scaffold: ScaffoldState;
};

export type TurnResult = {
  // 아이 말을 되받는 말 (DLG-01)
  echo: string;
  page: { text: string; scene: Scene; sceneDescription?: string } | null;
  // 다음 질문. 이야기가 끝났으면 null
  next: AiTurn | null;
  done: boolean;
  title: string | null;
  scaffold: ScaffoldState;
};
