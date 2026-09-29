#!/usr/bin/env node
/**
 * Keeps keys out of git and out of the shipped bundle.
 *
 *   node scripts/check-secrets.mjs            everything git would track
 *   node scripts/check-secrets.mjs --staged   what is about to be committed (pre-commit hook)
 *   node scripts/check-secrets.mjs --dist     the built bundle (after `vite build`)
 *
 * It fails on three things:
 *  1. a file that must never be tracked: .env and its variants (not .env.example),
 *     private keys, the member memory, the session key;
 *  2. a value that looks like a live credential (Anthropic, OpenAI, Google,
 *     Razorpay, Meta, private key blocks);
 *  3. any value from this machine's own .env / .env.local, found anywhere else.
 *     That is what catches a Tripsure key, which has no recognisable prefix.
 *
 * In --dist mode the browser's own Google Maps key is expected (it is public by
 * design and must be restricted by HTTP referrer), so VITE_* values are allowed.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mode = process.argv.includes("--staged") ? "staged" : process.argv.includes("--dist") ? "dist" : "all";

const FORBIDDEN_PATH = [
  /(^|\/)\.env(\.(?!example$)[^/]*)?$/,
  /(^|\/)[^/]*\.(pem|p12|pfx|key)$/,
  /(^|\/)id_(rsa|ed25519)$/,
  /^memory\//, // the traveller memory at the repo root; src/memory is code
  /(^|\/)_desk\//,
  /(^|\/)session\.key$/,
];

const PATTERNS = [
  ["Anthropic key", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["OpenAI key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["Razorpay key", /rzp_(?:live|test)_[A-Za-z0-9]{10,}/],
  ["Meta access token", /\bEAA[A-Za-z0-9]{60,}/],
  ["Private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

function readEnvValues() {
  const out = new Map();
  for (const f of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const value = m[2].replace(/^['"]|['"]$/g, "").trim();
      // Paths, URLs, model names and flags are configuration, not secrets.
      if (value.length < 16 || /^(https?:\/\/|\/|\.\/|true$|false$)/.test(value) || /^[a-z0-9.-]+$/.test(value)) continue;
      if (/(KEY|SECRET|TOKEN|PASSWORD|TENANT)/.test(m[1])) out.set(value, m[1]);
    }
  }
  return out;
}

function files() {
  if (mode === "dist") {
    const dist = path.join(root, "dist");
    if (!fs.existsSync(dist)) return [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    return walk(dist).map((f) => path.relative(root, f));
  }
  try {
    const args = mode === "staged" ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR"] : ["ls-files", "--cached", "--others", "--exclude-standard"];
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    console.error("check-secrets: not a git repository, nothing to check.");
    return [];
  }
}

const envValues = readEnvValues();
const problems = [];
for (const f of files()) {
  if (mode !== "dist" && FORBIDDEN_PATH.some((re) => re.test(f))) {
    problems.push(`${f}: this file must never be committed`);
    continue;
  }
  const p = path.join(root, f);
  let text;
  try {
    const st = fs.statSync(p);
    if (!st.isFile() || st.size > 3_000_000) continue;
    const buf = fs.readFileSync(p);
    if (buf.includes(0)) continue; // binary
    text = buf.toString("utf8");
  } catch {
    continue;
  }
  for (const [label, re] of PATTERNS) {
    if (mode === "dist" && label === "Google API key") continue;
    if (re.test(text)) problems.push(`${f}: looks like ${/^[AEIOU]/.test(label) ? "an" : "a"} ${label}`);
  }
  for (const [value, name] of envValues) {
    if (mode === "dist" && name.startsWith("VITE_")) continue;
    if (text.includes(value)) problems.push(`${f}: contains the value of ${name} from your local env file`);
  }
  if (/(^|\/)\.env\.example$/.test(f)) {
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*)\s*=\s*(\S.*)$/);
      if (m && !/(\.\.\.|^your|^<|^changeme|^replace|^pick-)/i.test(m[3])) problems.push(`${f}: ${m[1]} has a value; .env.example must hold names only`);
    }
  }
}

if (problems.length) {
  console.error(`\n✖ Secrets check failed (${mode}):\n  ${[...new Set(problems)].join("\n  ")}\n`);
  console.error("Keys live only in .env / .env.local on this machine and in the host's environment settings.\n");
  process.exit(1);
}
console.log(`✓ Secrets check passed (${mode}).`);
