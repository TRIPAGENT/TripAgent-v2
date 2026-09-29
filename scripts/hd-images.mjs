#!/usr/bin/env node
/**
 * Re-cuts the city and month photography at high definition from the sourcing
 * engine's 2560px originals, without touching any catalogue data.
 *
 *   cards   1080px, JPEG q80   (a full-width card at 3x)
 *   heroes  1600px, JPEG q82   (a full-bleed hero at 3x, with headroom)
 *
 * Sources are chosen exactly as scripts/build-catalogue.mjs chooses them. An
 * existing derivative that is already as sharp as its source allows is kept.
 *
 * Run: npm run images
 */
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const ENGINE =
  process.env.SOURCING_ENGINE ??
  '/Users/polaris/Downloads/VSC-Codes-Polaris/tripagent-sourcing-engine'
const APP = path.resolve(import.meta.dirname, '..')
const SRC_DATA = path.join(ENGINE, 'src/data')
const SRC_IMG = path.join(ENGINE, 'public/img')
const OUT_CITY = path.join(APP, 'public/img/city')
const OUT_MONTH = path.join(APP, 'public/img/month')

const CARD = [1080, 80]
const HERO = [1600, 82]
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'))

function sourceImage(ref) {
  if (!ref || typeof ref !== 'string') return null
  const m = ref.match(/[?&]url=([^&]+)/)
  const raw = m ? decodeURIComponent(m[1]) : ref
  return raw.split('?')[0].replace(/^\//, '')
}

const widthOf = async (file) =>
  Number((await run('sips', ['-g', 'pixelWidth', file])).stdout.match(/(\d+)\s*$/)?.[1] ?? 0)

async function resize(from, to, [width, quality]) {
  if (!existsSync(from)) return 'missing'
  const target = Math.min(width, await widthOf(from))
  if (existsSync(to) && (await widthOf(to)) >= target - 1) return 'kept'
  await run('sips', ['-Z', String(target), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality), from, '--out', to])
  return 'cut'
}

async function main() {
  const cities = await readJson(path.join(SRC_DATA, 'cities.generated.json'))
  const goin = await readJson(path.join(SRC_DATA, 'goin.generated.json'))
  await fs.mkdir(OUT_CITY, { recursive: true })
  await fs.mkdir(OUT_MONTH, { recursive: true })

  const tally = { cut: 0, kept: 0, missing: 0 }
  const jobs = []
  for (const slug of Object.keys(cities).sort()) {
    const src = sourceImage(cities[slug]?.hero?.image) ?? `img/cities/${slug}.jpg`
    const from = path.join(ENGINE, 'public', src)
    jobs.push([from, path.join(OUT_CITY, `${slug}-card.jpg`), CARD])
    jobs.push([from, path.join(OUT_CITY, `${slug}-hero.jpg`), HERO])
  }
  MONTHS.forEach((name, i) => {
    const no = String(i + 1).padStart(2, '0')
    const heroFrom = sourceImage(goin[`go-in-${name}`]?.hero?.image)
    jobs.push([path.join(SRC_IMG, 'mcal', `${no}.jpg`), path.join(OUT_MONTH, `${no}-card.jpg`), CARD])
    jobs.push([heroFrom ? path.join(ENGINE, 'public', heroFrom) : path.join(SRC_IMG, 'mcal', `${no}.jpg`), path.join(OUT_MONTH, `${no}-hero.jpg`), HERO])
  })

  // A few at a time: sips is single-threaded, the machine is not.
  const queue = [...jobs]
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const [from, to, size] = queue.shift()
        tally[await resize(from, to, size)] += 1
      }
    }),
  )
  console.log(`images: ${tally.cut} re-cut, ${tally.kept} already sharp, ${tally.missing} missing source`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
