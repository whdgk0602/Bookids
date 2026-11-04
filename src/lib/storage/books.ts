import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SessionLog } from "@/lib/story/session-log";
import type { Scene } from "@/lib/story/types";

// 그림책 저장소. 프로토타입은 로컬 디스크(data/books, git 제외)에 둔다.
// 배포할 때는 이 파일만 클라우드 저장소로 바꾼다.
// ⚠️ 아동 그림이 들어가므로 실제 아이 데이터는 저장하지 않는다 (동의·보관 정책이 생기기 전까지)

const ROOT = path.join(process.cwd(), "data", "books");

// 공유 링크로 쓰므로 추측할 수 없어야 한다 (BOK-03): 16자 = 96비트
const ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;
const FILE_PATTERN = /^(cover|page-\d{1,2})\.(png|jpg|webp)$/;

export type StoredPage = { text: string; scene: Scene; image: string | null };

export type StoredBook = {
  id: string;
  createdAt: string;
  title: string;
  cover: string; // 파일 이름
  pages: StoredPage[];
  log: SessionLog;
};

export type NewBook = {
  title: string;
  cover: string; // data URL
  pages: { text: string; scene: Scene; image: string | null }[]; // image는 data URL
  log: SessionLog;
};

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const TYPE: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

function decode(dataUrl: string): { bytes: Buffer; ext: string } {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("지원하지 않는 이미지 형식입니다");
  return { bytes: Buffer.from(match[2], "base64"), ext: EXT[match[1]] };
}

export async function saveBook(book: NewBook): Promise<string> {
  const id = randomBytes(12).toString("base64url");
  const dir = path.join(ROOT, id);
  await mkdir(dir, { recursive: true });

  const cover = decode(book.cover);
  const coverName = `cover.${cover.ext}`;
  await writeFile(path.join(dir, coverName), cover.bytes);

  const pages: StoredPage[] = [];
  for (const [i, page] of book.pages.entries()) {
    let image: string | null = null;
    if (page.image) {
      const img = decode(page.image);
      image = `page-${i + 1}.${img.ext}`;
      await writeFile(path.join(dir, image), img.bytes);
    }
    pages.push({ text: page.text, scene: page.scene, image });
  }

  const stored: StoredBook = { id, createdAt: new Date().toISOString(), title: book.title, cover: coverName, pages, log: book.log };
  await writeFile(path.join(dir, "book.json"), JSON.stringify(stored, null, 2));
  return id;
}

export async function getBook(id: string): Promise<StoredBook | null> {
  if (!ID_PATTERN.test(id)) return null;
  try {
    return JSON.parse(await readFile(path.join(ROOT, id, "book.json"), "utf8")) as StoredBook;
  } catch {
    return null;
  }
}

export async function readBookFile(id: string, name: string): Promise<{ bytes: Buffer; type: string } | null> {
  // 경로 조작(../)을 막기 위해 정해진 이름만 허용한다
  const match = FILE_PATTERN.exec(name);
  if (!ID_PATTERN.test(id) || !match) return null;
  try {
    return { bytes: await readFile(path.join(ROOT, id, name)), type: TYPE[match[2]] };
  } catch {
    return null;
  }
}

// 저장된 그림책 목록 (최신순). 개발용 기록 화면에서 쓴다
export async function listBooks(): Promise<StoredBook[]> {
  let ids: string[];
  try {
    ids = (await readdir(ROOT)).filter((id) => ID_PATTERN.test(id));
  } catch {
    return [];
  }
  const books = await Promise.all(ids.map(getBook));
  return books.filter((b): b is StoredBook => b !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
