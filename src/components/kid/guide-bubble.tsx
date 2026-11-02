// AI 캐릭터와 말풍선. 단계 3에서 TTS(DLG-05)가 붙는다.
export default function GuideBubble({ lines }: { lines: string[] }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-amber-200 text-5xl shadow-inner" aria-hidden>
        🦊
      </div>
      <div key={lines.join("|")} className="animate-pop-in rounded-3xl rounded-tl-md bg-white px-6 py-4 text-2xl leading-snug shadow-sm">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}
