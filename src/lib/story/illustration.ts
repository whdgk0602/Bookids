import type { DrawingInfo } from "./types";

// 삽화 프롬프트 (ILL-01, ILL-02). 이미지 모델은 영어 지시를 가장 잘 따른다.
// 모든 페이지에 같은 원본 그림·시드를 넣고, 이야기 중에 새로 나온 인물은 앞 장면과 같은 생김새 표현
// ("the brown bear")으로 묘사해 페이지 간 모습을 맞춘다.
// 직전 페이지 삽화를 참조 이미지로 넣는 방법도 시험했지만, 표정·물건까지 그대로 따라 그리고
// 아이가 그린 인물의 모습이 바뀌어서 쓰지 않는다.

type Context = {
  drawing: DrawingInfo | null;
  // 앞 페이지들의 장면 설명 (인물 생김새를 맞추기 위해)
  previousScenes: string[];
};

export function buildIllustrationPrompt(scene: string, { drawing, previousScenes }: Context): string {
  const cast = drawing ? `Characters and things from the child's drawing: ${drawing.elements.join(", ")}.` : "";
  return [
    "Illustrate one page of a picture book for a 5-year-old.",
    "The reference image is the child's own drawing. Draw in the SAME hand-drawn style: same simple shapes, line thickness, colors and proportions. Keep the child's characters looking exactly like in the drawing. Do not make it realistic or polished.",
    "New characters must be drawn in the same simple childlike style as the child's drawing.",
    cast,
    previousScenes.length ? `Earlier pages: ${previousScenes.join(" / ")}` : "",
    `This page: ${scene}`,
    "Draw every character mentioned for this page, each exactly once.",
    "Warm, gentle, safe for young children. No text, letters or words in the image.",
  ]
    .filter(Boolean)
    .join(" ");
}
