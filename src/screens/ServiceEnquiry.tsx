import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Screen, TopBar } from '@/components/Shell'
import { Btn, Empty, Icon, Sig, Status } from '@/components/ui'
import { CITIES } from '@/data/catalogue.generated'
import { useStore } from '@/context/store'
import { fileRequest } from '@/lib/agentClient'

type Kind = 'flights' | 'visas'

interface Field {
  id: string
  label: string
  placeholder: string
  type?: 'text' | 'date' | 'number'
  optional?: boolean
  suggest?: string[]
}

const CITY_NAMES = CITIES.map((c) => c.name)

const FORMS: Record<Kind, { number: string; title: string; accent: string; lede: string; fields: Field[] }> = {
  flights: {
    number: '01',
    title: 'Tell us the journey.',
    accent: 'the journey.',
    lede: 'Every cabin, with business and first our speciality. Send the shape of the journey and the Desk comes back with the options and one price.',
    fields: [
      { id: 'from', label: 'Flying from', placeholder: 'Delhi, Mumbai, Bengaluru…' },
      { id: 'to', label: 'Flying to', placeholder: 'City or airport', suggest: CITY_NAMES },
      { id: 'depart', label: 'Departing', placeholder: '', type: 'date' },
      { id: 'return', label: 'Returning', placeholder: '', type: 'date', optional: true },
      { id: 'travellers', label: 'Travellers', placeholder: '2', type: 'number' },
      { id: 'cabin', label: 'Cabin', placeholder: 'Business, First, Suites' },
      { id: 'notes', label: 'Anything that must not move', placeholder: 'Fixed dates, an airline you prefer, a seat you always take', optional: true },
    ],
  },
  visas: {
    number: '03',
    title: 'Tell us the passport.',
    accent: 'the passport.',
    lede: 'Checked, filed and tracked. Send the detail and the Desk confirms what is required, how long it takes, and what it will cost before anything is filed.',
    fields: [
      { id: 'nationality', label: 'Passport held', placeholder: 'Indian' },
      { id: 'destination', label: 'Travelling to', placeholder: 'Country or city', suggest: CITY_NAMES },
      { id: 'travel', label: 'Travelling on', placeholder: '', type: 'date' },
      { id: 'travellers', label: 'Applicants', placeholder: '2', type: 'number' },
      { id: 'residence', label: 'Where you live', placeholder: 'City, which sets the consulate', optional: true },
      { id: 'notes', label: 'Anything unusual', placeholder: 'Previous refusals, a renewal, a name change', optional: true },
    ],
  },
}

/**
 * A structured enquiry rather than a brochure.
 *
 * Everything collected here goes to the Desk's inbox, so a person picks it up,
 * and Tara can be opened with the same detail so the member never
 * repeats it. Nothing is priced or promised on this screen: the Desk answers
 * with what can actually be held.
 */
export default function ServiceEnquiry() {
  const { kind } = useParams<{ kind: Kind }>()
  const navigate = useNavigate()
  const { pushChat, refreshRequests } = useStore()
  const [values, setValues] = useState<Record<string, string>>({})
  const [filed, setFiled] = useState<{ id: string; opening: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = kind && FORMS[kind] ? FORMS[kind] : null

  const required = useMemo(() => (form ? form.fields.filter((f) => !f.optional) : []), [form])
  const ready = required.every((f) => (values[f.id] ?? '').trim().length > 0)

  // An address we do not keep a counter for. Offer the way out, never a dead end.
  if (!form) {
    return (
      <Screen tone="light" tabs={false}>
        <TopBar back="/services" solid />
        <Empty
          icon="info"
          title="We don't have a counter for that."
          body="Flights, stays and visas each have their own form. Anything else goes straight to Tara, and to the Desk behind it."
          action={
            <div className="flex flex-col items-center gap-2">
              <Btn tone="primary" onClick={() => navigate('/services')}>
                See what we handle
              </Btn>
              <Btn tone="ghost" onClick={() => navigate('/concierge')}>
                Ask Tara
              </Btn>
            </div>
          }
        />
      </Screen>
    )
  }

  async function submit() {
    if (!form || !kind) return
    const fields = Object.fromEntries(
      form.fields.map((f) => [f.label, (values[f.id] ?? '').trim()] as const).filter(([, v]) => v),
    )
    const opening = `${kind === 'flights' ? 'Flight enquiry' : 'Visa enquiry'}.\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}`
    setSending(true)
    setError(null)
    try {
      const r = await fileRequest({ type: 'enquiry', kind, fields })
      await refreshRequests()
      setFiled({ id: r.id, opening })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  function continueWithConcierge() {
    if (!filed) return
    // Seed the thread so Tara opens already holding the detail.
    pushChat({ id: `enq-${Date.now()}`, role: 'member', text: filed.opening, at: Date.now() })
    navigate('/concierge', { state: { send: filed.opening, query: filed.opening } })
  }

  if (filed) {
    return (
      <Screen tone="light" tabs={false}>
        <TopBar back="/services" solid />
        <section className="flex flex-col items-center px-6 pt-[160px] text-center">
          <span className="c-champagne flex">
            <Icon name="check-circle" size={30} />
          </span>
          <h1 className="t-display-l mt-5">
            With <Sig>the Desk.</Sig>
          </h1>
          <p className="t-body c-ivory-2 mt-4 max-w-quote">
            Reference <span className="t-mono">{filed.id}</span>. The Desk replies the same day, all times IST.
          </p>
          <div className="mt-8 flex w-full flex-col gap-2">
            <Btn tone="primary" block onClick={() => navigate('/status')}>
              See your requests
            </Btn>
            <Btn tone="secondary" block icon="horizon" onClick={continueWithConcierge}>
              Start on options with Tara
            </Btn>
          </div>
        </section>
      </Screen>
    )
  }

  return (
    <Screen tone="light" tabs={false}>
      <TopBar back="/services" solid title={kind === 'flights' ? 'Flights' : 'Visas'} />

      <section className="flex flex-col gap-3.5 px-6 pt-32">
        <h1 className="t-display-l">
          {form.title.replace(form.accent, '')}
          <Sig>{form.accent}</Sig>
        </h1>
        <p className="t-body c-ivory-2">{form.lede}</p>
      </section>

      <section className="flex flex-col gap-3 px-6 pt-10">
        {form.fields.map((f) => (
          <div key={f.id} className="k-card flex flex-col gap-2 px-4 py-3.5" style={{ borderRadius: 18 }}>
            <label htmlFor={f.id} className="k-field-label flex items-baseline gap-2">
              {f.label}
              {f.optional && <span className="t-caption c-ivory-3">optional</span>}
            </label>
            <input
              id={f.id}
              type={f.type ?? 'text'}
              list={f.suggest ? `${f.id}-list` : undefined}
              value={values[f.id] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
              className="t-body w-full"
              style={{ background: 'transparent', border: 0, outline: 'none', color: 'var(--ivory)' }}
            />
            {f.suggest && (
              <datalist id={`${f.id}-list`}>
                {f.suggest.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col items-center gap-3 px-6 pt-8">
        {error && <p className="t-body-s c-amber w-full">{error}</p>}
        <Btn
          tone="primary"
          block
          iconAfter="forward"
          disabled={!ready || sending}
          style={!ready || sending ? { opacity: 0.5 } : undefined}
          onClick={() => void submit()}
        >
          {sending ? 'Sending…' : 'Send to the Desk'}
        </Btn>
        <p className="t-caption c-ivory-3 text-center">
          Nothing is booked or charged by sending this. The Desk replies with what can be held.
        </p>
        <Status tone="progress">Goes only to the Desk</Status>
      </section>
    </Screen>
  )
}
