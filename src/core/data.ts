// Two made-up "chats with yourself", written to look like the real thing, with the right
// answer for every note. DEV is the only set the prompt was tuned on. HELDOUT was written
// alongside it and scored once the prompt was frozen; it is also the example in the app.
//
// Each row: [sent at, text, kind, extra]
//   todo  extra = due date "YYYY-MM-DD", or null when the note gives no day
//   money extra = "i_owe" | "owes_me"
//   buy   extra = how many separate items
//   secret extra = which secret

import { civil, type Message } from './whatsapp.ts';

export type GoldKind = 'todo' | 'buy' | 'money' | 'read' | 'keep' | 'done' | 'noise' | 'secret';
export type Row = [string, string, GoldKind, (string | number | null)?];

export const NOW = civil(2026, 10, 24, 7, 30); // Saturday morning, when the card is read
export const ME = 'Rohit';

export const DEV: Row[] = [
  ['2026-08-02 22:10', 'https://www.youtube.com/watch?v=8pTEmbeENF4', 'read'],
  ['2026-08-03 09:12', 'buy: atta 5kg, toor dal, Surf excel', 'buy', 3],
  ['2026-08-05 13:40', 'Car insurance renew karna hai 20th se pehle', 'todo', '2026-08-20'],
  ['2026-08-05 13:41', 'policy no 2311/4588/221', 'keep'],
  ['2026-08-09 23:02', 'idea: app that reminds you to drink water but in your mom\'s voice', 'keep'],
  ['2026-08-11 08:30', 'Your OTP for login is 482913. Do not share it with anyone.', 'secret', 'otp'],
  ['2026-08-14 19:20', 'Ankit ko 1200 dena hai dinner ka', 'money', 'i_owe'],
  ['2026-08-15 10:05', 'test', 'noise'],
  ['2026-08-18 21:30', 'renewed car insurance ✅', 'done'],
  ['2026-08-22 11:11', 'Dr. Sen clinic 033 2465 1180, Mon-Sat 5-8pm', 'keep'],
  ['2026-08-30 16:45', 'book to read: The Psychology of Money', 'read'],
  ['2026-09-02 09:00', 'call landlord about geyser kal subah', 'todo', '2026-09-03'],
  ['2026-09-04 18:22', 'shoe size UK 9, kurta size 40', 'keep'],
  ['2026-09-07 20:15', 'Priya se 750 lena hai movie tickets ka', 'money', 'owes_me'],
  ['2026-09-10 12:00', 'https://medium.com/@someone/how-to-negotiate-salary-3f2a1', 'read'],
  ['2026-09-12 07:50', 'milk bread eggs', 'buy', 3],
  ['2026-09-15 22:40', 'wifi password is Pune@2026home', 'secret', 'password'],
  ['2026-09-16 14:30', 'submit reimbursement form by friday', 'todo', '2026-09-18'],
  ['2026-09-20 10:10', '😂😂', 'noise'],
  ['2026-09-22 17:00', 'Maa er jonno blood pressure er osudh kinte hobe', 'buy', 1],
  ['2026-09-25 09:45', 'Gas cylinder booking number 7718955555', 'keep'],
  ['2026-09-28 21:00', 'watch Panchayat S4', 'read'],
  ['2026-10-01 08:15', 'PAN AQZPP4821K', 'secret', 'pan'],
  ['2026-10-02 19:30', 'electricity bill 12 tarikh tak bharna hai', 'todo', '2026-10-12'],
  ['2026-10-03 11:20', 'Babai ke 3000 ferot dite hobe', 'money', 'i_owe'],
  ['2026-10-05 22:00', 'gym done 💪', 'done'],
  ['2026-10-08 13:13', 'onions tomato coriander', 'buy', 3],
  ['2026-10-09 18:00', 'electricity bill paid', 'done'],
  ['2026-10-11 10:30', 'https://maps.app.goo.gl/x8KqT2 new biryani place', 'keep'],
  ['2026-10-13 20:45', 'remind Neha about Diwali gift budget', 'todo', null],
  ['2026-10-15 09:00', 'passport renewal appointment 28 oct 10am', 'todo', '2026-10-28'],
  ['2026-10-16 12:40', 'hmm', 'noise'],
  ['2026-10-20 17:25', 'Sunday ko car wash', 'todo', '2026-10-25'],
  ['2026-10-19 08:05', 'Kunal owes me 2k for Goa stay', 'money', 'owes_me'],
  ['2026-10-20 21:10', 'https://www.instagram.com/reel/C9xYz', 'read'],
  ['2026-10-21 19:00', 'Dhaniya, adrak, nimbu lena', 'buy', 3],
  ['2026-10-22 23:15', 'parso dentist 6 baje', 'todo', '2026-10-24'],
  ['2026-10-23 07:40', 'card 4111 1111 1111 1111 exp 09/29', 'secret', 'card'],
  ['2026-10-23 13:00', 'quote: "Nothing is so urgent that it can\'t wait till you\'re rested"', 'keep'],
  ['2026-10-23 22:30', 'kal laundry dena hai', 'todo', '2026-10-24'],
];

export const HELDOUT: Row[] = [
  ['2026-05-28 21:40', 'https://www.youtube.com/watch?v=arj7oStGLkU', 'read'],
  ['2026-06-02 08:10', 'LIC premium 15 june tak', 'todo', '2026-06-15'],
  ['2026-06-03 19:20', 'buy: shampoo, toothpaste, razor blades', 'buy', 3],
  ['2026-06-06 22:05', 'https://paulgraham.com/greatwork.html', 'read'],
  ['2026-06-09 11:30', 'Sourav da er number 98300 41275', 'keep'],
  ['2026-06-12 18:45', 'Meera ko 450 dena hai cab ka', 'money', 'i_owe'],
  ['2026-06-14 10:00', 'paid LIC premium', 'done'],
  ['2026-06-18 23:55', 'idea: reading list that deletes links you never opened', 'keep'],
  ['2026-06-21 09:15', 'ok', 'noise'],
  ['2026-06-25 14:00', 'https://www.linkedin.com/posts/system-design-notes-123', 'read'],
  ['2026-06-29 20:20', 'fix bathroom tap leak', 'todo', null],
  ['2026-07-03 07:30', 'Aadhaar 2345 6789 0124', 'secret', 'aadhaar'],
  ['2026-07-05 12:10', 'Grandma\'s aloo posto: posto bata, 2 green chilli, mustard oil at the end', 'keep'],
  ['2026-07-08 17:55', 'mango, curd, poha', 'buy', 3],
  ['2026-07-11 21:30', 'watch Oppenheimer again', 'read'],
  ['2026-07-14 09:40', 'renew gym membership by 31st', 'todo', '2026-07-31'],
  ['2026-07-16 22:10', 'https://x.com/naval/status/1002103360646823936', 'read'],
  ['2026-07-19 13:25', 'Office address: 3rd floor, Embassy Tech Square, Kadubeesanahalli', 'keep'],
  ['2026-07-22 18:00', 'Rahul se 1500 lena hai concert ka', 'money', 'owes_me'],
  ['2026-07-25 08:45', 'Your verification code is 771204', 'secret', 'otp'],
  ['2026-07-28 20:30', 'gym membership renewed', 'done'],
  ['2026-08-01 10:15', 'buy birthday gift for Didi', 'buy', 1],
  ['2026-08-03 19:40', 'book: Atomic Habits', 'read'],
  ['2026-08-06 07:55', 'kal 9 baje bank jaana hai KYC ke liye', 'todo', '2026-08-07'],
  ['2026-08-09 16:30', '🙏', 'noise'],
  ['2026-08-12 21:05', 'https://dev.to/some-author/building-a-local-first-app-4kd2', 'read'],
  ['2026-08-15 11:00', 'Ma bolche narkel tel ar mishti anbe', 'buy', 2],
  ['2026-08-18 09:20', 'pay credit card bill 22nd', 'todo', '2026-08-22'],
  ['2026-08-20 18:15', 'credit card bill paid', 'done'],
  ['2026-08-23 22:45', 'ideas for Didi\'s wedding speech: the cycle story, the exam night', 'keep'],
  ['2026-08-26 13:00', 'https://www.instagram.com/reel/DAbc12xyz', 'read'],
  ['2026-08-29 08:30', 'Arjun ko uske 2000 wapas karna hai', 'money', 'i_owe'],
  ['2026-09-01 19:10', 'detergent, dishwash bar, garbage bags', 'buy', 3],
  ['2026-09-03 10:45', 'Netbanking pwd Rohit#4471', 'secret', 'password'],
  ['2026-09-05 15:20', 'call plumber', 'todo', null],
  ['2026-09-07 21:50', 'watch the Kota Factory finale', 'read'],
  ['2026-09-10 08:05', 'parcel pick up from Blue Dart, AWB 78121904', 'todo', null],
  ['2026-09-12 12:30', 'Didi theke 600 nite hobe for Puja shopping', 'money', 'owes_me'],
  ['2026-09-14 19:00', 'testing 123', 'noise'],
  ['2026-09-16 07:20', 'https://medium.com/@writer/the-art-of-doing-nothing-8812ab', 'read'],
  ['2026-09-18 22:35', 'Laptop warranty ends 3 Dec, invoice in Gmail', 'keep'],
  ['2026-09-20 11:50', 'atta, besan, sugar, chai patti', 'buy', 4],
  ['2026-09-22 18:40', 'bike service next sunday', 'todo', '2026-09-27'],
  ['2026-09-24 09:00', 'A/c no 50100234567891 IFSC HDFC0001234', 'secret', 'account'],
  ['2026-09-26 20:15', 'https://youtu.be/Jx8fdC1oQ7c', 'read'],
  ['2026-09-28 13:35', 'doctor said: vitamin D 60k weekly for 8 weeks', 'keep'],
  ['2026-09-30 08:25', 'bike serviced', 'done'],
  ['2026-10-01 21:00', 'Pujo plans: Saturday Maddox Square, Sunday Bagbazar', 'keep'],
  ['2026-10-02 17:10', 'apples bananas', 'buy', 2],
  ['2026-10-03 10:30', 'submit tax proof to HR by 15 oct', 'todo', '2026-10-15'],
  ['2026-10-04 22:20', 'lol', 'noise'],
  ['2026-10-05 09:45', 'Vikram owes me 3500 for the trip', 'money', 'owes_me'],
  ['2026-10-06 19:55', 'https://www.reddit.com/r/IndiaInvestments/comments/abc123/', 'read'],
  ['2026-10-07 12:15', 'Mom\'s cataract follow up 20 oct 11am, Dr. Bose', 'todo', '2026-10-20'],
  ['2026-10-08 08:40', 'tax proof submitted ✅', 'done'],
  ['2026-10-09 21:30', 'Diwali: lights, diyas, rangoli colours', 'buy', 3],
  ['2026-10-10 14:00', 'new fridge options https://www.amazon.in/dp/B0CXYZ1234', 'read'],
  ['2026-10-11 18:20', 'book Rajdhani tickets for Kolkata trip', 'todo', null],
  ['2026-10-12 07:35', 'Use OTP 3391 to verify your Swiggy account', 'secret', 'otp'],
  ['2026-10-13 22:00', 'call Dadu on his birthday 17th', 'todo', '2026-10-17'],
  ['2026-10-14 10:10', 'Priya ko 900 bhejna hai cake ka', 'money', 'i_owe'],
  ['2026-10-14 19:45', 'paneer, capsicum, onion', 'buy', 3],
  ['2026-10-15 08:00', 'https://substack.com/@slowproductivity/p/doing-less', 'read'],
  ['2026-10-15 21:15', 'car PUC expires end of month, renew', 'todo', null],
  ['2026-10-16 12:30', 'Rajdhani tickets booked, PNR 2457810396', 'done'],
  ['2026-10-16 23:40', '...', 'noise'],
  ['2026-10-17 09:20', 'called Dadu on his birthday 🎂', 'done'],
  ['2026-10-19 07:40', 'Saturday ko gaadi dhulwani hai', 'todo', '2026-10-24'],
  ['2026-10-18 11:00', 'gift ideas for Neha: kindle, perfume, that pottery class', 'keep'],
  ['2026-10-18 20:50', 'Ishaan se 1200 lena hai dinner split', 'money', 'owes_me'],
  ['2026-10-19 07:45', 'curd, bread, eggs, coffee powder', 'buy', 4],
  ['2026-10-19 13:30', 'Dr. Bose clinic: 2nd floor, Lake Gardens, near the Kali temple', 'keep'],
  ['2026-10-19 22:10', 'https://www.youtube.com/watch?v=Kp7eSUU9oy8 sloth documentary', 'read'],
  ['2026-10-20 09:00', 'renew PUC kal', 'todo', '2026-10-21'],
  ['2026-10-20 18:30', 'Ma\'s cataract follow up done, next visit in Jan', 'done'],
  ['2026-10-21 10:15', 'pay maid salary on 1st', 'todo', '2026-11-01'],
  ['2026-10-21 20:40', 'washing powder, matchbox', 'buy', 2],
  ['2026-10-22 08:30', 'electricity bill due 27 oct', 'todo', '2026-10-27'],
  ['2026-10-22 12:00', 'parso Diwali shopping with Didi', 'todo', '2026-10-24'],
  ['2026-10-22 19:20', 'https://github.com/ollama/ollama', 'read'],
  ['2026-10-22 23:05', 'idea: a "do nothing" button that just archives everything', 'keep'],
  ['2026-10-23 07:50', 'Your one time password is 652017 for txn of Rs 2499', 'secret', 'otp'],
  ['2026-10-23 09:30', 'aaj shaam 7 baje Neha ke saath dinner', 'todo', '2026-10-23'],
  ['2026-10-23 11:45', 'Ankit ko 600 de dena hai lunch ka', 'money', 'i_owe'],
  ['2026-10-23 14:20', 'tissue, milk, maggi', 'buy', 3],
  ['2026-10-23 16:00', 'monday ko passport photo khichwana hai', 'todo', '2026-10-26'],
  ['2026-10-23 17:30', 'https://www.youtube.com/watch?v=lazy-sunday-lofi', 'read'],
  ['2026-10-23 18:10', 'Babai bollo 1500 debe Sunday', 'money', 'owes_me'],
  ['2026-10-23 19:00', 'kal subah 8 baje gas cylinder delivery', 'todo', '2026-10-24'],
  ['2026-10-23 20:10', 'ghar ka wifi: JioFiber-5G-Rohit', 'keep'],
  ['2026-10-23 21:00', 'cancel Hotstar before renewal on 30th', 'todo', '2026-10-30'],
  ['2026-10-23 21:30', 'Kindle wishlist: Four Thousand Weeks', 'read'],
  ['2026-10-23 22:00', 'dinner done, Neha loved the place', 'done'],
  ['2026-10-23 22:15', 'haha', 'noise'],
  ['2026-10-23 22:40', '30 oct office party ke liye kurta iron', 'todo', '2026-10-30'],
  ['2026-10-23 23:00', 'mixer grinder jar replace karwana', 'todo', null],
  ['2026-10-23 23:10', 'eggs, butter', 'buy', 2],
  ['2026-10-23 23:20', 'PAN BKRPS7766L for the loan form', 'secret', 'pan'],
  ['2026-10-23 23:30', 'https://www.netflix.com/title/81231974', 'read'],
  ['2026-10-23 23:45', 'kal 11 baje haircut', 'todo', '2026-10-24'],
];

const byTime = (rows: Row[]) => [...rows].sort((a, b) => a[0].localeCompare(b[0]));

/** Turn rows into a WhatsApp "Message yourself" export, Android format. */
export function toExport(rows: Row[]): string {
  return byTime(rows)
    .map(([at, text]) => {
      const [d, t] = at.split(' ');
      const [y, mo, da] = d.split('-');
      let [h, mi] = t.split(':').map(Number);
      const ap = h < 12 ? 'am' : 'pm';
      h = h % 12 || 12;
      return `${da}/${mo}/${y}, ${h}:${String(mi).padStart(2, '0')} ${ap} - ${ME}: ${text}`;
    })
    .join('\n');
}

export function sorted(rows: Row[]): Row[] {
  return byTime(rows);
}

export function toMessages(rows: Row[]): Message[] {
  return byTime(rows).map(([at, text]) => {
    const [d, t] = at.split(' ');
    const [y, mo, da] = d.split('-').map(Number);
    const [h, mi] = t.split(':').map(Number);
    return { at: civil(y, mo, da, h, mi), sender: ME, text };
  });
}
