#!/usr/bin/env node
/**
 * Dev server lifecycle manager for AI agents.
 *
 *   node scripts/dev.mjs background        — start air + vite detached, write lock file
 *   node scripts/dev.mjs status            — check if server is running (PID, port, URL)
 *   node scripts/dev.mjs stop              — graceful shutdown + remove lock file
 *   node scripts/dev.mjs logs [--follow]   — view logs (tail -f style with --follow)
 *
 * Lock file: .laju/dev.json ({ pid, port, url, startedAt })
 * Log file:  .laju/dev.log
 *
 * Human developers: use `npm run dev:all` (foreground) instead.
 * Air watches .go files and auto-rebuilds/restarts. Vite watches frontend.
 * After editing .templ files: run `templ generate` then wait for air reload.
 */
import { spawn, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";

const LOCK_FILE = ".laju/dev.json";
const LOG_FILE = ".laju/dev.log";
const READINESS_TIMEOUT_MS = 30_000;
const READINESS_POLL_MS = 200;
const GRACEFUL_SHUTDOWN_MS = 5_000;
const DEFAULT_PORT = process.env.APP_PORT ?? "8080";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readLock() {
	if (!existsSync(LOCK_FILE)) return null;
	try {
		return JSON.parse(readFileSync(LOCK_FILE, "utf-8"));
	} catch {
		return null;
	}
}

function removeLock() {
	if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
}

function isProcessAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function background() {
	mkdirSync(".laju", { recursive: true });

	const existing = readLock();
	if (existing && isProcessAlive(existing.pid)) {
		console.log(
			`Server already running at ${existing.url} (pid ${existing.pid})`,
		);
		console.log("Run `npm run dev:stop` to stop it first.");
		return;
	}
	if (existing) removeLock();

	// Build frontend if dist/.vite is missing
	if (!existsSync("dist/.vite")) {
		console.log("Building frontend assets...");
		spawnSync("npm", ["run", "build"], {
			stdio: "inherit",
			cwd: process.cwd(),
			shell: true,
		});
	}

	// Start air + vite in background, output to log file
	writeFileSync(LOG_FILE, "");
	const child = spawn(
		"npm",
		["run", "dev:all"],
		{
			stdio: ["ignore", "pipe", "pipe"],
			cwd: process.cwd(),
			shell: true,
			detached: true,
		},
	);
const { createWriteStream } = await import("node:fs");
const logStream = createWriteStream(LOG_FILE);
child.stdout.pipe(logStream);
child.stderr.pipe(logStream);

	child.unref();

	const pid = child.pid;
	if (!pid) {
		console.error("Failed to spawn dev server.");
		process.exit(1);
	}

	// Poll log file for the readiness line — Go prints "server listening"
	const start = Date.now();
	let url = "";
	let port = 0;

	while (Date.now() - start < READINESS_TIMEOUT_MS) {
		await sleep(READINESS_POLL_MS);
		if (!isProcessAlive(pid)) {
			console.error("Dev server exited unexpectedly. Logs:");
			try {
				console.error(readFileSync(LOG_FILE, "utf-8"));
			} catch {}
			removeLock();
			process.exit(1);
		}
		try {
			const log = readFileSync(LOG_FILE, "utf-8");
			const match = log.match(/server listening.*?port=(\d+)/);
			if (match) {
				port = parseInt(match[1], 10);
				url = `http://localhost:${port}`;
				break;
			}
			// Fallback: parse URL from Fiber banner
			const urlMatch = log.match(/http:\/\/127\.0\.0\.1:(\d+)/);
			if (urlMatch) {
				port = parseInt(urlMatch[1], 10);
				url = `http://localhost:${port}`;
				break;
			}
		} catch {}
	}

	if (!url) {
		console.error("Dev server did not become ready within 30s. Logs:");
		try {
			console.error(readFileSync(LOG_FILE, "utf-8"));
		} catch {}
		process.exit(1);
	}

	writeFileSync(
		LOCK_FILE,
		JSON.stringify(
			{ pid, port, url, startedAt: new Date().toISOString() },
			null,
			2,
		),
	);
	console.log(`Server ready at ${url} (pid ${pid})`);
	console.log("Logs:  npm run dev:logs");
	console.log("Stop:  npm run dev:stop");
}

async function status() {
	const lock = readLock();
	if (!lock) {
		console.log("No dev server running.");
		return;
	}
	if (!isProcessAlive(lock.pid)) {
		console.log("Dev server is not running (stale lock removed).");
		removeLock();
		return;
	}
	console.log(
		`Running: ${lock.url} (pid ${lock.pid}, started ${lock.startedAt})`,
	);
	try {
		const log = readFileSync(LOG_FILE, "utf-8");
		const lines = log.trim().split("\n").slice(-3);
		if (lines.length && lines[0]) {
			console.log("Recent logs:");
			for (const line of lines) console.log(`  ${line}`);
		}
	} catch {}
}

async function stop() {
	const lock = readLock();
	if (!lock) {
		console.log("No dev server running.");
		return;
	}
	if (!isProcessAlive(lock.pid)) {
		console.log("Dev server was not running (stale lock removed).");
		removeLock();
		return;
	}
	try {
		process.kill(lock.pid, "SIGTERM");
	} catch {
		console.error(`Failed to send SIGTERM to pid ${lock.pid}.`);
		process.exit(1);
	}

	const start = Date.now();
	while (Date.now() - start < GRACEFUL_SHUTDOWN_MS) {
		await sleep(100);
		if (!isProcessAlive(lock.pid)) break;
	}

	if (isProcessAlive(lock.pid)) {
		console.log("Server did not stop gracefully, sending SIGKILL...");
		try {
			process.kill(lock.pid, "SIGKILL");
		} catch {}
	}

	removeLock();
	console.log("Dev server stopped.");
}

async function logs(follow) {
	if (!existsSync(LOG_FILE)) {
		console.log("No log file found. Is the server running?");
		return;
	}
	if (!follow) {
		const content = readFileSync(LOG_FILE, "utf-8");
		const lines = content.trim().split("\n").slice(-50);
		for (const line of lines) console.log(line);
		return;
	}

	// Follow mode — poll every 500ms for new content
	let lastSize = statSync(LOG_FILE).size;
	process.stdout.write(readFileSync(LOG_FILE, "utf-8"));
	process.on("SIGINT", () => process.exit(0));
	while (true) {
		await sleep(500);
		try {
			const size = statSync(LOG_FILE).size;
			if (size !== lastSize) {
				if (size < lastSize) {
					process.stdout.write(readFileSync(LOG_FILE, "utf-8"));
				} else {
					const all = readFileSync(LOG_FILE, "utf-8");
					process.stdout.write(all.slice(lastSize));
				}
				lastSize = size;
			}
		} catch {}
	}
}

// --- CLI ---

const subcommand = process.argv[2];
const flags = process.argv.slice(3);

switch (subcommand) {
	case "background":
		await background();
		break;
	case "status":
		await status();
		break;
	case "stop":
		await stop();
		break;
	case "logs":
		await logs(flags.includes("--follow") || flags.includes("-f"));
		break;
	default:
		console.log(`Usage: node scripts/dev.mjs <command> [flags]

Commands:
  background         Start dev server in background (writes .laju/dev.json)
  status             Check if dev server is running
  stop               Stop the background dev server
  logs [--follow]    View logs (tail -f with --follow)

Human developers: use \`npm run dev:all\` instead.`);
}
