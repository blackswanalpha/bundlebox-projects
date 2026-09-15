# 04 · States
- owes: six states per surface, or a written reason one is impossible
- prevents: a product that was designed for the day the data arrives

`rest` is one sixth of the work. The other five are where the product is judged:

| state | what it owes |
|---|---|
| rest | the ordinary case, under ordinary volume |
| loading | the SHAPE of what is coming — a skeleton, not a spinner |
| empty | first-run empty and emptied-by-filter are two different screens |
| error | what failed, whether it was retried, what the user can do next |
| partial | some sources answered; name the one that did not |
| offline | the product still has a job when the network does not |

The rule that catches the most: **an error message with no verb the user can act
on is not an error state.** "Something went wrong" is the absence of a decision.

A state declared and not drawn is worse than a state never declared, because the
first one shows up as a green cell in a coverage table. A parse cannot tell them
apart — only a runtime observer can, which is what pattern 10 is for.

**Write into the prompt:** the state matrix, and for every `n/a` cell, the
sentence explaining why that state cannot occur.
