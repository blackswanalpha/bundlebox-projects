# Doctrine

Every rule `bb designlabs check` enforces, and the card that sets it. The cards
themselves ship with bundlebox under `designlabs/principles/`; read one with
`bb designlabs principles <id>`.

| rule | principle | severity | what is checked |
|---|---|---|---|
| `access.floor` | Contrast, Focus and Target Size | critical | text >= 4.5:1, large text and UI components >= 3:1, focus never invisible, targets >= 24px, motion respects prefers-reduced-motion |
| `generic.tells` | Anti-Generic | high | the ui-generic detector finds no more than two tells in a tree |
| `motion.duration` | The Doherty Threshold | high | no transition over 400ms; acknowledge every input within 100ms |
| `error.recoverable` | Error Prevention and Recovery | high | destructive actions are undoable or confirmed; every error message names the next action |
| `target.min-size` | Fitts's Law | high | every interactive element measures >= 44px on both axes, or declares why not |
| `group.by-space` | Gestalt Grouping | high | grouping is carried by whitespace and shared region before borders or colour |
| `affordance.signified` | Affordance, Signifier, Mapping, Feedback, Constraint | high | every interactive element carries a visible signifier; every action returns feedback |
| `state.coverage` | Visibility of System Status | high | every screen declares rest, loading, empty, error, partial and offline, or states why one is impossible |
| `accent.scarcity` | Von Restorff Effect | high | at most one accented element per viewport |
| `beauty.trap` | Aesthetic-Usability Effect | medium | usability findings are not closed on the basis of a visual redesign |
| `chrome.budget` | Data-Ink Ratio | medium | no screen exceeds its declared element budget |
| `choice.count` | Hick's Law | medium | at most one primary action and at most five ranked choices per view |
| `convention.respect` | Jakob's Law | medium | navigation, auth and checkout follow platform convention unless a waiver names the gain |
| `flow.ending` | Peak-End Rule | medium | every flow declares its peak moment and its ending, including the failure ending |
| `disclosure.layers` | Progressive Disclosure | medium | no screen shows more than its primary job; secondary controls are one layer down and reachable in one action |
| `memory.load` | Recognition Over Recall | medium | no screen requires a value the user must remember from a previous screen |
| `complexity.owner` | Tesler's Law | medium | every screen names who absorbs its irreducible complexity |
| `group.size` | Miller's Law | low | no ungrouped run longer than 7 siblings; prefer 5 |
| `order.edges` | Serial Position Effect | low | the most important items sit first or last in any ordered set |

Rules marked UNKNOWN by the gate are not failures and are not passes. They are
questions a static pass cannot settle — open `index.html` over http:// for the
visual ones, and read the flow for the rest.
