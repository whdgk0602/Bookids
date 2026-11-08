import { describe, expect, it } from "vitest";
import { newSessionLog, type TurnLog } from "@/lib/story/session-log";
import { buildChildReport, words, type ReportBook } from "./child-report";

function turn(answer: string, extra: Partial<TurnLog> = {}): TurnLog {
  return {
    at: "2026-11-08T00:00:00Z",
    question: "무슨 일이 있었어?",
    type: "사건",
    stage: "open",
    answer,
    via: "voice",
    stt: { confidence: 0.9, ms: 500 },
    turnMs: 1000,
    echoMs: 1500,
    usage: null,
    echo: "",
    madePage: !!answer,
    ...extra,
  };
}

function book(id: string, createdAt: string, turns: TurnLog[]): ReportBook {
  return { id, title: id, createdAt, log: { ...newSessionLog(), turns } };
}

describe("words", () => {
  it("문장부호를 떼고 띄어쓰기로 나눈다", () => {
    expect(words("곰을 만났어! 정말…")).toEqual(["곰을", "만났어", "정말"]);
  });
});

describe("buildChildReport", () => {
  it("대답 없음, 카드 선택, 인식 불확실은 지표에서 뺀다", () => {
    const r = buildChildReport("하늘", [
      book("a", "2026-11-01", [
        turn("토끼가 곰을 만났어"),
        turn(""),
        turn("기뻤어", { via: "choice", stt: null }),
        turn("뭐라고", { stt: { confidence: 0.2, ms: 500 } }),
      ]),
    ]);
    expect(r.totals.utterances).toBe(1);
    expect(r.totals.eojeol).toBe(3);
    expect(r.totals.avgEojeol).toBe(3);
    expect(r.totals.excluded).toBe(2);
    expect(r.totals.noAnswerRate).toBe(0.25);
    expect(r.books[0].transcript.map((u) => u.excluded)).toEqual([undefined, "대답 없음", "카드 선택", "인식 불확실"]);
  });

  it("새 낱말은 두 번째 그림책부터, 앞에서 안 쓴 것만", () => {
    const r = buildChildReport("하늘", [
      book("b", "2026-11-02", [turn("곰이 꿀을 먹었어")]),
      book("a", "2026-11-01", [turn("곰이 숲에 갔어")]),
    ]);
    expect(r.books.map((b) => b.id)).toEqual(["a", "b"]);
    expect(r.books[0].newWords).toEqual([]);
    expect(r.books[1].newWords).toEqual(["꿀을", "먹었어"]);
    expect(r.totals.differentWords).toBe(5);
  });

  it("발화가 적으면 참고치", () => {
    const r = buildChildReport(null, [book("a", "2026-11-01", [turn("곰")])]);
    expect(r.totals.reliable).toBe(false);
  });

  it("도움 단계별로 대답한 횟수를 센다", () => {
    const r = buildChildReport(null, [
      book("a", "2026-11-01", [turn("곰", { stage: null }), turn("숲", { stage: "narrowed" }), turn("기뻐", { stage: "choice", via: "choice" })]),
    ]);
    expect(r.totals.stages).toEqual({ open: 0, narrowed: 1, choice: 1 });
  });

  it("자주 쓴 낱말에서 말버릇은 뺀다", () => {
    const r = buildChildReport(null, [book("a", "2026-11-01", [turn("응 곰"), turn("응 곰 그리고")])]);
    expect(r.frequentWords).toEqual([{ word: "곰", count: 2 }]);
  });
});
