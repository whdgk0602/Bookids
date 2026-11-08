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
  // 아이 그림을 참조로 넣는지. 말로만 만든 이야기는 참조 없이 그린다
  hasReference?: boolean;
};

export function buildIllustrationPrompt(scene: string, { drawing, previousScenes, hasReference = true }: Context): string {
  const cast = drawing ? `Characters and things from the child's drawing: ${drawing.elements.join(", ")}.` : "";
  const style = hasReference
    ? [
        "The reference image is the child's own drawing. Draw in the SAME hand-drawn style: same simple shapes, line thickness, colors and proportions. Keep the child's characters looking exactly like in the drawing. Do not make it realistic or polished.",
        "New characters must be drawn in the same simple childlike style as the child's drawing.",
      ]
    : // 아이 그림이 없을 때: 페이지마다 같은 화풍이 나오도록 고정된 크레용 그림체를 쓴다
      ["Style: simple crayon drawing like a young child's picture book, thick soft lines, flat bright colors, plain background. Not realistic, not polished."];
  return [
    "Illustrate one page of a picture book for a 5-year-old.",
    ...style,
    cast,
    previousScenes.length ? `Earlier pages: ${previousScenes.join(" / ")}` : "",
    `This page: ${scene}`,
    "Draw every character mentioned for this page, each exactly once.",
    "One single full-bleed illustration. Not an open book, no page fold, no book binding, no frame.",
    "Warm, gentle, safe for young children. No text, letters or words in the image.",
  ]
    .filter(Boolean)
    .join(" ");
}
