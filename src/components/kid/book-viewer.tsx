"use client";

import Image from "next/image";
import { useState } from "react";
import type { StoryPage } from "@/lib/story/types";
import SceneArt from "./scene-art";

type Props = {
  title: string;
  drawing: string;
  pages: StoryPage[];
  onExit: () => void;
};

// 완성 그림책 (BOK-01): 표지 → 본문 페이지 → 끝
export default function BookViewer({ title, drawing, pages, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const last = pages.length + 1; // 0: 표지, 1..n: 본문, n+1: 끝
  const page = pages[index - 1];

  return (
    <div className="flex flex-1 flex-col items-center gap-4 p-4 sm:p-6">
      <div className="flex w-full max-w-4xl flex-1 items-center gap-3">
        <NavButton label="이전 페이지" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          ◀
        </NavButton>

        <article key={index} className="animate-pop-in flex flex-1 flex-col gap-4 rounded-3xl bg-white p-5 shadow-lg sm:p-8">
          {index === 0 && (
            <>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border-4 border-amber-200">
                <Image src={drawing} alt="아이가 그린 그림" fill unoptimized className="object-contain" />
              </div>
              <h1 className="text-center text-4xl font-bold">{title}</h1>
              <p className="text-center text-xl text-zinc-500">글·그림: 우리 아이</p>
            </>
          )}
          {page && (
            <>
              <SceneArt scene={page.scene} image={page.image} />
              <p className="text-center text-3xl leading-snug">{page.text}</p>
            </>
          )}
          {index === last && (
            <div className="flex flex-col items-center gap-6 py-10">
              <p className="text-6xl">🎉</p>
              <p className="text-4xl font-bold">끝!</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIndex(0)} className="rounded-full bg-amber-100 px-6 py-4 text-2xl font-bold">
                  📖 다시 보기
                </button>
                <button type="button" onClick={onExit} className="rounded-full bg-orange-400 px-6 py-4 text-2xl font-bold text-white">
                  🏠 처음으로
                </button>
              </div>
            </div>
          )}
        </article>

        <NavButton label="다음 페이지" disabled={index === last} onClick={() => setIndex(index + 1)}>
          ▶
        </NavButton>
      </div>

      <div className="flex gap-2" aria-hidden>
        {Array.from({ length: last + 1 }, (_, i) => (
          <span key={i} className={`size-3 rounded-full ${i === index ? "bg-orange-400" : "bg-orange-200"}`} />
        ))}
      </div>
    </div>
  );
}

function NavButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white text-3xl text-orange-500 shadow-md active:scale-95 disabled:invisible"
    >
      {children}
    </button>
  );
}
