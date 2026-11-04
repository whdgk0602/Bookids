import { describe, expect, it } from "vitest";
import { getBook, readBookFile } from "./books";

// 공유 링크로 다른 파일을 읽을 수 없어야 한다
describe("저장소 경로 검사", () => {
  it.each(["../../package.json", "..%2F..", "short", "aaaaaaaaaaaaaaaa/../x", ""])("id '%s'는 거부", async (id) => {
    expect(await getBook(id)).toBeNull();
    expect(await readBookFile(id, "cover.jpg")).toBeNull();
  });

  it.each(["book.json", "../book.json", "cover.svg", "page-1.png/../../x", "cover.jpg.exe"])("파일 '%s'는 거부", async (name) => {
    expect(await readBookFile("AAAAAAAAAAAAAAAA", name)).toBeNull();
  });

  it("형식이 맞아도 없는 그림책은 null", async () => {
    expect(await getBook("AAAAAAAAAAAAAAAA")).toBeNull();
    expect(await readBookFile("AAAAAAAAAAAAAAAA", "page-1.png")).toBeNull();
  });
});
