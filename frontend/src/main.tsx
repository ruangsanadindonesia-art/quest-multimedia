import { createInertiaApp } from "@inertiajs/react";

// React Fast Refresh — must load before any component imports in dev.
// @vitejs/plugin-react normally injects this preamble via transformIndexHtml,
// but with Inertia the Go server serves HTML, so Vite never sees it.
// We load it here manually so components load after refresh runtime is ready.
//
// Dynamic import is required: /@react-refresh is a Vite virtual module
// that only exists in dev — a static import would break production builds.
if (import.meta.env.DEV) {
	// @ts-expect-error Vite supplies this virtual module only during development.
	const { injectIntoGlobalHook } = await import("/@react-refresh");
	injectIntoGlobalHook(window);
	window.$RefreshReg$ = () => {};
	window.$RefreshSig$ = () => () => undefined;
}

createInertiaApp();
