# Realtime security

Server RLS remains authoritative. Client filters reduce traffic; filters are not authorization. The migration preserves previous row policies and financial/server-only RPC restrictions. No tokens, message contents or draft text are logged by the new manager. Notification rows are checked against the current UUID before badge/toast updates. Active-conversation message notifications do not produce repeated toasts.

Only INSERT/UPDATE publication is enabled to avoid DELETE/old-row disclosure. `REPLICA IDENTITY FULL` is not used. PostgreSQL Changes subscriptions require the same authenticated table visibility as REST. Anonymous marketplace images use a separate Storage SELECT policy for referenced images on published properties; this does not open private table subscriptions.

Typing/private Broadcast/Presence remain disabled until ordinary-JWT authorization tests demonstrate that non-members cannot subscribe, track or broadcast. No `realtime.messages` policies are added, and no frontend service-role key is used.

Local SQL tests assert cross-owner/tenant denials, member-only messages/attachments, current profile authority and immutable historic data. Mock browser tests assert lifecycle and UI behavior. They do **not** prove Cloud WebSocket delivery, JWT validation by Realtime, expiry propagation or private-channel authorization. Those require approved Cloud tests with the existing development accounts.

Primary reference: [Supabase PostgreSQL Changes and RLS limitations](https://supabase.com/docs/guides/realtime/postgres-changes). See [test status](../phase4/TESTING.md) before claiming Phase 4 complete.
