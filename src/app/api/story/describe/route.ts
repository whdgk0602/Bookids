import { llmConfigured } from "@/lib/ai/gemini";
import { describeDrawing } from "@/lib/story/engine";

const MAX_IMAGE_CHARS = 4 * 1024 * 1024; // data URL 기준 약 3MB

// 아이 그림을 보고 무엇이 있는지 알아낸다 (INP-03)
export async function POST(request: Request) {
  if (!llmConfigured()) return Response.json({ mode: "mock" });

  const { image } = (await request.json()) as { image?: unknown };
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return Response.json({ error: "그림이 없습니다" }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return Response.json({ error: "그림이 너무 큽니다" }, { status: 413 });
  }

  const started = performance.now();
  try {
    const { info, usage } = await describeDrawing(image);
    return Response.json({ mode: "live", info, usage, ms: Math.round(performance.now() - started) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "그림을 알아보지 못했습니다" }, { status: 502 });
  }
}
