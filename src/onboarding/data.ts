/**
 * Onboarding content. Copy, tones and shot briefs live here so product can
 * edit them without touching the component.
 *
 * `tone` / `light` are the placeholder colours a slot shows until its real
 * photograph is supplied through the `images` prop.
 */

export type PassionId =
  | 'food' | 'adrenaline' | 'nightlife' | 'wellness'
  | 'art' | 'shopping' | 'sport' | 'slow';

export type HouseId =
  | 'aman' | 'chevalblanc' | 'fourseasons' | 'rosewood' | 'belmond' | 'sixsenses'
  | 'soneva' | 'oberoi' | 'taj' | 'mandarin' | 'raffles' | 'bulgari';

export type PlaceTag = PassionId | 'wildlife';

export type PlaceId =
  | 'maldives' | 'amalfi' | 'kyoto' | 'heliski' | 'nyc' | 'dubai' | 'mara'
  | 'ranthambore' | 'antarctica' | 'iceland' | 'alula' | 'udaipur' | 'bhutan'
  | 'tuscany' | 'stmoritz' | 'riviera' | 'borabora' | 'tokyo' | 'fjords'
  | 'rwanda' | 'paris' | 'milan' | 'mykonos' | 'standrews' | 'seychelles'
  | 'patagonia' | 'galapagos';

export interface Passion {
  id: PassionId;
  label: string;
  desc: string;
  tone: string;
  light: string;
  brief: string;
}

export interface House {
  id: HouseId;
  name: string;
  /** TripAgent's own judgement of the house's character. Used to find kindred stays where the house is absent. */
  tags: string[];
  tone: string;
  light: string;
  brief: string;
}

export interface Place {
  id: PlaceId;
  title: string;
  place: string;
  tags: PlaceTag[];
  tone: string;
  light: string;
  brief: string;
}

export const PASSIONS: Passion[] = [
  { id: 'food', label: 'Food & wine', desc: 'Chef’s counters, private chefs, great cellars.', tone: '#2A1C14', light: '#D99B5E', brief: 'chef’s hands plating at an intimate counter' },
  { id: 'adrenaline', label: 'Adrenaline', desc: 'Heli-skiing, deep dives, the edge of the map.', tone: '#2F3B4C', light: '#F1F4F7', brief: 'heli-skier mid-turn in deep powder' },
  { id: 'nightlife', label: 'Dancing till late', desc: 'Dinners that turn into much later nights.', tone: '#24142E', light: '#E86E95', brief: 'candle-lit supper club, dancers in soft focus' },
  { id: 'wellness', label: 'Wellness', desc: 'Sunrise yoga, long treatments, sleep that resets.', tone: '#2F4A42', light: '#D6E8DC', brief: 'treatment room open to a forest at dawn' },
  { id: 'art', label: 'Art & culture', desc: 'Galleries after hours, opera, private collections.', tone: '#3A2C3E', light: '#E3C9A8', brief: 'empty gallery, a single sculpture, evening light' },
  { id: 'shopping', label: 'Ateliers & maisons', desc: 'Couture fittings, watchmakers, private salons.', tone: '#2B2430', light: '#D8C3A5', brief: 'private fitting in a couture salon' },
  { id: 'sport', label: 'The sporting life', desc: 'Grand Prix weekends, Centre Court, the 18th green.', tone: '#1F3A2C', light: '#CFE3B8', brief: 'golfer on a clifftop green at golden hour' },
  { id: 'slow', label: 'Doing nothing, beautifully', desc: 'A lounger, a book, nowhere to be.', tone: '#22545A', light: '#BFE4E0', brief: 'a single lounger by an empty infinity pool' },
];

/** Order matters: the grid lays these out in four mirrored blocks of three, the first of each block as the tall tile. */
export const HOUSES: House[] = [
  { id: 'aman', name: 'Aman', tags: ['Secluded', 'Minimal', 'Architectural'], tone: '#6F5F4C', light: '#E9DCC6', brief: 'stone pavilion and dark pool, utter calm' },
  { id: 'chevalblanc', name: 'Cheval Blanc', tags: ['Maison', 'Playful-chic', 'Island'], tone: '#2F4F6A', light: '#F2E9D8', brief: 'overwater pavilion with crafted detail' },
  { id: 'fourseasons', name: 'Four Seasons', tags: ['Polished', 'Effortless', 'Dependable'], tone: '#2E4A62', light: '#E3EDF5', brief: 'sweeping pool terrace at golden hour' },
  { id: 'rosewood', name: 'Rosewood', tags: ['Residential', 'Design-led', 'Sense of place'], tone: '#5E3F35', light: '#F1D6C6', brief: 'residence-style suite opening to landscape' },
  { id: 'belmond', name: 'Belmond', tags: ['Heritage', 'Romance', 'Journeys'], tone: '#4F2A2A', light: '#F3E1B8', brief: 'heritage train carriage or palazzo terrace' },
  { id: 'sixsenses', name: 'Six Senses', tags: ['Wellness', 'Barefoot', 'Eco-minded'], tone: '#3B6553', light: '#E1EFD9', brief: 'spa pavilion in a forest clearing' },
  { id: 'soneva', name: 'Soneva', tags: ['Barefoot', 'Island', 'Playful'], tone: '#3F8F98', light: '#F6EED8', brief: 'barefoot villa opening onto the lagoon' },
  { id: 'oberoi', name: 'The Oberoi', tags: ['Serene', 'Impeccable', 'Classic'], tone: '#454A40', light: '#EFEADF', brief: 'lakeside courtyard at dusk' },
  { id: 'taj', name: 'Taj', tags: ['Palaces', 'Heritage', 'Indian warmth'], tone: '#7F3426', light: '#F6D3A5', brief: 'palace terrace over a lake' },
  { id: 'mandarin', name: 'Mandarin Oriental', tags: ['Urban', 'Spa', 'Classic'], tone: '#38344E', light: '#E7E1F2', brief: 'city suite with skyline view' },
  { id: 'raffles', name: 'Raffles', tags: ['Grand', 'Butler service', 'Classic'], tone: '#5A5244', light: '#F2EBDD', brief: 'colonnaded verandah, white and brass' },
  { id: 'bulgari', name: 'Bulgari', tags: ['Jewel-box', 'Urban glamour', 'Italian design'], tone: '#2A2522', light: '#E2C79A', brief: 'black-marble pool in warm gold light' },
];

export const PLACES: Place[] = [
  { id: 'maldives', title: 'A villa on the reef', place: 'Maldives', tags: ['slow', 'wellness'], tone: '#1F5E68', light: '#A9E0DF', brief: 'aerial of a lone overwater villa on a glassy lagoon at dawn' },
  { id: 'amalfi', title: 'Lemon terraces above the sea', place: 'Amalfi Coast', tags: ['food', 'slow'], tone: '#B5633D', light: '#F3D6A4', brief: 'cliffside terrace, lemon trees, late sun on the water' },
  { id: 'kyoto', title: 'An autumn ryokan', place: 'Kyoto', tags: ['art', 'wellness'], tone: '#6B2E1F', light: '#E7A15A', brief: 'private onsen, red maples, rising steam' },
  { id: 'heliski', title: 'First tracks by helicopter', place: 'British Columbia', tags: ['adrenaline', 'sport'], tone: '#3D5770', light: '#EAF2F8', brief: 'helicopter on a ridge above untouched powder' },
  { id: 'nyc', title: 'Manhattan at blue hour', place: 'New York', tags: ['nightlife', 'art', 'shopping'], tone: '#1B2238', light: '#6E86C9', brief: 'floor-to-ceiling suite window over Midtown at dusk' },
  { id: 'dubai', title: 'Above the clouds', place: 'Dubai', tags: ['shopping', 'nightlife'], tone: '#6F5A4A', light: '#F2C891', brief: 'towers piercing low cloud at sunrise' },
  { id: 'mara', title: 'The Great Migration', place: 'Masai Mara', tags: ['wildlife', 'adrenaline'], tone: '#7A5A2E', light: '#F0C27B', brief: 'herds crossing the river, a balloon overhead' },
  { id: 'ranthambore', title: 'A tiger by the old fort', place: 'Ranthambore', tags: ['wildlife'], tone: '#5B4A2A', light: '#E3B566', brief: 'tiger at a lake beneath ruined ramparts' },
  { id: 'antarctica', title: 'Into the white continent', place: 'Antarctica', tags: ['adrenaline'], tone: '#2B4A63', light: '#DCEBF5', brief: 'expedition ship among icebergs, penguins on the floe' },
  { id: 'iceland', title: 'Ice under the aurora', place: 'Iceland', tags: ['adrenaline', 'wellness'], tone: '#14243A', light: '#6FE0B7', brief: 'icebergs on black sand beneath green aurora' },
  { id: 'alula', title: 'A desert camp under stars', place: 'AlUla', tags: ['art', 'slow'], tone: '#2A1E30', light: '#E89A5B', brief: 'lantern-lit tents, sandstone, the Milky Way' },
  { id: 'udaipur', title: 'A palace on the lake', place: 'Udaipur', tags: ['art'], tone: '#3A2A4E', light: '#F2B37A', brief: 'lake palace lit at dusk, seen from a boat' },
  { id: 'bhutan', title: 'The monastery in the cliff', place: 'Bhutan', tags: ['wellness', 'art'], tone: '#3E4A44', light: '#D8DDD2', brief: 'cliff monastery emerging from mist' },
  { id: 'tuscany', title: 'A vineyard estate', place: 'Tuscany', tags: ['food', 'slow'], tone: '#6E5A2C', light: '#F5D38A', brief: 'cypress avenue to a stone villa at golden hour' },
  { id: 'stmoritz', title: 'An alpine winter', place: 'St. Moritz', tags: ['sport', 'food'], tone: '#2E2A2A', light: '#F0A35A', brief: 'fire-lit chalet, peaks outside the window' },
  { id: 'riviera', title: 'Summer at anchor', place: 'Côte d’Azur', tags: ['nightlife', 'sport'], tone: '#12406A', light: '#8FC8F0', brief: 'yacht at anchor off a cliffside town' },
  { id: 'borabora', title: 'Lagoon and peak', place: 'Bora Bora', tags: ['slow'], tone: '#0F6E7A', light: '#9FF0E6', brief: 'volcanic peak over a turquoise lagoon' },
  { id: 'tokyo', title: 'Eight seats, one chef', place: 'Tokyo', tags: ['food', 'shopping', 'nightlife'], tone: '#2A1D16', light: '#D9A06A', brief: 'omakase counter, chef mid-slice' },
  { id: 'fjords', title: 'Fjords by seaplane', place: 'Norway', tags: ['adrenaline'], tone: '#24404A', light: '#BFD9DC', brief: 'seaplane banking over a deep fjord' },
  { id: 'rwanda', title: 'An hour with gorillas', place: 'Rwanda', tags: ['wildlife', 'adrenaline'], tone: '#2C3A22', light: '#A8C08A', brief: 'silverback in misty bamboo forest' },
  { id: 'paris', title: 'A suite facing the tower', place: 'Paris', tags: ['shopping', 'art', 'food'], tone: '#3B3446', light: '#E9C29A', brief: 'balcony breakfast, Eiffel Tower at dawn' },
  { id: 'milan', title: 'An appointment on Via Montenapoleone', place: 'Milan', tags: ['shopping', 'art'], tone: '#3A2F28', light: '#E6CFA8', brief: 'private salon in a fashion house, evening light' },
  { id: 'mykonos', title: 'Nights that start at midnight', place: 'Mykonos', tags: ['nightlife'], tone: '#1E2E4A', light: '#F0C9A0', brief: 'whitewashed terrace above the harbour at night' },
  { id: 'standrews', title: 'A round at the home of golf', place: 'St Andrews', tags: ['sport'], tone: '#2E4636', light: '#E3E8D0', brief: 'the Old Course at first light, empty fairway' },
  { id: 'seychelles', title: 'An island to yourselves', place: 'Seychelles', tags: ['slow', 'wellness'], tone: '#2D6B6A', light: '#F1E3C2', brief: 'granite boulders and an empty white beach' },
  { id: 'patagonia', title: 'Granite towers', place: 'Patagonia', tags: ['adrenaline'], tone: '#3A4654', light: '#F0D7B5', brief: 'jagged peaks at sunrise from a lodge window' },
  { id: 'galapagos', title: 'Islands that time kept', place: 'Galápagos', tags: ['wildlife'], tone: '#1E5068', light: '#E8DCC0', brief: 'sea lion on a yacht’s swim platform' },
];

/** The last card every member sees. Not a place; it records openness to the unexpected. */
export const SURPRISE = {
  id: 'surprise' as const,
  title: 'Somewhere I’d never have picked',
  place: 'Something I haven’t tried',
};

/** Passions used to build a deck when the member skipped step 1. */
export const DEFAULT_PASSIONS: PassionId[] = ['slow', 'art', 'food', 'adrenaline', 'wellness'];

export const HERO = {
  tone: '#1F5E68',
  light: '#A9E0DF',
  brief: 'aerial of a lone villa on a reef at first light',
};

export const PASSION_IDS = PASSIONS.map((p) => p.id);
export const HOUSE_IDS = HOUSES.map((h) => h.id);
export const PLACE_IDS = PLACES.map((p) => p.id);
