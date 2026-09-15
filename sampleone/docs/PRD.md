# sampleOne — product requirements

A small ecommerce platform. Ten products, one cart per customer, a checkout that
takes money and stock together, and an order that moves forward through five
states and never backwards.

This document is the input to `bb genesis`: every surface, rule and capability
below is written so a parse can turn it into a world, a plan and a seeded
corpus without a model reading it first.

## Surfaces

| surface | what a customer does there |
|---|---|
| `health` | nothing; it is how everything else knows the service is up |
| `catalogue` | browse ten products, search by name, sku or tag, page through results |
| `auth` | exchange an email address for a bearer token |
| `cart` | add a product, change a quantity, remove a line, apply a coupon |
| `checkout` | give an address and a card, and get an order or a reason |
| `orders` | list their own orders, read one, cancel one |
| `admin` | read stock, set stock, advance an order's state |

## Rules

Each of these is asserted by the corpus, and each names the file that defines it.

1. **Money is integer cents.** No amount anywhere is a float. Tax is in basis
   points and is computed on the subtotal once, after the discount and
   including shipping. `src/money.js`
2. **A cart is re-priced on every read.** The unit price is copied onto a line
   when the line is created, and `GET /cart` reports any product whose price or
   stock has moved since. `src/cart.js`
3. **One product is one line.** Adding the same product twice increases the
   quantity of the existing line. `src/cart.js`
4. **A quantity is a whole number between 1 and 99.** Zero removes the line.
   `src/cart.js`
5. **Shipping is 5.99 USD, and free at or above 75.00 USD.** An empty cart is
   never charged shipping. `src/cart.js`
6. **Checkout validates, reserves, authorises, commits — in that order.** Stock
   is taken before payment is authorised, and released if authorisation fails.
   `src/orders.js`
7. **A reserve is all or nothing.** If any line is short, nothing leaves the
   shelf and the response names every short line with what it wanted and what
   was there. `src/catalog.js`
8. **The last unit goes to one order.** Two carts holding the same single unit
   produce one 201 and one 409. `src/catalog.js`
9. **An address needs name, line1, city, postcode and a two-letter country.**
   Every missing field is reported at once, not one per submission.
   `src/orders.js`
10. **A card ending 0000 is declined.** It is the decline path the corpus uses.
    `src/orders.js`
11. **A customer reads only their own orders.** Somebody else's order id is a
    404, never a 403, because a 403 confirms the id exists. `src/server.js`
12. **An order moves forward only.** `placed → paid → shipped → delivered`, and
    `cancelled` and `delivered` are terminal. `src/orders.js`
13. **Cancelling restocks exactly once.** A second cancel is a 409 and changes
    no stock. `src/orders.js`
14. **Admin is a role on the token, not a header.** Only an address at
    `@sampleone.test` gets one. `src/auth.js`

## Capabilities

- `GET /health` — service, version, uptime, product and order counts
- `GET /products?q=&tag=&page=&size=` — ranked search, exact sku first
- `GET /products/:id`
- `POST /auth/token` `{email}` — `{token, customer_id, role}`
- `GET /cart` — lines, what changed since they were added, and the receipt
- `POST /cart/lines` `{product_id, qty}`
- `PATCH /cart/lines/:id` `{qty}` — zero removes
- `DELETE /cart/lines/:id`
- `POST /cart/coupon` `{code}` — `SAVE10`, `SAVE25`, `HALF`
- `POST /checkout` `{address, payment}` — 201, or 422/409/402 with reasons
- `GET /orders?page=&size=` — the caller's own, newest first
- `GET /orders/:id`
- `POST /orders/:id/cancel`
- `POST /orders/:id/advance` `{state}` — admin only
- `GET /admin/stock` — admin only
- `POST /admin/stock/:id` `{stock}` — admin only
- `POST /admin/reset` — admin only; re-seeds the catalogue

## Non-goals

No payment processor, no email, no sessions, no database server. Everything is
one JSON file written atomically, because this service exists to be measured and
a container between `bb runbook up` and the first scenario would be the thing
being measured.
