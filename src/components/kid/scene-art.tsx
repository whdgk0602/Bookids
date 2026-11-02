import type { Scene } from "@/lib/story/types";

// 삽화 자리표시. 단계 4에서 생성된 이미지로 바뀐다.
export default function SceneArt({ scene, drawing }: { scene: Scene; drawing?: boolean }) {
  return (
    <div
      className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl"
      style={{ background: `linear-gradient(135deg, ${scene.colors[0]}, ${scene.colors[1]})` }}
    >
      {drawing ? (
        <div className="flex flex-col items-center gap-2 text-zinc-600">
          <span className="animate-bounce text-5xl">🖍️</span>
          <span className="text-lg font-bold">그리는 중…</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2 p-4 text-[clamp(2.5rem,8vw,5rem)]">
          {scene.emojis.map((e, i) => (
            <span key={i}>{e}</span>
          ))}
        </div>
      )}
    </div>
  );
}
