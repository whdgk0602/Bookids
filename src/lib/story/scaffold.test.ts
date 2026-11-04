import { describe, expect, it } from "vitest";
import { classifyAnswer, decide, INITIAL_SCAFFOLD, SCAFFOLD_RULES, type ScaffoldState } from "./scaffold";

describe("classifyAnswer", () => {
  it.each(["", "  ", "몰라", "몰라요", "모르겠어", "음…", "어", "글쎄"])("'%s'는 약한 대답", (t) => {
    expect(classifyAnswer(t)).toBe("weak");
  });

  it("짧아도 내용이 있으면 약한 대답이 아니다", () => {
    expect(classifyAnswer("곰!")).toBe("ok");
    expect(classifyAnswer("곰을 만났어")).toBe("ok");
    expect(classifyAnswer("몰라서 곰한테 물어봤어")).toBe("ok");
  });

  it("5어절 이상이면 길게 대답한 것", () => {
    expect(classifyAnswer("당근이랑 꿀이 있어서 곰한테 나눠 줬어")).toBe("strong");
  });
});

describe("끝내기 (DLG-04)", () => {
  it.each(["끝", "끝!", "끝이야", "끝났어", "이제 끝", "그만할래", "다 했어"])("'%s'는 끝내기", (t) => {
    expect(classifyAnswer(t)).toBe("end");
  });

  it("'끝까지 달렸어'처럼 내용이 있으면 끝내기가 아니다", () => {
    expect(classifyAnswer("끝까지 달렸어")).toBe("ok");
  });

  it("페이지가 있으면 바로 마무리하고, 페이지를 만들지 않는다", () => {
    const state: ScaffoldState = { type: "감정", stage: "open", weakStreak: 0, pages: 2 };
    expect(decide(state, "끝")).toMatchObject({ kind: "end", done: true, makesPage: false });
  });

  it("아직 페이지가 없으면 끝내지 않는다", () => {
    expect(decide(INITIAL_SCAFFOLD, "끝")).toMatchObject({ done: false, makesPage: false });
  });
});

describe("decide", () => {
  it("한 번 '몰라'는 같은 단계로 다시 묻고 페이지를 만들지 않는다", () => {
    const d = decide(INITIAL_SCAFFOLD, "몰라");
    expect(d).toMatchObject({ makesPage: false, done: false });
    expect(d.next).toMatchObject({ stage: "open", type: "사건", weakStreak: 1 });
  });

  it("'몰라'가 두 번 이어지면 같은 유형을 한 단계 쉽게 묻는다", () => {
    const once = decide(INITIAL_SCAFFOLD, "몰라").next;
    const twice = decide(once, "").next;
    expect(twice).toMatchObject({ stage: "narrowed", type: "사건", weakStreak: 0 });
    const fourTimes = decide(decide(twice, "몰라").next, "몰라").next;
    expect(fourTimes.stage).toBe("choice");
  });

  it("보통 대답은 단계를 유지하고 다음 유형으로 넘어간다", () => {
    const d = decide(INITIAL_SCAFFOLD, "곰을 만났어");
    expect(d.makesPage).toBe(true);
    expect(d.next).toMatchObject({ stage: "open", type: "감정", pages: 1 });
  });

  it("길게 대답하면 한 단계 열어 준다", () => {
    const narrowed: ScaffoldState = { ...INITIAL_SCAFFOLD, stage: "narrowed" };
    expect(decide(narrowed, "토끼가 곰한테 당근을 나눠 줬어").next.stage).toBe("open");
  });

  it("선택지에서 고르면 한 단계 열어 준다", () => {
    const choice: ScaffoldState = { ...INITIAL_SCAFFOLD, stage: "choice" };
    expect(decide(choice, "배고팠어").next.stage).toBe("narrowed");
  });

  it("같은 유형이 연달아 나오지 않는다", () => {
    let state = INITIAL_SCAFFOLD;
    const types = [state.type];
    for (let i = 0; i < SCAFFOLD_RULES.pagesBeforeEnding - 1; i++) {
      state = decide(state, "곰을 만났어").next;
      types.push(state.type);
    }
    for (let i = 1; i < types.length; i++) expect(types[i]).not.toBe(types[i - 1]);
  });

  it("페이지가 쌓이면 결말을 묻고, 결말에 대답하면 끝난다", () => {
    let state = INITIAL_SCAFFOLD;
    for (let i = 0; i < SCAFFOLD_RULES.pagesBeforeEnding; i++) state = decide(state, "곰을 만났어").next;
    expect(state.type).toBe("결말");
    expect(decide(state, "친구가 됐어")).toMatchObject({ makesPage: true, done: true });
  });

  it("결말 질문에 '몰라'면 끝내지 않고 다시 묻는다", () => {
    const ending: ScaffoldState = { type: "결말", stage: "open", weakStreak: 0, pages: 5 };
    expect(decide(ending, "몰라")).toMatchObject({ done: false, makesPage: false });
  });

  it("선택지로도 계속 대답이 없으면 부드럽게 마무리한다", () => {
    const choice: ScaffoldState = { type: "감정", stage: "choice", weakStreak: 1, pages: 2 };
    expect(decide(choice, "")).toMatchObject({ done: true, makesPage: false });
  });

  it("아직 페이지가 없으면 선택지에서 대답이 없어도 끝내지 않는다", () => {
    const choice: ScaffoldState = { type: "사건", stage: "choice", weakStreak: 1, pages: 0 };
    expect(decide(choice, "").done).toBe(false);
  });
});
