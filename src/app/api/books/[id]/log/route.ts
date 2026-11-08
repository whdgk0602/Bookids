import { getBook } from "@/lib/storage/books";

// 그림책 한 권의 세션 기록 원본 (LOG-01). 보호자·선생님 화면과 팀 분석에서 내려받는다
export async function GET(_request: Request, { params }: RouteContext<"/api/books/[id]/log">) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) return new Response("Not found", { status: 404 });
  const { log, title, child, createdAt, pages } = book;
  return new Response(JSON.stringify({ id, title, child: child ?? null, createdAt, pages: pages.map((p) => p.text), log }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookids-log-${id}.json"`,
    },
  });
}
