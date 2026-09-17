import path from "node:path";
import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: ".env.test" });

export default defineConfig({
  // mesmo alias do app: teste importa igual ao código de produção
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 20000,
    hookTimeout: 30000,
    // os testes compartilham o mesmo Supabase local — rodar em série evita flakes
    fileParallelism: false,
  },
});
