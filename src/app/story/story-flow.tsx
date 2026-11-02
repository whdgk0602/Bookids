"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import BookViewer from "@/components/kid/book-viewer";
import DrawingCanvas from "@/components/kid/drawing-canvas";
import GuideBubble from "@/components/kid/guide-bubble";
import PushToTalk from "@/components/kid/push-to-talk";
import SceneArt from "@/components/kid/scene-art";
import { loadPhoto } from "@/lib/image/load-photo";
import { MOCK_CLOSING, MOCK_DRAWING, MOCK_FIRST_ANSWER, MOCK_TITLE, MOCK_TURNS } from "@/lib/story/mock-script";
import type { KidAnswer, ScaffoldStage, StoryPage } from "@/lib/story/types";

// 화면 1 시작(그리기) → 화면 2·3 되묻기와 삽화(반복) → 완성 → 화면 4 그림책
type Phase = "start" | "draw" | "talk" | "done" | "book";

type State = {
  phase: Phase;
  drawing: string | null;
  turn: number; // 지금 묻고 있는 MOCK_TURNS 인덱스
  guide: string[];
  kidSaid: string | null;
  pages: StoryPage[];
};

type Action =
  | { type: "startDrawing" }
  | { type: "pickDrawing"; src: string | null }
  | { type: "answer"; said: string; answer: KidAnswer; pageId: string }
  | { type: "illustrated"; pageId: string }
  | { type: "openBook" }
  | { type: "reset" };

const INITIAL: State = {
  phase: "start",
  drawing: null,
  turn: 0,
  guide: ["안녕! 나는 여우 토리야.", "어떤 그림을 그렸어? 그림 이야기를 들려줘!"],
  kidSaid: null,
  pages: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "startDrawing":
      return { ...state, phase: "draw" };
    case "pickDrawing":
      return { ...state, phase: "start", drawing: action.src ?? state.drawing };
    case "answer": {
      const { said, answer, pageId } = action;
      const pages = answer.page
        ? [...state.pages, { id: pageId, ...answer.page, status: "drawing" as const }]
        : state.pages;
      const nextTurn = state.phase === "start" ? 0 : state.turn + 1;
      const next = MOCK_TURNS[nextTurn];
      return {
        ...state,
        pages,
        kidSaid: said,
        turn: nextTurn,
        phase: next ? "talk" : "done",
        guide: [answer.echo, next ? next.question : MOCK_CLOSING],
      };
    }
    case "illustrated":
      return {
        ...state,
        pages: state.pages.map((p) => (p.id === action.pageId ? { ...p, status: "done" } : p)),
      };
    case "openBook":
      return { ...state, phase: "book" };
    case "reset":
      return INITIAL;
  }
}

// 단계 1 목업: 정해진 시나리오의 대답을 돌려준다. 단계 3에서 대화 엔진 호출로 바뀐다.
function mockAnswerFor(state: State, said: string): KidAnswer {
  if (state.phase === "start") return MOCK_FIRST_ANSWER;
  const turn = MOCK_TURNS[state.turn];
  return turn.choices?.find((c) => c.text === said) ?? turn.spoken;
}

const ILLUSTRATION_DELAY_MS = 2500;

export default function StoryFlow() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  // 다른 화면으로 나가면 처음부터 다시 시작한다. Next.js가 방문한 화면의 상태를 보존하므로
  // 직접 초기화하지 않으면 공용 태블릿에서 다음 아이가 앞 아이의 이야기를 보게 된다.
  useLayoutEffect(() => () => dispatch({ type: "reset" }), []);

  function answer(said: string) {
    const kidAnswer = mockAnswerFor(state, said);
    const pageId = `page-${state.pages.length + 1}`;
    dispatch({ type: "answer", said, answer: kidAnswer, pageId });
    // 삽화는 기다리지 않고 뒤에서 그려진다 (ILL-01)
    if (kidAnswer.page) {
      timers.current.push(setTimeout(() => dispatch({ type: "illustrated", pageId }), ILLUSTRATION_DELAY_MS));
    }
  }

  if (state.phase === "draw") {
    return (
      <div className="flex flex-1 flex-col p-4 sm:p-6">
        <DrawingCanvas
          onDone={(src) => dispatch({ type: "pickDrawing", src })}
          onCancel={() => dispatch({ type: "pickDrawing", src: null })}
        />
      </div>
    );
  }

  if (state.phase === "book" && state.drawing) {
    return <BookViewer title={MOCK_TITLE} drawing={state.drawing} pages={state.pages} onExit={() => router.push("/")} />;
  }

  const current = state.phase === "talk" ? MOCK_TURNS[state.turn] : undefined;
  const latestPage = state.pages.at(-1);
  const allDrawn = state.pages.every((p) => p.status === "done");

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="처음으로" className="flex size-14 items-center justify-center rounded-full bg-white text-3xl shadow-sm">
          🏠
        </Link>
        <PageStrip pages={state.pages} />
        {current && <StageBadge type={current.type} stage={current.stage} />}
      </header>

      <main className="grid flex-1 gap-6 md:grid-cols-2 md:items-center">
        {/* 왼쪽: 그림 또는 지금 페이지 */}
        <section className="flex flex-col gap-3">
          {state.phase === "start" ? (
            <DrawingPicker
              drawing={state.drawing}
              onDraw={() => dispatch({ type: "startDrawing" })}
              onPick={(src) => dispatch({ type: "pickDrawing", src })}
            />
          ) : (
            latestPage && (
              <div key={`${latestPage.id}-${latestPage.status}`} className="animate-pop-in flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-md">
                <SceneArt scene={latestPage.scene} drawing={latestPage.status === "drawing"} />
                <p className="text-center text-2xl">{latestPage.text}</p>
              </div>
            )
          )}
        </section>

        {/* 오른쪽: 캐릭터와 대답 */}
        <section className="flex flex-col gap-5">
          <GuideBubble lines={state.guide} />

          {state.kidSaid && (
            <p className="self-end rounded-3xl rounded-tr-md bg-sky-100 px-5 py-3 text-xl">
              <span aria-hidden>🧒 </span>
              {state.kidSaid}
            </p>
          )}

          {current?.choices && (
            <div className="grid grid-cols-3 gap-3">
              {current.choices.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => answer(c.text)}
                  className="flex flex-col items-center gap-1 rounded-3xl bg-white py-4 text-xl font-bold shadow-md active:scale-95"
                >
                  <span className="text-5xl">{c.emoji}</span>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {state.phase === "done" ? (
            <button
              type="button"
              disabled={!allDrawn}
              onClick={() => dispatch({ type: "openBook" })}
              className="h-28 rounded-full bg-emerald-500 text-3xl font-bold text-white shadow-lg active:scale-95 disabled:bg-zinc-300"
            >
              {allDrawn ? "📖 그림책 보기" : "🖍️ 마지막 그림 그리는 중…"}
            </button>
          ) : (
            <PushToTalk
              disabled={!state.drawing}
              mockAnswer={() => (state.phase === "start" ? MOCK_FIRST_ANSWER : MOCK_TURNS[state.turn].spoken).text}
              onAnswer={answer}
            />
          )}
        </section>
      </main>
    </div>
  );
}

type PickerProps = {
  drawing: string | null;
  onDraw: () => void;
  onPick: (src: string) => void;
};

// 그림 고르기: 직접 그리기(INP-01), 종이 그림 촬영·앨범(INP-02), 샘플
function DrawingPicker({ drawing, onDraw, onPick }: PickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [changing, setChanging] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 사진을 다시 골라도 반응하도록
    if (!file) return;
    setLoading(true);
    try {
      onPick(await loadPhoto(file));
      setChanging(false);
    } catch (error) {
      console.error("사진을 불러오지 못했습니다", error);
    } finally {
      setLoading(false);
    }
  }

  if (drawing && !changing) {
    return (
      <>
        <div className="animate-pop-in relative aspect-[4/3] w-full overflow-hidden rounded-3xl border-8 border-white bg-white shadow-md">
          <Image src={drawing} alt="내 그림" fill unoptimized className="object-contain" />
        </div>
        <button type="button" onClick={() => setChanging(true)} className="self-center rounded-full bg-white px-5 py-2 text-lg shadow-sm">
          🔄 다른 그림으로
        </button>
      </>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <PickButton emoji="✏️" label="그리기" onClick={onDraw} />
      <PickButton emoji="📷" label="사진 찍기" disabled={loading} onClick={() => cameraRef.current?.click()} />
      <PickButton emoji="🗂️" label="앨범에서" disabled={loading} onClick={() => albumRef.current?.click()} />
      <PickButton emoji="🖼️" label="샘플 그림" onClick={() => { onPick(MOCK_DRAWING); setChanging(false); }} />
      {/* capture: 태블릿·휴대폰에서 바로 뒤쪽 카메라를 연다 */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
      <input ref={albumRef} type="file" accept="image/*" onChange={onFile} hidden />
      {loading && <p className="col-span-2 text-center text-xl">사진을 불러오는 중…</p>}
    </div>
  );
}

function PickButton({ emoji, label, disabled, onClick }: { emoji: string; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-3xl bg-white text-xl font-bold shadow-md active:scale-95 disabled:opacity-40"
    >
      <span className="text-6xl">{emoji}</span>
      {label}
    </button>
  );
}

function PageStrip({ pages }: { pages: StoryPage[] }) {
  return (
    <ol className="flex flex-1 gap-2 overflow-x-auto" aria-label="만든 페이지">
      {pages.map((p, i) => (
        <li
          key={p.id}
          className={`flex size-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold shadow-sm ${
            p.status === "done" ? "bg-white" : "animate-pulse bg-amber-100"
          }`}
          title={p.text}
        >
          {p.status === "done" ? p.scene.emojis[0] : i + 1}
        </li>
      ))}
    </ol>
  );
}

const STAGE_LABEL: Record<ScaffoldStage, string> = { open: "열린 질문", narrowed: "범위 축소", choice: "선택지" };

// 시연용 표시: 지금 질문의 유형과 비계 단계 (DLG-02, DLG-03)
function StageBadge({ type, stage }: { type: string; stage: ScaffoldStage }) {
  return (
    <span className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-sm text-zinc-500">
      {type} · {STAGE_LABEL[stage]}
    </span>
  );
}
