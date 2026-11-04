import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // 같은 와이파이의 태블릿(192.168.x.x), 임시 터널(npm run tunnel)에서 개발 서버에 접속하기 위해 허용
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.trycloudflare.com"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
