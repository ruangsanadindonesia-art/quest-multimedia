/// <reference types="vite/client" />

// React Fast Refresh virtual module (dev only)
declare module "/@react-refresh" {
	export function injectIntoGlobalHook(globalObject: Window): void;
	export function register(type: unknown, id: string): void;
	export function createSignatureFunctionForTransform(): () => unknown;
}

interface Window {
	$RefreshReg$?: () => void;
	$RefreshSig$?: () => () => unknown;
}
