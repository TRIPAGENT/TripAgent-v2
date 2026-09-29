#!/usr/bin/env node
/**
 * One command to host TripAgent on this machine for a presentation:
 *
 *   npm run present            build the production app, start the agent and the app
 *   npm run present -- --lan   also serve the app on this Wi-Fi, to open it on a phone
 *   npm run present -- --fast  skip the build and serve the last one
 *
 * It serves the production build (what Vercel will serve), not the dev server,
 * through the same /agent proxy, so what you present is what members get.
 * Ctrl-C stops both.
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const APP = path.resolve(import.meta.dirname, '..')
const AGENT = process.env.AGENT_ROOT ?? path.resolve(APP, '../Chatbot_v1/tripagent')
const lan = process.argv.includes('--lan')
const fast = process.argv.includes('--fast')
const say = (s = '') => console.log(s)
const fail = (s) => {
  console.error(`\n✖ ${s}\n`)
  process.exit(1)
}

const busy = (port) =>
  new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' })
    s.once('connect', () => (s.destroy(), resolve(true)))
    s.once('error', () => resolve(false))
  })

// 1. The agent's own settings. Checked for presence only: values are never printed.
const envFile = path.join(AGENT, '.env')
if (!fs.existsSync(envFile)) fail(`No ${envFile}. Copy .env.example there and add the model key.`)
const env = Object.fromEntries(
  fs.readFileSync(envFile, 'utf8').split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
)
const modelKey = env[env.MODEL_PROVIDER === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'] ?? ''
if (modelKey.length < 16 || modelKey.includes('...')) say('! No model key in the agent .env: the AI desk will say it is unavailable; everything else works.')
if (!fs.existsSync(path.join(APP, 'public/img/brand/hero-1.jpg'))) fail('The catalogue has not been built. Run: npm run catalogue')

// 2. The production build, checked for secrets on the way out.
if (!fast) {
  say('Building the app (production)…')
  const b = spawnSync('npm', ['run', 'build'], { cwd: APP, stdio: 'inherit' })
  if (b.status !== 0) fail('The build failed; see above.')
}

const children = []
const start = (name, cmd, args, cwd) => {
  const c = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: process.env })
  const tag = (d) => String(d).split('\n').filter(Boolean).forEach((l) => console.log(`[${name}] ${l}`))
  c.stdout.on('data', tag)
  c.stderr.on('data', tag)
  c.on('exit', (code) => code && console.log(`[${name}] stopped (${code})`))
  children.push(c)
}

// 3. The agent (members, the desk, the AI) on 127.0.0.1:3000, unless it is already up.
if (await busy(3000)) say('Agent already running on :3000, using it.')
else start('agent', 'npm', ['run', 'local'], AGENT)

// 4. The app on :4173, proxying /agent to the agent.
if (await busy(4173)) fail('Port 4173 is in use. Stop whatever is on it, or run: npx vite preview --port 4174')
start('app', 'npx', ['vite', 'preview', '--port', '4173', '--strictPort', ...(lan ? ['--host', '0.0.0.0'] : ['--host', '127.0.0.1'])], APP)

for (let i = 0; i < 40 && !((await busy(3000)) && (await busy(4173))); i++) await new Promise((r) => setTimeout(r, 500))

const ip = Object.values(os.networkInterfaces()).flat().find((n) => n && n.family === 'IPv4' && !n.internal)?.address
let members = []
try {
  members = JSON.parse(fs.readFileSync(path.join(env.MEMORY_ROOT ? path.resolve(AGENT, env.MEMORY_ROOT) : path.join(AGENT, 'memory'), '_desk', 'members.json'), 'utf8')).filter((m) => !m.revoked)
} catch {
  /* the registry is created on the first sign-in */
}

say(`
TripAgent is up.

  Member app      http://localhost:4173${lan && ip ? `\n  On a phone      http://${ip}:4173   (same Wi-Fi)` : ''}
  The desk        http://127.0.0.1:3000/ops    requests, quotes, member codes
  API spend       http://127.0.0.1:3000/usage

  Access codes    ${members.length ? members.map((m) => `${m.code} (${m.name})`).join(' · ') : 'EV2410VC · RK4821MP · AK1987RS'}
  Walkthrough     PRESENTATION.md

Ctrl-C stops everything.`)

const stop = () => {
  for (const c of children) c.kill('SIGINT')
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
