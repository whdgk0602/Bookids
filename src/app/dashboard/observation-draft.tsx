"use client";

import { useState } from "react";

type Area = { area: string; text: string; quotes: string[] };
type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; areas: Area[]; basedOn: number }
  | { status: "error"; message: string };

// 관찰기록 초안 (OBS-01): 버튼을 누를 때만 AI로 만든다. 교사가 검토·수정해서 쓴다 (OBS-02)
export default function ObservationDraft({ child }: { child: string }) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function make() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/report/observation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ child }),
        signal: AbortSignal.timeout(40_000),
      });
      const data = await res.json();
      if (!res.ok) return setState({ status: "error", message: data.error ?? "초안을 만들지 못했어요" });
      if (data.mode === "mock") return setState({ status: "error", message: "AI 키가 없는 모드라 초안을 만들 수 없어요" });
      setState({ status: "done", areas: data.areas, basedOn: data.basedOn });
    } catch {
      setState({ status: "error", message: "초안을 만들지 못했어요. 잠시 뒤에 다시 눌러 주세요" });
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">관찰기록 초안 (누리과정)</h2>
        <button
          type="button"
          onClick={make}
          disabled={state.status === "loading"}
          className="rounded-full bg-sky-500 px-5 py-2 text-white shadow-sm disabled:bg-zinc-300"
        >
          {state.status === "loading" ? "만드는 중…" : state.status === "done" ? "다시 만들기" : "✍️ 초안 만들기"}
        </button>
      </div>
      <p className="text-sm text-zinc-400">
        아이가 한 말을 근거로 AI가 의사소통·사회관계·예술경험 영역 초안을 써요. 모든 문장에 근거 발화가 붙고, 실제로 하지 않은 말은 인용되지 않아요. 선생님이 고쳐서
        쓰는 출발점이며, 그대로 확정하지 마세요.
      </p>
      {state.status === "error" && <p className="text-rose-600">{state.message}</p>}
      {state.status === "done" &&
        (state.areas.length ? (
          <>
            {state.areas.map((a) => (
              <article key={a.area} className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-4">
                <h3 className="font-bold">{a.area}</h3>
                <p className="leading-relaxed">{a.text}</p>
                <ul className="flex flex-col gap-1 text-sm text-zinc-500">
                  {a.quotes.map((q) => (
                    <li key={q}>근거: “{q}”</li>
                  ))}
                </ul>
              </article>
            ))}
            <p className="text-sm text-zinc-400">대답 {state.basedOn}개를 바탕으로 만들었어요.</p>
          </>
        ) : (
          <p className="text-zinc-500">근거가 충분한 영역이 없어 초안을 만들지 않았어요. 그림책을 더 만든 뒤에 다시 눌러 주세요.</p>
        ))}
    </section>
  );
}
