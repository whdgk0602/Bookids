// 아이 별명 (계정이 생기기 전 임시 구분). 실명 대신 별명을 쓴다.
// 한글·영문·숫자·공백, 1~12자
export const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9 ]{1,12}$/;

export function normalizeNickname(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ");
  return NICKNAME_PATTERN.test(name) ? name : null;
}
