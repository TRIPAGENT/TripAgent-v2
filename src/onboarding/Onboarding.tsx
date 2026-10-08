
import {
  useRef, useState,
  type KeyboardEvent, type PointerEvent, type ReactNode,
} from 'react';
import { HERO, HOUSES, PASSIONS, PLACES, SURPRISE, type HouseId, type PassionId, type PlaceId } from './data';
import { buildDeck, buildProfile, type DeckCard } from './profile';
import type { ImageMap, InviteResult, TravelProfile } from './types';

type Screen = 'invite' | 'passions' | 'houses' | 'places' | 'signature';

export interface OnboardingProps {
  /** Called with the finished profile when the member taps "Meet Tara". Throw to show an error. */
  onComplete: (profile: TravelProfile) => void | Promise<void>;
  /** Check an invitation code. Omit to accept any non-empty code (prototype only). */
  verifyInvite?: (code: string) => Promise<InviteResult>;
  /** Start past the invitation screen, e.g. when the member is already verified. */
  skipInvite?: boolean;
  /** Shown as "Welcome, {name}." when the invite step is skipped. */
  memberName?: string;
  /** Prefill for "Refine my choices" from Membership. Places are always re-swiped. */
  initialProfile?: TravelProfile;
  /** Real photographs, keyed by slot. Missing slots show their tone and shot brief. */
  images?: ImageMap;
  /** Hide the "Photo: …" shot briefs on empty slots (e.g. in production before all images land). */
  hideShotBriefs?: boolean;
  /** Photographer credit per slot, shown on the image wherever the source requires it. */
  credits?: ImageMap;
}

const SWIPE_THRESHOLD = 80;
const CAROUSEL_THRESHOLD = 50;
const CAROUSEL_STEP = 196;

export function Onboarding({
  onComplete, verifyInvite, skipInvite = false, memberName, initialProfile, images = {}, hideShotBriefs = false, credits = {},
}: OnboardingProps) {
  const [screen, setScreen] = useState<Screen>(skipInvite ? 'passions' : 'invite');

  // Invitation
  const [code, setCode] = useState('');
  const [welcomed, setWelcomed] = useState(false);
  const [name, setName] = useState(memberName);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Step 1: passions carousel
  const [passions, setPassions] = useState<PassionId[]>(initialProfile?.passions ?? []);
  const [focus, setFocus] = useState(0);
  const [pdx, setPdx] = useState(0);
  const [pDragging, setPDragging] = useState(false);
  const pStart = useRef(0);
  const pMoved = useRef(false);

  // Step 2: houses
  const [ranked, setRanked] = useState<HouseId[]>(initialProfile?.houses.ranked ?? []);
  const [noHouse, setNoHouse] = useState(initialProfile?.houses.noPreference ?? false);

  // Step 3: places
  const [deck, setDeck] = useState<DeckCard[]>(() => buildDeck(initialProfile?.passions ?? []));
  const [idx, setIdx] = useState(0);
  const [yes, setYes] = useState<DeckCard[]>([]);
  const [no, setNo] = useState<DeckCard[]>([]);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const dStart = useRef(0);

  // Finish
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const img = (key: keyof ImageMap) => images[key];
  const cred = (key: keyof ImageMap) => credits[key];

  const startPlaces = () => {
    setDeck(buildDeck(passions));
    setIdx(0); setYes([]); setNo([]); setDx(0); setAnimating(false); setDragging(false);
    setScreen('places');
  };

  const back = () => {
    if (screen === 'passions') setScreen(skipInvite ? 'passions' : 'invite');
    else if (screen === 'houses') setScreen('passions');
    else if (screen === 'places') setScreen('houses');
    else if (screen === 'signature') setScreen('places');
  };

  // ---------- Invitation ----------
  const enter = async () => {
    const trimmed = code.trim();
    if (!trimmed) { setInviteError('Please enter your invitation code.'); return; }
    setInviteError(null);
    if (!verifyInvite) { setWelcomed(true); return; }
    setVerifying(true);
    try {
      const res = await verifyInvite(trimmed);
      if (res.ok) { setName(res.memberName ?? name); setWelcomed(true); }
      else setInviteError(res.message ?? 'That code isn’t recognised. Please check it and try again.');
    } catch {
      setInviteError('We couldn’t check your code just now. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // ---------- Step 1 ----------
  const togglePassion = (id: PassionId) =>
    setPassions((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const moveFocus = (step: number) =>
    setFocus((f) => Math.max(0, Math.min(PASSIONS.length - 1, f + step)));

  const onCarouselDown = (e: PointerEvent<HTMLDivElement>) => {
    pStart.current = e.clientX; pMoved.current = false; setPDragging(true); setPdx(0);
  };
  const onCarouselMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pDragging) return;
    const d = e.clientX - pStart.current;
    if (Math.abs(d) > 8) pMoved.current = true;
    setPdx(d);
  };
  const onCarouselUp = () => {
    if (!pDragging) return;
    if (pdx < -CAROUSEL_THRESHOLD) moveFocus(1);
    else if (pdx > CAROUSEL_THRESHOLD) moveFocus(-1);
    setPDragging(false); setPdx(0);
  };
  const onCarouselKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); moveFocus(-1); }
  };

  // ---------- Step 2 ----------
  const toggleHouse = (id: HouseId) => {
    setNoHouse(false);
    setRanked((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  };

  // ---------- Step 3 ----------
  const swipe = (side: 'yes' | 'no') => {
    if (animating || idx >= deck.length) return;
    const card = deck[idx];
    setAnimating(true); setDragging(false); setDx(side === 'yes' ? 520 : -520);
    window.setTimeout(() => {
      if (side === 'yes') setYes((y) => [...y, card]); else setNo((n) => [...n, card]);
      const next = idx + 1;
      setIdx(next); setDx(0); setAnimating(false);
      if (next >= deck.length) window.setTimeout(() => setScreen('signature'), 220);
    }, 230);
  };
  const onCardDown = (e: PointerEvent<HTMLDivElement>) => {
    if (animating) return;
    dStart.current = e.clientX;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true); setDx(0);
  };
  const onCardMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) setDx(e.clientX - dStart.current);
  };
  const onCardUp = () => {
    if (!dragging) return;
    if (dx > SWIPE_THRESHOLD) swipe('yes');
    else if (dx < -SWIPE_THRESHOLD) swipe('no');
    else { setDragging(false); setDx(0); }
  };
  const onCardKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); swipe('yes'); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); swipe('no'); }
  };

  // ---------- Finish ----------
  const profile = (): TravelProfile =>
    buildProfile({ passions, ranked, noHousePreference: noHouse, deck, yes, no });

  const finish = async () => {
    setSubmitting(true); setSubmitError(null);
    try { await onComplete(profile()); }
    catch { setSubmitError('We couldn’t save your choices. Please try again.'); }
    finally { setSubmitting(false); }
  };

  const step = screen === 'passions' ? 1 : screen === 'houses' ? 2 : screen === 'places' ? 3 : 0;
  const showHeader = step > 0;

  return (
    <div className="ta-root">
      {showHeader && (
        <header className="ta-header">
          <button type="button" className="ta-icon-btn" aria-label="Back" onClick={back}><Chevron dir="left" /></button>
          <div className="ta-progress" aria-label={`Step ${step} of 3`}>
            <div className="ta-progress-bars">
              {[1, 2, 3].map((i) => <span key={i} className={i <= step ? 'is-done' : ''} />)}
            </div>
            <span className="ta-muted ta-small">{step} of 3</span>
          </div>
          <button type="button" className="ta-text-btn" onClick={() => setScreen('signature')}>Later</button>
        </header>
      )}

      {screen === 'invite' && (
        <section className="ta-invite">
          <Photo tone={HERO.tone} light={HERO.light} src={img('hero')} credit={cred('hero')} brief={hideShotBriefs ? undefined : HERO.brief} />
          <div className="ta-invite-fade" />
          <div className="ta-invite-body">
            {!welcomed ? (
              <>
                <div className="ta-stack-8">
                  <span className="ta-display ta-wordmark">TripAgent</span>
                  <span className="ta-display ta-italic ta-accent ta-invite-sub">By invitation</span>
                </div>
                <label htmlFor="ta-code" className="ta-muted ta-small">Your invitation code</label>
                <input
                  id="ta-code" className="ta-code" type="text" autoComplete="off" autoCapitalize="characters"
                  value={code} placeholder="XXXX-XXX" aria-invalid={!!inviteError}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') void enter(); }}
                />
                {inviteError && <span role="alert" className="ta-error">{inviteError}</span>}
                <button type="button" className="ta-cta" onClick={() => void enter()} disabled={verifying}>
                  {verifying ? 'Checking…' : 'Enter'}
                </button>
                <span className="ta-muted ta-small ta-center">No code? Ask the member who introduced you.</span>
              </>
            ) : (
              <>
                <span className="ta-display ta-welcome">{name ? `Welcome, ${name}.` : 'Welcome.'}</span>
                <span className="ta-lead">Three quick moments, and Tara will know your style.</span>
                <button type="button" className="ta-cta" onClick={() => setScreen('passions')}>Begin</button>
              </>
            )}
          </div>
        </section>
      )}

      {screen === 'passions' && (() => {
        const fp = PASSIONS[focus];
        const fOn = passions.includes(fp.id);
        return (
          <section className="ta-screen ta-passions">
            <div className="ta-pad ta-stack-12">
              <h2 className="ta-display ta-h2">What are you most yourself doing?</h2>
              <div className="ta-tray" aria-live="polite">
                <span className="ta-display ta-italic ta-accent">{passions.length ? `Your world, ${passions.length}` : 'Your world'}</span>
                {passions.length === 0 && <span className="ta-muted ta-small">Add whatever feels like you.</span>}
                <div className="ta-tray-thumbs">
                  {passions.map((id) => {
                    const p = PASSIONS.find((x) => x.id === id)!;
                    return <div key={id} className="ta-tray-thumb"><Photo tone={p.tone} light={p.light} src={img(`passion:${id}`)} /></div>;
                  })}
                </div>
              </div>
            </div>
            <div
              className="ta-carousel" role="group" aria-roledescription="carousel" aria-label="What you love doing"
              tabIndex={0} onKeyDown={onCarouselKey}
              onPointerDown={onCarouselDown} onPointerMove={onCarouselMove} onPointerUp={onCarouselUp} onPointerCancel={onCarouselUp}
            >
              {PASSIONS.map((p, i) => {
                const off = i - focus;
                const a = Math.abs(off);
                const on = passions.includes(p.id);
                return (
                  <button
                    key={p.id} type="button" className={`ta-carousel-card${on && a === 0 ? ' is-on' : ''}`}
                    aria-label={`${p.label}${on ? ', in your world' : ''}`} aria-pressed={on} tabIndex={a === 0 ? 0 : -1}
                    style={{
                      transform: `translateX(${off * CAROUSEL_STEP + pdx}px) scale(${a === 0 ? 1 : 0.8})`,
                      opacity: a === 0 ? 1 : a === 1 ? 0.5 : 0, zIndex: 10 - a,
                      pointerEvents: a <= 1 ? 'auto' : 'none', transition: pDragging ? 'none' : undefined,
                    }}
                    onClick={() => {
                      if (pMoved.current) { pMoved.current = false; return; }
                      if (off === 0) togglePassion(p.id); else setFocus(i);
                    }}
                  >
                    <Photo tone={p.tone} light={p.light} src={img(`passion:${p.id}`)} credit={cred(`passion:${p.id}`)} brief={hideShotBriefs ? undefined : p.brief} />
                    {on && <span className="ta-check"><Check /></span>}
                  </button>
                );
              })}
            </div>
            <div className="ta-carousel-caption">
              <span className="ta-display ta-caption-title">{fp.label}</span>
              <span className="ta-muted">{fp.desc}</span>
            </div>
            <div className="ta-carousel-controls">
              <button type="button" className="ta-icon-btn ta-icon-btn-lg" aria-label="Previous" onClick={() => moveFocus(-1)} disabled={focus === 0}><Chevron dir="left" /></button>
              <button type="button" className={`ta-pill${fOn ? ' is-on' : ''}`} aria-pressed={fOn} onClick={() => togglePassion(fp.id)}>
                {fOn ? 'In your world' : 'Add to my world'}
              </button>
              <button type="button" className="ta-icon-btn ta-icon-btn-lg" aria-label="Next" onClick={() => moveFocus(1)} disabled={focus === PASSIONS.length - 1}><Chevron dir="right" /></button>
            </div>
            <div className="ta-pad ta-push-bottom">
              <button type="button" className="ta-cta" onClick={() => setScreen('houses')}>{passions.length ? 'Continue' : 'Skip this one'}</button>
            </div>
          </section>
        );
      })()}

      {screen === 'houses' && (
        <section className="ta-screen">
          <div className="ta-scroll ta-pad ta-stack-10">
            <div className="ta-stack-6 ta-mb-4">
              <h2 className="ta-display ta-h2">Where have you felt most at home?</h2>
              <span className="ta-muted">Tap the houses you’ve loved. The first you tap counts most.</span>
            </div>
            {[0, 1, 2, 3].map((k) => {
              const [big, s1, s2] = HOUSES.slice(k * 3, k * 3 + 3);
              return (
                <div key={k} className={`ta-bento${k % 2 ? ' is-mirrored' : ''}`}>
                  <div className="ta-bento-big"><HouseTile house={big} big rank={ranked.indexOf(big.id)} onTap={toggleHouse} src={img(`house:${big.id}`)} credit={cred(`house:${big.id}`)} hideBrief={hideShotBriefs} /></div>
                  <div className="ta-bento-small">
                    <HouseTile house={s1} rank={ranked.indexOf(s1.id)} onTap={toggleHouse} src={img(`house:${s1.id}`)} credit={cred(`house:${s1.id}`)} hideBrief={hideShotBriefs} />
                    <HouseTile house={s2} rank={ranked.indexOf(s2.id)} onTap={toggleHouse} src={img(`house:${s2.id}`)} credit={cred(`house:${s2.id}`)} hideBrief={hideShotBriefs} />
                  </div>
                </div>
              );
            })}
            <button
              type="button" className={`ta-outline-btn${noHouse ? ' is-on' : ''}`} aria-pressed={noHouse}
              onClick={() => { setNoHouse((v) => !v); setRanked([]); }}
            >
              No preferred house. Recommend the finest for each destination.
            </button>
          </div>
          <footer className="ta-footer">
            <button type="button" className="ta-cta" onClick={startPlaces}>
              {ranked.length ? `Continue with ${ranked.length} ${ranked.length === 1 ? 'house' : 'houses'}` : 'Continue'}
            </button>
          </footer>
        </section>
      )}

      {screen === 'places' && (() => {
        const cardId = deck[Math.min(idx, deck.length - 1)];
        const isSurprise = cardId === 'surprise';
        const place = isSurprise ? null : PLACES.find((p) => p.id === cardId)!;
        const title = place ? place.title : SURPRISE.title;
        const where = place ? place.place : SURPRISE.place;
        return (
          <section className="ta-screen ta-pad ta-stack-14 ta-places">
            <div className="ta-row-between">
              <h2 className="ta-display ta-h2-sm">Where would you go?</h2>
              <span className="ta-muted ta-small">{idx >= deck.length ? 'Done' : `${idx + 1} of ${deck.length}`}</span>
            </div>
            <div className="ta-deck">
              <div className="ta-deck-shadow ta-deck-shadow-2" />
              <div className="ta-deck-shadow ta-deck-shadow-1" />
              <div
                className={`ta-card${isSurprise ? ' is-surprise' : ''}`} role="group" tabIndex={0}
                aria-label={`${title}, ${where}. Right arrow for I’d go, left arrow for not for me.`}
                onKeyDown={onCardKey}
                onPointerDown={onCardDown} onPointerMove={onCardMove} onPointerUp={onCardUp} onPointerCancel={onCardUp}
                style={{ transform: `translateX(${dx}px) rotate(${(dx / 20).toFixed(2)}deg)`, transition: dragging ? 'none' : undefined }}
              >
                {place
                  ? <Photo tone={place.tone} light={place.light} src={img(`place:${place.id}`)} credit={cred(`place:${place.id}`)} brief={hideShotBriefs ? undefined : place.brief} alt={title} />
                  : <div className="ta-surprise-mark"><div><div><span className="ta-display ta-italic">?</span></div></div></div>}
                <div className="ta-scrim" />
                <div className="ta-card-text">
                  <span className="ta-card-where">{where}</span>
                  <span className="ta-display ta-card-title">{title}</span>
                </div>
                {dx > 30 && <span className="ta-stamp ta-stamp-yes">I’d go</span>}
                {dx < -30 && <span className="ta-stamp ta-stamp-no">Not for me</span>}
              </div>
            </div>
            <div className="ta-swipe-controls">
              <button type="button" className="ta-round ta-round-ghost" aria-label="Not for me" onClick={() => swipe('no')}><Cross /></button>
              <button type="button" className="ta-round ta-round-solid" aria-label="I’d go" onClick={() => swipe('yes')}><Check /></button>
            </div>
          </section>
        );
      })()}

      {screen === 'signature' && (() => {
        const isPlace = (c: DeckCard): c is PlaceId => c !== 'surprise';
        const placeYes = yes.filter(isPlace);
        const collage = [...placeYes, ...deck.filter(isPlace).filter((c) => !placeYes.includes(c))].slice(0, 3);
        const words = passions.map((id) => PASSIONS.find((p) => p.id === id)!.label);
        const houseNames = ranked.map((id) => HOUSES.find((h) => h.id === id)!.name);
        return (
          <section className="ta-screen ta-scroll">
            <div className="ta-collage">
              {collage.map((id) => {
                const p = PLACES.find((x) => x.id === id)!;
                return <div key={id}><Photo tone={p.tone} light={p.light} src={img(`place:${p.id}`)} credit={cred(`place:${p.id}`)} /></div>;
              })}
            </div>
            <div className="ta-signature">
              <div className="ta-stack-8 ta-signature-head">
                <span className="ta-accent ta-small">Your travel signature</span>
                <span className="ta-display ta-signature-line">{words.length ? `${words.slice(0, 3).join(', ')}.` : 'Open to everything.'}</span>
              </div>
              <dl className="ta-facts">
                <Fact k="Drawn to">{placeYes.length ? placeYes.map((id) => PLACES.find((p) => p.id === id)!.place).join(', ') : 'Still to discover'}</Fact>
                <Fact k="Houses">{noHouse ? 'The finest for each destination' : houseNames.length ? houseNames.join(', then ') : 'No preference yet'}</Fact>
                <Fact k="Something new">{yes.includes('surprise') ? 'Yes, surprise me now and then' : no.includes('surprise') ? 'Keep to places I’d choose' : 'Not answered'}</Fact>
              </dl>
              <div className="ta-stack-10">
                {submitError && <span role="alert" className="ta-error">{submitError}</span>}
                <button type="button" className="ta-cta" onClick={() => void finish()} disabled={submitting}>{submitting ? 'Saving…' : 'Meet Tara'}</button>
                <button type="button" className="ta-text-btn ta-center" onClick={() => setScreen('passions')}>Refine my choices</button>
              </div>
            </div>
          </section>
        );
      })()}
    </div>
  );
}

function HouseTile({ house, big = false, rank, onTap, src, credit, hideBrief }: {
  house: (typeof HOUSES)[number]; big?: boolean; rank: number; onTap: (id: HouseId) => void; src?: string; credit?: string; hideBrief: boolean;
}) {
  const on = rank >= 0;
  return (
    <button
      type="button" className={`ta-house${on ? ' is-on' : ''}${big ? ' is-big' : ''}`}
      aria-pressed={on} aria-label={`${house.name}${on ? `, choice ${rank + 1}` : ''}`} onClick={() => onTap(house.id)}
    >
      <Photo tone={house.tone} light={house.light} src={src} credit={credit} brief={hideBrief ? undefined : house.brief} />
      <div className="ta-scrim" />
      <div className="ta-house-text">
        <span className="ta-display ta-house-name">{house.name}</span>
        <span className="ta-house-tags">{house.tags.join(', ')}</span>
      </div>
      {on && <span className="ta-rank">{rank + 1}</span>}
    </button>
  );
}

function Photo({ tone, light, src, brief, alt = '', credit }: { tone: string; light: string; src?: string; brief?: string; alt?: string; credit?: string }) {
  return (
    <>
      <span className="ta-photo-tone" style={{ background: tone }} />
      <span className="ta-photo-light" style={{ background: `radial-gradient(120% 80% at 70% 20%, ${light} 0%, transparent 60%)` }} />
      {src
        ? <img className="ta-photo-img" src={src} alt={alt} draggable={false} decoding="async" />
        : brief ? <span className="ta-photo-brief">Photo: {brief}</span> : null}
      {src && credit ? <span className="ta-credit">{credit}</span> : null}
    </>
  );
}

function Fact({ k, children }: { k: string; children: ReactNode }) {
  return <div className="ta-fact"><dt className="ta-muted ta-small">{k}</dt><dd>{children}</dd></div>;
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}
function Check() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}
function Cross() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default Onboarding;
