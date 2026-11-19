# Subscription management

`NP.reconcile()` derives subscriptions from Connected mode, verified UUID, capabilities and active route. Missing `phase4_capabilities()` keeps the existing Phase 3 flow usable until migration approval/deployment; reload after applying migration 14. Repeated reconciliation with the same specifications creates no duplicate channels.

Every channel entry carries an epoch and identity. Route changes remove the former route channel immediately; logout, cleared identity, expired session or leaving Connected mode disposes every entry. Callback guards reject late events/statuses from removed channels or previous sessions. Auth refresh updates the singleton Realtime access token outside the Auth SDK callback lock. A refresh of unchanged identity/roles uses live refresh to preserve the composer; changed authority renders through the normal route guard.

The SDK manages socket reconnection. Channel failures schedule one retry timer with exponential backoff from 1 s, capped at 30 s and five consecutive channel attempts. No polling is used. An online event recreates channels. Every SUBSCRIBED event performs a scoped REST catch-up, including reconnection, because events may have been missed. A foreground tab also fetches its current view and notifications. Temporary failures keep currently displayed data and show reconnecting status in chat.

Deduplication keys include table, operation, record UUID and update/commit timestamp. Memory is bounded to 500 entries with a 120 s TTL. Notification toasts have separate bounded deduplication. Pending send request keys and drafts are memory-only and cleared on identity disposal.

Scope discovery caches up to 100 visible rooms/agreements/conversations for 30 seconds. Relevant events invalidate that scope. Notifications also trigger discovery for new conversations/agreements. This is appropriate for the UAS dataset; larger portfolios need server-generated authorized subscription partitions. There is no claim that subscribing with a guessed filter bypasses RLS.
