import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Btn, Icon, Photo, Sig } from '@/components/ui'
import { brandImage } from '@/lib/catalogue'
import { requestAccess } from '@/lib/agentClient'
import { DESK } from '@/data/members'

/**
 * Asking to be let in.
 *
 * The house is by invitation, so this is not a sign-up form and must never read
 * like one: nothing here creates an account, and nobody is promised a code. It
 * records an ask, says so plainly, and stops. The Desk reads every one.
 *
 * It sits on the obsidian ground with the door, because it belongs to the
 * arrival sequence rather than to the app a member sees once inside.
 */
export default function RequestAccess() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const ready = name.trim().length >= 2 && email.trim().includes('@') && phone.trim().length >= 6

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready || sending) return
    setSending(true)
    setError(null)
    const r = await requestAccess({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      note: note.trim() || undefined,
    })
    setSending(false)
    if (r.ok) setSent(true)
    else setError(r.error)
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-app" style={{ background: 'var(--ink-0)' }}>
      <Photo
        src={brandImage('door')}
        alt="A dune at first light"
        veil="hero"
        radius={0}
        eager
        className="absolute inset-x-0 top-0 h-[42svh] w-full"
      />

      <div className="relative z-[2] flex min-h-dvh flex-col px-6 pb-10">
        <header
          className="flex items-center"
          style={{ paddingTop: 'max(54px, calc(env(safe-area-inset-top) + 12px))', height: 44 }}
        >
          <button
            type="button"
            aria-label="Back to the door"
            onClick={() => navigate('/signin')}
            className="k-icon-btn"
          >
            <Icon name="back" size={20} />
          </button>
        </header>

        {sent ? (
          /* Nothing is claimed here that is not true: no timeline, no promise
             of a code, no account. Only that a person will read it. */
          <section className="flex flex-1 flex-col justify-center gap-5 pb-16">
            <span className="c-champagne">
              <Icon name="check-circle" size={32} />
            </span>
            <h1 className="t-display-l">
              We have your <Sig>request.</Sig>
            </h1>
            <p className="t-body c-ivory-2 max-w-quote">
              The Desk reads every one, in Bengaluru. If TripAgent is right for you, someone will
              write to you at <span className="c-ivory">{email.trim()}</span> with an invitation.
            </p>
            <p className="t-caption c-ivory-3 max-w-quote">
              Membership is personal and offered at our discretion, so this is not a queue and not
              an account. Nothing has been created for you yet.
            </p>
            <div className="mt-2 flex flex-col gap-2.5">
              <Btn tone="secondary" block onClick={() => navigate('/signin')}>
                Back to the door
              </Btn>
            </div>
          </section>
        ) : (
          <section className="flex flex-1 flex-col justify-end gap-6 pb-4">
            <div className="flex flex-col gap-3">
              <h1 className="t-display-l">
                Ask for an <Sig>invitation.</Sig>
              </h1>
              <p className="t-body-s c-ivory-2 max-w-quote">
                Tell us how to reach you. A person at the Desk reads every request — no code is
                issued automatically, and nothing here creates an account.
              </p>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-3.5">
              <Field
                id="ra-name"
                label="Your name"
                value={name}
                onChange={setName}
                autoComplete="name"
                placeholder="First and last name"
              />
              <Field
                id="ra-email"
                label="Email"
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
              />
              <Field
                id="ra-phone"
                label="Mobile"
                value={phone}
                onChange={setPhone}
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+91 ….."
              />
              <Field
                id="ra-note"
                label="Anything we should know"
                optional
                value={note}
                onChange={setNote}
                placeholder="Where you are hoping to go, or who introduced you"
              />

              {error ? (
                <p role="alert" className="t-caption" style={{ color: 'var(--rose)' }}>
                  {error}
                </p>
              ) : null}

              <Btn type="submit" tone="primary" block disabled={!ready || sending} className="mt-1">
                {sending ? 'Sending…' : 'Send to the Desk'}
              </Btn>

              <p className="t-caption c-ivory-3 text-center">
                Already have a code?{' '}
                <Link
                  to="/signin"
                  className="c-ivory-2 underline underline-offset-4"
                  style={{ textDecorationColor: 'var(--line-2)' }}
                >
                  Open the door
                </Link>
              </p>
              <p className="t-caption c-ivory-3 text-center">
                Or write to{' '}
                <a
                  href={`mailto:${DESK.invite}`}
                  className="c-ivory-2 underline underline-offset-4"
                  style={{ textDecorationColor: 'var(--line-2)' }}
                >
                  {DESK.invite}
                </a>
              </p>
            </form>
          </section>
        )}
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
  optional = false,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
  inputMode?: 'email' | 'tel' | 'text'
  optional?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="k-field-label">
        {label}
        {optional ? <span className="c-ivory-3"> · optional</span> : null}
      </label>
      <div className="k-field" style={{ borderRadius: 16 }}>
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  )
}
