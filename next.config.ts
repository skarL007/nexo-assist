import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O driver do libSQL tem partes nativas: fica fora do bundle do servidor.
  serverExternalPackages: ["@libsql/client", "libsql"],
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
