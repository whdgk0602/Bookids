import { generateTurnJson, turnLlmConfigured } from "@/lib/ai/llm";
import { NICKNAME_PATTERN } from "@/lib/child";
import { buildChildReport } from "@/lib/report/child-report";
import { listBooks } from "@/lib/storage/books";
import { isUnsafe } from "@/lib/story/safety";

// 관찰기록 초안 (OBS-01의 프로토타입판). 교사가 고쳐 쓰는 출발점일 뿐이며 확정본이 아니다 (OBS-02)
// 모든 서술에 근거 발화를 붙이고, 실제 발화에 없는 인용은 버린다.

const AREAS = ["의사소통", "사회관계", "예술경험"] as const;
const MAX_UTTERANCES = 60;

type Draft = { areas: { area: string; text: string; quotes: string[] }[] };

const SCHEMA = {
  type: "object",
  properties: {
    areas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          area: { type: "string", enum: [...AREAS] },
          text: { type: "string" },
          quotes: { type: "array", items: { type: "string" } },
        },
        required: ["area", "text", "quotes"],
      },
    },
  },
  required: ["areas"],
};

const SYSTEM = `너는 유치원 교사가 누리과정 관찰기록을 쓰도록 돕는 보조자야.
- 아이가 그림책을 만들며 한 말만 근거로, 관찰된 사실을 담백하게 적어.
- [만든 그림책]과 [아이 발화]에 없는 활동은 지어내지 마. "말로만 만듦"인 그림책은 아이가 그림을 그리지 않았고, 삽화는 AI가 그렸어.
- 진단, 평가, 비교, 결핍 표현(예: "부족하다", "지연", "또래보다")은 절대 쓰지 마.
- 아이 이름이나 별명을 쓰지 말고 "유아는"으로 시작해.
- 각 영역은 2~3문장. 근거가 없는 영역은 빼.
- quotes에는 아래 [아이 발화]에 있는 문장을 한 글자도 바꾸지 말고 그대로 1~3개 넣어.`;

export async function POST(request: Request) {
  if (!turnLlmConfigured()) return Response.json({ mode: "mock" });

  const { child } = (await request.json()) as { child?: unknown };
  if (typeof child !== "string" || !NICKNAME_PATTERN.test(child)) {
    return Response.json({ error: "아이를 골라 주세요" }, { status: 400 });
  }

  const books = (await listBooks()).filter((b) => b.child === child);
  const report = buildChildReport(child, books);
  const said = report.books.flatMap((b) => b.transcript.filter((u) => u.counted).map((u) => u.answer.trim()));
  if (said.length < 3) {
    return Response.json({ error: "초안을 만들기에는 아이가 한 말이 아직 적어요 (대답 3개 이상 필요)" }, { status: 422 });
  }

  const recent = said.slice(-MAX_UTTERANCES);
  const stories = report.books.map((b) => `- ${b.title} (${b.talkOnly ? "말로만 만듦" : b.drawing ? `아이 그림: ${b.drawing}` : "아이가 그린 그림으로 시작"})`).join("\n");
  const prompt = `[만든 그림책]\n${stories}\n\n[아이 발화]\n${recent.map((s) => `- ${s}`).join("\n")}\n\n[할 일] ${AREAS.join("·")} 영역별 관찰기록 초안을 써.`;

  try {
    const { data, provider } = await generateTurnJson<Draft>({ system: SYSTEM, prompt, schema: SCHEMA, temperature: 0.4 });
    const source = new Set(recent);
    const areas = data.areas
      .filter((a) => (AREAS as readonly string[]).includes(a.area) && a.text.trim() && !isUnsafe(a.text))
      // 실제로 아이가 한 말과 똑같은 인용만 남긴다. 근거가 하나도 없으면 그 영역은 버린다
      .map((a) => ({ area: a.area, text: a.text.trim(), quotes: a.quotes.map((q) => q.trim()).filter((q) => source.has(q)).slice(0, 3) }))
      .filter((a) => a.quotes.length > 0);
    return Response.json({ mode: "live", areas, provider, basedOn: recent.length });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "초안을 만들지 못했습니다" }, { status: 502 });
  }
}
