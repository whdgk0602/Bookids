import { describe, expect, it } from "vitest";
import { newSessionLog, summarize, type TurnLog } from "./session-log";

const turn = (answer: string, extra: Partial<TurnLog> = {}): TurnLog => ({
  at: "2026-11-04T00:00:00.000Z",
  question: "q",
  type: "사건",
  stage: "open",
  answer,
  via: "voice",
  stt: { confidence: 0.9, ms: 400 },
  turnMs: 1000,
  usage: { inputTokens: 100, outputTokens: 20, thoughtTokens: 0 },
  echo: "e",
  madePage: !!answer,
  ...extra,
});

describe("summarize", () => {
  it("발화량·무응답·평균 시간·토큰을 센다", () => {
    const log = newSessionLog();
    log.turns.push(turn("토끼가 숲에 갔어"), turn(""), turn("곰", { stt: { confidence: 0.5, ms: 600 }, turnMs: 2000 }));
    log.illustrations.push({ page: 1, ms: 4000, ok: true }, { page: 2, ms: null, ok: false });

    expect(summarize(log)).toEqual({
      turns: 3,
      pages: 2,
      kidEojeol: 4,
      noAnswerTurns: 1,
      avgSttMs: 467,
      avgTurnMs: 1333,
      avgIllustrationMs: 4000,
      failedIllustrations: 1,
      tokens: 360,
    });
  });

  it("빈 로그도 처리한다", () => {
    expect(summarize(newSessionLog())).toMatchObject({ turns: 0, avgTurnMs: null, avgIllustrationMs: null });
  });
});
