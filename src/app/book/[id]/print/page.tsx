import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import SceneArt from "@/components/kid/scene-art";
import { getBook } from "@/lib/storage/books";
import PrintButton from "./print-button";

// 그림책 내려받기: 표지와 페이지를 A4 가로 한 장씩 배치한 인쇄용 화면.
// 브라우저 인쇄의 "PDF로 저장"으로 그림책 PDF를 만든다 (한글 글꼴이 그대로 들어간다)
export const metadata: Metadata = { title: "그림책 내려받기", robots: { index: false, follow: false } };

export default function PrintPage({ params }: PageProps<"/book/[id]/print">) {
  return (
    <Suspense fallback={<p className="m-auto text-2xl text-zinc-500">그림책을 준비하는 중…</p>}>
      <PrintBook params={params} />
    </Suspense>
  );
}

async function PrintBook({ params }: Pick<PageProps<"/book/[id]/print">, "params">) {
  // 저장소(Blob)를 읽을 때 현재 시각을 쓰므로 빌드 때가 아니라 요청마다 그린다
  await connection();
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();

  const file = (name: string) => `/api/books/${id}/files/${name}`;
  // 말로만 만든 그림책은 표지 그림이 없어서 첫 삽화를 표지로 쓴다
  const coverName = book.cover ?? book.pages.find((p) => p.image)?.image ?? null;
  const coverSrc = coverName ? file(coverName) : null;
  const author = book.child ?? "우리 아이";

  return (
    <div className="flex flex-col items-center gap-6 bg-zinc-100 p-6 print:block print:bg-white print:p-0">
      <div className="flex flex-col items-center gap-2 text-center print:hidden">
        <PrintButton />
        <p className="text-zinc-500">인쇄 창의 &quot;대상&quot;에서 &quot;PDF로 저장&quot;을 고르면 그림책 파일이 만들어져요. (용지: A4 가로)</p>
      </div>

      <Sheet>
        {coverSrc && (
          <div className="relative min-h-0 w-full flex-1">
            <Image src={coverSrc} alt="" fill unoptimized className="object-contain" />
          </div>
        )}
        <h1 className="text-5xl font-bold">{book.title}</h1>
        <p className="text-2xl text-zinc-500">
          {book.cover ? "글·그림" : "글"}: {author}
        </p>
      </Sheet>

      {book.pages.map((p, i) => (
        <Sheet key={i}>
          <div className="relative min-h-0 w-full flex-1">
            {p.image ? <Image src={file(p.image)} alt="" fill unoptimized className="object-contain" /> : <SceneArt scene={p.scene} />}
          </div>
          <p className="text-4xl leading-snug">{p.text}</p>
          <p className="text-lg text-zinc-400">{i + 1}</p>
        </Sheet>
      ))}

      <Sheet>
        <p className="text-7xl">🎉</p>
        <p className="text-5xl font-bold">끝!</p>
        <p className="text-xl text-zinc-400">{new Date(book.createdAt).toLocaleDateString("ko-KR")} · Bookids</p>
      </Sheet>
    </div>
  );
}

// A4 가로 한 장 (297×210mm, 여백 12mm)
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex aspect-[297/210] w-full max-w-5xl flex-col items-center justify-center gap-4 bg-white p-10 text-center shadow-md break-after-page print:h-[186mm] print:w-full print:max-w-none print:p-0 print:shadow-none">
      {children}
    </section>
  );
}
