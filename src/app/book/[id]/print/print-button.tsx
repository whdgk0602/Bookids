"use client";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-full bg-orange-400 px-8 py-4 text-2xl font-bold text-white shadow-md active:scale-95">
      📥 PDF로 저장하기
    </button>
  );
}
