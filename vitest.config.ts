import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Next.js가 처리하는 표시용 import. 테스트에서는 빈 모듈로 바꾼다
      "server-only": path.resolve(__dirname, "src/test/empty.ts"),
    },
  },
});
