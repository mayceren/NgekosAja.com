# Service layer

All services live in `js/services/backend-services.js`, under `NB.services`. They use the existing singleton authenticated SDK; there is no second Auth client.

| Service | Operations | Database boundary |
| --- | --- | --- |
| catalogue | list/filter/sort/detail/compare | `public_listings` result filters/range |
| property | list, master facilities, save, remove | Data API; `owner_save_property`, `owner_delete_property` |
| room | list, save, remove | Data API; `owner_save_room`; FK protects deletion |
| agreement | list, offers, propose/respond/check-in/close/transfer | `rental_agreements`, `rental_offers`; authorized RPCs |
| invoice | list, create/edit/cancel/bulk, schedule/generate/remind | `invoice_statuses`, `recurring_invoices`; owner RPCs |
| transaction | paged history | Read-only `transactions` |
| finance | owner/monthly/platform/operations | Reporting RPCs |
| complaint | list/create/transition, timeline, notes, analyses, attachments | Scoped tables and complaint RPCs |
| chat | directory/open/messages/send/read | Member-scoped RPCs and paged `messages` |
| notification | list/read/all/generate | Own rows; existing reminder generator |
| favorite/search | list/save/remove | Own `favorites` / `recent_searches` |
| boost | campaign history | Read-only `boost_campaigns` |
| analytics/activity | list/record; audit history | Scoped tables; `record_listing_event` |
| settings/admin | own preferences; paged profiles/roles | RLS Data API, no role/password changes |

`NB.read(table, options, signal)` applies stable ordering and a default 25-row range. Options include explicit columns, page, size and equality filters. `NB.rpc` and reads reject stale responses. `NB.write` validates the active mode/session, throws on Data API errors and clears caches after success. Domain errors are mapped to short Indonesian messages without printing raw SQL, credentials or private payloads.

Catalogue page size is 12; message page size is 30. Pickers are capped at 100 rows and require navigation/filtering for larger portfolios. The conversation directory is capped at 100 conversations; chat messages have pagination. Favorites resolve up to 100 stored IDs; recent searches show the newest ten. These bounds are explicit current limitations, not unlimited scalability claims.

Money arrives as an integer number only when safe, otherwise as an exact string. The SDK fetch adapter rewrites unsafe integral JSON tokens and numeric aggregates ending in `.0…` before JSON.parse. Mappers normalize monetary fields to strings; display and arithmetic use BigInt. Percentages remain display values. Business dates use Asia/Jakarta.
