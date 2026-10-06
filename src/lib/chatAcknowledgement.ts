import type { ChatJob } from './agentClient'
import type { ChatMessage } from './types'

export function chatAcknowledgement(message: ChatMessage, job: ChatJob | null) {
  if (message.role !== 'member') return null
  const turn = job?.messages.find(turn => `job-member-${turn.id}` === message.id)
  if (turn?.state === 'completed') return { emoji: '✅', label: 'Answered', working: false }
  if (turn?.state === 'failed') return { emoji: '👀', label: 'Received · reply interrupted', working: false }
  if (turn?.state === 'running') return { emoji: '👀', label: 'Tara is on it', working: true }
  if (turn?.state === 'queued') return { emoji: '👀', label: 'Received · next in line', working: true }
  if (message.delivery === 'sending') return { emoji: '⏳', label: 'Sending…', working: true }
  if (message.delivery === 'unconfirmed') return { emoji: '↻', label: 'Receipt not confirmed · retry', working: false }
  if (message.delivery === 'received') return { emoji: '👀', label: 'Seen by Tara', working: false }
  return null
}
