// 질문 유형 (DLG-02)
export type QuestionType = "사건" | "원인" | "감정" | "결말";

// 비계 단계 (DLG-03): 열린 질문 → 범위 축소 → 선택지
export type ScaffoldStage = "open" | "narrowed" | "choice";

// 삽화 자리에 쓰는 장면 정보. 단계 4에서 실제 이미지로 바뀐다.
export type Scene = {
  emojis: string[];
  colors: [string, string];
};

export type KidAnswer = {
  text: string;
  // 이 대답을 받은 뒤 AI가 되받아 하는 말 (DLG-01)
  echo: string;
  // 그림책 한 페이지가 되는 대답만 page를 가진다 ("몰라" 같은 대답은 없음)
  page?: { text: string; scene: Scene };
};

export type ChoiceCard = KidAnswer & { emoji: string; label: string };

export type AiTurn = {
  question: string;
  type: QuestionType;
  stage: ScaffoldStage;
  choices?: ChoiceCard[];
};

export type StoryPage = {
  id: string;
  text: string;
  scene: Scene;
  status: "drawing" | "done";
};
