# 02 · Surfaces
- owes: a list of surfaces, each with a `why` and a first failing question
- prevents: nine screens that are one screen, and one screen doing nine jobs

A surface is a place the product is used, not a route and not a component. Each
one declares three things:

```json
{ "id": "items", "title": "Items", "why": "the thing the product is about",
  "owes": ["a list under real volume", "one row's full story", "the empty case"] }
```

`why` is the test. A surface whose `why` is "users need a settings page" is a
route somebody drew. A surface whose `why` is "the only place a user finds out
what changed while they were away" has a job, and that job can fail.

Two rules that cost the most when broken:

1. **A surface owes its worst case, not its best.** The list surface owes the
   300-row answer and the 0-row answer before it owes the 5-row screenshot.
2. **Two surfaces that fail the same way are one surface.** If `chats` and
   `ai-chats` both fail by "the thread is unreadable past 40 turns", they share
   a mechanism, and splitting them duplicates the fix.

**Write into the prompt:** the surface table, and for each, the first question
it must answer correctly.
