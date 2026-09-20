/* Fails if public/countries.js and lib/print/destinations.mjs disagree.
 *
 * The two exist for different jobs — one hides options in a dropdown, the other
 * refuses a checkout — but they have to agree, or a customer picks a country
 * from the list and is rejected at payment, or worse, is offered a country the
 * server would have blocked and never finds out why.
 *
 * The repo has form here: lib/print/catalog.mjs and its client mirror in
 * order.html drift the moment someone edits one of them (2026-09-15).
 *
 *   node scripts/check-destinations.mjs
 */
import { readFileSync } from 'node:fs';
import { RESTRICTED_CODES } from '../lib/print/destinations.mjs';

const src = readFileSync(new URL('../public/countries.js', import.meta.url), 'utf8');

function section(name) {
  const m = src.match(new RegExp(`var ${name} = (\\[|\\{)([\\s\\S]*?)\\n  (\\]|\\});`));
  if (!m) throw new Error(`Could not find ${name} in public/countries.js`);
  return m[2];
}

const listed = new Set([...section('COUNTRIES').matchAll(/code:\s*"([A-Z]{2})"/g)].map((m) => m[1]));
const clientRestricted = new Map(
  [...section('RESTRICTED').matchAll(/([A-Z]{2}):\s*"(\w+)"/g)].map((m) => [m[1], m[2]]),
);

const problems = [];

// 1. Anything the server restricts must be either absent from the client list
//    or flagged there with the same reason.
for (const [code, reason] of Object.entries(RESTRICTED_CODES)) {
  if (!listed.has(code)) continue;                    // never offered at all — fine
  const client = clientRestricted.get(code);
  if (!client) problems.push(`${code}: offered by the dropdown but ${reason}-restricted at checkout`);
  else if (client !== reason) problems.push(`${code}: client says "${client}", server says "${reason}"`);
}

// 2. Anything the client hides must be restricted server-side, or the hiding is
//    cosmetic and a crafted request walks straight past it.
for (const [code, reason] of clientRestricted) {
  const server = RESTRICTED_CODES[code];
  if (!server) problems.push(`${code}: hidden by the dropdown but NOT enforced at checkout`);
  else if (server !== reason) problems.push(`${code}: client says "${reason}", server says "${server}"`);
}

const unique = [...new Set(problems)];   // a mismatched reason trips both loops
if (unique.length) {
  console.error('Destination lists disagree:\n  ' + unique.join('\n  '));
  process.exit(1);
}

const offered = [...listed].filter((c) => !clientRestricted.has(c)).length;
console.log(
  `destinations OK — ${offered} offered, ${clientRestricted.size} listed-but-restricted, ` +
  `${Object.keys(RESTRICTED_CODES).length} restricted server-side`,
);
