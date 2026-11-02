"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  // 단계 1에서는 실제 녹음 없이, 손을 떼면 시나리오의 대답을 돌려준다.
  // 단계 2에서 녹음 + STT로 교체한다.
  mockAnswer: () => string;
  onAnswer: (text: string) => void;
};

type State = "idle" | "listening" | "thinking";

export default function PushToTalk({ disabled, mockAnswer, onAnswer }: Props) {
  const [state, setStateValue] = useState<State>("idle");
  // 누름과 뗌이 다시 그려지기 전에 연달아 와도 맞게 판단하도록 ref로 현재 상태를 본다
  const stateRef = useRef<State>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function setState(next: State) {
    stateRef.current = next;
    setStateValue(next);
  }

  function press() {
    if (disabled || stateRef.current !== "idle") return;
    setState("listening");
  }

  function release() {
    if (stateRef.current !== "listening") return;
    setState("thinking");
    timerRef.current = setTimeout(() => {
      setState("idle");
      onAnswer(mockAnswer());
    }, 700);
  }

  const label = { idle: "누르고 말하기", listening: "듣고 있어요…", thinking: "알아듣는 중…" }[state];

  return (
    <button
      type="button"
      disabled={disabled || state === "thinking"}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
      className={`flex h-28 w-full touch-none select-none items-center justify-center gap-3 rounded-full text-2xl font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-40 ${
        state === "listening" ? "animate-pulse bg-rose-500" : "bg-orange-400"
      }`}
    >
      <span className="text-4xl">{state === "listening" ? "🎙️" : "🎤"}</span>
      {label}
    </button>
  );
}
