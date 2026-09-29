/**
 * The Nocturne component vocabulary.
 *
 * Classes live in src/styles/nocturne.css — the same stylesheet the design
 * canvas uses, so the app and the design stay one system. Components here
 * carry behaviour and structure; layout stays at the call site.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './icons'
import { AGENT } from '@/data/members'

export { Icon } from './icons'

/* ---------------------------------------------------------------- type ---- */

/** A small tracked label. Used sparingly: at most one per section. */
export function Eyebrow({
  children,
  accent = false,
  className = '',
}: {
  children: ReactNode
  accent?: boolean
  className?: string
}) {
  return (
    <p className={`${accent ? 'k-eyebrow' : 't-label'} ${accent ? '' : 'c-ivory-3'} ${className}`}>
      {children}
    </p>
  )
}

/** Display headline in Cormorant. Wrap the one signature phrase in <Sig>. */
export function Headline({
  children,
  size = 'l',
  className = '',
}: {
  children: ReactNode
  size?: 's' | 'm' | 'l' | 'xl' | 'xxl'
  className?: string
}) {
  return <h1 className={`t-display-${size} ${className}`}>{children}</h1>
}

/** The single italic phrase a screen is allowed. */
export function Sig({ children }: { children: ReactNode }) {
  return <em className="t-italic">{children}</em>
}

export function Section({
  children,
  className = '',
  gutter = true,
}: {
  children: ReactNode
  className?: string
  gutter?: boolean
}) {
  return <section className={`${gutter ? 'px-6' : ''} ${className}`}>{children}</section>
}

/**
 * A full-bleed band in the other ground.
 *
 * Tonal rhythm is the house's structural signature: a page that alternates
 * ivory → parchment → obsidian reads as composed, where a page held at one
 * tone all the way down reads as a form (if it is pale) or as a void (if it
 * is dark). Statements and photography belong on obsidian; lists and the
 * things a member acts on belong on ivory.
 *
 * Every `k-*` and `t-*` class inside re-tones on its own, because the tone
 * classes re-declare the tokens rather than restyling the components.
 */
export function Band({
  children,
  tone,
  className = '',
  style,
}: {
  children: ReactNode
  tone: 'dark' | 'light' | 'parchment'
  className?: string
  style?: CSSProperties
}) {
  const cls = tone === 'dark' ? 'k-dark' : 'k-light'
  return (
    <section
      className={`${cls} ${className}`}
      style={tone === 'parchment' ? { background: 'var(--ink-1)', ...style } : style}
    >
      {children}
    </section>
  )
}

/** Heading of a section, with an optional link on the right. */
export function SectionHead({
  title,
  caption,
  action,
}: {
  title: ReactNode
  caption?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="t-display-s">{title}</h2>
        {caption ? <p className="t-caption">{caption}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function Divider({ className = '' }: { className?: string }) {
  return <hr className={`k-rule ${className}`} />
}

/* -------------------------------------------------------------- controls -- */

type BtnTone = 'primary' | 'commit' | 'secondary' | 'ghost' | 'paper'

export function Btn({
  children,
  tone = 'primary',
  size = 'md',
  block = false,
  icon,
  iconAfter,
  className = '',
  ...rest
}: {
  children: ReactNode
  tone?: BtnTone
  size?: 'md' | 'sm'
  block?: boolean
  icon?: string
  iconAfter?: string
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`k-btn k-btn-${tone} ${size === 'sm' ? 'k-btn-sm' : ''} ${block ? 'k-btn-block' : ''} ${className}`}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={size === 'sm' ? 16 : 18} /> : null}
    </button>
  )
}

/** A circular control: glass over photography, solid on the ground. */
export function IconBtn({
  name,
  label,
  solid = false,
  size = 44,
  filled = false,
  className = '',
  ...rest
}: {
  name: string
  label: string
  solid?: boolean
  size?: number
  filled?: boolean
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`k-icon-btn ${solid ? 'k-icon-btn-solid' : ''} ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={name} size={Math.round(size * 0.45)} filled={filled} />
    </button>
  )
}

export function Chip({
  children,
  on = false,
  className = '',
  ...rest
}: { children: ReactNode; on?: boolean; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`k-chip ${on ? 'is-on' : ''} ${className}`} aria-pressed={on} {...rest}>
      {children}
    </button>
  )
}

/** A chip that floats over photography. */
export function GlassChip({ children, className = '', icon }: { children: ReactNode; className?: string; icon?: string }) {
  return (
    <span className={`k-glass-chip ${className}`}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  )
}

/** A credential, exactly as sourced. Evidence, never the pitch. */
export function Cred({ children }: { children: ReactNode }) {
  return (
    <span className="k-cred">
      <Icon name="rosette" size={12} />
      {children}
    </span>
  )
}

export type StatusTone = 'ready' | 'progress' | 'ok' | 'alert'

export function Status({ children, tone = 'progress' }: { children: ReactNode; tone?: StatusTone }) {
  return <span className={`k-status k-status-${tone}`}>{children}</span>
}

/** Kept for older call sites; maps the previous tones onto Nocturne's. */
export function StatusPill({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'ink' | 'muted' }) {
  return <Status tone={tone === 'accent' ? 'ready' : tone === 'ink' ? 'ok' : 'progress'}>{children}</Status>
}

export function LiveDot({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-1.5 w-1.5 rounded-full bg-champagne ${className}`} aria-hidden="true" />
}

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label ? <span className="k-field-label">{label}</span> : null}
      {children}
      {hint ? <span className="t-caption c-ivory-3">{hint}</span> : null}
    </div>
  )
}

/* ------------------------------------------------------------- surfaces --- */

export function Card({
  children,
  raised = false,
  className = '',
  style,
}: {
  children: ReactNode
  raised?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={`${raised ? 'k-card-raised' : 'k-card'} ${className}`} style={style}>
      {children}
    </div>
  )
}

/** The document register: a letter from the house, laid on the dark desk. */
export function Paper({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`k-paper ${className}`} style={style}>
      {children}
    </div>
  )
}

/** The house seal: a monogram in a champagne ring. */
/**
 * Tara, with the mark that says she is a model and not a person.
 *
 * The house sells access to people, so the one thing it cannot afford is a
 * member believing a human wrote something a model wrote. The name earns its
 * warmth; the `AI` mark beside it keeps the claim honest, and the two always
 * travel together.
 */
export function AgentMark({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const type = size === 'lg' ? 't-display-s' : size === 'sm' ? 't-caption' : 't-title-s'
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <span className={type}>{AGENT.name}</span>
      <span className="k-ai-mark" aria-label="an AI agent">
        {AGENT.mark}
      </span>
    </span>
  )
}

export function Seal({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        border: '1px solid var(--champagne-line)',
        background: 'linear-gradient(160deg, #2A2A2E, #141416)',
        color: 'var(--champagne)',
        fontFamily: 'var(--f-display)',
        fontSize: Math.round(size * 0.36),
        letterSpacing: '0.04em',
      }}
      aria-hidden="true"
    >
      TA
    </span>
  )
}

/** Tara's mark. It breathes while Tara is working. */
export function Horizon({ size = 22, working = false, className = '' }: { size?: number; working?: boolean; className?: string }) {
  return (
    <span className={`inline-flex ${working ? 'k-breathe' : ''} ${className}`} style={{ color: 'var(--champagne)' }}>
      <Icon name="horizon" size={size} strokeWidth={1.6} />
    </span>
  )
}

/** A bottom sheet over dimmed content. */
export function Sheet({
  children,
  onClose,
  labelledBy,
  className = '',
}: {
  children: ReactNode
  onClose: () => void
  labelledBy?: string
  className?: string
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 fade-in"
        style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`sheet-in relative w-full max-w-app overflow-y-auto ${className}`}
        style={{
          maxHeight: '88vh',
          background: 'var(--ink-1)',
          borderTop: '1px solid var(--line-2)',
          borderRadius: '28px 28px 0 0',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="sticky top-0 z-10 flex justify-center pb-2 pt-3" style={{ background: 'var(--ink-1)' }}>
          <span className="h-[5px] w-9 rounded-full" style={{ background: 'var(--line-2)' }} />
        </div>
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ photography - */

/**
 * A photograph with a graceful fallback. Photography carries the colour in this
 * system, so a frame that fails becomes a quiet obsidian rectangle with its
 * label rather than a broken glyph.
 */
export function Plate({
  src,
  className = '',
  alt = '',
  label,
  style,
  eager = false,
  position,
}: {
  src?: string
  className?: string
  alt?: string
  label?: string
  style?: CSSProperties
  /** The first frame a member sees: fetch it now, not when it scrolls into view. */
  eager?: boolean
  /** CSS object-position that keeps the subject in a tall crop. */
  position?: string
}) {
  const [failed, setFailed] = useState(!src)
  const [loaded, setLoaded] = useState(false)
  const img = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setFailed(!src)
    setLoaded(false)
  }, [src])

  /*
   * A photograph already in the browser's cache can finish decoding before
   * React attaches its onLoad handler, and then the event never fires: the
   * frame keeps its loading shimmer for the rest of the session. So on every
   * mount and every new source we ask the element itself whether it is done.
   */
  useEffect(() => {
    const el = img.current
    if (!el || !src || !el.complete) return
    if (el.naturalWidth > 0) setLoaded(true)
    else setFailed(true)
  }, [src])

  if (failed) {
    /*
     * A photograph that never arrives leaves a quiet surface, not a caption. The
     * old system printed the label into the empty frame; on a dark ground, with
     * a title already sitting over it, that prints two lines on top of each
     * other. The name stays for assistive technology, where it belongs.
     */
    return (
      <span
        role="img"
        aria-label={alt || label || 'Photography'}
        className={className}
        style={{
          background: 'linear-gradient(160deg, var(--ink-2), var(--ink-1))',
          ...style,
        }}
      />
    )
  }

  return (
    <img
      ref={img}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      {...({ fetchpriority: eager ? 'high' : 'auto' } as Record<string, string>)}
      decoding="async"
      style={{ objectPosition: position, ...style }}
      className={`plate ${loaded ? 'is-loaded' : ''} ${className}`}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  )
}

/**
 * A photographic frame: the image, a directional veil for legibility, and
 * whatever sits on top. Never a flat grey wash over the whole picture.
 */
export function Photo({
  src,
  alt,
  label,
  position,
  veil = 'card',
  radius = 20,
  eager = false,
  kenburns = false,
  className = '',
  style,
  children,
}: {
  src?: string
  alt: string
  label?: string
  position?: string
  veil?: 'card' | 'hero' | 'none'
  radius?: number
  eager?: boolean
  kenburns?: boolean
  className?: string
  style?: CSSProperties
  children?: ReactNode
}) {
  return (
    <div className={`k-photo ${className}`} style={{ borderRadius: radius, ...style }}>
      <Plate
        src={src}
        alt={alt}
        /*
         * A frame with content over it falls back to a quiet obsidian rectangle,
         * never to its own label: the title is already there, and two of them
         * print on top of each other.
         */
        label={children ? undefined : label}
        position={position}
        eager={eager}
        className={`absolute inset-0 h-full w-full object-cover ${kenburns ? 'kenburns' : ''}`}
      />
      {veil === 'hero' ? (
        <>
          <span className="k-veil-top" />
          <span className="k-veil-bottom" />
        </>
      ) : veil === 'card' ? (
        <span className="k-veil-card" />
      ) : null}
      {children}
    </div>
  )
}

/** A horizontal rail that bleeds off the right edge: the signal that there is more. */
export function Rail({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex gap-3 overflow-x-auto pl-6 pr-6 ${className}`}
      style={{ scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }}
    >
      {children}
    </div>
  )
}

/* ----------------------------------------------------------------- state -- */

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: string
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-8 py-24 text-center">
      <span className="c-ivory-3">
        <Icon name={icon} size={28} />
      </span>
      <p className="t-display-m mt-6">{title}</p>
      <p className="t-caption mt-3 max-w-quote">{body}</p>
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  )
}

/** A progress track. Used for holds, builds and steppers. */
export function Track({ value = 1, className = '' }: { value?: number; className?: string }) {
  return (
    <span className={`k-track block ${className}`}>
      <span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </span>
  )
}

/** The back bar of a task screen, kept for older call sites. */
export function BackBar({ title, status, onBack }: { title: string; status?: ReactNode; onBack?: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-between px-6 py-3">
      <button
        type="button"
        className="flex items-center gap-3 t-title-s"
        onClick={() => (onBack ? onBack() : navigate(-1))}
      >
        <Icon name="back" size={18} />
        {title}
      </button>
      {status}
    </div>
  )
}

/**
 * A paragraph that shows its opening and keeps the rest behind one tap.
 *
 * A guide holds more than anyone reads in a sitting, and a wall of it is the
 * fastest way to make a member stop reading at all. The lede earns the tap;
 * nothing is removed, only folded.
 */
export function Clamp({
  children,
  lines = 3,
  className = '',
  more = 'Read more',
  less = 'Less',
}: {
  children: ReactNode
  lines?: number
  className?: string
  more?: string
  less?: string
}) {
  const [open, setOpen] = useState(false)
  const [clipped, setClipped] = useState(false)
  const body = useRef<HTMLParagraphElement>(null)

  /* Only offer the control when the text actually overflows: a two-line note
     with a "Read more" under it is worse than no control at all. */
  useEffect(() => {
    const el = body.current
    if (!el) return
    setClipped(el.scrollHeight - el.clientHeight > 2)
  }, [children, lines])

  return (
    <div className={`flex flex-col items-start gap-1.5 ${className}`}>
      <p
        ref={body}
        className="t-body c-ivory-2"
        style={
          open
            ? undefined
            : {
                display: '-webkit-box',
                WebkitLineClamp: lines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
        }
      >
        {children}
      </p>
      {(clipped || open) && (
        <button type="button" onClick={() => setOpen(!open)} className="k-link k-link-champagne">
          {open ? less : more}
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={15} />
        </button>
      )}
    </div>
  )
}

/**
 * A section that is a heading until someone wants it.
 *
 * The lower half of a city guide is reference, not reading: where to base
 * yourself, what is on, what to know on the ground. Closed, the page stays
 * short enough to reach the bottom of; open, nothing has been lost.
 */
export function Disclosure({
  title,
  caption,
  count,
  icon,
  children,
  defaultOpen = false,
}: {
  title: ReactNode
  caption?: ReactNode
  count?: number
  /** A glyph to anchor the row, so an index of these is scannable by shape. */
  icon?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="k-disclosure">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3.5 py-5 text-left"
      >
        {icon ? (
          <span className="k-disclosure-glyph shrink-0">
            <Icon name={icon} size={18} />
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="t-title block">{title}</span>
          {caption ? <span className="t-caption mt-0.5 block">{caption}</span> : null}
        </span>
        {typeof count === 'number' && count > 0 && (
          <span className="t-mono c-ivory-3 shrink-0">{count}</span>
        )}
        <span
          className="c-ivory-2 flex shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        >
          <Icon name="chevron-down" size={20} />
        </span>
      </button>
      {open ? <div className="pb-6">{children}</div> : null}
    </div>
  )
}
