import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` throws outside a React Server build; tests run in plain Node.
      "server-only": path.resolve(__dirname, "tests/stubs/empty.ts"),
    },
  },
});
