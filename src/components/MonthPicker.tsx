import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui'

/**
 * A month chosen from a small popover: a pill that sits inside a sentence, and a
 * three-by-four grid under it. Built from spans so it can live inside a heading.
 */
export function MonthPicker({
  value,
  months,
  onChange,
}: {
  value: number
  months: { no: number; name: string }[]
  onChange: (no: number) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const current = months.find((m) => m.no === value)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <span ref={root} className="relative inline-flex">
      <button
        type="button"
        className="k-chip"
        style={{ height: 32, padding: '0 10px 0 14px', fontSize: 13, background: 'transparent' }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Month: ${current?.name}. Change month`}
        onClick={() => setOpen((o) => !o)}
      >
        {current?.name}
        <span
          aria-hidden="true"
          className="inline-flex transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        >
          <Icon name="chevron-down" size={14} />
        </span>
      </button>

      {open && (
        <span
          role="listbox"
          aria-label="Choose a month"
          className="fade-in absolute left-0 z-30 grid grid-cols-3 gap-1.5 p-2"
          style={{
            top: 'calc(100% + 8px)',
            width: 'min(300px, calc(100vw - 48px))',
            background: 'var(--ink-2)',
            border: '1px solid var(--line-2)',
            borderRadius: 20,
            boxShadow: '0 18px 44px rgba(25, 22, 19, .22)',
            fontFamily: 'var(--f-sans)',
          }}
        >
          {months.map((m) => (
            <button
              key={m.no}
              type="button"
              role="option"
              aria-selected={m.no === value}
              className={`k-chip justify-center ${m.no === value ? 'is-on' : ''}`}
              style={{ height: 38, padding: '0 6px', border: m.no === value ? undefined : '1px solid transparent' }}
              onClick={() => {
                onChange(m.no)
                setOpen(false)
              }}
            >
              {m.name}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
