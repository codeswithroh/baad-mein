// Small, boring readers that code does better than a 2B model: links, rupee amounts,
// who owes whom, and splitting "dahi, bread aur 2 maggi" into three things to buy.

export interface Link {
  url: string;
  site: string; // "YouTube", "Instagram", "article"…
}

const SITES: [RegExp, string][] = [
  [/youtu\.?be/, 'YouTube'],
  [/instagram\.com/, 'Instagram'],
  [/(twitter|x)\.com/, 'X'],
  [/linkedin\.com/, 'LinkedIn'],
  [/reddit\.com/, 'Reddit'],
  [/github\.com/, 'GitHub'],
  [/medium\.com|substack\.com|dev\.to|blog/, 'Article'],
  [/maps\.app\.goo\.gl|google\.[a-z.]+\/maps|goo\.gl\/maps/, 'Map'],
  [/amazon\.|amzn\.|flipkart\.|myntra\.|meesho\.|nykaa\./, 'Shop'],
  [/spotify\.com/, 'Spotify'],
  [/netflix\.com|primevideo|hotstar/, 'Watch'],
];

export function findLinks(text: string): Link[] {
  return [...text.matchAll(/\bhttps?:\/\/[^\s<>"')]+|\bwww\.[^\s<>"')]+/gi)].map((m) => {
    const url = m[0].replace(/[.,!?;:]+$/, '');
    const site = SITES.find(([re]) => re.test(url))?.[1] ?? 'Link';
    return { url: url.startsWith('http') ? url : `https://${url}`, site };
  });
}

/** True when a note is nothing but links (plus maybe an emoji or two). */
export function onlyLinks(text: string): boolean {
  return findLinks(text).length > 0 && text.replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, '').replace(/[\s\p{Extended_Pictographic}.,!?:;-]/gu, '').length === 0;
}

/** "₹1,200", "rs 500", "500 rupaye", "1.5k", "2k". Returns rupees, or null. */
export function parseAmount(text: string): number | null {
  const t = text.toLowerCase().replace(/,/g, '');
  const m =
    t.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)\s*(k)?\b/) ??
    t.match(/\b(\d+(?:\.\d+)?)\s*(k)?\s*(?:₹|rs\b|rupees?|rupaye|rupay|taka|taaka|bucks)/) ??
    t.match(/\b(\d+(?:\.\d+)?)(k)\b/) ??
    t.match(/\b(\d{2,6})\b/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] ? 1000 : 1);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type Direction = 'i_owe' | 'owes_me';

// Words that say which way the money goes. Hindi, Bengali and English.
const I_OWE = /\b(dena|dene|de\s?dena|lautana|lotana|wapas\s?karna|return|pay|owe|bhejna|bhej\s?dena|dite\s?hobe|dite\s?hbe|ferot\s?dite|dibo|debo|repay|transfer\s?to)\b/i;
const OWES_ME = /\b(lena|lene|se\s?lena|wapas\s?lena|maangna|mangna|collect|owes\s?me|nite\s?hobe|nite\s?hbe|ferot\s?nite|pabo|paabo|pending\s?from|due\s?from|se\s?paise|debe|dibe|dey\s?nai)\b/i;

/** Which way the money goes, from the words alone, or null if the note doesn't say. */
export function moneyDirection(text: string): Direction | null {
  const owe = I_OWE.test(text);
  const owed = OWES_ME.test(text);
  if (owe === owed) return null;
  return owe ? 'i_owe' : 'owes_me';
}

// Words that mean "and" between things to buy.
const JOINERS = /\s*(?:,|\+|&|\/|\n|;|\band\b|\baur\b|\bor\b|\bar\b|\bebong\b)\s*/i;
const BUY_WORDS = /^(buy|lena|le\s?aana|lana|kinte\s?hobe|kinbo|order|get|pick\s?up|grocery|groceries|sabzi|bazaar|bazar)\s*[:-]?\s*/i;

/** "buy dahi, bread aur 2 maggi" -> ["dahi", "bread", "2 maggi"] */
export function splitItems(quote: string): string[] {
  return quote
    .replace(BUY_WORDS, '')
    .replace(/\b(lena hai|lena|le aana|lana hai|lana|kinte hobe|kinbo|order karna|lete aana)\b/gi, '')
    .split(JOINERS)
    .map((s) => s.trim().replace(/^[-•*]\s*/, '').replace(/[.!]+$/, ''))
    .filter((s) => s.length > 1 && s.length < 40);
}

/** For merging the shopping list: "2 Maggi" and "maggi" are the same thing. */
export function itemKey(item: string): string {
  return item
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(kg|g|gm|l|ltr|litre|ml|pc|pcs|packet|packets|dozen|x)?\b/g, '')
    .replace(/[^a-zऀ-෿ ]/g, '')
    .replace(/s\b/, '')
    .trim();
}
