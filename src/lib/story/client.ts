import type { Usage } from "@/lib/ai/gemini";
import type { SessionLog } from "./session-log";
import type { DrawingInfo, Scene, TurnRequest, TurnResult } from "./types";

// 브라우저에서 이야기 API를 부르는 함수들. 서버에 키가 없으면 { mode: "mock" }이 온다.

export type DescribeResponse = { mode: "mock" } | { mode: "live"; info: DrawingInfo; ms: number; usage: Usage };
export type IllustrateResponse = { mode: "mock" } | { mode: "live"; image: string; ms: number };
export type TurnResponse = { mode: "mock" } | { mode: "live"; result: TurnResult; ms: number; usage: Usage | null };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

export const requestSaveBook = (book: {
  title: string;
  cover: string;
  pages: { text: string; scene: Scene; image: string | null }[];
  log: SessionLog;
}) => post<{ id: string }>("/api/books", book);

export const requestDescribe = (image: string) => post<DescribeResponse>("/api/story/describe", { image });
export const requestTurn = (req: TurnRequest) => post<TurnResponse>("/api/story/turn", req);
export const requestIllustration = (body: {
  reference: string;
  scene: string;
  previousScenes: string[];
  drawing: DrawingInfo | null;
  seed: number;
}) =>
  post<IllustrateResponse>("/api/story/illustrate", body);
