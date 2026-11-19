// Copy public values only into config/runtime.js. Browser JS does not read .env.
window.NGEKOSAJA_PUBLIC_CONFIG = Object.freeze({
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  publishableKey: 'YOUR_SB_PUBLISHABLE_KEY',
  defaultMode: 'connected'
});
