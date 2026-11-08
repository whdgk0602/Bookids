import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buildChildReport, MIN_STT_CONFIDENCE, RELIABLE_UTTERANCES, type BookReport, type ChildReport } from "@/lib/report/child-report";
import { listBooks } from "@/lib/storage/books";
import type { ScaffoldStage } from "@/lib/story/types";
import ObservationDraft from "./observation-draft";

// 보호자·선생님 화면 (DSH-01, DSH-03, OBS-01의 프로토타입판).
// ⚠️ 프로토타입: 로그인이 없어 주소를 아는 누구나 볼 수 있다. 실제 아이 데이터를 넣지 않는다.
export const metadata: Metadata = { title: "보호자·선생님 · Bookids", robots: { index: false, follow: false } };

const NO_NAME = "__none";

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 font-sans select-text sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/" className="rounded-full bg-white px-4 py-2 text-zinc-600 shadow-sm">
          🏠 처음으로
        </Link>
        <h1 className="text-3xl font-bold">👩‍🏫 보호자·선생님 화면</h1>
      </header>
      <Suspense fallback={<p className="text-zinc-500">기록을 모으는 중…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
      <p className="text-sm text-zinc-400">
        프로토타입이라 로그인이 없어요. 모든 지표는 띄어쓰기 단위(어절)로 센 참고 숫자이며 진단이 아닙니다. 형태소 분석, 또래 비교, 전사본 수정은 다음 단계에서
        만듭니다.
      </p>
    </main>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const params = await searchParams;
  const books = await listBooks();
  const names = [...new Set(books.map((b) => b.child ?? NO_NAME))].sort((a, b) => (a === NO_NAME ? 1 : b === NO_NAME ? -1 : a.localeCompare(b, "ko")));
  if (!names.length) return <p className="text-xl text-zinc-500">아직 저장된 그림책이 없어요. 아이와 그림책을 한 권 만들어 보세요.</p>;

  const asked = typeof params.child === "string" ? params.child : null;
  const selected = asked && names.includes(asked) ? asked : names[0];
  const child = selected === NO_NAME ? null : selected;
  const report = buildChildReport(child, books.filter((b) => (b.child ?? NO_NAME) === selected && Array.isArray(b.log?.turns)));

  return (
    <>
      <nav className="flex flex-wrap gap-2" aria-label="아이 고르기">
        {names.map((n) => (
          <Link
            key={n}
            href={`/dashboard?child=${encodeURIComponent(n)}`}
            className={`rounded-full px-4 py-2 text-lg shadow-sm ${n === selected ? "bg-sky-500 text-white" : "bg-white"}`}
          >
            {n === NO_NAME ? "이름 없음" : n}
          </Link>
        ))}
      </nav>
      <Summary report={report} />
      <Growth books={report.books} />
      <Words report={report} />
      <Support stages={report.totals.stages} />
      {child && <ObservationDraft child={child} />}
      <Transcripts books={report.books} />
    </>
  );
}

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
      {note && <p className="text-sm text-zinc-400">{note}</p>}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col rounded-xl bg-zinc-50 p-3">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-3xl font-bold">{value}</span>
      {sub && <span className="text-xs text-zinc-400">{sub}</span>}
    </div>
  );
}

function Summary({ report }: { report: ChildReport }) {
  const t = report.totals;
  return (
    <Card
      title="한눈에 보기"
      note={`아이가 직접 말한 대답만 셉니다. 그림 카드를 고른 대답, 음성인식 신뢰도 ${MIN_STT_CONFIDENCE * 100}% 미만은 빼요 (뺀 대답 ${t.excluded}개).`}
    >
      {!t.reliable && (
        <p className="rounded-xl bg-amber-50 px-4 py-2 text-amber-700">
          참고치: 아직 대답이 {t.utterances}개예요. {RELIABLE_UTTERANCES}개가 넘으면 숫자가 더 믿을 만해져요.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="만든 그림책" value={`${t.books}권`} />
        <Stat label="아이 대답" value={`${t.utterances}개`} />
        <Stat label="말한 어절" value={`${t.eojeol}개`} />
        <Stat label="평균 대답 길이" value={t.avgEojeol === null ? "-" : `${t.avgEojeol}어절`} sub="MLU(어절) 근사" />
        <Stat label="서로 다른 낱말" value={`${t.differentWords}개`} sub="NDW(어절) 근사" />
        <Stat label="대답 없음" value={t.noAnswerRate === null ? "-" : `${Math.round(t.noAnswerRate * 100)}%`} sub="질문 중 비율" />
      </div>
    </Card>
  );
}

function Growth({ books }: { books: BookReport[] }) {
  const max = Math.max(1, ...books.map((b) => b.avgEojeol ?? 0));
  return (
    <Card title="그림책마다 달라진 점" note="평균 대답 길이 = 대답 한 번에 말한 어절 수의 평균. 그림책 한 권은 대답 수가 적어 오르내림이 클 수 있어요.">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-sm text-zinc-500">
            <tr>
              <th className="py-2 pr-3 font-medium">날짜</th>
              <th className="py-2 pr-3 font-medium">그림책</th>
              <th className="py-2 pr-3 font-medium">대답</th>
              <th className="py-2 pr-3 font-medium">평균 대답 길이</th>
              <th className="py-2 pr-3 font-medium">서로 다른 낱말</th>
              <th className="py-2 font-medium">대답 없음</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.id} className="border-t border-zinc-100">
                <td className="py-2 pr-3 whitespace-nowrap text-zinc-500">{new Date(b.createdAt).toLocaleDateString("ko-KR")}</td>
                <td className="py-2 pr-3">
                  <Link href={`/book/${b.id}`} className="underline">
                    {b.title}
                  </Link>
                </td>
                <td className="py-2 pr-3">{b.utterances}</td>
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-2">
                    <span className="h-2 rounded-full bg-sky-400" style={{ width: `${((b.avgEojeol ?? 0) / max) * 6}rem` }} aria-hidden />
                    {b.avgEojeol ?? "-"}
                  </span>
                </td>
                <td className="py-2 pr-3">{b.differentWords}</td>
                <td className="py-2">{b.noAnswer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Chips({ items, empty }: { items: { word: string; count?: number }[]; empty: string }) {
  if (!items.length) return <p className="text-zinc-400">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((w) => (
        <li key={w.word} className="rounded-full bg-zinc-100 px-3 py-1">
          {w.word}
          {w.count !== undefined && <span className="ml-1 text-sm text-zinc-400">{w.count}</span>}
        </li>
      ))}
    </ul>
  );
}

function Words({ report }: { report: ChildReport }) {
  const withNew = report.books.filter((b) => b.newWords.length).slice(-3).reverse();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card title="새로 쓴 낱말" note="앞의 그림책에서는 쓰지 않았던 어절이에요. 두 번째 그림책부터 보여요.">
        {withNew.length ? (
          withNew.map((b) => (
            <div key={b.id} className="flex flex-col gap-1">
              <p className="text-sm text-zinc-500">
                {new Date(b.createdAt).toLocaleDateString("ko-KR")} · {b.title}
              </p>
              <Chips items={b.newWords.map((word) => ({ word }))} empty="" />
            </div>
          ))
        ) : (
          <p className="text-zinc-400">그림책이 두 권 이상 쌓이면 보여요.</p>
        )}
      </Card>
      <Card title="자주 나온 낱말과 소재" note="소재는 아이 그림에서 알아본 것들이에요.">
        <Chips items={report.frequentWords} empty="아직 없어요." />
        {report.topics.length > 0 && (
          <>
            <p className="text-sm text-zinc-500">그림 소재</p>
            <Chips items={report.topics} empty="" />
          </>
        )}
      </Card>
    </div>
  );
}

const STAGES: { key: ScaffoldStage; label: string; color: string; desc: string }[] = [
  { key: "open", label: "열린 질문", color: "bg-emerald-400", desc: "도움 없이 자유롭게 대답" },
  { key: "narrowed", label: "좁힌 질문", color: "bg-amber-400", desc: "범위를 좁혀 주자 대답" },
  { key: "choice", label: "선택지", color: "bg-rose-400", desc: "보기 중에서 골라 대답" },
];

function Support({ stages }: { stages: Record<ScaffoldStage, number> }) {
  const total = stages.open + stages.narrowed + stages.choice;
  return (
    <Card title="대답할 때 받은 도움" note="토리는 아이가 대답을 어려워하면 질문을 점점 쉽게 바꿔요. 열린 질문에 대답한 비율이 늘면 혼자 이야기를 이어 가는 힘이 자라고 있다는 뜻이에요. 첫 질문은 빼고 셉니다.">
      {total === 0 ? (
        <p className="text-zinc-400">아직 없어요.</p>
      ) : (
        <>
          <div className="flex h-4 overflow-hidden rounded-full" aria-hidden>
            {STAGES.map((s) => (stages[s.key] ? <span key={s.key} className={s.color} style={{ width: `${(stages[s.key] / total) * 100}%` }} /> : null))}
          </div>
          <ul className="grid gap-2 sm:grid-cols-3">
            {STAGES.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className={`size-3 rounded-full ${s.color}`} aria-hidden />
                <span>
                  {s.label} <b>{stages[s.key]}번</b> ({Math.round((stages[s.key] / total) * 100)}%)
                  <span className="block text-sm text-zinc-400">{s.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

const EXCLUDED_STYLE: Record<string, string> = { "대답 없음": "text-zinc-400", "카드 선택": "text-sky-600", "인식 불확실": "text-rose-600" };

function Transcripts({ books }: { books: BookReport[] }) {
  return (
    <Card title="대화 기록 (전사본)" note="음성인식이 틀렸을 수 있어요. 빨간 표시는 인식 신뢰도가 낮아 지표에서 뺀 대답이에요.">
      {[...books].reverse().map((b) => (
        <details key={b.id} className="rounded-xl bg-zinc-50 px-4 py-3">
          <summary className="cursor-pointer text-lg">
            {new Date(b.createdAt).toLocaleString("ko-KR")} · <b>{b.title}</b> · 대답 {b.transcript.length}개
          </summary>
          {b.drawing && <p className="mt-2 text-sm text-zinc-500">그림: {b.drawing}</p>}
          <ol className="mt-3 flex flex-col gap-3">
            {b.transcript.map((u, i) => (
              <li key={i} className="flex flex-col gap-1">
                <span className="text-sm text-zinc-500">🦊 {u.question}</span>
                <span className={u.excluded ? EXCLUDED_STYLE[u.excluded] : ""}>
                  🧒 {u.answer.trim() || "(대답 없음)"}
                  {u.excluded && u.excluded !== "대답 없음" && <span className="ml-2 text-xs">[{u.excluded}]</span>}
                  {u.confidence !== null && <span className="ml-2 text-xs text-zinc-400">인식 {Math.round(u.confidence * 100)}%</span>}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex gap-3 text-sm">
            <a href={`/book/${b.id}/print`} target="_blank" rel="noopener" className="underline">
              📥 그림책 PDF
            </a>
            <a href={`/api/books/${b.id}/log`} className="underline">
              📄 기록 원본(JSON)
            </a>
          </div>
        </details>
      ))}
    </Card>
  );
}
