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
  const res = await fetch("/api/stt", { method: "POST", body: form });
  if (!res.ok) throw new Error(`STT ${res.status}`);
  return res.json();
}
