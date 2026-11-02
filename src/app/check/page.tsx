import Link from "next/link";
import DeviceCheck from "./device-check";

export default function CheckPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <DeviceCheck />
      <Link href="/" className="text-lg text-zinc-500 underline">
        처음으로
      </Link>
    </main>
  );
}
