import { test } from 'node:test'
import assert from 'node:assert/strict'
import { destinationMatches } from '../src/lib/destinationMatches.ts'
import type { CitySummary } from '../src/lib/catalogue.ts'

const city = (slug: string, name: string, country: string): CitySummary => ({ slug, name, country, region: null, lat: null, lon: null, tagline: '', facts: [], months: [], bestMonths: '', whenBlurb: '', lede: '' })
const cities = [city('tokyo', 'Tokyo', 'Japan'), city('kyoto', 'Kyoto', 'Japan'), city('paris', 'Paris', 'France'), city('sao-paulo', 'São Paulo', 'Brazil')]

test('recognises a plausible misspelling without unrelated fallback suggestions', () => {
  assert.deepEqual(destinationMatches('Tokio', cities).map(c => c.slug), ['tokyo'])
  assert.deepEqual(destinationMatches('Atlantis', cities), [])
  assert.deepEqual(destinationMatches('', cities), [])
})
test('handles accents and multiword city slugs', () => {
  assert.equal(destinationMatches('sao-paulo', cities)[0]?.slug, 'sao-paulo')
})
test('country suggestions exclude the unavailable guide', () => {
  assert.deepEqual(destinationMatches('Japan', cities, 'tokyo').map(c => c.slug), ['kyoto'])
})
