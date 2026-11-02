// 유해 표현 필터 (SAF-01, 프로토타입 기본 수준)
// 1차 방어는 프롬프트 제약이고, 이 목록은 그 위에 거는 마지막 안전장치다. MVP에서 분류 모델로 강화한다.

const BLOCKED = [
  /씨발|시발|ㅅㅂ|ㅆㅂ|개새|병신|ㅂㅅ|좆|존나|지랄|닥쳐|꺼져/,
  /섹스|야동|성기|자위/,
  /자살|자해|목\s*매/,
  /담배|술\s*마시|마약/,
];

export function isUnsafe(text: string): boolean {
  return BLOCKED.some((re) => re.test(text));
}
