/**
 * Menu aligned with https://nicenailsphoenix.com/ServiceAndPrice/ShowService
 * price = cash (primary for booking); priceCard = card when different
 */
function row(p) {
  return {
    name: p.name,
    nameVi: p.nameVi || null,
    description: p.description || null,
    price: p.cash,
    priceCard: p.card != null ? p.card : null,
    duration: p.min,
    category: p.category,
    menuSort: p.sort,
    isActive: true,
  };
}

const S = [];
let sort = 1;

// —— MANICURE ——
S.push(
  row({
    sort: sort++,
    category: 'manicure',
    name: 'No. 1 — Classic Manicure',
    cash: 30,
    card: 30.9,
    min: 35,
    description: 'Gel $35. Cuticle trim, nail shape, lotion massage & polish.',
  }),
  row({
    sort: sort++,
    category: 'manicure',
    name: 'No. 2 — Deluxe Manicure',
    cash: 50,
    card: 51.5,
    min: 45,
    description: 'Gel $55. Cuticle trim, sugar scrub, cooling gel, hot towel, lotion & polish.',
  }),
  row({
    sort: sort++,
    category: 'manicure',
    name: 'No. 3 — Deep Manicure',
    cash: 60,
    card: 61.8,
    min: 50,
    description: 'Gel $65. Deluxe manicure + Jelly spa to soften skin & soothe muscles.',
  })
);

// —— PEDICURE ——
const pedis = [
  {
    name: 'No. 1 — Classic Pedicure',
    cash: 35,
    card: 36.05,
    min: 40,
    desc: 'Gel $43. Cuticle trim, shape, sugar scrub, hot towel, massage, polish.',
  },
  {
    name: 'No. 2 — Signature Pedicure',
    cash: 40,
    card: 41.2,
    min: 45,
    desc: 'Gel $52. + callus removal, cooling gel, hot towel, massage, polish.',
  },
  {
    name: 'No. 3 — Deluxe Pedicure',
    cash: 48,
    card: 49.44,
    min: 55,
    desc: 'Gel $62. + hot stone, paraffin dip, massage, polish.',
  },
  {
    name: 'No. 4 — Royal Pedicure',
    cash: 58,
    card: 59.74,
    min: 65,
    desc: 'Gel $72. Signature + special pedi kit (soak, scrub, mud masque, butter) & 8 min massage.',
  },
  {
    name: 'No. 5 — Luxurious Pedicure',
    cash: 68,
    card: 70.04,
    min: 75,
    desc: 'Gel $82. Deluxe + special kit, 10 min massage; optional Margarita soak, milk, fruit, or collagen socks.',
  },
  {
    name: 'No. 6 — Herbal La Palm Pedicure',
    cash: 82,
    card: 84.46,
    min: 80,
    desc: 'Gel $98. La Palm Collagen 7-step — exfoliate, moisturize, lemon & collagen glow.',
  },
  {
    name: 'No. 7 — Vena Golden Pedicure',
    cash: 98,
    card: 100.94,
    min: 90,
    desc: 'Gel $115. Golden scrub, mask, serum & lotion; full pamper finish with polish.',
  },
];
pedis.forEach((p) =>
  S.push(
    row({
      sort: sort++,
      category: 'pedicure',
      name: p.name,
      cash: p.cash,
      card: p.card,
      min: p.min,
      description: p.desc,
    })
  )
);
S.push(
  row({
    sort: sort++,
    category: 'pedicure',
    name: 'Add-on — Paraffin or hot stone',
    cash: 7,
    card: 7.21,
    min: 10,
    description: 'Add to any pedicure.',
  }),
  row({
    sort: sort++,
    category: 'pedicure',
    name: 'Add-on — Extra massage time',
    cash: 10,
    card: 10.3,
    min: 10,
    description: 'Per block; ask in salon.',
  })
);

// —— NAILS ——
[
  { name: 'Full set', cash: 40, card: 41.2, min: 90, desc: 'Gel from $50 & up.' },
  { name: 'Fill-in', cash: 35, card: 36.05, min: 60, desc: 'Gel from $45 & up.' },
  { name: 'Ombré / marble', cash: 55, card: 56.65, min: 90, desc: 'Starting price; varies by design.' },
  { name: 'Fancy nail (custom)', cash: 60, card: 61.8, min: 90, desc: 'By request.' },
  { name: 'Pink & white', cash: 60, card: 61.8, min: 75, desc: null },
  { name: 'White tip / French tip', cash: 55, card: 56.65, min: 75, desc: null },
  { name: 'Dipping nails', cash: 45, card: 46.35, min: 60, desc: 'Starting price.' },
  { name: 'Gel-X', cash: 55, card: 56.65, min: 75, desc: 'Starting price.' },
].forEach((p) =>
  S.push(
    row({
      sort: sort++,
      category: 'nails',
      name: p.name,
      cash: p.cash,
      card: p.card,
      min: p.min,
      description: p.desc,
    })
  )
);

// —— ADDITIONAL ——
[
  { name: 'Color nail / feet', cash: 15, card: 15.45, min: 20, desc: 'Gel $25.' },
  { name: 'Take-off nails', cash: 10, card: 10.3, min: 20, desc: '$10 / $15 by type.' },
  { name: 'Full set toes', cash: 40, card: 41.2, min: 60, desc: '$40 / $45.' },
  { name: 'Acrylic two big toes', cash: 10, card: 10.3, min: 25, desc: null },
  { name: 'Paraffin dip', cash: 8, card: 8.24, min: 15, desc: null },
  { name: 'Callus removal', cash: 8, card: 8.24, min: 15, desc: null },
  { name: 'Collagen socks', cash: 10, card: 10.3, min: 15, desc: null },
  { name: '10 minutes massage', cash: 10, card: 10.3, min: 10, desc: null },
  { name: 'Shiny buffing', cash: 8, card: 8.24, min: 15, desc: null },
  { name: 'Rhinestone', cash: 5, card: 5.15, min: 15, desc: 'Starting price.' },
  { name: 'French (add-on)', cash: 8, card: 8.24, min: 15, desc: null },
].forEach((p) =>
  S.push(
    row({
      sort: sort++,
      category: 'addon',
      name: p.name,
      cash: p.cash,
      card: p.card,
      min: p.min,
      description: p.desc,
    })
  )
);

// —— KIDS (under 10) ——
S.push(
  row({
    sort: sort++,
    category: 'kids',
    name: 'Kids manicure',
    cash: 15,
    card: 15.45,
    min: 25,
    description: 'Gel $20. Under 10 years.',
  }),
  row({
    sort: sort++,
    category: 'kids',
    name: 'Kids pedicure',
    cash: 20,
    card: 20.6,
    min: 30,
    description: 'Gel $27. Under 10 years.',
  }),
  row({
    sort: sort++,
    category: 'kids',
    name: 'Kids color nail / feet',
    cash: 10,
    card: null,
    min: 20,
    description: 'Gel $10.',
  })
);

// —— LASHES ——
[
  {
    name: 'Classic full set',
    cash: 87,
    card: 89.61,
    min: 90,
    desc: 'Classic fill $40. One extension per natural lash; natural mascara look.',
  },
  {
    name: 'Volume full set',
    cash: 120,
    card: 123.6,
    min: 120,
    desc: 'Volume fill $75. Fuller, darker fan style.',
  },
  {
    name: 'Wispy full set',
    cash: 130,
    card: 133.9,
    min: 120,
    desc: 'Wispy fill $70. Soft, feathery length.',
  },
  {
    name: 'Hybrid full set',
    cash: 125,
    card: 128.75,
    min: 105,
    desc: 'Hybrid fill $65. Mix of classic & volume.',
  },
  { name: 'Lash lift', cash: 50, card: 51.5, min: 60, desc: '$50 / $60 options.' },
  { name: 'Regular lash', cash: 35, card: 36.05, min: 45, desc: null },
].forEach((p) =>
  S.push(
    row({
      sort: sort++,
      category: 'lash',
      name: p.name,
      cash: p.cash,
      card: p.card,
      min: p.min,
      description: p.desc,
    })
  )
);

// —— WAXING ——
S.push(
  row({
    sort: sort++,
    category: 'waxing',
    name: 'Eyebrow wax',
    cash: 12,
    card: 12.36,
    min: 15,
    description: 'Starting price.',
  }),
  row({
    sort: sort++,
    category: 'waxing',
    name: 'Face / chin / lip / back / body wax',
    cash: 12,
    card: 12.36,
    min: 15,
    description: 'Starting price by area.',
  })
);

// —— HEAD SPA ——
[
  {
    name: 'Combo 1 — Basic shampoo (60 min)',
    cash: 78,
    card: 80.34,
    min: 60,
    desc: 'Aroma therapy, meridian release, face/scalp massage, aloe mask, double shampoo, conditioner, dry, tea.',
  },
  {
    name: 'Combo 2 — Deluxe head spa (90 min)',
    cash: 98,
    card: 100.94,
    min: 90,
    desc: 'Combo 1 + foot & eye compress, face/scalp/neck/shoulder massage, hydrating facial, Korean sheet mask, shoulder & ear foam cleanse, tea.',
  },
  {
    name: 'Combo 3 — Royal head spa (110 min)',
    cash: 120,
    card: 123.6,
    min: 110,
    desc: 'Combo 1 & 2 + hot stone shoulders/face, quartz massage, steam hair oil, arms & hands massage, professional dry, tea.',
  },
  { name: 'Cluster lash', cash: 40, card: 41.2, min: 45, desc: 'Add-on at head spa.' },
  { name: 'Facial scrub', cash: 15, card: 15.45, min: 20, desc: null },
  { name: 'Scalp massage', cash: 2, card: 2.06, min: 1, desc: '$2 / minute.' },
  { name: 'Hand paraffin', cash: 15, card: 15.45, min: 20, desc: null },
].forEach((p) =>
  S.push(
    row({
      sort: sort++,
      category: 'head_spa',
      name: p.name,
      cash: p.cash,
      card: p.card,
      min: p.min,
      description: p.desc,
    })
  )
);

// —— FACIAL ——
[
  {
    name: 'Combo 1 — Basic hydrating facial (45 min)',
    cash: 45,
    card: 46.35,
    min: 45,
    desc: 'Cleanse, exfoliate, mask, serum & moisturizer.',
  },
  {
    name: 'Combo 2 — Deep clean facial (60 min)',
    cash: 60,
    card: 61.8,
    min: 60,
    desc: 'Deep cleanse, exfoliation, mask, facial acupressure, neck/shoulder massage, hydrating finish.',
  },
  {
    name: 'Combo 3 — Detox deep clean facial (80 min)',
    cash: 80,
    card: 82.4,
    min: 80,
    desc: 'Charcoal/clay/salicylic focus, steam, purify & hydrate — ideal for oily or congested skin.',
  },
].forEach((p) =>
  S.push(
    row({
      sort: sort++,
      category: 'facial',
      name: p.name,
      cash: p.cash,
      card: p.card,
      min: p.min,
      description: p.desc,
    })
  )
);

module.exports = S;
