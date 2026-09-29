import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Icon, Photo, Sig } from '@/components/ui'
import { brandImage } from '@/lib/catalogue'
import { PARTY_FOR, useStore, type Preferences } from '@/context/store'

interface Question {
  key: keyof Preferences
  eyebrow: string
  title: string
  sig: string
  help: string
  multi?: boolean
  /** Lodging is chosen from photographs; every other question is a text row. */
  image?: boolean
  options: { value: string; label: string; note: string; image?: string; alt?: string }[]
}

/*
 * Five questions that describe the traveller, not a trip.
 *
 * The old set asked how a day should feel and how present the house should
 * be — useful once a journey exists, useless for deciding what to put in
 * front of someone who has said nothing yet. These five are ordered by how
 * much each one narrows a suggestion: the motive, then the landscape, then
 * who is along, then the rhythm, then the room. They are asked once and they
 * hold; a trip's own dates and party are asked for on the request itself.
 */
const QUESTIONS: Question[] = [
  {
    key: 'purpose',
    eyebrow: 'One of five',
    title: 'What pulls you',
    sig: 'away?',
    help: 'The reason that keeps coming back, whatever the destination.',
    options: [
      { value: 'restoration', label: 'To be restored', note: 'Quiet, air, nothing owed to anyone' },
      { value: 'discovery', label: 'To understand a place', note: 'Culture, craft, the long look' },
      { value: 'people', label: 'To be with people', note: 'The table that fills, and stays full' },
      { value: 'rare', label: 'To see the rare', note: 'The hard to reach and seldom opened' },
    ],
  },
  {
    key: 'terrain',
    eyebrow: 'Two of five',
    title: 'Where do you feel most',
    sig: 'yourself?',
    help: 'The landscape you return to. This does more than anything else to decide what we put in front of you.',
    image: true,
    options: [
      {
        value: 'coast',
        label: 'Water',
        note: 'Coast, islands, the long horizon',
        image: 'maldives',
        alt: 'A turquoise lagoon under open sky',
      },
      {
        value: 'mountain',
        label: 'High ground',
        note: 'Mountains, lakes, cold clean air',
        image: 'lake-como',
        alt: 'A lake held between steep green mountains',
      },
      {
        value: 'city',
        label: 'Cities',
        note: 'Streets, rooms, things that are on',
        image: 'london',
        alt: 'A great city at dusk along its river',
      },
      {
        value: 'wild',
        label: 'The wild',
        note: 'Desert, bush, ice, open ocean',
        image: 'manta',
        alt: 'A manta ray moving through open blue water',
      },
    ],
  },
  {
    key: 'company',
    eyebrow: 'Three of five',
    title: 'Who is usually',
    sig: 'with you?',
    help: 'We will assume this, and ask again on any journey where it changes.',
    options: [
      { value: 'alone', label: 'I travel alone', note: 'One room, and my own hours' },
      { value: 'partner', label: 'The two of us', note: 'A partner, and time to ourselves' },
      { value: 'family', label: 'Family', note: 'Children, and what that asks of a place' },
      { value: 'friends', label: 'Friends', note: 'A group that moves together' },
    ],
  },
  {
    key: 'pace',
    eyebrow: 'Four of five',
    title: 'How do your days usually',
    sig: 'run?',
    help: 'Not for one trip — the rhythm you are happiest travelling at.',
    options: [
      { value: 'unhurried', label: 'Unhurried', note: 'Two anchors a day, long intervals' },
      { value: 'balanced', label: 'Balanced', note: 'Three or four, with room to drift' },
      { value: 'full', label: 'Full', note: 'Dawn to nocturne, tightly held' },
    ],
  },
  {
    key: 'lodging',
    eyebrow: 'Five of five',
    title: 'Where should the night',
    sig: 'settle?',
    help: 'The category shapes which doors we knock on first.',
    image: true,
    options: [
      {
        value: 'sanctuary',
        label: 'Sanctuary',
        note: 'Ryokan, riad, retreat',
        image: 'sanctuary',
        alt: 'An infinity pool facing limestone islands, a lone swimmer at its edge',
      },
      {
        value: 'grand',
        label: 'Grand house',
        note: 'Palace hotels and grande dames',
        image: 'grand-house',
        alt: 'A palace-hotel staircase above a chequerboard marble floor',
      },
      {
        value: 'ultra',
        label: 'Ultra-modern',
        note: 'Architectural, discreet, new',
        image: 'ultra-modern',
        alt: 'A modern pool villa of clean lines set in green hills',
      },
      {
        value: 'private',
        label: 'Somewhere private',
        note: 'The whole house, staffed, ours alone',
        image: 'udaipur',
        alt: 'A private lakeside palace at golden hour',
      },
    ],
  },
]

/** The champagne tick that marks a chosen answer. */
function Tick({ on, className = '' }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-full ${className}`}
      style={{
        width: 28,
        height: 28,
        background: on ? 'var(--champagne)' : 'rgba(10,10,11,.42)',
        color: on ? 'var(--ink-0)' : 'transparent',
        border: on ? 'none' : '1.5px solid var(--ivory-3)',
      }}
    >
      {on ? <Icon name="check" size={16} strokeWidth={2.2} /> : null}
    </span>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { prefs, setPrefs } = useStore()
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState<Record<string, string | string[]>>({})

  const q = QUESTIONS[index]
  const current = draft[q.key as string]
  const answered = Array.isArray(current) ? current.length > 0 : Boolean(current)

  /** What has been noted so far, as chips above the title. */
  const noted = QUESTIONS.slice(0, index)
    .map((prev) => {
      const value = draft[prev.key as string]
      const values = Array.isArray(value) ? value : value ? [value] : []
      const labels = values
        .map((v) => prev.options.find((o) => o.value === v)?.label)
        .filter((l): l is string => Boolean(l))
      return labels.length ? { key: prev.key as string, text: labels.join(' · ') } : null
    })
    .filter((c): c is { key: string; text: string } => c !== null)

  function choose(value: string) {
    setDraft((prev) => {
      if (q.multi) {
        const list = (prev[q.key as string] as string[] | undefined) ?? []
        return {
          ...prev,
          [q.key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
        }
      }
      return { ...prev, [q.key]: value }
    })
  }

  function next() {
    if (index < QUESTIONS.length - 1) {
      setIndex(index + 1)
      return
    }
    const company = draft.company as Preferences['company']
    setPrefs({
      ...prefs,
      purpose: draft.purpose as Preferences['purpose'],
      terrain: draft.terrain as Preferences['terrain'],
      company,
      pace: draft.pace as Preferences['pace'],
      lodging: draft.lodging as Preferences['lodging'],
      /* Who is usually along gives the party a sensible starting number. It is
         a default, never a fact: every request may say otherwise. */
      party: (company ? PARTY_FOR[company] : undefined) ?? prefs.party ?? 2,
      completed: true,
    })
    navigate('/', { replace: true })
  }

  function skip() {
    setPrefs({ ...prefs, completed: true })
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-app" style={{ background: 'var(--ink-0)' }}>
      <div
        className="relative flex min-h-dvh flex-col px-6"
        style={{
          paddingTop: 'max(54px, calc(env(safe-area-inset-top) + 12px))',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Top bar: back, where we are, and the way out */}
        <div className="relative flex h-11 items-center justify-between">
          <button
            type="button"
            aria-label="Back to the previous question"
            className="k-icon-btn k-icon-btn-solid disabled:opacity-30"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            <Icon name="back" size={20} />
          </button>
          <p className="t-label c-ivory-2 pointer-events-none absolute inset-x-0 text-center">
            {q.eyebrow}
          </p>
          <button type="button" className="k-link c-ivory-2 relative" style={{ height: 44, padding: '0 8px' }} onClick={skip}>
            Skip
          </button>
        </div>

        {/* Progress: done, current, still to come */}
        <div
          role="progressbar"
          aria-label={q.eyebrow}
          aria-valuemin={1}
          aria-valuemax={QUESTIONS.length}
          aria-valuenow={index + 1}
          className="mt-4 grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${QUESTIONS.length}, minmax(0, 1fr))` }}
        >
          {QUESTIONS.map((_, i) => (
            <span
              key={i}
              style={{
                height: 3,
                borderRadius: 3,
                background: i < index ? 'var(--ivory)' : i === index ? 'var(--champagne)' : 'var(--line-2)',
              }}
            />
          ))}
        </div>

        {noted.length > 0 && (
          <ul aria-label="Noted so far" className="mt-4 flex flex-wrap gap-2">
            {noted.map((chip) => (
              <li
                key={chip.key}
                className="k-chip max-w-full"
                style={{ height: 30, padding: '0 12px 0 10px', gap: 6 }}
              >
                <span className="c-champagne flex">
                  <Icon name="check" size={14} strokeWidth={1.8} />
                </span>
                <span className="truncate">{chip.text}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <h1 id="onboarding-q" className="t-display-l">
            {q.title} <Sig>{q.sig}</Sig>
          </h1>
          <p id="onboarding-help" className="t-body-s c-ivory-2">
            {q.help}
          </p>
        </div>

        <div
          role="group"
          aria-labelledby="onboarding-q"
          aria-describedby="onboarding-help"
          className="mt-8 flex flex-col gap-3"
        >
          {q.options.map((opt) => {
            const selected = Array.isArray(current) ? current.includes(opt.value) : current === opt.value

            if (q.image && opt.image) {
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => choose(opt.value)}
                  className="relative block w-full text-left"
                  style={{ height: 136, borderRadius: 20, boxShadow: selected ? '0 0 0 5px rgba(216,194,154,.12)' : undefined }}
                >
                  <Photo
                    src={brandImage(opt.image)}
                    alt={opt.alt ?? opt.label}
                    label={opt.label}
                    veil="none"
                    radius={20}
                    position="50% 60%"
                    className="absolute inset-0 h-full w-full"
                  >
                    <span
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(90deg, rgba(8,8,9,.9) 0%, rgba(8,8,9,.74) 40%, rgba(8,8,9,.3) 72%, rgba(8,8,9,.08) 100%), linear-gradient(0deg, rgba(8,8,9,.55) 0%, rgba(8,8,9,0) 62%)',
                      }}
                    />
                    <span
                      className="absolute inset-0"
                      style={{
                        borderRadius: 20,
                        border: selected ? '2px solid var(--champagne)' : '1px solid var(--line)',
                      }}
                    />
                    <span className="absolute right-3 top-3">
                      <Tick on={selected} />
                    </span>
                    <span className="absolute bottom-[18px] left-5 right-[120px] flex flex-col gap-0.5">
                      <span className="t-display-s">{opt.label}</span>
                      <span className="t-caption">{opt.note}</span>
                    </span>
                  </Photo>
                </button>
              )
            }

            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => choose(opt.value)}
                className="k-card flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                style={{
                  minHeight: 72,
                  borderColor: selected ? 'var(--champagne)' : 'var(--line)',
                  boxShadow: selected ? '0 0 0 5px rgba(216,194,154,.12)' : undefined,
                }}
              >
                <span className="min-w-0 flex flex-col gap-0.5">
                  <span className="t-title">{opt.label}</span>
                  <span className="t-caption">{opt.note}</span>
                </span>
                <Tick on={selected} />
              </button>
            )
          })}
        </div>

        <div className="flex-1" style={{ minHeight: 32 }} />

        <Btn block className="mt-10" disabled={!answered} onClick={next}>
          {index === QUESTIONS.length - 1 ? 'Begin' : 'Next'}
        </Btn>
      </div>
    </div>
  )
}
