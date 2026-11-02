import { describe, expect, it } from "vitest";
import { isUnsafe } from "./safety";

describe("isUnsafe", () => {
  it.each(["씨발", "너 병신이야", "자살할래"])("'%s' 차단", (t) => expect(isUnsafe(t)).toBe(true));

  // 아이 이야기에 흔한 표현은 막지 않는다
  it.each(["괴물이 쓰러졌어", "곰이 꿀을 먹었어", "늑대가 무서웠어", "용이 불을 뿜었어"])("'%s' 허용", (t) =>
    expect(isUnsafe(t)).toBe(false),
  );
});
