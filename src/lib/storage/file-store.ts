import "server-only";

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, list, put } from "@vercel/blob";

// 그림책 파일을 두는 곳. 버셀에 Blob 저장소를 연결하면 BLOB_READ_WRITE_TOKEN이 생기고,
// 그때는 Blob(비공개)에, 없으면 로컬 디스크 data/books(git 제외)에 저장한다.
// 버셀 서버는 디스크에 파일을 계속 남길 수 없어서 배포 환경에서는 Blob이 필요하다.
export type FileStore = {
  write(id: string, name: string, bytes: Buffer, type: string): Promise<void>;
  read(id: string, name: string): Promise<Buffer | null>;
  listIds(): Promise<string[]>;
};

export function fileStore(): FileStore {
  return process.env.BLOB_READ_WRITE_TOKEN ? blobStore : diskStore;
}

const ROOT = path.join(process.cwd(), "data", "books");

const diskStore: FileStore = {
  async write(id, name, bytes) {
    await mkdir(path.join(ROOT, id), { recursive: true });
    await writeFile(path.join(ROOT, id, name), bytes);
  },
  async read(id, name) {
    try {
      return await readFile(path.join(ROOT, id, name));
    } catch {
      return null;
    }
  },
  async listIds() {
    try {
      return await readdir(ROOT);
    } catch {
      return [];
    }
  },
};

const PREFIX = "books/";

// 아이 그림이 들어가므로 비공개로 둔다. 화면에는 /api/books/[id]/files/[name]을 거쳐서만 나간다
const blobStore: FileStore = {
  async write(id, name, bytes, type) {
    await put(`${PREFIX}${id}/${name}`, bytes, { access: "private", contentType: type, addRandomSuffix: false });
  },
  async read(id, name) {
    const result = await get(`${PREFIX}${id}/${name}`, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  },
  async listIds() {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: PREFIX, cursor });
      for (const blob of page.blobs) {
        const match = /^books\/([^/]+)\/book\.json$/.exec(blob.pathname);
        if (match) ids.push(match[1]);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return ids;
  },
};
