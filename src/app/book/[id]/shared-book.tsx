"use client";

import { useRouter } from "next/navigation";
import BookViewer from "@/components/kid/book-viewer";
import type { StoryPage } from "@/lib/story/types";

export default function SharedBook({ title, drawing, pages }: { title: string; drawing: string; pages: StoryPage[] }) {
  const router = useRouter();
  return <BookViewer title={title} drawing={drawing} pages={pages} onExit={() => router.push("/")} />;
}
