import type { SessionLog, TurnLog } from "@/lib/story/session-log";
import type { ScaffoldStage } from "@/lib/story/types";

// 보호자·선생님 화면의 숫자 (ANL-02, ANL-05, ANL-06, DSH-01, DSH-03의 프로토타입판).
// 형태소 분석(ANL-01)이 아직 없어서 모든 지표는 **어절**(띄어쓰기 단위) 기준의 근사치다.
// 진단이 아니라 참고용이며, 화면에서도 그렇게 표시한다.

// 누적 발화가 이보다 적으면 "참고치" (ANL-05 초기값)
export const RELIABLE_UTTERANCES = 50;
// 음성인식 신뢰도가 이보다 낮은 발화는 지표에서 뺀다 (ANL-06 초기값)
export const MIN_STT_CONFIDENCE = 0.5;

export type ReportBook = {
  id: string;
  title: string;
  createdAt: string;
  child?: string | null;
  log: SessionLog;
};

export type Utterance = {
  question: string;
  answer: string;
  via: TurnLog["via"];
  stage: ScaffoldStage | null;
  confidence: number | null;
  // 지표 계산에 넣었는지. 빠진 이유가 있으면 적는다
  counted: boolean;
  excluded?: "대답 없음" | "카드 선택" | "인식 불확실";
};

export type BookReport = {
  id: string;
  title: string;
  createdAt: string;
  utterances: number; // 지표에 넣은 발화 수
  eojeol: number;
  avgEojeol: number | null; // 대답 한 번의 평균 어절 수 (MLU-어절 근사)
  differentWords: number; // 서로 다른 어절 수 (NDW 근사)
  newWords: string[]; // 앞 그림책들에서는 쓰지 않았던 어절
  noAnswer: number;
  stages: Record<ScaffoldStage, number>; // 어떤 도움 단계의 질문에 대답했는지
  transcript: Utterance[];
  drawing: string | null; // 그림 인식 요약
  talkOnly: boolean; // 그림 없이 말로만 만든 그림책
};

export type ChildReport = {
  child: string | null;
  books: BookReport[]; // 오래된 것부터
  totals: {
    books: number;
    utterances: number;
    eojeol: number;
    avgEojeol: number | null;
    differentWords: number;
    noAnswerRate: number | null; // 질문 중 대답이 없던 비율
    excluded: number;
    stages: Record<ScaffoldStage, number>;
    reliable: boolean;
  };
  frequentWords: { word: string; count: number }[];
  topics: { word: string; count: number }[]; // 그림·이야기에 자주 나온 소재
};

// 이야기 내용과 상관없는 말버릇·대답은 자주 쓴 낱말에서 뺀다
const STOPWORDS = new Set(["응", "어", "음", "네", "아니", "아니야", "몰라", "그리고", "그래서", "그런데", "근데", "그냥", "이제", "막", "또", "진짜", "좀", "그거", "이거", "저거", "있어", "했어", "해", "돼", "끝"]);

export function words(text: string): string[] {
  return text
    .replace(/[.,!?~…"'“”‘’()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function classify(t: TurnLog): Utterance {
  const base = { question: t.question, answer: t.answer, via: t.via, stage: t.stage, confidence: t.stt?.confidence ?? null };
  if (!t.answer.trim()) return { ...base, counted: false, excluded: "대답 없음" };
  // 그림 카드를 누른 대답은 아이가 직접 만든 문장이 아니다
  if (t.via === "choice") return { ...base, counted: false, excluded: "카드 선택" };
  if (t.stt?.confidence != null && t.stt.confidence < MIN_STT_CONFIDENCE) return { ...base, counted: false, excluded: "인식 불확실" };
  return { ...base, counted: true };
}

const emptyStages = (): Record<ScaffoldStage, number> => ({ open: 0, narrowed: 0, choice: 0 });

export function buildChildReport(child: string | null, input: ReportBook[]): ChildReport {
  const sorted = [...input].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const seen = new Set<string>();
  const allWords = new Map<string, number>();
  const topics = new Map<string, number>();
  const totalStages = emptyStages();
  let questions = 0;
  let noAnswerTotal = 0;
  let excluded = 0;

  const books: BookReport[] = sorted.map((book) => {
    const transcript = book.log.turns.map(classify);
    const counted = transcript.filter((u) => u.counted);
    const bookWords = counted.flatMap((u) => words(u.answer));
    const different = new Set(bookWords);
    const newWords = [...different].filter((w) => !seen.has(w));
    // 첫 그림책의 낱말은 모두 "새 낱말"이라 의미가 없으므로 두 번째 그림책부터 보여 준다
    const shownNew = seen.size ? newWords : [];
    different.forEach((w) => seen.add(w));
    bookWords.forEach((w) => allWords.set(w, (allWords.get(w) ?? 0) + 1));
    book.log.drawing?.elements.forEach((e) => topics.set(e, (topics.get(e) ?? 0) + 1));

    const stages = emptyStages();
    for (const t of book.log.turns) {
      if (t.stage && t.answer.trim()) {
        stages[t.stage]++;
        totalStages[t.stage]++;
      }
    }
    const noAnswer = transcript.filter((u) => u.excluded === "대답 없음").length;
    questions += transcript.length;
    noAnswerTotal += noAnswer;
    excluded += transcript.filter((u) => !u.counted && u.excluded !== "대답 없음").length;

    return {
      id: book.id,
      title: book.title,
      createdAt: book.createdAt,
      utterances: counted.length,
      eojeol: bookWords.length,
      avgEojeol: counted.length ? round1(bookWords.length / counted.length) : null,
      differentWords: different.size,
      newWords: shownNew,
      noAnswer,
      stages,
      transcript,
      drawing: book.log.drawing?.summary ?? null,
      talkOnly: !!book.log.talkOnly,
    };
  });

  const utterances = books.reduce((n, b) => n + b.utterances, 0);
  const eojeol = books.reduce((n, b) => n + b.eojeol, 0);
  const frequentWords = [...allWords]
    .filter(([w]) => !STOPWORDS.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));

  return {
    child,
    books,
    totals: {
      books: books.length,
      utterances,
      eojeol,
      avgEojeol: utterances ? round1(eojeol / utterances) : null,
      differentWords: seen.size,
      noAnswerRate: questions ? noAnswerTotal / questions : null,
      excluded,
      stages: totalStages,
      reliable: utterances >= RELIABLE_UTTERANCES,
    },
    frequentWords,
    topics: [...topics].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word, count]) => ({ word, count })),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
