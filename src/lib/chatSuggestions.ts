/** Drafts stay in this member's conversation and invite comparison, not booking. */
export const CHAT_SUGGESTIONS = [
  { label: 'Compare stays', prompt: 'Help me compare places to stay for the trip we are discussing. Suggest a few options and explain which suits me best.' },
  { label: 'Flights & routes', prompt: 'Help me compare flight and route options for this trip, including travel time and convenience. Ask me for any missing dates or departure details.' },
  { label: 'Experiences', prompt: 'Suggest a few experiences for this trip that fit my interests and pace. Help me choose between them.' },
  { label: 'Budget & dates', prompt: 'Help me weigh the dates and budget for this trip. Compare the trade-offs and tell me what details you need from me.' },
] as const

export function addSuggestionToDraft(draft: string, prompt: string) {
  return draft.trim() ? `${draft.trim()} ${prompt}` : prompt
}
