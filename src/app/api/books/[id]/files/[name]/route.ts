import { readBookFile } from "@/lib/storage/books";

// 저장된 그림책의 그림 파일 (표지, 페이지 삽화)
export async function GET(_request: Request, { params }: RouteContext<"/api/books/[id]/files/[name]">) {
  const { id, name } = await params;
  const file = await readBookFile(id, name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.type,
      // 저장된 그림은 바뀌지 않는다
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
