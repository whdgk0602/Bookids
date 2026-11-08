import Link from "next/link";
import HomeMenu from "./home-menu";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <p className="text-7xl" aria-hidden>
          🦊📖
        </p>
        <h1 className="mt-3 text-5xl font-bold">Bookids</h1>
        <p className="mt-2 text-2xl text-zinc-600">내 말이 그림책이 돼요</p>
      </div>
      <HomeMenu />
      <nav className="flex gap-4 text-lg text-zinc-500">
        <Link href="/dashboard" className="underline">
          👩‍🏫 보호자·선생님
        </Link>
        <Link href="/check" className="underline">
          기기 점검
        </Link>
      </nav>
    </main>
  );
}
