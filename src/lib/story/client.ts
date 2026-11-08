import type { Usage } from "@/lib/ai/gemini";
import type { SessionLog } from "./session-log";
import type { DrawingInfo, Scene, TurnRequest, TurnResult } from "./types";

// 브라우저에서 이야기 API를 부르는 함수들. 서버에 키가 없으면 { mode: "mock" }이 온다.

export type DescribeResponse = { mode: "mock" } | { mode: "live"; info: DrawingInfo; ms: number; usage: Usage };
export type IllustrateResponse = { mode: "mock" } | { mode: "live"; image: string; ms: number };
export type TurnResponse =
  | { mode: "mock" }
  | { mode: "live"; result: TurnResult; ms: number; usage: Usage | null; provider: string | null };

// 네트워크가 멈춰도 "생각 중"에서 끝없이 기다리지 않도록 요청마다 시간 제한을 둔다
async function post<T>(url: string, body: unknown, timeoutMs: number): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

export const requestSaveBook = (book: {
  child: string | null;
  title: string;
  cover: string | null;
  pages: { text: string; scene: Scene; image: string | null }[];
  log: SessionLog;
}) => post<{ id: string }>("/api/books", book, 30_000);

export const requestDescribe = (image: string) => post<DescribeResponse>("/api/story/describe", { image }, 30_000);
export const requestTurn = (req: TurnRequest) => post<TurnResponse>("/api/story/turn", req, 25_000);
export const requestIllustration = (body: {
  reference: string | null;
  scene: string;
  previousScenes: string[];
  drawing: DrawingInfo | null;
  seed: number;
}) => post<IllustrateResponse>("/api/story/illustrate", body, 100_000);
