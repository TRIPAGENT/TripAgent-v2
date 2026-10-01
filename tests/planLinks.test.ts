import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planKeyFrom, planLinks, withoutPlanLinks } from '../src/lib/planLinks.ts'
const key = 'a'.repeat(64)
const url = `https://tripagent-chat.onrender.com/p/${key}`
test('finds itinerary keys in bare, markdown and inline links', () => {
  for (const text of [url, `[Your London trip](${url})`, `Ready: ${url}. Take a look.`, `<${url}>`]) assert.equal(planLinks(text)[0]?.key, key)
  assert.equal(withoutPlanLinks(`[Your London trip](${url})`), 'Your London trip')
  assert.equal(planKeyFrom(`/journeys/${key}`), key)
})
test('does not turn price sources or invented keys into itinerary cards', () => {
  assert.deepEqual(planLinks('See https://hotel.example/offer'), [])
  assert.equal(planKeyFrom('https://example.com/p/not-a-plan'), null)
  assert.equal(planKeyFrom('javascript:alert(1)'), null)
})
