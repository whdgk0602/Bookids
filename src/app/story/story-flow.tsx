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
import { useSpeech } from "@/lib/audio/use-speech";
import { loadPhoto } from "@/lib/image/load-photo";
import { toImagePayload } from "@/lib/image/to-payload";
import { requestDescribe, requestTurn } from "@/lib/story/client";
import { MOCK_DRAWING, mockSpoken, mockTurn } from "@/lib/story/mock-script";
import { INITIAL_SCAFFOLD, type ScaffoldState } from "@/lib/story/scaffold";
import type { AiTurn, DrawingInfo, ScaffoldStage, StoryPage, TurnResult } from "@/lib/story/types";

// 화면 1 시작(그리기) → 화면 2·3 되묻기와 삽화(반복) → 완성 → 화면 4 그림책
type Phase = "start" | "draw" | "talk" | "done" | "book";

type State = {
  phase: Phase;
  drawing: string | null;
  drawingInfo: DrawingInfo | null;
  current: AiTurn | null; // 지금 아이에게 한 질문 (null이면 첫 질문: 그림 이야기)
  guide: string[];
  kidSaid: string | null;
  waiting: boolean; // 토리가 대답을 만드는 중
  pages: StoryPage[];
  history: { question: string; answer: string }[];
  scaffold: ScaffoldState;
  mockStep: number; // mock 모드에서 지금 대답하는 질문 순서
  title: string | null;
};

type Action =
  | { type: "startDrawing" }
  | { type: "pickDrawing"; src: string | null }
  | { type: "described"; info: DrawingInfo }
  | { type: "asked"; said: string }
  | { type: "answered"; said: string; result: TurnResult; pageId: string }
  | { type: "failed" }
  | { type: "illustrated"; pageId: string }
  | { type: "openBook" }
  | { type: "reset" };

const FIRST_QUESTION = "어떤 그림을 그렸어? 그림 이야기를 들려줘!";

const INITIAL: State = {
  phase: "start",
  drawing: null,
  drawingInfo: null,
  current: null,
  guide: ["안녕! 나는 여우 토리야.", FIRST_QUESTION],
  kidSaid: null,
  waiting: false,
  pages: [],
  history: [],
  scaffold: INITIAL_SCAFFOLD,
  mockStep: -1,
  title: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "startDrawing":
      return { ...state, phase: "draw" };
    case "pickDrawing":
      return action.src
        ? { ...state, phase: "start", drawing: action.src, drawingInfo: null }
        : { ...state, phase: "start" };
    case "described":
      return { ...state, drawingInfo: action.info };
    case "asked":
      return { ...state, kidSaid: action.said || "…", waiting: true };
    case "answered": {
      const { result, said, pageId } = action;
      const pages = result.page ? [...state.pages, { id: pageId, ...result.page, status: "drawing" as const }] : state.pages;
      return {
        ...state,
        phase: result.done ? "done" : "talk",
        waiting: false,
        pages,
        current: result.next,
        guide: result.next ? [result.echo, result.next.question] : [result.echo],
        // 토리가 실제로 한 말(되받기 + 질문)을 남겨, 다음 턴에서 같은 표현을 반복하지 않게 한다
        history: [...state.history, { question: state.guide.join(" "), answer: said }],
        scaffold: result.scaffold,
        mockStep: state.mockStep + 1,
        title: result.title,
      };
    }
    case "failed":
      return { ...state, waiting: false, guide: ["앗, 잘 못 들었어.", "다시 한 번 말해 줄래?"] };
    case "illustrated":
      return { ...state, pages: state.pages.map((p) => (p.id === action.pageId ? { ...p, status: "done" } : p)) };
    case "openBook":
      return { ...state, phase: "book" };
    case "reset":
      return INITIAL;
  }
}

// 단계 4에서 실제 삽화 생성으로 바뀐다
const ILLUSTRATION_DELAY_MS = 2500;
const DESCRIBE_WAIT_MS = 4000;

export default function StoryFlow() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const { speak, stop } = useSpeech();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const describing = useRef<Promise<DrawingInfo | null> | null>(null);
  // 화면을 나갔다 오면 늦게 도착한 응답을 버리기 위한 회차 번호
  const epoch = useRef(0);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  // 다른 화면으로 나가면 처음부터 다시 시작한다. Next.js가 방문한 화면의 상태를 보존하므로
  // 직접 초기화하지 않으면 공용 태블릿에서 다음 아이가 앞 아이의 이야기를 보게 된다.
  useLayoutEffect(
    () => () => {
      epoch.current++;
      describing.current = null;
      dispatch({ type: "reset" });
    },
    [],
  );

  // 토리의 말이 바뀌면 소리 내어 읽는다
  const spoken = state.waiting ? "" : state.guide.join(" ");
  useEffect(() => {
    if (spoken) speak(spoken);
  }, [spoken, speak]);

  function pickDrawing(src: string) {
    dispatch({ type: "pickDrawing", src });
    // 아이가 첫 문장을 말하는 동안 그림을 미리 알아본다 (INP-03)
    const myEpoch = epoch.current;
    describing.current = toImagePayload(src)
      .then(requestDescribe)
      .then((res) => {
        if (res.mode !== "live" || epoch.current !== myEpoch) return null;
        dispatch({ type: "described", info: res.info });
        return res.info;
      })
      .catch((error) => {
        console.error("그림을 알아보지 못했습니다", error);
        return null;
      });
  }

  async function answer(said: string) {
    const myEpoch = epoch.current;
    dispatch({ type: "asked", said });
    try {
      const drawingInfo = state.drawingInfo ?? (await within(describing.current, DESCRIBE_WAIT_MS));
      const res = await requestTurn({
        drawing: drawingInfo,
        pages: state.pages.map((p) => p.text),
        history: state.history,
        question: state.current?.question ?? null,
        answer: said,
        scaffold: state.scaffold,
      });
      if (epoch.current !== myEpoch) return;
      const result = res.mode === "live" ? res.result : mockTurn(state.mockStep, said);
      const pageId = `page-${state.pages.length + 1}`;
      dispatch({ type: "answered", said, result, pageId });
      // 삽화는 기다리지 않고 뒤에서 그려진다 (ILL-01)
      if (result.page) {
        timers.current.push(setTimeout(() => dispatch({ type: "illustrated", pageId }), ILLUSTRATION_DELAY_MS));
      }
    } catch (error) {
      console.error(error);
      if (epoch.current === myEpoch) dispatch({ type: "failed" });
    }
  }

  if (state.phase === "draw") {
    return (
      <div className="flex flex-1 flex-col p-4 sm:p-6">
        <DrawingCanvas onDone={pickDrawing} onCancel={() => dispatch({ type: "pickDrawing", src: null })} />
      </div>
    );
  }

  if (state.phase === "book" && state.drawing) {
    return (
      <BookViewer title={state.title ?? "우리가 만든 이야기"} drawing={state.drawing} pages={state.pages} onExit={() => router.push("/")} />
    );
  }

  const current = state.phase === "talk" ? state.current : null;
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
            <DrawingPicker drawing={state.drawing} onDraw={() => dispatch({ type: "startDrawing" })} onPick={pickDrawing} />
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
          <GuideBubble lines={state.guide} thinking={state.waiting} onReplay={() => speak(state.guide.join(" "))} />

          {state.kidSaid && (
            <p className="self-end rounded-3xl rounded-tr-md bg-sky-100 px-5 py-3 text-xl">
              <span aria-hidden>🧒 </span>
              {state.kidSaid}
            </p>
          )}

          {current?.choices && !state.waiting && (
            <div className="grid grid-cols-3 gap-3">
              {current.choices.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    stop();
                    void answer(c.label);
                  }}
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
              disabled={!state.drawing || state.waiting}
              mockAnswer={() => mockSpoken(state.mockStep)}
              onAnswer={(said) => void answer(said)}
              onPressStart={stop}
            />
          )}
        </section>
      </main>
    </div>
  );
}

// 그림 인식이 아직 안 끝났으면 잠깐만 기다리고, 늦으면 그림 정보 없이 진행한다
async function within<T>(promise: Promise<T | null> | null, ms: number): Promise<T | null> {
  if (!promise) return null;
  return Promise.race([promise, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
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
      <PickButton
        emoji="🖼️"
        label="샘플 그림"
        onClick={() => {
          onPick(MOCK_DRAWING);
          setChanging(false);
        }}
      />
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
