/** Lists behind the visa enquiry's pickers: what to offer as you type, and what to show before you do. */

export const NATIONALITIES = [
  'Indian', 'American', 'British', 'Canadian', 'Australian', 'New Zealander', 'Irish', 'Singaporean', 'Emirati', 'Saudi',
  'Qatari', 'Kuwaiti', 'Omani', 'Bahraini', 'Sri Lankan', 'Nepali', 'Bangladeshi', 'Pakistani', 'Bhutanese', 'Maldivian',
  'French', 'German', 'Italian', 'Spanish', 'Portuguese', 'Dutch', 'Belgian', 'Swiss', 'Austrian', 'Swedish',
  'Norwegian', 'Danish', 'Finnish', 'Greek', 'Polish', 'Czech', 'Turkish', 'Russian', 'Ukrainian', 'Israeli',
  'Egyptian', 'South African', 'Kenyan', 'Nigerian', 'Moroccan', 'Chinese', 'Japanese', 'South Korean', 'Thai', 'Malaysian',
  'Indonesian', 'Filipino', 'Vietnamese', 'Brazilian', 'Argentine', 'Mexican',
]
export const POPULAR_NATIONALITIES = ['Indian', 'American', 'British', 'Canadian', 'Australian', 'Singaporean', 'Emirati']

export const COUNTRIES = [
  'United Arab Emirates', 'United Kingdom', 'United States', 'Canada', 'Australia', 'New Zealand', 'Ireland', 'France', 'Italy', 'Spain',
  'Portugal', 'Germany', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Greece', 'Türkiye', 'Iceland', 'Norway',
  'Sweden', 'Denmark', 'Finland', 'Czech Republic', 'Hungary', 'Poland', 'Croatia', 'Malta', 'Russia', 'Schengen area',
  'Singapore', 'Thailand', 'Malaysia', 'Indonesia', 'Vietnam', 'Cambodia', 'Philippines', 'Japan', 'South Korea', 'China',
  'Hong Kong', 'Taiwan', 'Sri Lanka', 'Maldives', 'Nepal', 'Bhutan', 'Bangladesh', 'India', 'Qatar', 'Oman',
  'Saudi Arabia', 'Bahrain', 'Kuwait', 'Jordan', 'Israel', 'Egypt', 'Morocco', 'Kenya', 'Tanzania', 'South Africa',
  'Mauritius', 'Seychelles', 'Mexico', 'Brazil', 'Argentina', 'Peru', 'Cuba',
]
export const POPULAR_DESTINATIONS = ['United Arab Emirates', 'United Kingdom', 'United States', 'Schengen area', 'Singapore', 'Thailand', 'Japan', 'Australia']

export const EXTRA_CITIES = ['Pune', 'Ahmedabad', 'Chandigarh', 'Lucknow', 'Kochi', 'Goa', 'Jaipur', 'Surat', 'Dubai', 'London', 'Singapore', 'New York']
export const POPULAR_RESIDENCES = ['Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Dubai', 'London', 'Singapore']

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Prefix matches first, then anywhere in the name. */
export function suggest(all: string[], query: string, limit = 8): string[] {
  const q = norm(query)
  if (!q) return []
  const starts: string[] = []
  const within: string[] = []
  for (const item of all) {
    const n = norm(item)
    if (n.startsWith(q) || n.split(/[\s-]+/).some((w) => w.startsWith(q))) starts.push(item)
    else if (n.includes(q)) within.push(item)
  }
  return [...starts, ...within].slice(0, limit)
}
