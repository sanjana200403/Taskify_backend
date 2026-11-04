import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.js"],
      exclude: ["src/server.js"],
      thresholds: { statements: 70, branches: 55, functions: 70, lines: 70 },
    },
  },
});
