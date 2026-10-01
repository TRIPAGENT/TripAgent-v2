import type { Choice, PlanBundle, TripPlan } from '@/lib/plan'

const choice = (name: string, details: string, why: string, tradeoff: string): Choice => ({ name, details, why, tradeoff, price: 'Not checked' })

/** Illustrative content for reviewing the customer renderer, never a live offer. */
export const londonPreview: PlanBundle & { plan: TripPlan } = {
  key: 'preview-london-five-nights', status: 'proposed', start: '2026-11-07', end: '2026-11-12',
  places: { hero: 'london', stays: ['london'], days: Array(6).fill('london') }, bookDue: [],
  plan: {
    kind: 'trip', id: 'preview-london-five-nights', title: 'London, at your pace',
    sub: '7–12 November 2026 · 5 nights · two travellers',
    lede: 'A London escape built around long lunches, art-filled afternoons and evenings worth dressing for. One base, a little discovery each day, and room to change your mind.',
    startDate: '2026-11-07', endDate: '2026-11-12', places: ['london'],
    shape: [{ k: 'Travellers', v: 'Two adults · one room' }, { k: 'Departure', v: 'Bengaluru' }, { k: 'Time away', v: '6 days · 5 nights' }, { k: 'Your rhythm', v: 'Art, food and unhurried afternoons' }],
    shapeNote: { t: 'Made around you', b: 'One meaningful anchor each day. The rest is yours to discover.' },
    hotelOptions: [{
      label: 'London · 7–12 November · 5 nights',
      recommended: choice('The Connaught · illustrative option', 'One room for two · category, breakfast and terms to confirm', 'The proposed base for a trip centred on Mayfair and time together.', 'The Desk needs to compare room categories and the full five-night quote.'),
      alternatives: [
        choice('Claridge’s · illustrative option', 'Same dates and occupancy · room and terms to confirm', 'An alternative to compare if the hotel itself is a highlight of the trip.', 'Choose after reviewing the exact room and total price.'),
        choice('The Beaumont · illustrative option', 'Same dates and occupancy · room and terms to confirm', 'A third option for the same city stay, with a different hotel character.', 'Availability, inclusions and cancellation terms remain unchecked.'),
      ],
    }],
    stay: [],
    flightOptions: [{
      label: 'Bengaluru ↔ London · return for two',
      recommended: choice('Nonstop business · proposed routing', '7–12 November · airline, schedule and fare to confirm', 'Start by comparing a direct journey to keep the travel day simple.', 'A convenient schedule may cost more; no fare has been checked.'),
      alternatives: [
        choice('Via Dubai · proposed routing', 'Business cabin requested · connection and airline to confirm', 'Compare a one-stop option if it improves the overall quote.', 'Adds a connection; total travel time still needs checking.'),
        choice('Via Doha · proposed routing', 'Business cabin requested · connection and airline to confirm', 'A second connecting route to compare on the same dates.', 'Exact cabin, timings and baggage terms depend on the selected fare.'),
      ],
    }],
    move: [{ t: 'A calm arrival', d: 'Ask the Desk to price a private airport transfer both ways, with pickup timed to the selected flights.' }],
    allowance: [{ k: 'Flights for two', v: 'Awaiting the Desk’s quote' }, { k: 'Five hotel nights', v: 'Awaiting the Desk’s quote' }, { k: 'Experiences & transfers', v: 'Choose first, then price' }, { k: 'Trip total', v: 'Quote on request' }],
    days: [
      { date: '2026-11-07', place: 'london', t: 'Arrive, exhale', d: 'Afternoon: a private transfer to your proposed hotel, with check-in subject to the final flight and room arrangements. Evening: a gentle neighbourhood stroll and an easy dinner. Leave the first night open.' },
      { date: '2026-11-08', place: 'london', t: 'Mayfair, slowly', d: 'Morning: breakfast without a deadline, then galleries and the streets around your hotel. Afternoon: a long lunch and time to browse. Evening: ask Tara to shortlist a memorable dinner around your tastes.' },
      { date: '2026-11-09', place: 'london', t: 'Art and a table worth keeping', d: 'Morning: choose a museum or exhibition around what you love; opening times and tickets need checking. Afternoon: time back at the hotel. Evening: a proposed special dinner, with venue and availability for the Desk to confirm.' },
      { date: '2026-11-10', place: 'london', t: 'Across the river', d: 'Morning: a leisurely riverside walk, weather permitting. Afternoon: explore a neighbourhood market or independent shops after checking opening days. Evening: a theatre performance if the programme and seats suit you.' },
      { date: '2026-11-11', place: 'london', t: 'A day that belongs to you', d: 'Morning: return to a favourite street, or ask for a private guide. Afternoon: leave space for shopping, a spa appointment or doing very little. Evening: your final dinner, chosen after the first few days tell us what you enjoy.' },
      { date: '2026-11-12', place: 'london', t: 'Until next time', d: 'Morning: breakfast and packing at an easy pace. Transfer to the airport with timing confirmed against your booked flight. The final day stays flexible until the schedule is settled.' },
    ],
    daysNote: { t: 'Room to move', b: 'This is a proposed sequence. Tara can adjust the pace before the Desk checks bookings.' },
    bookOrder: [{ t: 'Choose the hotel and flight approach', d: 'Compare the alternatives, then send your preferences for a quote.' }, { t: 'Review the complete quote', d: 'The Desk confirms availability, inclusions, payment and cancellation terms.' }, { t: 'Add the moments that matter', d: 'Confirm dining, tickets, guides and transfers around the booked journey.' }],
    gate: { t: 'Before anything is booked', b: 'Confirm your dates, departure city and passport details with the Desk. Entry requirements and availability have not been checked for this example.' },
    gateLinks: [], visa: { status: 'to-check', note: 'The Desk needs nationality and current travel documents before checking the applicable entry requirements.' },
    bookingActions: [{ title: 'Your hotel preference', points: ['Keep the proposed base or compare the two alternatives.'], status: 'your-choice' }, { title: 'Your flight preference', points: ['Prioritise a direct route, or compare connections on total price.'], status: 'your-choice' }, { title: 'The complete quote', points: ['The Desk checks dates, inventory, inclusions and terms before asking you to commit.'], status: 'with-advisor' }],
    decisions: [], why: ['One base keeps packing and transfers to a minimum.', 'The proposed days leave time to enjoy the hotel and change plans.', 'Flight and hotel alternatives use the same dates and party size.'],
    asof: 'Design preview · illustrative itinerary, not researched availability or a bookable offer.',
  },
}
