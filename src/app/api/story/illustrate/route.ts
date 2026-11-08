import { generateIllustration, imageConfigured, takeImageQuota } from "@/lib/ai/image";
import { buildIllustrationPrompt } from "@/lib/story/illustration";
import type { DrawingInfo } from "@/lib/story/types";

const MAX_IMAGE_CHARS = 4 * 1024 * 1024;
const MAX_SCENE_CHARS = 600;

type Body = {
  reference?: unknown;
  scene?: unknown;
  previousScenes?: unknown;
  drawing?: DrawingInfo | null;
  seed?: unknown;
};

const isImage = (v: unknown): v is string => typeof v === "string" && v.startsWith("data:image/") && v.length <= MAX_IMAGE_CHARS;

// 아이 그림을 참조해 한 페이지 삽화를 만든다 (ILL-01)
export async function POST(request: Request) {
  if (!imageConfigured()) return Response.json({ mode: "mock" });

  const { reference, scene, previousScenes, drawing, seed } = (await request.json()) as Body;
  // 참조 그림이 없으면 (말로만 만든 이야기) 장면 설명만으로 그린다
  const ref = reference === null ? null : isImage(reference) ? reference : undefined;
  if (ref === undefined) {
    return Response.json({ error: "참조 그림이 올바르지 않습니다" }, { status: 400 });
  }
  if (typeof scene !== "string" || !scene.trim() || scene.length > MAX_SCENE_CHARS) {
    return Response.json({ error: "장면 설명이 없습니다" }, { status: 400 });
  }
  if (!takeImageQuota()) {
    return Response.json({ error: "시간당 삽화 생성 한도를 넘었습니다" }, { status: 429 });
  }

  const started = performance.now();
  try {
    const scenes = Array.isArray(previousScenes) ? previousScenes.filter((s): s is string => typeof s === "string").slice(-3) : [];
    const image = await generateIllustration({
      reference: ref,
      prompt: buildIllustrationPrompt(scene, { drawing: drawing ?? null, previousScenes: scenes, hasReference: ref !== null }),
      seed: typeof seed === "number" ? seed : 42,
    });
    return Response.json({ mode: "live", image, ms: Math.round(performance.now() - started) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "삽화를 만들지 못했습니다" }, { status: 502 });
  }
}
