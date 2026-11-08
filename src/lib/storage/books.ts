import "server-only";

import { randomBytes } from "node:crypto";
import type { SessionLog } from "@/lib/story/session-log";
import type { Scene } from "@/lib/story/types";
import { fileStore } from "./file-store";

// 그림책 저장소. 파일을 어디에 두는지는 file-store.ts가 정한다
// (로컬: data/books 디스크, 버셀: Vercel Blob 비공개 저장소)
// ⚠️ 아동 그림이 들어가므로 실제 아이 데이터는 저장하지 않는다 (동의·보관 정책이 생기기 전까지)

// 공유 링크로 쓰므로 추측할 수 없어야 한다 (BOK-03): 16자 = 96비트
const ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;
const FILE_PATTERN = /^(cover|page-\d{1,2})\.(png|jpg|webp)$/;

export type StoredPage = { text: string; scene: Scene; image: string | null };

export type StoredBook = {
  id: string;
  createdAt: string;
  // 아이 별명 (계정이 생기기 전 임시 구분). 예전에 저장된 그림책에는 없다
  child?: string | null;
  title: string;
  cover: string | null; // 파일 이름. 그림 없이 말로만 만든 그림책은 없을 수 있다
  pages: StoredPage[];
  log: SessionLog;
};

export type NewBook = {
  child: string | null;
  title: string;
  cover: string | null; // data URL
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
  const store = fileStore();

  const writes: Promise<void>[] = [];
  let coverName: string | null = null;
  if (book.cover) {
    const cover = decode(book.cover);
    coverName = `cover.${cover.ext}`;
    writes.push(store.write(id, coverName, cover.bytes, TYPE[cover.ext]));
  }

  const pages: StoredPage[] = book.pages.map((page, i) => {
    let image: string | null = null;
    if (page.image) {
      const img = decode(page.image);
      image = `page-${i + 1}.${img.ext}`;
      writes.push(store.write(id, image, img.bytes, TYPE[img.ext]));
    }
    return { text: page.text, scene: page.scene, image };
  });
  await Promise.all(writes);

  // book.json을 마지막에 쓴다: 이 파일이 있으면 그림 파일도 모두 저장된 것
  const stored: StoredBook = { id, createdAt: new Date().toISOString(), child: book.child, title: book.title, cover: coverName, pages, log: book.log };
  await store.write(id, "book.json", Buffer.from(JSON.stringify(stored, null, 2)), "application/json");
  return id;
}

export async function getBook(id: string): Promise<StoredBook | null> {
  if (!ID_PATTERN.test(id)) return null;
  try {
    const bytes = await fileStore().read(id, "book.json");
    return bytes ? (JSON.parse(bytes.toString("utf8")) as StoredBook) : null;
  } catch {
    return null;
  }
}

export async function readBookFile(id: string, name: string): Promise<{ bytes: Buffer; type: string } | null> {
  // 경로 조작(../)을 막기 위해 정해진 이름만 허용한다
  const match = FILE_PATTERN.exec(name);
  if (!ID_PATTERN.test(id) || !match) return null;
  try {
    const bytes = await fileStore().read(id, name);
    return bytes ? { bytes, type: TYPE[match[2]] } : null;
  } catch {
    return null;
  }
}

// 저장된 그림책 목록 (최신순). 개발용 기록 화면에서 쓴다
export async function listBooks(): Promise<StoredBook[]> {
  let ids: string[];
  try {
    ids = (await fileStore().listIds()).filter((id) => ID_PATTERN.test(id));
  } catch (error) {
    console.error(error);
    return [];
  }
  const books = await Promise.all(ids.map(getBook));
  return books.filter((b): b is StoredBook => b !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
