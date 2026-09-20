/* ═══════════════════════════════════════════════════════
   SUPABASE CONFIGURATION
   -------------------------------------------------------
   1. Create a free project at https://supabase.com
   2. Go to Settings → API and copy your URL + anon key
   3. Paste them below
   4. Run the SQL in the Supabase SQL Editor to create the
      visitors table (see comments below)
═══════════════════════════════════════════════════════ */

// TODO: Replace with your Supabase project URL
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";

// TODO: Replace with your Supabase anon (public) key
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY_HERE";

/*
   ── SQL to run in Supabase SQL Editor ──────────────────

   CREATE TABLE visitors (
     id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     fingerprint   TEXT UNIQUE NOT NULL,
     name          TEXT NOT NULL,
     skin_tone     INT NOT NULL,
     hair_style    INT NOT NULL,
     hair_color    INT NOT NULL,
     outfit_color  TEXT NOT NULL,
     accent_color  TEXT NOT NULL,
     accessory     INT NOT NULL,
     role          TEXT NOT NULL,
     position_x    FLOAT DEFAULT 0,
     position_y    FLOAT DEFAULT 0,
     joined_at     TIMESTAMPTZ DEFAULT NOW()
   );

   -- Enable real-time subscriptions
   ALTER PUBLICATION supabase_realtime ADD TABLE visitors;

   -- Row Level Security
   ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Public read" ON visitors
     FOR SELECT USING (true);

   CREATE POLICY "Public insert" ON visitors
     FOR INSERT WITH CHECK (true);

   CREATE POLICY "Public update position" ON visitors
     FOR UPDATE USING (true) WITH CHECK (true);

   ────────────────────────────────────────────────────────
*/

// Initialize the Supabase client safely if configured
let supabaseClient = null;
if (
  typeof supabase !== "undefined" &&
  SUPABASE_URL &&
  !SUPABASE_URL.includes("YOUR_PROJECT_ID")
) {
  try {
    const cleanUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, "");
    supabaseClient = supabase.createClient(cleanUrl, SUPABASE_ANON_KEY);
  } catch (e) {
    console.warn("Supabase client initialization skipped or failed:", e);
  }
}
