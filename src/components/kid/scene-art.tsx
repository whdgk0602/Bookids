import Image from "next/image";
import type { Scene } from "@/lib/story/types";

type Props = {
  scene: Scene;
  // 생성된 삽화. 없으면 장면 이모지로 대신 보여 준다
  image?: string;
  drawing?: boolean;
};

export default function SceneArt({ scene, image, drawing }: Props) {
  if (image && !drawing) {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white">
        <Image src={image} alt="" fill unoptimized className="object-contain" />
      </div>
    );
  }
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
