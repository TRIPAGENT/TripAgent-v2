import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayMaps, detailPoints } from '../src/lib/itineraryPresentation'

test('day directions preserve ordered stops, encode special characters and fit mobile waypoint limits', () => {
  const stops = Array.from({ length: 12 }, (_, i) => ({ name: `Stop ${i + 1}`, query: `Stop ${i + 1}, Zürich & area` }))
  const routes = dayMaps({ stops })
  assert.equal(routes.length, 3)
  assert.equal(new URL(routes[0].url).searchParams.get('origin'), stops[0].query)
  assert.equal(new URL(routes[0].url).searchParams.get('destination'), stops[4].query)
  assert.equal(new URL(routes[1].url).searchParams.get('origin'), stops[4].query)
  assert.equal(new URL(routes[2].url).searchParams.get('destination'), stops[11].query)
  assert.equal(new URL(routes[0].url).searchParams.get('waypoints')?.split('|').length, 3)
  assert.equal(dayMaps({ place: 'Maldives' })[0].label, 'View day’s area on map')
  assert.deepEqual(dayMaps({}), [])
})
test('legacy hotel prose becomes bullets without losing cancellation or indicative-price qualifications', () => {
  const points = detailPoints('Lagoon Villa, breakfast included; cancellable until 20 Oct. Indicative only · exact dates not confirmed')
  assert.deepEqual(points, ['Lagoon Villa, breakfast included', 'cancellable until 20 Oct.', 'Indicative only', 'exact dates not confirmed'])
})
