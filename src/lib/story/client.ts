import type { Usage } from "@/lib/ai/gemini";
import type { DrawingInfo, TurnRequest, TurnResult } from "./types";

// 브라우저에서 이야기 API를 부르는 함수들. 서버에 키가 없으면 { mode: "mock" }이 온다.

export type DescribeResponse = { mode: "mock" } | { mode: "live"; info: DrawingInfo; ms: number; usage: Usage };
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

export const requestDescribe = (image: string) => post<DescribeResponse>("/api/story/describe", { image });
export const requestTurn = (req: TurnRequest) => post<TurnResponse>("/api/story/turn", req);
