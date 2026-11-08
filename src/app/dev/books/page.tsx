import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { listBooks } from "@/lib/storage/books";
import { summarize } from "@/lib/story/session-log";

// 저장된 그림책 기록 (단계 6): 응답 지연, 발화량, 실패, 1권당 사용량을 한눈에 본다.
// 팀 내부용 화면. 프로토타입이라 접근 제한이 없으니 로컬·시연 환경에서만 쓴다.

// Cloudflare FLUX.2 klein 4B 단가: 출력 512px 칸당 26.05, 입력 칸당 5.37 뉴런.
// 1024×768 출력 = 4칸, 512×384 참조 = 1칸
const NEURONS_PER_IMAGE = Math.round(4 * 26.05 + 1 * 5.37);
const FREE_NEURONS_PER_DAY = 10_000;

export default function BooksReportPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6 font-sans text-sm select-text">
      <header className="flex flex-wrap items-baseline gap-x-4">
        <h1 className="text-2xl font-bold">그림책 기록</h1>
        <span className="text-zinc-500">
          삽화 1장 ≈ {NEURONS_PER_IMAGE} 뉴런 · 무료 하루 {FREE_NEURONS_PER_DAY.toLocaleString()} 뉴런 ≈ {Math.floor(FREE_NEURONS_PER_DAY / NEURONS_PER_IMAGE)}장
        </span>
      </header>
      <Suspense fallback={<p className="text-zinc-500">불러오는 중…</p>}>
        <BookTable />
      </Suspense>
    </main>
  );
}

async function BookTable() {
  // 저장 목록은 계속 바뀌므로 빌드 때 고정하지 않고 요청마다 읽는다
  await connection();
  const books = await listBooks();
  if (!books.length) return <p className="text-zinc-500">아직 저장된 그림책이 없습니다.</p>;

  const rows = books.map((b) => ({ book: b, s: summarize(b.log) }));
  const ms = (v: number | null) => (v === null ? "-" : `${(v / 1000).toFixed(1)}초`);

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="w-full text-left">
        <thead className="bg-zinc-50 text-zinc-500">
          <tr>
            {["만든 시각", "제목", "턴", "페이지", "아이 어절", "무응답", "되받기 평균", "3초 넘음", "음성인식", "대화", "삽화", "삽화 실패", "토큰", "뉴런(추정)"].map((h) => (
              <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ book, s }) => (
            <tr key={book.id} className="border-t border-zinc-100">
              <td className="px-3 py-2 whitespace-nowrap">{new Date(book.createdAt).toLocaleString("ko-KR")}</td>
              <td className="px-3 py-2">
                <Link href={`/book/${book.id}`} className="underline">
                  {book.title}
                </Link>
              </td>
              <td className="px-3 py-2">{s.turns}</td>
              <td className="px-3 py-2">{s.pages}</td>
              <td className="px-3 py-2">{s.kidEojeol}</td>
              <td className="px-3 py-2">{s.noAnswerTurns}</td>
              <td className={`px-3 py-2 ${s.avgEchoMs !== null && s.avgEchoMs > 3000 ? "font-bold text-rose-600" : ""}`}>{ms(s.avgEchoMs)}</td>
              <td className="px-3 py-2">{s.slowEchoTurns}</td>
              <td className="px-3 py-2">{ms(s.avgSttMs)}</td>
              <td className="px-3 py-2">{ms(s.avgTurnMs)}</td>
              <td className="px-3 py-2">{ms(s.avgIllustrationMs)}</td>
              <td className={`px-3 py-2 ${s.failedIllustrations ? "font-bold text-rose-600" : ""}`}>{s.failedIllustrations}</td>
              <td className="px-3 py-2">{s.tokens.toLocaleString()}</td>
              <td className="px-3 py-2">{((book.log.illustrations.length - s.failedIllustrations) * NEURONS_PER_IMAGE).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
