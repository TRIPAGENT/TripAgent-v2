import test from 'node:test'
import assert from 'node:assert/strict'
import { chatAcknowledgement } from '../src/lib/chatAcknowledgement'
import { addSuggestionToDraft, CHAT_SUGGESTIONS } from '../src/lib/chatSuggestions'

test('receipt states distinguish an unconfirmed send from work accepted by Tara', () => {
  const message = { id: 'job-member-mine', role: 'member' as const, text: 'My trip', at: 1, delivery: 'sending' as const }
  assert.equal(chatAcknowledgement(message, null)?.label, 'Sending…')
  assert.equal(chatAcknowledgement({ ...message, delivery: 'unconfirmed' }, null)?.label, 'Receipt not confirmed · retry')
  const job = { id: 'job', status: 'running' as const, startedAt: '', updatedAt: '', activity: null, partial: '', messages: [{ id: 'mine', text: 'My trip', state: 'queued' as const, replies: [] }] }
  assert.equal(chatAcknowledgement(message, job)?.label, 'Received · next in line')
  assert.equal(chatAcknowledgement(message, { ...job, messages: [{ ...job.messages[0]!, state: 'running' }] })?.label, 'Tara is on it')
  assert.equal(chatAcknowledgement(message, { ...job, messages: [{ ...job.messages[0]!, state: 'completed' }] })?.label, 'Answered')
  assert.equal(chatAcknowledgement({ ...message, id: 'another-turn' }, job)?.label, 'Sending…')
  assert.equal(chatAcknowledgement({ ...message, role: 'ai' }, job), null)
})

test('travel suggestions preserve the member draft and keep the current trip context', () => {
  for (const suggestion of CHAT_SUGGESTIONS) {
    assert.equal(addSuggestionToDraft('', suggestion.prompt), suggestion.prompt)
    assert.equal(addSuggestionToDraft('My dates are flexible', suggestion.prompt), `My dates are flexible ${suggestion.prompt}`)
  }
})
