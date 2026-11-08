import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getBook } from "@/lib/storage/books";
import SharedBook from "./shared-book";

// 공유 링크로 여는 읽기 전용 그림책 (BOK-03). 검색에 노출되지 않게 한다
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function BookPage({ params }: PageProps<"/book/[id]">) {
  return (
    <Suspense fallback={<p className="m-auto text-2xl text-zinc-500">그림책을 펼치는 중…</p>}>
      <Book params={params} />
    </Suspense>
  );
}

async function Book({ params }: Pick<PageProps<"/book/[id]">, "params">) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();

  const file = (name: string) => `/api/books/${id}/files/${name}`;
  // 세션 로그는 팀 내부용이라 보호자 화면에 보내지 않는다
  return (
    <SharedBook
      id={id}
      title={book.title}
      drawing={book.cover ? file(book.cover) : null}
      author={book.child ?? null}
      pages={book.pages.map((p, i) => ({
        id: `page-${i + 1}`,
        text: p.text,
        scene: p.scene,
        image: p.image ? file(p.image) : undefined,
        status: "done" as const,
      }))}
    />
  );
}
