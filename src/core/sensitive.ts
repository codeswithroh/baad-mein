// Things that should not be sitting in a chat at all: OTPs, card numbers, Aadhaar, PAN,
// passwords and PINs. Found by plain code, with checksums where the number has one, so a
// phone number or an order ID doesn't get mistaken for a card. These notes are never sent
// to Gemma: they go straight to the "delete from your chat" list, masked.

export type SecretKind = 'otp' | 'card' | 'aadhaar' | 'pan' | 'password' | 'account';

export interface Secret {
  kind: SecretKind;
  masked: string; // what the card shows, e.g. "•••• 4821"
}

export const SECRET_LABEL: Record<SecretKind, string> = {
  otp: 'OTP',
  card: 'Card number',
  aadhaar: 'Aadhaar number',
  pan: 'PAN',
  password: 'Password or PIN',
  account: 'Bank account number',
};

/** Luhn check: every real card number passes it, random 16-digit numbers mostly don't. */
export function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

// Verhoeff check: the checksum UIDAI uses for the last digit of every Aadhaar number.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
export function verhoeff(digits: string): boolean {
  let c = 0;
  const rev = digits.split('').reverse().map(Number);
  for (let i = 0; i < rev.length; i++) c = D[c][P[i % 8][rev[i]]];
  return c === 0;
}

const last4 = (s: string) => '•••• ' + s.replace(/\D/g, '').slice(-4);

export function findSecrets(text: string): Secret[] {
  const found: Secret[] = [];
  const t = text.replace(/[  ]/g, ' ');

  // OTP: a short code next to the words that announce one.
  if (/\b(otp|one[\s-]?time\s?pass(word|code)?|verification code|security code|login code|code is)\b/i.test(t)) {
    const code = t.match(/\b\d{4,8}\b/);
    if (code) found.push({ kind: 'otp', masked: '••' + code[0].slice(-2) });
  }

  // Card: 13 to 19 digits, spaces or dashes allowed, must pass Luhn.
  for (const m of t.matchAll(/\b(?:\d[ -]?){13,19}\b/g)) {
    const d = m[0].replace(/\D/g, '');
    if (d.length >= 13 && d.length <= 19 && luhn(d) && !/^(\d)\1+$/.test(d)) found.push({ kind: 'card', masked: last4(d) });
  }

  // Aadhaar: 12 digits, never starting with 0 or 1, must pass Verhoeff.
  for (const m of t.matchAll(/\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g)) {
    const d = m[0].replace(/\D/g, '');
    if (verhoeff(d) && !found.some((f) => f.kind === 'card' && f.masked === last4(d))) found.push({ kind: 'aadhaar', masked: last4(d) });
  }

  // PAN: five letters, four digits, one letter. The fourth letter says who holds it (P for a person).
  for (const m of t.matchAll(/\b[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]\b/g)) {
    found.push({ kind: 'pan', masked: m[0].slice(0, 2) + '•••••' + m[0].slice(-3) });
  }

  // Passwords and PINs, when the note says so.
  const pw = t.match(/\b(password|passwd|pwd|pass ?code|wifi pass(?:word)?|login pass|m?pin|upi pin|atm pin|cvv)\b\s*(?:is|hai|:|=|-)?\s*(\S{3,})/i);
  if (pw && !/^(change|reset|bhool|forgot|update|yaad)/i.test(pw[2])) found.push({ kind: 'password', masked: pw[1] + ' ••••' });

  // Bank account: the words, then 9 to 18 digits.
  const acc = t.match(/\b(a\/c|acct?|account)\s*(?:no\.?|number|num)?\s*[:-]?\s*(\d{9,18})\b/i);
  if (acc) found.push({ kind: 'account', masked: last4(acc[2]) });

  return found;
}
