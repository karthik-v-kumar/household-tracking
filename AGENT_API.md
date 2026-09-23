# Stocked agent API

Base URL: `https://stocked.grok.me`

Send the key on every request:

```
Authorization: Bearer stk_...
```

Missing or unknown keys get **401**. Keys are household-scoped. A write key can change lists, pantry, and filters. It cannot invite, remove, or manage other keys.

## Read

- `GET /api/agent/health` → `{ ok, write, household }`
- `GET /api/agent/household` → household, members, lists, usuals, inventory, filters, low items, due filters
- `GET /api/agent/lists`
- `GET /api/agent/lists/:id` → list plus items
- `GET /api/agent/inventory`
- `GET /api/agent/filters`

## Write

- `POST /api/agent/lists` `{ name, icon?, color? }`
- `PATCH /api/agent/lists/:id` `{ name?, icon?, color? }`
- `DELETE /api/agent/lists/:id`
- `POST /api/agent/items` `{ listName or listId, name, quantity?, notes?, staple? }`
- `POST /api/agent/lists/:id/items` `{ name, quantity?, notes?, staple? }`
- `PATCH /api/agent/items/:id` `{ quantity?, notes?, checked?, staple? }`
- `DELETE /api/agent/items/:id`
- `POST /api/agent/inventory` `{ name, category?, level?, typicalDays?, defaultListId?, notes? }`
- `PATCH /api/agent/inventory/:id` `{ name?, level?, typicalDays?, lastRestockedAt?, notes?, category?, defaultListId? }`
- `DELETE /api/agent/inventory/:id`
- `POST /api/agent/filters` `{ name, intervalDays, qtyNeeded?, spareCount?, lastReplacedAt?, stockLeadDays?, defaultListId? }`
- `PATCH /api/agent/filters/:id`
- `DELETE /api/agent/filters/:id`

Levels: `full`, `ok`, `low`, `out`.

Checked items moved back onto a list are un-checked instead of duplicated.
