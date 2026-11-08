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
import { useChild } from "@/lib/use-child";
import { loadPhoto } from "@/lib/image/load-photo";
import { toImagePayload } from "@/lib/image/to-payload";
import { now } from "@/lib/time";
import { requestDescribe, requestIllustration, requestSaveBook, requestTurn } from "@/lib/story/client";
import { mockSpoken, mockTurn } from "@/lib/story/mock-script";
import { SAMPLE_DRAWINGS } from "@/lib/story/samples";
import { INITIAL_SCAFFOLD, type ScaffoldState } from "@/lib/story/scaffold";
import { newSessionLog, type SessionLog, type SttMeta } from "@/lib/story/session-log";
import type { AiTurn, DrawingInfo, ScaffoldStage, StoryPage, TurnResult } from "@/lib/story/types";

// 화면 1 시작(그리기) → 화면 2·3 되묻기와 삽화(반복) → 완성 → 화면 4 그림책
type Phase = "start" | "draw" | "talk" | "done" | "book";

type State = {
  phase: Phase;
  drawing: string | null;
  // 그림 없이 말로만 만드는 이야기
  talkOnly: boolean;
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
  saved: { status: "idle" | "saving" | "error" } | { status: "saved"; id: string };
};

type Action =
  | { type: "startDrawing" }
  | { type: "pickDrawing"; src: string | null }
  | { type: "talkOnly"; on: boolean }
  | { type: "described"; info: DrawingInfo }
  | { type: "asked"; said: string }
  | { type: "answered"; said: string; result: TurnResult; pageId: string }
  | { type: "failed"; offline: boolean }
  | { type: "illustrated"; pageId: string; image?: string }
  | { type: "openBook" }
  | { type: "save"; status: "saving" | "error" }
  | { type: "saved"; id: string }
  | { type: "reset" };

const FIRST_QUESTION = "어떤 그림을 그렸어? 그림 이야기를 들려줘!";
const TALK_FIRST_QUESTION = "어떤 이야기를 만들어 볼까? 누가 나오는지 들려줘!";

const INITIAL: State = {
  phase: "start",
  drawing: null,
  talkOnly: false,
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
  saved: { status: "idle" },
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "startDrawing":
      return { ...state, phase: "draw" };
    case "pickDrawing":
      return action.src
        ? { ...state, phase: "start", drawing: action.src, talkOnly: false, drawingInfo: null, guide: ["멋진 그림이다!", "마이크를 꾹 누른 채로 그림 이야기를 들려줘."] }
        : { ...state, phase: "start" };
    case "talkOnly":
      return action.on
        ? { ...state, drawing: null, talkOnly: true, drawingInfo: null, guide: ["좋아, 말로 이야기를 만들어 보자!", "마이크를 꾹 누른 채로 " + TALK_FIRST_QUESTION] }
        : { ...state, talkOnly: false, guide: INITIAL.guide };
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
      return {
        ...state,
        waiting: false,
        guide: action.offline ? ["앗, 인터넷이 끊겼나 봐.", "선생님께 알려 줄래?"] : ["앗, 잘 못 들었어.", "다시 한 번 말해 줄래?"],
      };
    case "illustrated":
      return {
        ...state,
        pages: state.pages.map((p) => (p.id === action.pageId ? { ...p, image: action.image, status: "done" } : p)),
      };
    case "openBook":
      return { ...state, phase: "book" };
    case "save":
      return { ...state, saved: { status: action.status } };
    case "saved":
      return { ...state, saved: { status: "saved", id: action.id } };
    case "reset":
      return INITIAL;
  }
}

// 삽화 공급자가 없을 때(mock) 그리는 척하는 시간
const MOCK_ILLUSTRATION_DELAY_MS = 2500;
// 그림 인식이 늦으면 첫 대답을 이만큼만 기다리고 그림 정보 없이 진행한다
const DESCRIBE_WAIT_MS = 2500;

export default function StoryFlow() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const { speak, stop } = useSpeech();
  const child = useChild();
  // 그림 없이 말로만 만들 때 페이지마다 같은 그림체가 나오도록 쓰는 시드
  const talkSeed = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const describing = useRef<Promise<DrawingInfo | null> | null>(null);
  // AI에 보낼 형태로 바꾼 아이 그림 (그림 인식용 1024px)
  const payload = useRef<Promise<string> | null>(null);
  // 삽화 참조용 512px 그림
  const reference = useRef<Promise<string> | null>(null);
  // 화면을 나갔다 오면 늦게 도착한 응답을 버리기 위한 회차 번호
  const epoch = useRef(0);
  // 세션 로그 (LOG-01). 화면에 그리지 않으므로 상태가 아닌 ref에 쌓는다
  const log = useRef<SessionLog | null>(null);

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
      payload.current = null;
      reference.current = null;
      log.current = null;
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
    const session = newSessionLog();
    log.current = session;
    payload.current = toImagePayload(src);
    reference.current = toImagePayload(src, 512);
    describing.current = payload.current
      .then(requestDescribe)
      .then((res) => {
        if (res.mode !== "live" || epoch.current !== myEpoch) return null;
        session.drawing = { ...res.info, describeMs: res.ms };
        dispatch({ type: "described", info: res.info });
        return res.info;
      })
      .catch((error) => {
        console.error("그림을 알아보지 못했습니다", error);
        return null;
      });
  }

  function startTalkOnly() {
    dispatch({ type: "talkOnly", on: true });
    epoch.current++;
    describing.current = null;
    payload.current = null;
    reference.current = null;
    log.current = { ...newSessionLog(), talkOnly: true };
    talkSeed.current = Math.floor(Math.random() * 2_000_000_000);
  }

  // 지금 아이가 대답하는 질문 (첫 질문은 그림으로 시작했는지에 따라 다르다)
  const askedQuestion = state.current?.question ?? (state.talkOnly ? TALK_FIRST_QUESTION : null);

  async function answer(said: string, via: "voice" | "choice", startedAt: number, stt: SttMeta | null = null) {
    const myEpoch = epoch.current;
    dispatch({ type: "asked", said });
    try {
      const drawingInfo = state.drawingInfo ?? (await within(describing.current, DESCRIBE_WAIT_MS));
      const res = await requestTurn({
        drawing: drawingInfo,
        pages: state.pages.map((p) => p.text),
        scenes: sceneHistory(state.pages),
        history: state.history,
        question: askedQuestion,
        answer: said,
        scaffold: state.scaffold,
      });
      if (epoch.current !== myEpoch) return;
      const result = res.mode === "live" ? res.result : mockTurn(state.mockStep, said);
      const pageId = `page-${state.pages.length + 1}`;
      log.current?.turns.push({
        at: new Date().toISOString(),
        question: askedQuestion ?? FIRST_QUESTION,
        type: state.current?.type ?? null,
        stage: state.current?.stage ?? null,
        answer: said,
        via: res.mode === "live" ? via : "mock",
        stt,
        turnMs: res.mode === "live" ? res.ms : null,
        echoMs: Math.round(now() - startedAt),
        usage: res.mode === "live" ? res.usage : null,
        provider: res.mode === "live" ? res.provider : null,
        echo: result.echo,
        madePage: !!result.page,
      });
      if (result.done && log.current) log.current.finishedAt = new Date().toISOString();
      dispatch({ type: "answered", said, result, pageId });
      // 삽화는 기다리지 않고 뒤에서 그려진다 (ILL-01)
      if (result.page) void illustrate(pageId, result.page.sceneDescription, drawingInfo, sceneHistory(state.pages));
    } catch (error) {
      console.error(error);
      if (epoch.current === myEpoch) dispatch({ type: "failed", offline: !navigator.onLine });
    }
  }

  async function illustrate(pageId: string, scene: string | undefined, drawingInfo: DrawingInfo | null, previousScenes: string[]) {
    const myEpoch = epoch.current;
    const fakeDrawing = () =>
      timers.current.push(setTimeout(() => dispatch({ type: "illustrated", pageId }), MOCK_ILLUSTRATION_DELAY_MS));
    try {
      const ref = (await reference.current) ?? null;
      // 그림을 골랐는데 참조 그림을 못 만들었거나 장면 설명이 없으면 그리는 척만 한다
      if ((!ref && !state.talkOnly) || !scene) return fakeDrawing();
      const res = await requestIllustration({ reference: ref, scene, previousScenes, drawing: drawingInfo, seed: ref ? seedFrom(ref) : talkSeed.current });
      if (epoch.current !== myEpoch) return;
      if (res.mode === "mock") return fakeDrawing();
      log.current?.illustrations.push({ page: pageNumber(pageId), ms: res.ms, ok: true });
      dispatch({ type: "illustrated", pageId, image: res.image });
    } catch (error) {
      // 삽화가 실패해도 이야기는 이어 간다. 장면 이모지로 페이지를 채운다
      console.error(error);
      if (epoch.current !== myEpoch) return;
      log.current?.illustrations.push({ page: pageNumber(pageId), ms: null, ok: false });
      dispatch({ type: "illustrated", pageId });
    }
  }

  if (state.phase === "draw") {
    return (
      <div className="flex flex-1 flex-col p-4 sm:p-6">
        <DrawingCanvas onDone={pickDrawing} onCancel={() => dispatch({ type: "pickDrawing", src: null })} />
      </div>
    );
  }

  // 그림책을 펼치면 저장해서 공유 링크를 만든다 (BOK-03)
  async function openBook() {
    dispatch({ type: "openBook" });
    const myEpoch = epoch.current;
    // 그림 없이 만든 그림책은 표지 그림 없이 저장한다 (첫 삽화가 표지를 대신한다)
    const cover = payload.current ? await payload.current.catch(() => null) : null;
    if ((!cover && !state.talkOnly) || !log.current) return dispatch({ type: "save", status: "error" });
    dispatch({ type: "save", status: "saving" });
    try {
      const { id } = await requestSaveBook({
        child,
        title: state.title ?? "우리가 만든 이야기",
        cover,
        pages: await Promise.all(
          state.pages.map(async (p) => ({ text: p.text, scene: p.scene, image: p.image ? await toImagePayload(p.image, 1024, 0.75).catch(() => p.image!) : null })),
        ),
        log: log.current,
      });
      if (epoch.current === myEpoch) dispatch({ type: "saved", id });
    } catch (error) {
      console.error("그림책을 저장하지 못했습니다", error);
      if (epoch.current === myEpoch) dispatch({ type: "save", status: "error" });
    }
  }

  if (state.phase === "book") {
    return (
      <BookViewer
        title={state.title ?? "우리가 만든 이야기"}
        drawing={state.drawing}
        author={child}
        pages={state.pages}
        onExit={() => router.push("/")}
        extras={<AdultTools saved={state.saved} />}
      />
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
            state.talkOnly ? (
              <div className="animate-pop-in flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 rounded-3xl bg-white shadow-md">
                <span className="text-8xl">🗣️</span>
                <p className="text-2xl font-bold">말로 만드는 이야기</p>
                <button type="button" onClick={() => dispatch({ type: "talkOnly", on: false })} className="rounded-full bg-zinc-100 px-5 py-2 text-lg">
                  🖍️ 그림으로 시작할래
                </button>
              </div>
            ) : (
              <DrawingPicker drawing={state.drawing} onDraw={() => dispatch({ type: "startDrawing" })} onPick={pickDrawing} onTalkOnly={startTalkOnly} />
            )
          ) : (
            latestPage && (
              <div key={`${latestPage.id}-${latestPage.status}`} className="animate-pop-in flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-md">
                <SceneArt scene={latestPage.scene} image={latestPage.image} drawing={latestPage.status === "drawing"} />
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
                  onClick={(e) => {
                    stop();
                    void answer(c.label, "choice", e.timeStamp);
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
              onClick={() => void openBook()}
              className="h-28 rounded-full bg-emerald-500 text-3xl font-bold text-white shadow-lg active:scale-95 disabled:bg-zinc-300"
            >
              {allDrawn ? "📖 그림책 보기" : "🖍️ 마지막 그림 그리는 중…"}
            </button>
          ) : (
            <PushToTalk
              disabled={(!state.drawing && !state.talkOnly) || state.waiting}
              mockAnswer={() => mockSpoken(state.mockStep)}
              onAnswer={(said, stt, releasedAt) => void answer(said, "voice", releasedAt, stt)}
              onPressStart={stop}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function pageNumber(pageId: string): number {
  return Number(pageId.replace("page-", ""));
}

// 끝 페이지 아래의 어른용 도구: 보호자 공유 링크(BOK-03), 그림책 내려받기(PDF)
// 세션 기록은 보호자·선생님 화면(/dashboard)에서 본다
function AdultTools({ saved }: { saved: State["saved"] }) {
  const [copied, setCopied] = useState(false);
  const link = saved.status === "saved" ? `${window.location.origin}/book/${saved.id}` : null;

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2 border-t border-zinc-100 pt-4 text-base text-zinc-500">
      <p className="text-sm">어른용</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" disabled={!link} onClick={copy} className="rounded-full bg-zinc-100 px-4 py-2 disabled:opacity-50">
          {saved.status === "saving" ? "저장 중…" : saved.status === "error" ? "저장 실패" : copied ? "✅ 링크 복사됨" : "🔗 공유 링크 복사"}
        </button>
        {saved.status === "saved" ? (
          <a href={`/book/${saved.id}/print`} target="_blank" rel="noopener" className="rounded-full bg-zinc-100 px-4 py-2">
            📥 그림책 내려받기 (PDF)
          </a>
        ) : (
          <span className="rounded-full bg-zinc-100 px-4 py-2 opacity-50">📥 그림책 내려받기 (PDF)</span>
        )}
      </div>
      {link && <p className="text-xs break-all select-text">{link}</p>}
    </div>
  );
}

function sceneHistory(pages: StoryPage[]): string[] {
  return pages.flatMap((p) => (p.sceneDescription ? [p.sceneDescription] : []));
}

// 같은 그림이면 같은 시드를 써서 페이지마다 인물 모습이 덜 바뀌게 한다 (ILL-02)
function seedFrom(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 97) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(hash) % 2_147_483_647;
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
  onTalkOnly: () => void;
};

// 그림 고르기: 직접 그리기(INP-01), 종이 그림 촬영·앨범(INP-02), 샘플
function DrawingPicker({ drawing, onDraw, onPick, onTalkOnly }: PickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [changing, setChanging] = useState(false);
  const [samples, setSamples] = useState(false);

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

  if (samples) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {SAMPLE_DRAWINGS.map((s) => (
          <button
            key={s.src}
            type="button"
            onClick={() => {
              onPick(s.src);
              setSamples(false);
              setChanging(false);
            }}
            className="flex flex-col items-center gap-1 rounded-3xl bg-white p-2 text-lg font-bold shadow-md active:scale-95"
          >
            <span className="relative aspect-[4/3] w-full">
              <Image src={s.src} alt={s.label} fill unoptimized className="object-contain" />
            </span>
            {s.label}
          </button>
        ))}
        <button type="button" onClick={() => setSamples(false)} className="col-span-3 justify-self-center rounded-full bg-white px-5 py-2 text-lg shadow-sm">
          ↩️ 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <PickButton emoji="✏️" label="그리기" onClick={onDraw} />
      <PickButton emoji="📷" label="사진 찍기" disabled={loading} onClick={() => cameraRef.current?.click()} />
      <PickButton emoji="🗂️" label="앨범에서" disabled={loading} onClick={() => albumRef.current?.click()} />
      <PickButton emoji="🖼️" label="샘플 그림" onClick={() => setSamples(true)} />
      <button
        type="button"
        onClick={onTalkOnly}
        className="col-span-2 flex items-center justify-center gap-3 rounded-3xl bg-white py-4 text-xl font-bold shadow-md active:scale-95"
      >
        <span className="text-4xl">🗣️</span>그림 없이 말로만 할래
      </button>
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
          {p.status !== "done" ? (
            i + 1
          ) : p.image ? (
            <Image src={p.image} alt="" width={56} height={42} unoptimized className="size-full rounded-xl object-cover" />
          ) : (
            p.scene.emojis[0]
          )}
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
