/** Airports the flight enquiry offers. A short list of the ones members actually fly; anything else can still be typed. */
export interface Airport {
  code: string
  city: string
  name: string
  country: string
  /** Shown first when nothing has been typed. */
  popular?: boolean
}

export const AIRPORTS: Airport[] = [
  // India
  { code: 'DEL', city: 'Delhi', name: 'Indira Gandhi International', country: 'India', popular: true },
  { code: 'BOM', city: 'Mumbai', name: 'Chhatrapati Shivaji Maharaj International', country: 'India', popular: true },
  { code: 'BLR', city: 'Bengaluru', name: 'Kempegowda International', country: 'India', popular: true },
  { code: 'MAA', city: 'Chennai', name: 'Chennai International', country: 'India' },
  { code: 'HYD', city: 'Hyderabad', name: 'Rajiv Gandhi International', country: 'India' },
  { code: 'CCU', city: 'Kolkata', name: 'Netaji Subhas Chandra Bose International', country: 'India' },
  { code: 'GOI', city: 'Goa', name: 'Manohar International', country: 'India' },
  { code: 'COK', city: 'Kochi', name: 'Cochin International', country: 'India' },
  { code: 'AMD', city: 'Ahmedabad', name: 'Sardar Vallabhbhai Patel International', country: 'India' },
  { code: 'PNQ', city: 'Pune', name: 'Pune Airport', country: 'India' },
  { code: 'JAI', city: 'Jaipur', name: 'Jaipur International', country: 'India' },
  { code: 'UDR', city: 'Udaipur', name: 'Maharana Pratap Airport', country: 'India' },
  // Middle East
  { code: 'DXB', city: 'Dubai', name: 'Dubai International', country: 'United Arab Emirates', popular: true },
  { code: 'AUH', city: 'Abu Dhabi', name: 'Zayed International', country: 'United Arab Emirates' },
  { code: 'DOH', city: 'Doha', name: 'Hamad International', country: 'Qatar', popular: true },
  { code: 'RUH', city: 'Riyadh', name: 'King Khalid International', country: 'Saudi Arabia' },
  { code: 'MCT', city: 'Muscat', name: 'Muscat International', country: 'Oman' },
  { code: 'TLV', city: 'Tel Aviv', name: 'Ben Gurion', country: 'Israel' },
  // Europe
  { code: 'LHR', city: 'London', name: 'Heathrow', country: 'United Kingdom', popular: true },
  { code: 'LGW', city: 'London', name: 'Gatwick', country: 'United Kingdom' },
  { code: 'CDG', city: 'Paris', name: 'Charles de Gaulle', country: 'France' },
  { code: 'NCE', city: 'Nice', name: 'Côte d\'Azur', country: 'France' },
  { code: 'FRA', city: 'Frankfurt', name: 'Frankfurt am Main', country: 'Germany' },
  { code: 'MUC', city: 'Munich', name: 'Munich Airport', country: 'Germany' },
  { code: 'AMS', city: 'Amsterdam', name: 'Schiphol', country: 'Netherlands' },
  { code: 'ZRH', city: 'Zurich', name: 'Zurich Airport', country: 'Switzerland' },
  { code: 'GVA', city: 'Geneva', name: 'Geneva Airport', country: 'Switzerland' },
  { code: 'FCO', city: 'Rome', name: 'Leonardo da Vinci–Fiumicino', country: 'Italy' },
  { code: 'MXP', city: 'Milan', name: 'Malpensa', country: 'Italy' },
  { code: 'VCE', city: 'Venice', name: 'Marco Polo', country: 'Italy' },
  { code: 'MAD', city: 'Madrid', name: 'Adolfo Suárez Madrid–Barajas', country: 'Spain' },
  { code: 'BCN', city: 'Barcelona', name: 'El Prat', country: 'Spain' },
  { code: 'LIS', city: 'Lisbon', name: 'Humberto Delgado', country: 'Portugal' },
  { code: 'ATH', city: 'Athens', name: 'Eleftherios Venizelos', country: 'Greece' },
  { code: 'JTR', city: 'Santorini', name: 'Santorini (Thira)', country: 'Greece' },
  { code: 'IST', city: 'Istanbul', name: 'Istanbul Airport', country: 'Türkiye' },
  { code: 'VIE', city: 'Vienna', name: 'Vienna International', country: 'Austria' },
  { code: 'CPH', city: 'Copenhagen', name: 'Copenhagen Airport', country: 'Denmark' },
  { code: 'DUB', city: 'Dublin', name: 'Dublin Airport', country: 'Ireland' },
  { code: 'KEF', city: 'Reykjavik', name: 'Keflavík International', country: 'Iceland' },
  // Asia & Pacific
  { code: 'SIN', city: 'Singapore', name: 'Changi', country: 'Singapore', popular: true },
  { code: 'BKK', city: 'Bangkok', name: 'Suvarnabhumi', country: 'Thailand' },
  { code: 'HKT', city: 'Phuket', name: 'Phuket International', country: 'Thailand' },
  { code: 'KUL', city: 'Kuala Lumpur', name: 'Kuala Lumpur International', country: 'Malaysia' },
  { code: 'DPS', city: 'Bali', name: 'Ngurah Rai International', country: 'Indonesia' },
  { code: 'MLE', city: 'Malé', name: 'Velana International', country: 'Maldives' },
  { code: 'CMB', city: 'Colombo', name: 'Bandaranaike International', country: 'Sri Lanka' },
  { code: 'KTM', city: 'Kathmandu', name: 'Tribhuvan International', country: 'Nepal' },
  { code: 'HKG', city: 'Hong Kong', name: 'Hong Kong International', country: 'Hong Kong' },
  { code: 'NRT', city: 'Tokyo', name: 'Narita', country: 'Japan' },
  { code: 'HND', city: 'Tokyo', name: 'Haneda', country: 'Japan' },
  { code: 'KIX', city: 'Osaka', name: 'Kansai International', country: 'Japan' },
  { code: 'ICN', city: 'Seoul', name: 'Incheon International', country: 'South Korea' },
  { code: 'SYD', city: 'Sydney', name: 'Kingsford Smith', country: 'Australia' },
  { code: 'MEL', city: 'Melbourne', name: 'Tullamarine', country: 'Australia' },
  { code: 'AKL', city: 'Auckland', name: 'Auckland Airport', country: 'New Zealand' },
  // Africa
  { code: 'CAI', city: 'Cairo', name: 'Cairo International', country: 'Egypt' },
  { code: 'CPT', city: 'Cape Town', name: 'Cape Town International', country: 'South Africa' },
  { code: 'JNB', city: 'Johannesburg', name: 'O. R. Tambo International', country: 'South Africa' },
  { code: 'NBO', city: 'Nairobi', name: 'Jomo Kenyatta International', country: 'Kenya' },
  { code: 'CMN', city: 'Casablanca', name: 'Mohammed V International', country: 'Morocco' },
  { code: 'RAK', city: 'Marrakech', name: 'Menara', country: 'Morocco' },
  // Americas
  { code: 'JFK', city: 'New York', name: 'John F. Kennedy International', country: 'United States', popular: true },
  { code: 'EWR', city: 'New York', name: 'Newark Liberty International', country: 'United States' },
  { code: 'LAX', city: 'Los Angeles', name: 'Los Angeles International', country: 'United States' },
  { code: 'SFO', city: 'San Francisco', name: 'San Francisco International', country: 'United States' },
  { code: 'ORD', city: 'Chicago', name: 'O\'Hare International', country: 'United States' },
  { code: 'MIA', city: 'Miami', name: 'Miami International', country: 'United States' },
  { code: 'YYZ', city: 'Toronto', name: 'Pearson International', country: 'Canada' },
  { code: 'YVR', city: 'Vancouver', name: 'Vancouver International', country: 'Canada' },
  { code: 'MEX', city: 'Mexico City', name: 'Benito Juárez International', country: 'Mexico' },
  { code: 'CUN', city: 'Cancún', name: 'Cancún International', country: 'Mexico' },
  { code: 'GRU', city: 'São Paulo', name: 'Guarulhos International', country: 'Brazil' },
  { code: 'EZE', city: 'Buenos Aires', name: 'Ezeiza International', country: 'Argentina' },
]

/** How an airport reads once chosen, e.g. "Mumbai (BOM)". */
export const airportLabel = (a: Airport) => `${a.city} (${a.code})`

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Matches by city, code, airport name or country; city and code matches rank first. */
export function searchAirports(query: string, limit = 8): Airport[] {
  const q = norm(query)
  if (!q) return []
  const scored: Array<[number, Airport]> = []
  for (const a of AIRPORTS) {
    const city = norm(a.city)
    const code = a.code.toLowerCase()
    let score = 0
    if (code === q) score = 100
    else if (city.startsWith(q)) score = 90
    else if (code.startsWith(q)) score = 80
    else if (norm(a.name).startsWith(q)) score = 60
    else if (city.includes(q) || norm(a.name).includes(q)) score = 40
    else if (norm(a.country).startsWith(q)) score = 30
    if (score) scored.push([score, a])
  }
  return scored.sort((x, y) => y[0] - x[0]).slice(0, limit).map(([, a]) => a)
}

const RECENT_KEY = 'tripagent:recent-airports'

export function recentAirports(): Airport[] {
  try {
    const codes = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
    return codes.map((c) => AIRPORTS.find((a) => a.code === c)).filter((a): a is Airport => !!a).slice(0, 4)
  } catch {
    return []
  }
}

export function rememberAirport(a: Airport) {
  try {
    const codes = (JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]).filter((c) => c !== a.code)
    localStorage.setItem(RECENT_KEY, JSON.stringify([a.code, ...codes].slice(0, 8)))
  } catch {
    /* storage unavailable: recents are a convenience only */
  }
}

export const popularAirports = () => AIRPORTS.filter((a) => a.popular)
