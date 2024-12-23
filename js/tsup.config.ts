import { defineConfig } from "tsup";

import tsconfig from "./tsconfig.json";

export default defineConfig({
  name: "form-atoms",
  entry: ["src/index.ts", "src/react.tsx", "src/server.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  minify: true,
  target: tsconfig.compilerOptions.target,
});
