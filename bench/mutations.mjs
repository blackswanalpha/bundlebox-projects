// mutations.mjs — one real defect per task.
//
// Each mutation is an exact string replacement against the pristine tree. The
// gate is binary and objective: `npm test` fails with the bug in, passes with
// it fixed. Without a seeded defect the agent is asked to fix something that
// is not there, and the run measures confusion rather than context.

export const MUTATIONS = [
  {
    id: "discount-base",
    problem: "quote() in the pricing module applies the guest service fee to the full accommodation subtotal instead of the discounted one, so a stay long enough to earn a length discount is overcharged",
    file: "src/domain/pricing.ts",
    find: "  const serviceFee = applyRate(discounted, policy.serviceFeeRate);",
    replace: "  const serviceFee = applyRate(accommodation, policy.serviceFeeRate);",
    breaks: "the service fee is taken on the discounted accommodation, not the list price",
  },
  {
    id: "turnover-night",
    problem: "a booking that checks in on the same day another checks out is refused as a clash, so the host loses a night on every back-to-back turnover",
    file: "src/domain/dates.ts",
    find: "  return toUtc(aIn) < toUtc(bOut) && toUtc(bIn) < toUtc(aOut);",
    replace: "  return toUtc(aIn) <= toUtc(bOut) && toUtc(bIn) <= toUtc(aOut);",
    breaks: "a back-to-back booking does not count as an overlap",
  },
  {
    id: "service-refund",
    problem: "cancelling a booking refunds the platform service fee to the guest, which should never happen under any cancellation policy",
    file: "src/domain/booking.ts",
    find: "  const accommodation = rowAmount(booking.quote, \"accommodation\") + rowAmount(booking.quote, \"discount\");",
    replace: "  const accommodation = rowAmount(booking.quote, \"accommodation\") + rowAmount(booking.quote, \"discount\") + rowAmount(booking.quote, \"service\");",
    breaks: "the service fee is never refunded",
  },
  {
    id: "lone-review",
    problem: "a listing with a single five-star review sorts above a listing with twenty of them, because the displayed score is not shrunk toward the platform mean",
    file: "src/domain/rating.ts",
    find: "  const weighted = summary.overall * summary.count + platformMean * priorWeight;\n  return round1(weighted / (summary.count + priorWeight));",
    replace: "  return round1(summary.overall);",
    breaks: "a lone five-star review does not outrank a listing with twenty of them",
  },
  {
    id: "empty-filter",
    problem: "when a search returns nothing, the screen names the wrong filter as the one that emptied it — it reports the first filter applied rather than the one that removed the last listing",
    file: "src/domain/search.ts",
    find: "  return result.trace.find((t) => t.remaining === 0) ?? null;",
    replace: "  return result.trace[0] ?? null;",
    breaks: "the trace names which filter emptied the result",
  },
  {
    id: "stale-superhost",
    problem: "the superhost badge on a listing card is wrong: it is derived from the listing's own fields instead of being read from the host who owns it",
    file: "src/data/listings.ts",
    find: "export function isSuperhost(l: Listing): boolean {\n  return hostOf(l.hostId).superhost;\n}",
    replace: "export function isSuperhost(l: Listing): boolean {\n  return l.categories.includes(\"design\");\n}",
    breaks: "superhost is read from the host, so it cannot drift per listing",
  },
];
