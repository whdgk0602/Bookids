"use client";

import { useRef, useState, useSyncExternalStore } from "react";

type MicState = "idle" | "recording" | "recorded" | "denied";

const noopSubscribe = () => () => {};

// 서버 렌더링 시점엔 알 수 없으므로 null, 브라우저에서만 실제 값을 읽는다.
function useBrowserValue<T>(read: () => T): T | null {
  return useSyncExternalStore(noopSubscribe, read, () => null);
}

// 단계 0 확인용: 태블릿에서 HTTPS(보안 연결)와 마이크 녹음이 되는지 점검한다.
export default function DeviceCheck() {
  const secure = useBrowserValue(() => window.isSecureContext);
  const micSupported = useBrowserValue(() => !!navigator.mediaDevices?.getUserMedia);
  const [mic, setMic] = useState<MicState>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const holdingRef = useRef(false);

  async function start() {
    holdingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType });
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setMic("recorded");
      };
      recorder.start();
      recorderRef.current = recorder;
      setMic("recording");
      // 권한 대기 중에 이미 손을 뗐다면 바로 종료
      if (!holdingRef.current) recorder.stop();
    } catch {
      setMic("denied");
    }
  }

  function stop() {
    holdingRef.current = false;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  return (
    <section className="flex w-full max-w-md flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">기기 점검</h2>
      <p>
        보안 연결(HTTPS):{" "}
        <strong>{secure === null ? "확인 중" : secure ? "✅ 정상" : "❌ 아님 — 마이크 사용 불가"}</strong>
      </p>
      <p>
        마이크:{" "}
        <strong>
          {micSupported === false
            ? "❌ 이 브라우저(또는 HTTP 연결)에서는 지원하지 않음"
            : {
                idle: "버튼을 누른 채로 말해 보세요",
                recording: "🎙️ 녹음 중…",
                recorded: "✅ 녹음 성공",
                denied: "❌ 권한 거부 또는 오류",
              }[mic]}
        </strong>
      </p>
      <button
        type="button"
        disabled={!micSupported}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={() => mic === "recording" && stop()}
        className="h-24 select-none rounded-full bg-orange-400 text-2xl font-bold text-white active:scale-95 disabled:opacity-40"
      >
        누르고 말하기
      </button>
      {audioUrl && <audio controls src={audioUrl} className="w-full" />}
    </section>
  );
}
