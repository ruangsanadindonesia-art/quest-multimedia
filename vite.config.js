import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import inertia from "@inertiajs/vite";
import "dotenv/config";
import { resolve } from "path";
import { writeFileSync, rmSync } from "fs";

// Vite entry point - build JS and CSS as separate entries
const input = {
	main: resolve(__dirname, "frontend/src/main.tsx"),
	app: resolve(__dirname, "frontend/src/app.css"),
};

// https://vite.dev/config/
export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(__dirname, "frontend/src"),
			"@components": resolve(__dirname, "frontend/src/components"),
			"@layouts": resolve(__dirname, "frontend/src/layouts"),
			"@pages": resolve(__dirname, "frontend/src/pages"),
			"@lib": resolve(__dirname, "frontend/src/lib"),
		},
	},
	plugins: [
		tailwindcss(),
		react(),
		inertia(),
		{
			name: "write-port",
			configureServer(server) {
				server.httpServer?.on("listening", () => {
					const address = server.httpServer?.address();
					if (typeof address === "object" && address) {
						const port = address.port;
						const url = `http://localhost:${port}`;
						writeFileSync(".vite-port", url);
						console.log(`[vite-plugin] Port written to .vite-port: ${url}`);
					}
				});
				// Cleanup on exit
				const cleanup = () => {
					try {
						rmSync(".vite-port");
					} catch {}
					process.exit();
				};
				process.on("SIGINT", cleanup);
				process.on("SIGTERM", cleanup);
			},
		},
	],
	root: "frontend",
	server: {
		host: "0.0.0.0",
		strictPort: false,
		hmr: {
			host: "localhost",
			path: "/@vite/hmr",
		},
	},
	build: {
		outDir: "../dist",
		emptyOutDir: true,
		manifest: true,
		target: "es2022",
		rollupOptions: {
			input: input,
		},
	},
});
