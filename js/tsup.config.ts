import { defineConfig } from "tsup";

import tsconfig from "./tsconfig.json";

export default defineConfig({
	name: "railway-images",
	entry: ["src/astro.ts", "src/next.ts", "src/react.tsx", "src/server.ts"],
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	minify: true,
	external: ["react", "react-dom", "jotai"],
	target: tsconfig.compilerOptions.target,
});
