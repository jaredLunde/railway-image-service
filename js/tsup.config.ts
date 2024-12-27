import { defineConfig } from "tsup";

import tsconfig from "./tsconfig.json";

export default defineConfig({
	name: "railway-image-service",
	entry: ["src/react.tsx", "src/server.ts"],
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	minify: true,
	external: ["react", "react-dom", "jotai"],
	target: tsconfig.compilerOptions.target,
});
