import { saveBook, type NewBook } from "@/lib/storage/books";

const MAX_IMAGE_CHARS = 4 * 1024 * 1024;
const MAX_PAGES = 20;
const MAX_TEXT_CHARS = 300;

// 완성된 그림책을 저장하고 공유용 id를 돌려준다 (BOK-01, BOK-03)
// 프로토타입: 인증 없음. 로컬·시연 환경에서만 쓴다
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<NewBook>;
  if (!isNewBook(body)) {
    return Response.json({ error: "그림책 형식이 올바르지 않습니다" }, { status: 400 });
  }
  try {
    const id = await saveBook(body);
    return Response.json({ id });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "그림책을 저장하지 못했습니다" }, { status: 500 });
  }
}

const isImage = (v: unknown): v is string => typeof v === "string" && v.startsWith("data:image/") && v.length <= MAX_IMAGE_CHARS;

function isNewBook(b: Partial<NewBook>): b is NewBook {
  return (
    typeof b.title === "string" &&
    b.title.length <= 100 &&
    isImage(b.cover) &&
    Array.isArray(b.pages) &&
    b.pages.length > 0 &&
    b.pages.length <= MAX_PAGES &&
    b.pages.every((p) => typeof p.text === "string" && p.text.length <= MAX_TEXT_CHARS && typeof p.scene === "object" && (p.image === null || isImage(p.image))) &&
    typeof b.log === "object" &&
    b.log !== null
  );
}
