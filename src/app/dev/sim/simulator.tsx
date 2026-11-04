"use client";

import { useEffect, useRef, useState } from "react";
import type { Usage } from "@/lib/ai/gemini";
import { toImagePayload } from "@/lib/image/to-payload";
import { requestDescribe, requestTurn } from "@/lib/story/client";
import { SAMPLE_DRAWINGS } from "@/lib/story/samples";
import { INITIAL_SCAFFOLD, type ScaffoldState } from "@/lib/story/scaffold";
import type { AiTurn, DrawingInfo, TurnResult } from "@/lib/story/types";

// 대화 엔진 텍스트 시뮬레이터 (단계 3): 말 대신 글자로 대답하며 질문 품질을 다듬는다.
// 실제 아이 데이터는 넣지 않는다 (무료 등급은 입력이 학습에 쓰일 수 있음).

type LogEntry = {
  asked: AiTurn | null;
  answer: string;
  result: TurnResult;
  ms: number;
  usage: Usage | null;
  provider: string | null;
};

const FIRST_QUESTION = "어떤 그림을 그렸어? 그림 이야기를 들려줘!";

const STAGE_LABEL = { open: "열린", narrowed: "범위 축소", choice: "선택지" } as const;

export default function Simulator() {
  const [drawing, setDrawing] = useState<DrawingInfo | null>(null);
  const [describeMs, setDescribeMs] = useState<number | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [current, setCurrent] = useState<AiTurn | null>(null);
  const [scaffold, setScaffold] = useState<ScaffoldState>(INITIAL_SCAFFOLD);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    toImagePayload(SAMPLE_DRAWINGS[0].src)
      .then(requestDescribe)
      .then((res) => {
        if (cancelled) return;
        if (res.mode === "mock") setError("서버가 mock 모드입니다. .env.local의 AI_MODE=live와 GEMINI_API_KEY를 확인하세요.");
        else {
          setDrawing(res.info);
          setDescribeMs(res.ms);
        }
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  async function send(answer: string) {
    if (busy || done) return;
    setBusy(true);
    setError(null);
    try {
      const res = await requestTurn({
        drawing,
        pages: log.flatMap((l) => (l.result.page ? [l.result.page.text] : [])),
        scenes: log.flatMap((l) => (l.result.page?.sceneDescription ? [l.result.page.sceneDescription] : [])),
        history: log.map((l, i) => ({ question: `${i > 0 ? log[i - 1].result.echo : ""} ${l.asked?.question ?? FIRST_QUESTION}`.trim(), answer: l.answer })),
        question: current?.question ?? null,
        answer,
        scaffold,
      });
      if (res.mode === "mock") throw new Error("서버가 mock 모드입니다");
      setLog((prev) => [...prev, { asked: current, answer, result: res.result, ms: res.ms, usage: res.usage, provider: res.provider }]);
      setCurrent(res.result.next);
      setScaffold(res.result.scaffold);
      setDone(res.result.done);
      setInput("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function reset() {
    setLog([]);
    setCurrent(null);
    setScaffold(INITIAL_SCAFFOLD);
    setDone(false);
    setError(null);
  }

  function download() {
    const blob = new Blob([JSON.stringify({ drawing, log }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `story-sim-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const avgMs = log.length ? Math.round(log.reduce((s, l) => s + l.ms, 0) / log.length) : null;
  const title = log.at(-1)?.result.title;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6 font-sans text-base select-text">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-2xl font-bold">대화 엔진 시뮬레이터</h1>
        <span className="text-sm text-zinc-500">샘플 그림 · 실제 아이 데이터 입력 금지</span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={reset} className="rounded-lg bg-white px-3 py-1 shadow-sm">
            처음부터
          </button>
          <button type="button" onClick={download} disabled={!log.length} className="rounded-lg bg-white px-3 py-1 shadow-sm disabled:opacity-40">
            로그 내려받기
          </button>
        </div>
      </header>

      <section className="rounded-xl bg-white p-4 text-sm shadow-sm">
        <b>그림 인식</b>{" "}
        {drawing ? (
          <>
            {drawing.summary} <span className="text-zinc-500">({drawing.elements.join(", ")} · {describeMs}ms)</span>
          </>
        ) : (
          <span className="text-zinc-500">불러오는 중…</span>
        )}
      </section>

      <ol className="flex flex-col gap-3">
        {log.map((l, i) => (
          <li key={i} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-zinc-500">
              #{i + 1} {l.asked ? `[${l.asked.type} · ${STAGE_LABEL[l.asked.stage]}]` : "[첫 질문]"} {l.asked?.question ?? FIRST_QUESTION}
            </p>
            <p className="mt-1">🧒 {l.answer || <i className="text-zinc-400">(대답 없음)</i>}</p>
            <p className="mt-1">🦊 {l.result.echo}</p>
            {l.result.page && (
              <p className="mt-1 rounded-lg bg-amber-50 px-3 py-1">
                📖 {l.result.page.text} {l.result.page.scene.emojis.join("")}
                {l.result.page.sceneDescription && <span className="block text-sm text-zinc-500">🎨 {l.result.page.sceneDescription}</span>}
              </p>
            )}
            <p className="mt-1 text-xs text-zinc-400">
              {l.ms}ms · {l.provider ?? "대체 문장"}
              {l.usage && ` · 토큰 입력 ${l.usage.inputTokens} / 출력 ${l.usage.outputTokens} / 생각 ${l.usage.thoughtTokens}`}
            </p>
          </li>
        ))}
      </ol>

      {done ? (
        <p className="rounded-xl bg-emerald-50 p-4 text-lg">
          ✅ 완성 — 제목: <b>{title}</b> · 평균 응답 {avgMs}ms
        </p>
      ) : (
        <section className="sticky bottom-4 flex flex-col gap-2 rounded-xl bg-white p-4 shadow-md">
          <p>
            <span className="text-sm text-zinc-500">{current ? `[${current.type} · ${STAGE_LABEL[current.stage]}] ` : "[첫 질문] "}</span>
            🦊 {current?.question ?? FIRST_QUESTION}
          </p>
          {current?.choices && (
            <div className="flex gap-2">
              {current.choices.map((c) => (
                <button key={c.label} type="button" onClick={() => send(c.label)} disabled={busy} className="rounded-lg bg-amber-100 px-3 py-1">
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="아이 대답을 입력"
              disabled={busy}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2"
            />
            <button type="submit" disabled={busy} className="rounded-lg bg-orange-400 px-4 py-2 font-bold text-white disabled:opacity-50">
              {busy ? "…" : "보내기"}
            </button>
            <button type="button" onClick={() => send("몰라")} disabled={busy} className="rounded-lg bg-zinc-100 px-3 py-2">
              몰라
            </button>
            <button type="button" onClick={() => send("")} disabled={busy} className="rounded-lg bg-zinc-100 px-3 py-2">
              무응답
            </button>
          </form>
          {avgMs !== null && <p className="text-xs text-zinc-400">평균 응답 {avgMs}ms · 비계 상태 {JSON.stringify(scaffold)}</p>}
        </section>
      )}

      {error && <p className="rounded-xl bg-rose-50 p-3 text-rose-700">{error}</p>}
    </main>
  );
}
