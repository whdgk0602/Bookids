import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 p-6">
      <div className="text-center">
        <p className="text-8xl" aria-hidden>
          🦊📖
        </p>
        <h1 className="mt-4 text-5xl font-bold">Bookids</h1>
        <p className="mt-3 text-2xl text-zinc-600">내 말이 그림책이 돼요</p>
      </div>
      <Link
        href="/story"
        className="flex h-28 w-full max-w-md items-center justify-center rounded-full bg-orange-400 text-3xl font-bold text-white shadow-lg active:scale-95"
      >
        ✨ 이야기 만들기
      </Link>
      <Link href="/check" className="text-lg text-zinc-500 underline">
        기기 점검
      </Link>
    </main>
  );
}
