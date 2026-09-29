import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 30000,
    teardownTimeout: 10000,
    env: {
      NODE_ENV: "test",
      // The reset tests need the emailed link back in the response body. This
      // is the only environment where that opt-in is ever enabled, and it is
      // set here rather than inherited from a developer's shell.
      EXPOSE_RESET_TOKEN_IN_RESPONSE: "true",
    },
  },
});
