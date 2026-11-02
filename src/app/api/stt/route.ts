import { sttConfigured, transcribe } from "@/lib/ai/stt";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

// 아이 녹음을 받아 텍스트로 돌려준다.
// 키가 없거나 AI_MODE=mock이면 { mode: "mock" }을 돌려주고, 화면은 가짜 답변을 쓴다.
export async function POST(request: Request) {
  if (!sttConfigured()) {
    return Response.json({ mode: "mock" });
  }

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: "녹음 파일이 없습니다" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "녹음이 너무 깁니다" }, { status: 413 });
  }

  const started = performance.now();
  try {
    const result = await transcribe(audio, audio.name);
    return Response.json({ mode: "live", ...result, ms: Math.round(performance.now() - started) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "음성인식에 실패했습니다" }, { status: 502 });
  }
}
