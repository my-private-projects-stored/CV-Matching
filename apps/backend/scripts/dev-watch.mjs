import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const watchDirs = ["src"].map((dir) => path.join(rootDir, dir));
const pollIntervalMs = Number(process.env.DEV_WATCH_POLL_INTERVAL_MS || 1000);
const restartDebounceMs = Number(process.env.DEV_WATCH_RESTART_DEBOUNCE_MS || 250);
const extensions = new Set([".js", ".mjs", ".cjs", ".json"]);

let child = null;
let snapshot = new Map();
let restartTimer = null;
let restarting = false;

function startServer() {
  child = spawn(process.execPath, ["src/server.js"], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (!restarting) {
      process.exitCode = code ?? (signal ? 1 : 0);
    }
  });
}

async function stopServer() {
  if (!child || child.exitCode !== null) return;

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child?.kill("SIGKILL");
    }, 3000);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill("SIGTERM");
  });
}

async function walk(dir, files = []) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "coverage") continue;
      await walk(fullPath, files);
      continue;
    }

    if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

async function takeSnapshot() {
  const next = new Map();
  for (const dir of watchDirs) {
    const files = await walk(dir);
    for (const file of files) {
      try {
        const info = await stat(file);
        next.set(file, `${info.mtimeMs}:${info.size}`);
      } catch {
        // File may have been deleted between readdir and stat.
      }
    }
  }
  return next;
}

function hasChanged(previous, next) {
  if (previous.size !== next.size) return true;
  for (const [file, marker] of next) {
    if (previous.get(file) !== marker) return true;
  }
  return false;
}

function scheduleRestart() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(async () => {
    restarting = true;
    console.log("[dev-watch] Change detected. Restarting backend...");
    await stopServer();
    startServer();
    restarting = false;
  }, restartDebounceMs);
}

async function poll() {
  const next = await takeSnapshot();
  if (hasChanged(snapshot, next)) {
    snapshot = next;
    scheduleRestart();
  }
}

process.on("SIGINT", async () => {
  await stopServer();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await stopServer();
  process.exit(0);
});

snapshot = await takeSnapshot();
startServer();
setInterval(() => {
  poll().catch((error) => {
    console.error("[dev-watch] Poll failed:", error);
  });
}, pollIntervalMs);
