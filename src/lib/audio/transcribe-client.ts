export type SttResponse =
  | { mode: "mock" }
  | { mode: "live"; text: string; confidence: number | null; ms: number };

// 브라우저마다 녹음 형식이 다르다 (Chrome: webm, Safari: mp4)
export function pickRecorderMime(): { mimeType: string; ext: string } | null {
  const candidates = [
    { mimeType: "audio/webm;codecs=opus", ext: "webm" },
    { mimeType: "audio/webm", ext: "webm" },
    { mimeType: "audio/mp4", ext: "mp4" },
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c.mimeType)) ?? null;
}

export async function requestTranscription(audio: Blob, ext: string): Promise<SttResponse> {
  const form = new FormData();
  form.append("audio", audio, `speech.${ext}`);
  const res = await fetch("/api/stt", { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`STT ${res.status}`);
  return res.json();
}

// 서버가 가짜 응답(mock) 모드인지. 마이크를 못 쓸 때 가짜 대답으로 진행해도 되는지 판단한다.
// 실제 모드에서는 아이 말 대신 가짜 대답을 넣으면 안 된다 (아이 말이 무시된 것처럼 보인다)
let mockMode: Promise<boolean> | null = null;
export function isSttMock(): Promise<boolean> {
  mockMode ??= fetch("/api/stt", { method: "POST", body: new FormData(), signal: AbortSignal.timeout(10_000) })
    .then((res) => res.json())
    .then((data: { mode?: string }) => data.mode === "mock")
    .catch(() => {
      mockMode = null; // 네트워크 문제면 다음에 다시 확인
      return false;
    });
  return mockMode;
}
