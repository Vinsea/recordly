import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Standalone viewer build — no Electron, pure web SPA.
// Output goes to dist-viewer/ so it doesn't conflict with the Electron build.
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
	// The viewer entry is viewer.html, not the default index.html
	root: ".",
	build: {
		outDir: "dist-viewer",
		emptyOutDir: true,
		target: "esnext",
		rollupOptions: {
			input: {
				viewer: path.resolve(__dirname, "viewer.html"),
			},
			output: {
				manualChunks: {
					pixi: ["pixi.js"],
					"react-vendor": ["react", "react-dom"],
				},
			},
		},
	},
	optimizeDeps: {
		entries: ["viewer.html"],
		exclude: [
			"react-icons/bs",
			"react-icons/fa",
			"react-icons/fa6",
			"react-icons/fi",
			"react-icons/md",
			"react-icons/rx",
		],
	},
});
