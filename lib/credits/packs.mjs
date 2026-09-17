// The Popcode packs, server-side. The client sends a pack id and nothing else —
// the credits and the price are read from here, so a tampered request can only
// ever buy a pack that exists at the price it costs.
//
// Prices are in minor units. Keep in step with the cards in public/pricing.html.

export const FREE_ALLOWANCE = 5;   // mirrors popcode_free_allowance() in SQL

export const PACKS = [
  { id: 'pack25',  credits: 25,  amountMinor: 2900, currency: 'usd',
    label: 'Pack of 25 Popcodes' },
  { id: 'pack100', credits: 100, amountMinor: 9900, currency: 'usd',
    label: 'Pack of 100 Popcodes' },
];

export function findPack(id) {
  return PACKS.find((p) => p.id === id) || null;
}
