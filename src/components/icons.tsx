/**
 * The Nocturne icon set: 24px grid, 1.5px stroke, round caps and joins, drawn
 * to sit beside Jost. Inline SVG, so there is no icon font to download and no
 * flash of ligature text ("arrow_forward") while one loads.
 *
 * Screens use the Nocturne names. The Material Symbols names the app used
 * before are mapped onto them so older call sites keep rendering.
 */
import type { ReactNode } from 'react'

const P: Record<string, ReactNode> = {
  back: (<><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>),
  forward: (<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>),
  'arrow-up-right': (<><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>),
  send: (<><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>),
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-up': <path d="m6 15 6-6 6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>),
  mic: (<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><path d="M12 17.5V21" /></>),
  'mic-off': (<><path d="M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.9 2.3" /><path d="M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.4 13A6.5 6.5 0 0 0 18.5 11" /><path d="M12 17.5V21M4 4l16 16" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  bookmark: <path d="M7 3.75h10a.75.75 0 0 1 .75.75V20.5l-5.75-4-5.75 4V4.5A.75.75 0 0 1 7 3.75Z" />,
  bell: (<><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15Z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>),
  horizon: (<><path d="M3.5 16h17" /><path d="M7 16a5 5 0 0 1 10 0" /><path d="M12 6v2.2M6.4 8.6l1.5 1.5M17.6 8.6l-1.5 1.5" /><path d="M8.5 19.5h7" /></>),
  compass: (<><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></>),
  route: (<><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" /></>),
  user: (<><circle cx="12" cy="8.5" r="3.75" /><path d="M4.75 20a7.25 7.25 0 0 1 14.5 0" /></>),
  plane: <path d="M21 15.5v-1.8l-7.5-4.7V4.5a1.5 1.5 0 0 0-3 0V9L3 13.7v1.8l7.5-2.3v4.3L8.5 19v1.5l3.5-1 3.5 1V19l-2-1.5v-4.3Z" />,
  stay: (<><path d="M3 18.5V7" /><path d="M3 14h18v4.5" /><path d="M21 14v-2.5a3 3 0 0 0-3-3h-7V14" /><circle cx="7" cy="11" r="1.8" /></>),
  dine: (<><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10" /><path d="M17 21V3c-2 1.5-3 4-3 7v3h3" /></>),
  do: <path d="m3 19 6.5-10 4 6 2.5-3.5L21 19Z" />,
  moon: <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />,
  pin: (<><path d="M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0c0 5.6-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>),
  map: (<><path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5l-6-2Z" /><path d="M9 4.5v13M15 6.5v13" /></>),
  calendar: (<><rect x="3.75" y="5" width="16.5" height="15" rx="2.5" /><path d="M3.75 9.5h16.5M8 3v4M16 3v4" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  'check-circle': (<><circle cx="12" cy="12" r="8.5" /><path d="m8 12.3 2.8 2.8L16.2 9.7" /></>),
  lock: (<><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>),
  shield: <path d="M12 3.5 5 6v5.5c0 4.4 3 7.7 7 9 4-1.3 7-4.6 7-9V6Z" />,
  'face-id': (<><path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5" /><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 15.5a3.5 3.5 0 0 0 5 0" /></>),
  phone: <path d="M5 4.5h3l1.5 4-2 1.3a10.5 10.5 0 0 0 6.7 6.7l1.3-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 6.1 1.5 1.5 0 0 1 5 4.5Z" />,
  chat: <path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.6A7.5 7.5 0 1 1 20 11.5Z" />,
  mail: (<><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.5 7 7.5 6 7.5-6" /></>),
  share: (<><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8" /><path d="M5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6" /></>),
  edit: <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Z" />,
  swap: (<><path d="M7 4 3.5 7.5 7 11" /><path d="M3.5 7.5h13" /><path d="m17 13 3.5 3.5L17 20" /><path d="M20.5 16.5h-13" /></>),
  document: (<><path d="M7 3.5h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" /><path d="M14 3.5V8h4M9 12.5h6M9 16h6" /></>),
  passport: (<><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="10.5" r="3" /><path d="M9 16.5h6" /></>),
  globe: (<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5Z" /></>),
  sliders: (<><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>),
  star: <path d="m12 4 2.3 4.9 5.2.6-3.9 3.6 1.1 5.2L12 15.7l-4.7 2.6 1.1-5.2-3.9-3.6 5.2-.6Z" />,
  hourglass: <path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 4 5 4 8.5s-4 4.5-4 8.5M16 3.5c0 4-4 5-4 8.5s4 4.5 4 8.5" />,
  rosette: (<><circle cx="12" cy="10" r="5" /><path d="m9 14.5-1.5 6 4.5-2.5 4.5 2.5-1.5-6" /></>),
  keyhole: (<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="10.5" r="2.2" /><path d="M11 12.4 10.4 16h3.2l-.6-3.6" /></>),
  car: (<><path d="M5 16.5V12l2-5h10l2 5v4.5" /><path d="M4 12h16v4.5H4z" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /></>),
  wallet: (<><rect x="3.5" y="6" width="17" height="13" rx="2.5" /><path d="M16 12.5h4.5M3.5 9.5h17" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>),
  info: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.01" /></>),
  more: <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={2.5} />,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
  waveform: <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />,
  refresh: (<><path d="M19.5 8A8 8 0 0 0 5 7.5M4.5 16A8 8 0 0 0 19 16.5" /><path d="M19.5 3.5V8H15M4.5 20.5V16H9" /></>),
  'cloud-off': (<><path d="M7 18h10a4 4 0 0 0 .9-7.9A6 6 0 0 0 7.1 8.4 4.8 4.8 0 0 0 7 18Z" /><path d="M4 4l16 16" /></>),
  link: (<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  keyboard: (<><rect x="3" y="6.5" width="18" height="11" rx="2.5" /><path d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M8 14h8" /></>),
  locate: (<><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="7.5" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2" /></>),
  'radio-on': (<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></>),
  'radio-off': <circle cx="12" cy="12" r="8.5" />,
}

/** Material Symbols names used before the redesign → the Nocturne glyph. */
const ALIAS: Record<string, string> = {
  arrow_back: 'back', arrow_forward: 'forward', arrow_upward: 'send', open_in_new: 'arrow-up-right',
  chevron_right: 'chevron-right', expand_more: 'chevron-down', expand_less: 'chevron-up',
  close: 'close', search: 'search', mic: 'mic', add: 'plus', remove: 'minus',
  bookmark: 'bookmark', bookmark_border: 'bookmark',
  smart_toy: 'horizon', support_agent: 'horizon', auto_awesome: 'horizon', travel_explore: 'compass',
  explore: 'compass', calendar_month: 'calendar', person: 'user',
  flight: 'plane', flight_takeoff: 'plane', flight_land: 'plane',
  apartment: 'stay', hotel: 'stay', restaurant: 'dine', landscape: 'do', local_bar: 'moon',
  map: 'map', schedule: 'clock', call: 'phone', chat: 'chat', mail: 'mail',
  check: 'check', check_circle: 'check-circle', verified: 'rosette', lock: 'lock',
  shield: 'shield', health_and_safety: 'shield', description: 'document', receipt_long: 'document',
  gavel: 'document', menu_book: 'document', checklist: 'check', badge: 'passport', public: 'globe',
  tune: 'sliders', star: 'star', hourglass_top: 'hourglass', more_horiz: 'more', info: 'info',
  undo: 'refresh', directions_car: 'car', payments: 'wallet', wifi: 'globe', thermostat: 'sun',
  compare: 'swap', cloud_off: 'cloud-off', link_off: 'link', edit: 'edit', share: 'share',
  radio_button_checked: 'radio-on', radio_button_unchecked: 'radio-off', location_on: 'pin',
  my_location: 'locate', place: 'pin',
}

export const ICON_NAMES = Object.keys(P)

export function Icon({
  name,
  size = 20,
  className = '',
  strokeWidth = 1.5,
  filled = false,
  label,
}: {
  name: string
  size?: number
  className?: string
  strokeWidth?: number
  /** Fill the glyph (a saved bookmark, a chosen star). */
  filled?: boolean
  /** Give a meaning to assistive technology; otherwise the icon is decorative. */
  label?: string
}) {
  const key = P[name] ? name : ALIAS[name] ?? 'info'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {P[key]}
    </svg>
  )
}
