# Relay — product requirements

An on-call incident service. Six monitored services, three escalation policies,
two rotations, and a clock that only moves when somebody moves it.

This document is the input to `bb genesis`: every surface, rule and capability
below is written so a parse can turn it into a world, a plan and a seeded
corpus without a model reading it first.

## Surfaces

| surface | what somebody does there |
|---|---|
| `health` | nothing; it is how everything else knows the service is up |
| `auth` | exchange a directory address for a bearer token |
| `oncall` | read who holds each pager now, or at any instant |
| `intake` | a monitor posts an alert and gets an incident, new or joined |
| `queue` | read the board: open, taken, closed, by service or severity |
| `answer` | acknowledge, snooze and resolve a page |
| `command` | re-grade a severity, hand an incident to somebody, move the clock |
| `console` | what the browser shows, which the API scenarios cannot see |

## Rules

Each of these is asserted by the corpus, and each names the file that defines it.

1. **Time is a value.** Every deadline is an instant in the store and the clock
   is a number beside them. `POST /admin/clock` moves it forward; nothing moves
   it back. A deployment on the wall clock refuses the endpoint rather than
   pretending. `src/clock.js`
2. **One symptom is one incident.** An alert whose `dedup_key` matches an
   unresolved incident on the same service joins it and pages nobody a second
   time. `src/incidents.js`
3. **A resolved incident never absorbs.** The same symptom after a fix is new
   information and opens a new incident. `src/incidents.js`
4. **A repeat may raise, never lower.** A worse repeat raises the severity and
   pages again, because the person who accepted a sev3 did not accept this.
   Only a commander lowers one. `src/incidents.js`
5. **Escalation is measured from the open instant**, not from the previous step,
   so a policy reads the way an on-call agreement is written: five minutes, then
   fifteen. `src/policy.js`
6. **A step reaches whoever holds the pager when it fires**, resolved at that
   instant rather than at the instant the incident opened. An escalation that
   crosses a handoff must not page the shift that went to bed. `src/policy.js`
7. **Who is on call is arithmetic**, never a stored assignment: a start instant,
   a shift length and an ordered list. Shifts before the start instant are
   answered rather than refused, because that is the question a review asks.
   `src/schedule.js`
8. **Acknowledgement stops escalation** and nothing else does. `src/incidents.js`
9. **Being a responder is not authority over every incident.** A responder may
   answer what is assigned to them and what they are on call for. Anyone else
   gets 403; no token at all gets 401. `src/auth.js`
10. **Snooze postpones escalation by the length of the snooze**, keeping the
    warning the holder had left, and pages again when it expires. Waking
    somebody and escalating past them at the same instant would make the button
    quiet the pager and change nothing else. Only an unanswered page can be
    snoozed. `src/incidents.js`
11. **The timeline is append-only.** Every transition writes one entry and a
    refused transition writes none. `src/incidents.js`
12. **Acknowledgement and resolution are measured from the open instant.**
    Measuring from the last page is how a service that escalated three times
    reports a two-minute acknowledgement. `src/stats.js`
13. **An average over nothing is null, not nought.** `src/stats.js`
14. **Reads are open and writes are not.** A wallboard should render without a
    token; a pager anybody can answer is a pager nobody answers. `src/server.js`
15. **Relay does not create responders at the door.** A token for an address
    nobody added to the directory is an escalation target no rotation contains.
    `src/server.js`

## Capabilities

| capability | route |
|---|---|
| health | `GET /health` |
| token | `POST /auth/token` |
| rotations | `GET /oncall`, `GET /policies` |
| services | `GET /services`, `GET /services/:key` |
| intake | `POST /alerts` |
| board | `GET /incidents`, `GET /incidents/:key` |
| answer | `POST /incidents/:key/ack`, `/resolve`, `/snooze` |
| command | `POST /incidents/:key/severity`, `/assign` |
| outbox | `GET /notifications` |
| review | `GET /stats` |
| operate | `POST /admin/clock`, `POST /admin/reset` |

## The world the seed builds

Four responders — `nadia`, `tomas`, `imani` and `wren`, who is the commander.
Two rotations: Core is eight hours over the first three, starting two hours
before the seed instant; Platform is twenty-four hours over `imani` and `nadia`.
Six services across three tiers, and four incidents with a history: one closed,
one acknowledged, one quiet at sev3 and one live at sev1 that has already
escalated once. The seed instant is `2026-03-02T09:00:00Z`.

Every number the corpus asserts is a consequence of those, which is why the
corpus resets before it starts.
