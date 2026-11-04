import "server-only";

// 음성인식(INP-04). Groq의 Whisper(OpenAI 호환 API)를 쓴다.
// 공급자를 바꿀 때는 이 파일의 transcribe만 교체한다.

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3";

export type SttResult = {
  text: string;
  // 0~1. 세그먼트 평균 로그확률을 확률로 바꾼 값 (ANL-06 저신뢰 필터에 사용 예정)
  confidence: number | null;
};

// Whisper는 무음·잡음에서 학습 데이터의 자막 문구를 지어내는 경우가 잦다.
const HALLUCINATIONS = [/시청해\s*주셔서\s*감사합니다/, /구독과\s*좋아요/, /^감사합니다\.?$/, /^MBC 뉴스/, /^자막/];

const NO_SPEECH_THRESHOLD = 0.6;

type VerboseJson = {
  text: string;
  segments?: { avg_logprob: number; no_speech_prob: number }[];
};

export function sttConfigured() {
  return process.env.AI_MODE === "live" && !!process.env.GROQ_API_KEY;
}

export async function transcribe(audio: Blob, filename: string): Promise<SttResult> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", MODEL);
  form.append("language", "ko");
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`STT 요청 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as VerboseJson;
  const segments = data.segments ?? [];
  const speech = segments.filter((s) => s.no_speech_prob < NO_SPEECH_THRESHOLD);
  const text = data.text.trim();

  if ((segments.length > 0 && speech.length === 0) || HALLUCINATIONS.some((re) => re.test(text))) {
    return { text: "", confidence: null };
  }

  const confidence = speech.length
    ? Math.exp(speech.reduce((sum, s) => sum + s.avg_logprob, 0) / speech.length)
    : null;
  return { text, confidence };
}
