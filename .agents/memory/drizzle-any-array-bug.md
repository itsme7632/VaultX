---
name: Drizzle sql`` ANY(array) bug
description: sql`` template tag with JS arrays generates invalid Postgres SQL for ANY(); must use inArray() instead
---

## The Rule
Never use `sql\`... ANY(${jsArray}::int[])\`` in Drizzle — use `inArray(col, jsArray)` instead.

**Why:** Drizzle's `sql` template tag parameterises JS arrays as `($1, $2)` (row constructor syntax), producing `ANY(($1, $2)::int[])` which PostgreSQL rejects with "failed query". The silent 500 makes it look like data is missing, not a query error. `inArray()` generates correct `= ANY(ARRAY[$1,$2])` SQL.

**How to apply:** Any time you query `WHERE col = ANY(${someArray})` in a raw sql`` block — replace with `.where(inArray(table.col, someArray))` from drizzle-orm. Add `inArray` to the drizzle-orm import. Guard with `array.length > 0` to avoid empty inArray() which also errors.
