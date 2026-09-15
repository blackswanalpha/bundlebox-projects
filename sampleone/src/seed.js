// seed.js — the catalogue every run starts from.
//
// Fixed, not random. A corpus that asserts a price has to be asserting against
// a number that does not move between runs, and a board whose numbers change
// for reasons the product did not cause is a board nobody trusts twice.
//
// One product is deliberately out of stock and one is deliberately a single
// unit, because the interesting paths in an ecommerce service are the ones at
// the edge of the shelf.
export const PRODUCTS = [
  { id: "p1", sku: "KB-61", name: "Sixty-one key keyboard", price_cents: 8900, stock: 24, tags: ["input", "desk"], weight_g: 620 },
  { id: "p2", sku: "MS-02", name: "Two-button mouse", price_cents: 2450, stock: 60, tags: ["input", "desk"], weight_g: 95 },
  { id: "p3", sku: "MON-27", name: "27-inch display", price_cents: 32900, stock: 6, tags: ["display", "desk"], weight_g: 5400 },
  { id: "p4", sku: "CBL-USBC", name: "USB-C cable, 2m", price_cents: 1200, stock: 240, tags: ["cable"], weight_g: 70 },
  { id: "p5", sku: "DOCK-11", name: "Eleven-port dock", price_cents: 15900, stock: 1, tags: ["dock", "desk"], weight_g: 480 },
  { id: "p6", sku: "HUB-04", name: "Four-port hub", price_cents: 4200, stock: 0, tags: ["dock", "cable"], weight_g: 110 },
  { id: "p7", sku: "STAND-AL", name: "Aluminium laptop stand", price_cents: 6400, stock: 18, tags: ["desk"], weight_g: 900 },
  { id: "p8", sku: "PAD-XL", name: "Extra-large desk pad", price_cents: 3500, stock: 42, tags: ["desk"], weight_g: 700 },
  { id: "p9", sku: "CAM-1080", name: "1080p webcam", price_cents: 7900, stock: 12, tags: ["video"], weight_g: 160 },
  { id: "p10", sku: "MIC-USB", name: "USB condenser microphone", price_cents: 11900, stock: 9, tags: ["audio", "video"], weight_g: 540 },
];

export const seed = () => ({
  products: structuredClone(PRODUCTS),
  customers: [{ id: "C0", email: "ops@sampleone.test", role: "admin", created: "2026-01-01T00:00:00.000Z" }],
  carts: {},
  orders: [],
  seq: { order: 1000 },
});
