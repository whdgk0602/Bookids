// 화면에 쓰는 그림(SVG 샘플, 캔버스 PNG, 사진)을 AI에 보낼 JPEG data URL로 바꾼다.
// SVG는 AI가 읽지 못하고, 큰 PNG는 전송이 느리다.
// 그림 인식에는 1024px, 삽화 참조에는 512px을 쓴다 (삽화 모델이 512px 이하 참조를 요구함)
export async function toImagePayload(src: string, maxSide = 1024): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();

  const width = img.naturalWidth || 1200;
  const height = img.naturalHeight || 900;
  const isVector = src.endsWith(".svg") || src.startsWith("data:image/svg");
  // 벡터는 키워서 그리고, 사진은 줄이기만 한다
  const scale = isVector ? maxSide / Math.max(width, height) : Math.min(1, maxSide / Math.max(width, height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 쓸 수 없습니다");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}
