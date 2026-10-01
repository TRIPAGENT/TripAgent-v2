/**
 * The app's chrome.
 *
 * One floating glass tab bar with Tara at its centre, and nothing else
 * permanently on screen. The old arrangement — a sticky header, a tab bar and a
 * two-button dock stacked on top of each other — took 114pt off every screen
 * and said the same thing three times.
 */
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Icon } from './icons'
import { Mark } from './ui'
import { useStore } from '@/context/store'

const TABS = [
  { to: '/', label: 'Discover', icon: 'compass', end: true },
  { to: '/journeys', label: 'Journeys', icon: 'route', end: false },
  { to: '/saved', label: 'Saved', icon: 'bookmark', end: false },
] as const

/** Initials for the membership tab, from the member's own name. */
function initials(name?: string | null) {
  if (!name) return 'TA'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.at(-1)?.[0] ?? '')).toUpperCase() || 'TA'
}

export function TabBar() {
  const { member, wishlist } = useStore()
  const { pathname } = useLocation()
  const conciergeOn = pathname.startsWith('/concierge')

  const tabClass = ({ isActive }: { isActive: boolean }) => `k-tab ${isActive ? 'is-active' : ''}`

  return (
    <nav
      aria-label="Primary"
      /* `k-dark` because the chrome is obsidian on both grounds: it is a single
         floating object a member learns the position of, not a part of the page
         it happens to be over. Without it the capsule inherits the light
         register and its labels wash out over ivory. */
      className="k-tabbar k-dark fixed z-40"
      style={{
        left: 'max(16px, calc(50% - 224px))',
        right: 'max(16px, calc(50% - 224px))',
        bottom: 'max(20px, env(safe-area-inset-bottom))',
      }}
    >
      <NavLink to={TABS[0].to} end className={tabClass}>
        <Icon name={TABS[0].icon} size={22} />
        <span>{TABS[0].label}</span>
      </NavLink>
      <NavLink to={TABS[1].to} className={tabClass}>
        <Icon name={TABS[1].icon} size={22} />
        <span>{TABS[1].label}</span>
      </NavLink>

      <NavLink
        to="/concierge"
        aria-label="Tara"
        className="k-orb"
        style={conciergeOn ? { boxShadow: 'var(--shadow-orb), 0 0 0 2px rgba(216,194,154,.55)' } : undefined}
      >
        {/* The house mark, not Tara's sunrise: this is the most prominent
            thing in the app and it should be the brand. */}
        <Mark size={25} strokeWidth={30} />
      </NavLink>

      <NavLink to={TABS[2].to} className={tabClass}>
        {({ isActive }) => (
          <>
            <span className="relative">
              <Icon name="bookmark" size={22} filled={isActive} />
              {wishlist.length > 0 && (
                <span
                  className="absolute -right-2 -top-1 rounded-full px-1 text-[10px] font-semibold leading-[14px]"
                  style={{ background: 'var(--champagne)', color: 'var(--ink-0)' }}
                >
                  {wishlist.length}
                </span>
              )}
            </span>
            <span>{TABS[2].label}</span>
          </>
        )}
      </NavLink>

      <NavLink to="/membership" className={tabClass}>
        <span className="k-monogram" style={{ width: 24, height: 24, fontSize: 10 }}>
          {initials(member?.name)}
        </span>
        <span>Membership</span>
      </NavLink>
    </nav>
  )
}

/**
 * The top bar of a sub-screen: a back control, an optional centred title, and
 * up to two actions. Glass over photography, solid on the ground.
 */
export function TopBar({
  back = true,
  onBack,
  title,
  sub,
  actions,
  solid = false,
  className = '',
}: {
  back?: boolean | string
  onBack?: () => void
  title?: ReactNode
  sub?: ReactNode
  actions?: ReactNode
  /** On a plain ground rather than over a photograph. */
  solid?: boolean
  className?: string
}) {
  const navigate = useNavigate()
  const go = () => (onBack ? onBack() : typeof back === 'string' ? navigate(back) : navigate(-1))

  return (
    <header
      className={`absolute left-4 right-4 z-30 flex items-center justify-between gap-3 ${className}`}
      style={{ top: 'max(54px, calc(env(safe-area-inset-top) + 12px))', height: 44 }}
    >
      {back ? (
        <button
          type="button"
          aria-label="Back"
          onClick={go}
          className={`k-icon-btn ${solid ? 'k-icon-btn-solid' : ''}`}
        >
          <Icon name="back" size={20} />
        </button>
      ) : (
        <span className="w-11" />
      )}

      {title ? (
        <div className="min-w-0 flex-1 text-center">
          <p className="t-title-s truncate">{title}</p>
          {sub ? <p className="t-caption truncate">{sub}</p> : null}
        </div>
      ) : (
        <span className="flex-1" />
      )}

      <div className="flex items-center gap-2">{actions}</div>
    </header>
  )
}

/**
 * The bottom dock of a detail or task screen: one primary action, and at most
 * one secondary. The only raised object on the screen.
 */
export function Dock({
  children,
  caption,
}: {
  children: ReactNode
  caption?: ReactNode
}) {
  return (
    /* Obsidian on both grounds, for the same reason as the tab bar. */
    <div
      className="k-dark fixed z-40"
      style={{
        left: 'max(16px, calc(50% - 224px))',
        right: 'max(16px, calc(50% - 224px))',
        bottom: 'max(20px, env(safe-area-inset-bottom))',
        background: 'transparent',
      }}
    >
      {caption ? <p className="t-caption c-ivory-3 mb-2 text-center">{caption}</p> : null}
      <div className="k-glass-strong flex items-center gap-2 p-2" style={{ borderRadius: 32 }}>
        {children}
      </div>
    </div>
  )
}

/**
 * The page frame. `tabs` shows the floating tab bar; `dock` leaves room for a
 * bottom dock. Content is capped at a phone measure and centred on a desktop,
 * so the app reads as an app on every screen.
 */
export function Screen({
  children,
  tabs = true,
  dock = false,
  tone = 'dark',
  className = '',
}: {
  children: ReactNode
  tabs?: boolean
  dock?: boolean
  /**
   * Which of the house's two grounds this screen sits on. Obsidian carries
   * arrival, photography and Tara; ivory carries the lists, the
   * documents and the things a member acts on. Photographs keep their own
   * obsidian register either way, so a light screen still has a dark hero.
   */
  tone?: 'dark' | 'light'
  className?: string
}) {
  const { pathname } = useLocation()
  return (
    <div
      className={`mx-auto min-h-full w-full max-w-app ${tone === 'light' ? 'k-light' : ''}`}
      style={{ background: 'var(--ink-0)' }}
    >
      <main key={pathname} className={`page-in relative ${className}`} style={{ paddingBottom: tabs || dock ? 132 : 0 }}>
        {children}
      </main>
      {tabs && <TabBar />}
    </div>
  )
}

/* Kept so older call sites keep compiling while screens are rebuilt. */
export function AppHeader() {
  return null
}

export function ConciergeDock({
  primary,
  secondary,
}: {
  primary: { label: string; icon: string; onClick: () => void }
  secondary?: { label: string; icon: string; onClick: () => void }
}) {
  return (
    <Dock>
      <button type="button" onClick={primary.onClick} className="k-btn k-btn-primary flex-1">
        <Icon name={primary.icon} size={18} />
        {primary.label}
      </button>
      {secondary && (
        <button
          type="button"
          onClick={secondary.onClick}
          aria-label={secondary.label}
          className="k-icon-btn k-icon-btn-solid"
        >
          <Icon name={secondary.icon} size={20} />
        </button>
      )}
    </Dock>
  )
}
