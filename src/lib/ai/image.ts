import "server-only";

// 삽화 생성 (ILL-01). 공급자는 IMAGE_PROVIDER로 고른다. 다른 공급자를 붙일 때는
// 이 파일에 함수를 하나 추가하고 generateIllustration의 분기에 넣는다.

export type IllustrationRequest = {
  // 아이 원본 그림 (data URL). 그림체를 살리기 위한 참조 이미지. 말로만 만들 때는 없다
  reference: string | null;
  prompt: string;
  seed: number;
};

// 4:3, 그림책 페이지 비율
const WIDTH = 1024;
const HEIGHT = 768;
const TIMEOUT_MS = 90_000;

export function imageConfigured() {
  if (process.env.AI_MODE !== "live") return false;
  switch (process.env.IMAGE_PROVIDER) {
    case "cloudflare":
      return !!process.env.CLOUDFLARE_ACCOUNT_ID && !!process.env.CLOUDFLARE_API_TOKEN;
    case "pollinations":
      return !!process.env.POLLINATIONS_API_KEY;
    default:
      return false;
  }
}

// 코드 버그로 생성이 반복 호출돼 크레딧이 바닥나지 않도록 서버 프로세스 단위로 시간당 횟수를 제한한다
const MAX_PER_HOUR = Number(process.env.IMAGE_MAX_PER_HOUR ?? 60);
const recent: number[] = [];

export function takeImageQuota(): boolean {
  const hourAgo = Date.now() - 3_600_000;
  while (recent.length && recent[0] < hourAgo) recent.shift();
  if (recent.length >= MAX_PER_HOUR) return false;
  recent.push(Date.now());
  return true;
}

export async function generateIllustration(req: IllustrationRequest): Promise<string> {
  return process.env.IMAGE_PROVIDER === "cloudflare" ? cloudflare(req) : pollinations(req);
}

// Cloudflare Workers AI: 무료 플랜에서 하루 10,000 뉴런 (이 크기로 약 80~100장)
// 참조 이미지는 512px 이하로 보낸다 (호출하는 쪽에서 줄여서 보냄)
async function cloudflare(req: IllustrationRequest): Promise<string> {
  const model = process.env.IMAGE_MODEL ?? "@cf/black-forest-labs/flux-2-klein-4b";
  const form = new FormData();
  form.append("prompt", req.prompt);
  form.append("width", String(WIDTH));
  form.append("height", String(HEIGHT));
  form.append("seed", String(req.seed));
  if (req.reference) form.append("input_image_0", dataUrlToBlob(req.reference), "reference.jpg");

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    // 3030: 결과 이미지 검열에 걸림 (무해한 그림도 가끔 걸린다는 보고가 있음)
    throw new Error(`삽화 생성 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }

  // 결과는 JSON 안의 base64이거나 이미지 바이트 그대로 온다
  const type = res.headers.get("content-type") ?? "";
  if (type.startsWith("image/")) {
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  }
  const json = (await res.json()) as { result?: { image?: string } };
  const image = json.result?.image;
  if (!image) throw new Error("삽화 응답에 이미지가 없습니다");
  return image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("참조 그림은 base64 data URL이어야 합니다");
  return new Blob([Buffer.from(match[2], "base64")], { type: match[1] });
}

type OpenAiImageResponse = { data?: { b64_json?: string; media_type?: string }[] };

async function pollinations(req: IllustrationRequest): Promise<string> {
  // 참조 그림 편집 엔드포인트만 연결해 두었다. 말로만 만든 이야기는 장면 이모지로 대신한다
  if (!req.reference) throw new Error("pollinations: 참조 그림 없는 생성은 연결하지 않았습니다");
  const res = await fetch("https://gen.pollinations.ai/v1/images/edits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.IMAGE_MODEL ?? "black-forest-labs/flux.2-klein-4b",
      prompt: req.prompt,
      image: [{ image_url: req.reference }],
      size: `${WIDTH}x${HEIGHT}`,
      seed: req.seed,
      response_format: "b64_json",
      // 요청 문장에 대한 검사만 한다. 생성된 그림은 Pollinations가 검사하지 않는다
      safe: "nsfw,privacy",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`삽화 생성 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as OpenAiImageResponse;
  const image = json.data?.[0];
  if (!image?.b64_json) throw new Error("삽화 응답에 이미지가 없습니다");
  return `data:${image.media_type ?? "image/png"};base64,${image.b64_json}`;
}
