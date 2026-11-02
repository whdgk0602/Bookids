type Props = {
  lines: string[];
  thinking?: boolean;
  onReplay?: () => void;
};

// AI 캐릭터와 말풍선 (DLG-05: 같은 문장을 화면에도 보여 주고, 다시 듣기를 제공)
export default function GuideBubble({ lines, thinking, onReplay }: Props) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-amber-200 text-5xl shadow-inner" aria-hidden>
        🦊
      </div>
      {thinking ? (
        <div className="rounded-3xl rounded-tl-md bg-white px-6 py-4 text-3xl tracking-widest text-zinc-400 shadow-sm" aria-label="토리가 생각하는 중">
          <span className="animate-pulse">•••</span>
        </div>
      ) : (
        <div key={lines.join("|")} className="animate-pop-in flex items-start gap-2 rounded-3xl rounded-tl-md bg-white px-6 py-4 text-2xl leading-snug shadow-sm">
          <div>
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          {onReplay && (
            <button type="button" onClick={onReplay} aria-label="다시 듣기" className="shrink-0 rounded-full p-1 text-2xl active:scale-90">
              🔊
            </button>
          )}
        </div>
      )}
    </div>
  );
}
