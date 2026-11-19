# Realtime architecture — Phase 4

Status: implemented and exercised locally with an explicit mock transport; approved migration 14 has activated the ten-table INSERT/UPDATE-only Cloud publication, verified in [postflight](../phase4/cloud-postflight-results.json). Actual authenticated multi-account WebSocket delivery remains pending. Phase 3 preflight had no published tables. No email, push, scheduler, paid service or second Auth client is added.

`js/core/live-core.js` supplies bounded deduplication and channel lifecycle contracts. `js/core/realtime-manager.js` uses the existing `NA.client`, verified identity, active hash route and current RLS-scoped resource IDs. `NB` remains the REST/RPC data layer; PostgreSQL is the source of truth. Realtime payloads invalidate views, rather than becoming trusted records displayed directly.

One notification channel filters `notifications.user_id = auth.uid()`. One additional route channel listens only while chat, owner/tenant/admin operations, offers or checkout are active. Chat filters messages by up to 100 authorized conversation IDs and member cursors by the current user. Dashboards filter invoices/complaints by agreement IDs, rooms by property IDs, agreements by room/user and offers by recipient/owner. The administrator's active dashboard may listen to its explicitly authorized application tables; admin authority is still enforced by RLS.

Events are INSERT/UPDATE only. Migration 14 adds exactly ten tables to `supabase_realtime`: messages, notifications, complaints, complaint_histories, invoices, rental_offers, rental_agreements, rooms, conversation_members, properties. No full replica identity, DELETE events, public Broadcast or public Presence is enabled. Complaint histories are published for future scoped detail subscriptions; current views refresh from complaint events and fetch timeline when opened.

Events are batched for 300 ms. Route cache entries are evicted without invoking mutation-oriented `NB.clear()`. Normal navigation renders normally; live dashboard refresh replaces only main content while restoring filters/focus/scroll. Chat merges server messages by ID, preserves composer and existing message nodes, retains drafts in memory and exposes a newest-message button when reading older history. Read cursors update only for the visible latest conversation near the bottom. REST pagination remains 30 messages; directory is bounded to 100 conversations.

Typing and Presence are disabled. No private Broadcast authorization has yet been verified; no online/typing indicator is fabricated. Public marketplace realtime is intentionally not enabled; availability is fetched from the safe published catalogue RPC.

See [subscription management](SUBSCRIPTION_MANAGEMENT.md), [security](REALTIME_SECURITY.md), and [actual testing status](../phase4/TESTING.md).
