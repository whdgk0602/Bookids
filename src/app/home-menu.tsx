"use client";

import Link from "next/link";
import { useState } from "react";
import { normalizeNickname } from "@/lib/child";
import { forgetChild, rememberChild, setChild, useChild, useKnownChildren } from "@/lib/use-child";

// 시작 화면: 누구의 이야기인지 고르고(별명), 이야기 만들기 또는 내 그림책으로 간다
export default function HomeMenu() {
  const child = useChild();
  const children = useKnownChildren();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const valid = normalizeNickname(name);

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    rememberChild(valid);
    setName("");
    setAdding(false);
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <section className="flex w-full flex-col items-center gap-3">
        <p className="text-2xl text-zinc-600">누구의 이야기야?</p>
        <div className="flex flex-wrap justify-center gap-2">
          {children.map((c) => (
            <span key={c} className="relative">
              <button
                type="button"
                onClick={() => setChild(c)}
                aria-pressed={child === c}
                className={`rounded-full px-5 py-3 text-2xl shadow-sm active:scale-95 ${child === c ? "bg-sky-400 text-white" : "bg-white"}`}
              >
                {child === c ? "🙋 " : ""}
                {c}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => forgetChild(c)}
                  aria-label={`${c} 목록에서 빼기`}
                  className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-rose-500 text-sm text-white"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className="rounded-full border-2 border-dashed border-zinc-300 px-5 py-3 text-2xl text-zinc-500">
              ➕ 친구 추가
            </button>
          )}
        </div>
        {adding && (
          <form onSubmit={add} className="flex w-full flex-col items-center gap-2">
            <div className="flex w-full gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={12}
                placeholder="별명 (예: 토끼반 하늘)"
                className="min-w-0 flex-1 rounded-full bg-white px-5 py-3 text-xl shadow-sm outline-sky-400"
              />
              <button type="submit" disabled={!valid} className="rounded-full bg-sky-400 px-5 text-xl font-bold text-white disabled:bg-zinc-300">
                추가
              </button>
              <button type="button" onClick={() => setAdding(false)} className="rounded-full bg-white px-4 text-xl shadow-sm">
                취소
              </button>
            </div>
            <p className="text-sm text-zinc-500">어른이 입력해 주세요. 실명 대신 별명을 써 주세요 (한글·영문·숫자 12자까지).</p>
          </form>
        )}
        {children.length > 0 && !adding && (
          <button type="button" onClick={() => setEditing(!editing)} className="text-sm text-zinc-400 underline">
            {editing ? "다 했어요" : "목록 정리"}
          </button>
        )}
      </section>

      <Link
        href="/story"
        className="flex h-28 w-full items-center justify-center rounded-full bg-orange-400 text-3xl font-bold text-white shadow-lg active:scale-95"
      >
        ✨ 이야기 만들기
      </Link>
      <Link
        href="/library"
        className="flex h-20 w-full items-center justify-center rounded-full bg-white text-2xl font-bold text-orange-500 shadow-md active:scale-95"
      >
        📚 {child ? `${child}의 그림책` : "그림책 책장"}
      </Link>
    </div>
  );
}
