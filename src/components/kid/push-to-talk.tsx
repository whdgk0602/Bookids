"use client";

import { useEffect, useRef, useState } from "react";
import { pickRecorderMime, requestTranscription } from "@/lib/audio/transcribe-client";
import type { SttMeta } from "@/lib/story/session-log";

type Props = {
  disabled?: boolean;
  // 서버에 키가 없거나(mock 모드) 마이크를 쓸 수 없을 때 대신 쓰는 대답
  mockAnswer: () => string;
  // stt는 실제 음성인식 결과일 때만 있다 (mock이면 null). releasedAt은 손을 뗀 시각 (지연 측정용)
  onAnswer: (text: string, stt: SttMeta | null, releasedAt: number) => void;
  // 녹음을 시작할 때 (캐릭터 음성을 멈춰 녹음에 섞이지 않게)
  onPressStart?: () => void;
};

type State = "idle" | "listening" | "thinking" | "retry";

const MIN_RECORDING_MS = 300;
const RETRY_MESSAGE_MS = 2000;

// 누르고 말하기 (INP-04): 누르는 동안 녹음하고, 손을 떼면 음성인식 결과를 넘긴다.
export default function PushToTalk({ disabled, mockAnswer, onAnswer, onPressStart }: Props) {
  const [state, setStateValue] = useState<State>("idle");
  const [retryMessage, setRetryMessage] = useState("");
  // 누름과 뗌이 다시 그려지기 전에 연달아 와도 맞게 판단하도록 ref로 현재 상태를 본다
  const stateRef = useRef<State>("idle");
  const holdingRef = useRef(false);
  const acquiringRef = useRef(false); // 마이크 권한을 기다리는 중
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  // 누른 시간은 포인터 이벤트의 시각으로 잰다
  const pressedAtRef = useRef(0);
  const releasedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  function setState(next: State) {
    stateRef.current = next;
    setStateValue(next);
  }

  function retry(message: string) {
    setRetryMessage(message);
    setState("retry");
    timerRef.current = setTimeout(() => setState("idle"), RETRY_MESSAGE_MS);
  }

  function answerWithMock() {
    setState("thinking");
    timerRef.current = setTimeout(() => {
      setState("idle");
      onAnswer(mockAnswer(), null, releasedAtRef.current);
    }, 700);
  }

  async function getStream(): Promise<MediaStream | null> {
    if (streamRef.current) return streamRef.current;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return null;
    try {
      // 한 번 받은 마이크는 화면을 떠날 때까지 유지해 매 턴 권한·시작 지연을 없앤다
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      return streamRef.current;
    } catch (error) {
      console.warn("마이크를 쓸 수 없어 가짜 대답으로 진행합니다", error);
      return null;
    }
  }

  async function press(e: React.PointerEvent) {
    if (disabled || stateRef.current !== "idle") return;
    holdingRef.current = true;
    pressedAtRef.current = e.timeStamp;
    onPressStart?.();
    setState("listening");

    acquiringRef.current = true;
    const stream = await getStream();
    acquiringRef.current = false;
    const format = stream && pickRecorderMime();
    if (!stream || !format) {
      // 마이크를 쓸 수 없으면 가짜 대답으로 진행. 아직 누르고 있으면 손을 뗄 때(release) 처리한다
      if (!holdingRef.current) answerWithMock();
      return;
    }
    if (!holdingRef.current) {
      // 권한을 묻는 동안 이미 손을 뗐다
      retry("꾹 누른 채로 말해 줘");
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType: format.mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      recorderRef.current = null;
      if (releasedAtRef.current - pressedAtRef.current < MIN_RECORDING_MS) {
        retry("꾹 누른 채로 말해 줘");
        return;
      }
      void transcribe(new Blob(chunks, { type: format.mimeType }), format.ext);
    };
    recorder.start();
    recorderRef.current = recorder;
  }

  function release(e: React.PointerEvent) {
    if (stateRef.current !== "listening") return;
    holdingRef.current = false;
    releasedAtRef.current = e.timeStamp;
    if (acquiringRef.current) return; // press가 권한 응답 뒤에 처리한다
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      recorder.stop();
    } else {
      answerWithMock(); // 마이크를 쓸 수 없는 경우
    }
  }

  async function transcribe(audio: Blob, ext: string) {
    setState("thinking");
    try {
      const result = await requestTranscription(audio, ext);
      if (result.mode === "mock") {
        answerWithMock();
      } else if (!result.text) {
        retry("잘 못 들었어. 다시 말해 줄래?");
      } else {
        setState("idle");
        onAnswer(result.text, { confidence: result.confidence, ms: result.ms }, releasedAtRef.current);
      }
    } catch (error) {
      console.error(error);
      retry("다시 한 번 말해 줄래?");
    }
  }

  const label = {
    idle: "누르고 말하기",
    listening: "듣고 있어요…",
    thinking: "알아듣는 중…",
    retry: retryMessage,
  }[state];

  return (
    <button
      type="button"
      disabled={disabled || state === "thinking"}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
      className={`flex h-28 w-full touch-none select-none items-center justify-center gap-3 rounded-full text-2xl font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-40 ${
        state === "listening" ? "animate-pulse bg-rose-500" : state === "retry" ? "bg-sky-500" : "bg-orange-400"
      }`}
    >
      <span className="text-4xl">{state === "listening" ? "🎙️" : state === "retry" ? "🙂" : "🎤"}</span>
      {label}
    </button>
  );
}
