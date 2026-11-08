"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useChild } from "@/lib/use-child";

export type ShelfBook = { id: string; title: string; child: string | null; createdAt: string; cover: string | null; pages: number };

type Load = { status: "loading" } | { status: "error" } | { status: "done"; books: ShelfBook[] };

// 그림책 책장: 지금 고른 아이가 만든 그림책을 최신순으로 보여 준다
export default function Bookshelf() {
  const child = useChild();
  const [load, setLoad] = useState<{ key: string; value: Load } | null>(null);
  const key = child ?? "";

  useEffect(() => {
    let cancelled = false;
    const url = child ? `/api/books?child=${encodeURIComponent(child)}` : "/api/books";
    fetch(url, { signal: AbortSignal.timeout(20_000) })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { books: ShelfBook[] }) => !cancelled && setLoad({ key, value: { status: "done", books: data.books } }))
      .catch(() => !cancelled && setLoad({ key, value: { status: "error" } }));
    return () => {
      cancelled = true;
    };
  }, [child, key]);

  // 아이를 바꾼 직후에는 앞 아이의 책을 보여 주지 않는다
  const state: Load = load?.key === key ? load.value : { status: "loading" };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="처음으로" className="flex size-14 items-center justify-center rounded-full bg-white text-3xl shadow-sm">
          🏠
        </Link>
        <h1 className="text-3xl font-bold">📚 {child ? `${child}의 그림책` : "모든 그림책"}</h1>
      </header>

      {!child && <p className="text-lg text-zinc-500">처음 화면에서 아이를 고르면 그 아이가 만든 그림책만 보여요.</p>}

      {state.status === "loading" && <p className="m-auto text-2xl text-zinc-500">책장을 여는 중…</p>}
      {state.status === "error" && <p className="m-auto text-2xl text-zinc-500">그림책을 불러오지 못했어요. 잠시 뒤에 다시 열어 주세요.</p>}
      {state.status === "done" && state.books.length === 0 && (
        <div className="m-auto flex flex-col items-center gap-4 text-center">
          <p className="text-6xl">📖</p>
          <p className="text-2xl text-zinc-500">아직 만든 그림책이 없어요.</p>
          <Link href="/story" className="rounded-full bg-orange-400 px-8 py-4 text-2xl font-bold text-white shadow-md">
            ✨ 이야기 만들기
          </Link>
        </div>
      )}
      {state.status === "done" && state.books.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {state.books.map((b) => (
            <li key={b.id}>
              <Link href={`/book/${b.id}`} className="flex h-full flex-col gap-2 rounded-3xl bg-white p-3 shadow-md active:scale-95">
                <span className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl bg-amber-50 text-6xl">
                  {b.cover ? <Image src={b.cover} alt="" fill unoptimized className="object-cover" /> : "📖"}
                </span>
                <span className="text-xl font-bold">{b.title}</span>
                <span className="text-sm text-zinc-500">
                  {new Date(b.createdAt).toLocaleDateString("ko-KR")} · {b.pages}쪽{!child && b.child ? ` · ${b.child}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
