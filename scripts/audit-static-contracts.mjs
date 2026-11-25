import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

async function walkFiles(dir, predicate) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(full, predicate)));
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

async function auditMongoosePatterns() {
  const serviceFiles = await walkFiles(
    path.join(ROOT_DIR, "services"),
    (p) => p.endsWith(".js") && !p.includes(`${path.sep}tests${path.sep}`) && !p.endsWith("analytics.service.js")
  );
  const violations = [];

  for (const file of serviceFiles) {
    const src = await fs.readFile(file, "utf8");
    const rel = path.relative(ROOT_DIR, file);

    // 1. Detect 2-arg Model.find(filter, { sort|limit|skip }) missing null projection
    const findRegex = /\b[A-Z]\w*Model\.find\(([^;{}]{1,200}),\s*\{\s*(sort|limit|skip)\s*:/g;
    let m;
    while ((m = findRegex.exec(src)) !== null) {
      if (/,\s*null\s*$/.test(m[1])) continue;
      const line = src.slice(0, m.index).split("\n").length;
      violations.push(`[Mongoose .find() 2-arg projection bug] ${rel}:${line} -> pass 'null' as 2nd arg before options`);
    }

    // 2. Detect raw Model.create({ ... }, session...) outside createWithSession
    const createSessionRegex = /\b[A-Z]\w*Model\.create\(\s*\{[\s\S]{1,600}?\bsession\b/g;
    while ((m = createSessionRegex.exec(src)) !== null) {
      const line = src.slice(0, m.index).split("\n").length;
      violations.push(`[Mongoose .create() session array bug] ${rel}:${line} -> use Model.create([doc], { session })`);
    }
  }

  return violations;
}

async function auditRouteOrdering() {
  const routeFiles = await walkFiles(
    path.join(ROOT_DIR, "services"),
    (p) => p.endsWith(".routes.js")
  );
  const violations = [];

  for (const file of routeFiles) {
    const src = await fs.readFile(file, "utf8");
    const rel = path.relative(ROOT_DIR, file);
    const lines = src.split("\n");
    const firstParamByMethod = new Map();

    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(/router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/);
      if (!m) continue;
      const [, method, routePath] = m;
      const isSingleParam = /^\/:[A-Za-z0-9_]+$/.test(routePath);
      const isStaticTopLevel = /^\/[a-zA-Z0-9_-]+$/.test(routePath);

      if (isSingleParam && !firstParamByMethod.has(method)) {
        firstParamByMethod.set(method, { routePath, line: i + 1 });
      } else if (isStaticTopLevel && firstParamByMethod.has(method)) {
        const paramInfo = firstParamByMethod.get(method);
        violations.push(
          `[Route order bug] ${rel}:${i + 1} registers static '${method.toUpperCase()} ${routePath}' AFTER '${paramInfo.routePath}' (line ${paramInfo.line})`
        );
      }
    }
  }

  return violations;
}

async function auditFrontendGatewayCoverage() {
  const proxySrc = await fs.readFile(
    path.join(ROOT_DIR, "services", "api-gateway", "src", "routes", "proxy.js"),
    "utf8"
  );
  const allowedPrefixes = [
    "/api/auth",
    "/api/users",
    "/api/candidate-profile",
    "/api/resumes",
    "/api/company",
    "/api/jobs",
    "/api/applications",
    "/api/recommendations",
    "/api/vectors",
    "/api/enrichment",
    "/api/interviews",
    "/api/notifications",
    "/api/config",
    "/api/status",
    "/api/config-analytics",
    "/api/admin",
    "/api/owner",
    "/api/health",
  ];
  for (const prefix of allowedPrefixes) {
    if (prefix !== "/api/health" && !proxySrc.includes(`"${prefix}"`)) {
      return [`[Gateway missing prefix] ${prefix} not found in proxy.js`];
    }
  }

  const frontendLibFiles = await walkFiles(
    path.join(ROOT_DIR, "apps", "frontend", "lib"),
    (p) => p.endsWith(".ts") && !p.endsWith(".test.ts")
  );
  const violations = [];
  const callRe = /(?:apiFetch|apiPost|apiPatch|apiPut|apiDelete|buildUrl|request<[^>]+>)\(\s*[`'"]([^`'"]+)[`'"]/g;

  for (const file of frontendLibFiles) {
    const src = await fs.readFile(file, "utf8");
    const rel = path.relative(ROOT_DIR, file);
    let m;
    while ((m = callRe.exec(src)) !== null) {
      const ep = m[1].replace(/\$\{[^}]+\}/g, "").replace(/\/+/g, "/");
      if (!ep.startsWith("/") || ep.startsWith("//") || ep === "/" || ep === "/api" || ep === "/api/" || ep.startsWith("/api/?")) continue;
      const fullPath = ep.startsWith("/api/") ? ep : `/api${ep}`;
      const matched = allowedPrefixes.some((p) => fullPath === p || fullPath.startsWith(`${p}/`) || fullPath.startsWith(`${p}?`));
      if (!matched) {
        const line = src.slice(0, m.index).split("\n").length;
        violations.push(`[Unrouted Frontend API] ${rel}:${line} calls '${fullPath}' which has no Gateway proxy prefix`);
      }
    }
  }

  return violations;
}

async function main() {
  const [mongooseIssues, routeIssues, gatewayIssues] = await Promise.all([
    auditMongoosePatterns(),
    auditRouteOrdering(),
    auditFrontendGatewayCoverage(),
  ]);

  const all = [...mongooseIssues, ...routeIssues, ...gatewayIssues];
  if (all.length > 0) {
    console.error("[audit-static-contracts] VIOLATIONS FOUND:");
    for (const v of all) console.error("  -", v);
    process.exit(1);
  }

  console.log("[audit-static-contracts] PASS: 0 Mongoose 8 anti-patterns, 0 route-order collisions, 0 unrouted Frontend APIs.");
}

main().catch((err) => {
  console.error("[audit-static-contracts] Fatal:", err);
  process.exit(1);
});
