import type { Choice, PlanBundle, TripPlan } from '@/lib/plan'
const option = (name: string, details: string, why: string): Choice => ({ name, details, why, tradeoff: 'Exact room, availability, inclusions and cancellation terms need checking.', price: 'Not checked · sample' })
const stay = (label: string, names: string[]) => ({ label, recommended: option(names[0], 'One room · proposed base, subject to availability', 'A proposed base for this part of the route.'), alternatives: names.slice(1).map(n => option(n, 'Same dates and occupancy · category to confirm', 'An alternative to compare against the proposed base.')) })
const flight = (label: string, depCity: string, arrCity: string) => ({ label, recommended: { ...option('SWISS · proposed', 'Business cabin requested · schedule to confirm', 'Compare the most convenient routing.'), flight: { depCity, arrCity, cabin: 'Business requested' } }, alternatives: ['Emirates', 'Lufthansa'].map(n => ({ ...option(`${n} · proposed`, 'Connections, cabin and fare need verification', 'Compare routing and the full fare conditions.'), flight: { depCity, arrCity, cabin: 'Business requested' } })) })
export const switzerlandPreview: PlanBundle & { plan: TripPlan } = {
 key: 'preview-switzerland', status: 'proposed', start: '2026-10-12', end: '2026-10-20',
 places: { hero: 'zurich', stays: ['zurich','lucerne','zermatt','zurich'], days: ['zurich','zurich','lucerne','lucerne','zermatt','zermatt','zermatt','zurich','zurich'] }, bookDue: [],
 plan: {
  kind: 'trip', id: 'preview-switzerland', title: 'Switzerland, curated for you', sub: '12–20 October 2026 · 1 traveller',
  lede: 'An eight-night route through Zurich, Lucerne and Zermatt, with scenic rail, mountain views and time to slow down. One proposed flight and hotel per leg, with alternatives to make it your own.',
  startDate: '2026-10-12', endDate: '2026-10-20', places: ['zurich','lucerne','zermatt','zurich'],
  shape: [{k:'Dates',v:'12–20 October 2026 · 8 nights'},{k:'Traveller',v:'1 · Business cabin requested'},{k:'Route',v:'Zurich → Lucerne → Zermatt → Zurich'},{k:'Priorities',v:'Scenic rail, fine dining, mountain views'}],
  stay: [], hotelOptions: [stay('Zurich · 12–14 October · 2 nights',['Widder Hotel','Baur au Lac','Storchen Zürich']),stay('Lucerne · 14–16 October · 2 nights',['Bürgenstock Resort','Mandarin Oriental Palace Luzern','Hotel Schweizerhof Luzern']),stay('Zermatt · 16–19 October · 3 nights',['Riffelalp Resort','The Omnia','Mont Cervin Palace']),stay('Zurich · 19–20 October · 1 night',['Widder Hotel','Baur au Lac','Storchen Zürich'])],
  flightOptions: [flight('Outbound · 12 October · Mumbai → Zurich','Mumbai','Zurich'),flight('Return · 20 October · Zurich → Mumbai','Zurich','Mumbai')],
  move: [{t:'Between cities',d:'Rail transfers are proposed. Timetables, operating dates and the final route need checking.'}],
  allowance: [{k:'Stays',v:'To be priced'},{k:'Flights',v:'To be priced'},{k:'Rail & extras',v:'To be priced'},{k:'Trip total',v:'Not quoted'}],
  days: [
   ['Arrive, settle in','Zurich','Arrive in Zurich, transfer to your hotel and leave the evening open.'],
   ['Zurich, unhurried','Zurich','Explore the Old Town and the lakeside, with time for a leisurely lunch.'],
   ['On to Lucerne','Lucerne','Travel to Lucerne and settle into your proposed hotel. Keep the afternoon flexible.'],
   ['Lake and mountains','Lucerne','A lake excursion or mountain outing, subject to seasonal operations and weather.'],
   ['Onward to Zermatt','Zermatt','Travel by rail to Zermatt and check in. Confirm transfer times before reserving.'],
   ['Matterhorn day','Zermatt','Consider the Gornergrat railway if conditions allow, followed by an easy afternoon.'],
   ['Zermatt, at your pace','Zermatt','A village walk, a long lunch and a deliberately open evening.'],
   ['Back to Zurich','Zurich','Return to Zurich for the final night, close enough for a calm departure tomorrow.'],
   ['Depart','Zurich','Transfer to the airport for your chosen return flight. Timing to be confirmed.'],
  ].map(([t,place,d],i)=>({t,place:place.toLowerCase(),d,date:`2026-10-${12+i}`})),
  bookOrder: [{t:'Confirm the dates and room preferences',d:'Agree the eight-night route and the room category for each stay.'},{t:'Check entry and transit requirements',d:'The advisor needs confirmed passport nationality and residence before advising on visa rules.'},{t:'Review the complete quote',d:'Check flights, rooms, rail, taxes, cancellation terms and inclusions before approving.'}],
  gate: {t:'Before money moves',b:'This is a design preview. No prices, availability, visa requirements or transport schedules have been verified.'}, gateLinks: [],
  decisions: [{t:'Choose your flights and stays',d:'Try the alternatives, then ask Tara to refine the route.'},{t:'Confirm the final quote',d:'The Desk will check exact availability and terms before any booking.'}],
  why:['Two nights each in Zurich and Lucerne, three in Zermatt and a final night in Zurich total eight nights.','The final Zurich stay keeps departure day simpler.'],
  asof:'Illustrative design preview. Sample dates and proposed properties; nothing is booked, held or paid.',
 }
}
