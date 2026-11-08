"use client";

import { useRouter } from "next/navigation";
import BookViewer from "@/components/kid/book-viewer";
import type { StoryPage } from "@/lib/story/types";

type Props = { id: string; title: string; drawing: string | null; author: string | null; pages: StoryPage[] };

export default function SharedBook({ id, title, drawing, author, pages }: Props) {
  const router = useRouter();
  return (
    <BookViewer
      title={title}
      drawing={drawing}
      author={author}
      pages={pages}
      onExit={() => router.push("/")}
      extras={
        <a href={`/book/${id}/print`} target="_blank" rel="noopener" className="mt-2 rounded-full bg-zinc-100 px-4 py-2 text-base text-zinc-500">
          📥 그림책 내려받기 (PDF)
        </a>
      }
    />
  );
}
