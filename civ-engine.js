/* ═══════════════════════════════════════════════════════
   CIVILIZATION ENGINE — Shared Core
   -------------------------------------------------------
   Used by both the main-page preview (civ-preview.js)
   and the full-experience page (civ-fullpage.js).
   
   Modules:
     1. Supabase Integration
     2. Visitor Fingerprinting
     3. Procedural Character Generator
     4. Pixel-Art Renderer
     5. Isometric Engine
     6. Village Stage System
     7. Character AI
     8. Day/Night Cycle
     9. Sound System
═══════════════════════════════════════════════════════ */

const CivEngine = (() => {
  "use strict";

  /* ─────────────────────────────────────────────────────
     MODULE 1 — SUPABASE INTEGRATION
  ───────────────────────────────────────────────────── */
  const DB = {
    /** Fetch every visitor row, ordered by join date */
    async getAllVisitors() {
      if (!supabaseClient) throw new Error("Supabase client not initialized");
      const { data, error } = await supabaseClient
        .from("visitors")
        .select("*")
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    /** Check if a fingerprint already exists */
    async getVisitorByFingerprint(fp) {
      if (!supabaseClient) throw new Error("Supabase client not initialized");
      const { data, error } = await supabaseClient
        .from("visitors")
        .select("*")
        .eq("fingerprint", fp)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    /** Insert a new visitor row */
    async addVisitor(visitor) {
      if (!supabaseClient) throw new Error("Supabase client not initialized");
      const { data, error } = await supabaseClient
        .from("visitors")
        .insert(visitor)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /** Update a character's drag-and-drop position */
    async updatePosition(fingerprint, x, y) {
      if (!supabaseClient) return;
      const { error } = await supabaseClient
        .from("visitors")
        .update({ position_x: x, position_y: y })
        .eq("fingerprint", fingerprint);
      if (error) console.error("updatePosition:", error);
    },

    /** Subscribe to real-time INSERT events on visitors */
    onNewVisitor(callback) {
      if (!supabaseClient) return;
      supabaseClient
        .channel("visitors-inserts")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "visitors" },
          (payload) => callback(payload.new),
        )
        .subscribe();
    },
  };

  /* ─────────────────────────────────────────────────────
     MODULE 2 — VISITOR FINGERPRINTING
  ───────────────────────────────────────────────────── */
  const Fingerprint = {
    /** Generate a lightweight browser fingerprint */
    async generate() {
      // check localStorage first
      const stored = localStorage.getItem("civ_fingerprint");
      if (stored) return stored;

      const components = [
        navigator.language,
        navigator.platform,
        screen.width + "x" + screen.height,
        screen.colorDepth,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        navigator.hardwareConcurrency || "unknown",
        this._canvasFingerprint(),
      ];

      const raw = components.join("|");
      const hash = await this._sha256(raw);
      localStorage.setItem("civ_fingerprint", hash);
      return hash;
    },

    /** Canvas-based fingerprint component */
    _canvasFingerprint() {
      try {
        const c = document.createElement("canvas");
        c.width = 200;
        c.height = 50;
        const ctx = c.getContext("2d");
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillStyle = "#f60";
        ctx.fillRect(50, 0, 80, 30);
        ctx.fillStyle = "#069";
        ctx.fillText("CivFP", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("CivFP", 4, 17);
        return c.toDataURL().slice(-50);
      } catch {
        return "no-canvas";
      }
    },

    /** SHA-256 hash helper */
    async _sha256(message) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    },
  };

  /* ─────────────────────────────────────────────────────
     MODULE 3 — PROCEDURAL CHARACTER GENERATOR
  ───────────────────────────────────────────────────── */
  const ADJECTIVES = [
    "Swift","Brave","Quiet","Bold","Keen","Wise","Wild","Calm","Sharp","Bright",
    "Fierce","Gentle","Noble","Stout","Agile","Silent","Merry","Stern","Quick","Deft",
    "Fair","Hardy","Lucky","Proud","True","Warm","Cool","Grand","Iron","Stone",
    "Dawn","Dusk","Frost","Storm","Cloud","Flame","River","Shadow","Star","Moon",
    "Amber","Jade","Ruby","Sage","Thorn","Vale","Birch","Cliff","Glen","Marsh",
  ];

  const NOUNS = [
    "Ember","Willow","Hawk","Fox","Oak","Pine","Reed","Brook","Flint","Slate",
    "Maple","Cedar","Aspen","Raven","Crane","Wolf","Bear","Lynx","Hare","Wren",
    "Stone","Forge","Dale","Glen","Ridge","Peak","Drift","Moss","Fern","Ivy",
    "Arrow","Shield","Blade","Helm","Cloak","Spark","Blaze","Frost","Tide","Gale",
    "Root","Leaf","Bark","Thorn","Bloom","Seed","Petal","Dew","Mist","Rain",
  ];

  /* ── Strict Game Boy 4-color palette ── */
  const GB = {
    BLACK: "#0c0c0f",  // darkest
    DARK:  "#5a5a5a",  // dark grey
    LIGHT: "#a8a8a8",  // light grey
    WHITE: "#f1f3f5",  // lightest
  };

  // Character variation arrays — mapped to GB palette at render time
  const SKIN_TONES = [
    GB.WHITE, GB.WHITE, GB.LIGHT, GB.LIGHT, GB.DARK, GB.DARK,
  ];

  const HAIR_COLORS = [
    GB.BLACK, GB.BLACK, GB.DARK, GB.DARK, GB.BLACK,
    GB.DARK, GB.BLACK, GB.BLACK, GB.DARK, GB.BLACK,
  ];

  const OUTFIT_COLORS = [
    GB.WHITE, GB.LIGHT, GB.DARK, GB.WHITE, GB.LIGHT,
    GB.DARK, GB.WHITE, GB.LIGHT, GB.DARK, GB.WHITE,
    GB.LIGHT, GB.DARK, GB.WHITE, GB.LIGHT, GB.DARK,
  ];

  const ROLES_BY_ERA = {
    campsite:   ["Camper", "Scout", "Drifter"],
    settlement: ["Forager", "Woodcutter", "Pioneer"],
    hamlet:     ["Gardener", "Carpenter", "Baker"],
    village:    ["Barista", "Bookseller", "Fisherman"],
    town:       ["Artist", "Scholar", "Florist"],
    city:       ["Architect", "Musician", "Librarian"],
    metropolis: ["Mayor", "Curator", "Philosopher"],
  };

  const CharGen = {
    /** Deterministically generate a character from a fingerprint hash */
    generate(fingerprint, populationAtJoin) {
      const seed = this._seedFromHash(fingerprint);
      const era = Stages.getEraForPopulation(populationAtJoin);
      const roles = ROLES_BY_ERA[era] || ["Citizen"];

      return {
        fingerprint,
        name: ADJECTIVES[seed(ADJECTIVES.length)] + " " + NOUNS[seed(NOUNS.length)],
        skin_tone: seed(SKIN_TONES.length),
        hair_style: seed(8),
        hair_color: seed(HAIR_COLORS.length),
        outfit_color: OUTFIT_COLORS[seed(OUTFIT_COLORS.length)],
        accent_color: OUTFIT_COLORS[seed(OUTFIT_COLORS.length)],
        accessory: seed(5), // 0 = none, 1 = hat, 2 = scarf, 3 = glasses, 4 = bandana
        role: roles[seed(roles.length)],
        position_x: 0,
        position_y: 0,
      };
    },

    /** Create a seeded pseudo-random function from a hex hash */
    _seedFromHash(hash) {
      let idx = 0;
      return (max) => {
        // take 4 hex chars at a time, cycling through the hash
        const start = (idx * 4) % (hash.length - 4);
        const val = parseInt(hash.substring(start, start + 4), 16);
        idx++;
        return val % max;
      };
    },
  };

  /* ─────────────────────────────────────────────────────
     MODULE 4 — PIXEL-ART RENDERER
  ───────────────────────────────────────────────────── */
  /* ── 45-degree diagonal hatching helper (1-bit shading texture) ── */
  function drawHatch(ctx, x, y, w, h, s, color) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = color || GB.BLACK;
    ctx.lineWidth = 1 * s;
    for (let d = -h; d < w + h; d += 4 * s) {
      ctx.beginPath();
      ctx.moveTo(x + d, y);
      ctx.lineTo(x + d + h, y + h);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ─────────────────────────────────────────────────────
     MODULE 4 — COZY RETRO RPG TOWN PIXEL-ART RENDERER
  ───────────────────────────────────────────────────── */
  const PixelArt = {
    /** Draw charming human RPG townsfolk in retro 1-bit / 2-bit B&W style */
    drawCharacter(ctx, char, sx, sy, scale, frame, facingRight) {
      const s = scale;
      const BLK = GB.BLACK;
      const WHT = GB.WHITE;
      const GRY = GB.DARK;
      const LGT = GB.LIGHT;

      ctx.save();

      // Horizontal flip around center axis (8*s)
      if (!facingRight) {
        ctx.translate(sx + 8 * s, 0);
        ctx.scale(-1, 1);
        ctx.translate(-(sx + 8 * s), 0);
      }

      // ── Solid Chunky Black Drop Shadow Pill ──
      ctx.fillStyle = BLK;
      ctx.fillRect(sx + 3 * s, sy + 14 * s, 10 * s, 2 * s);

      // Walk bounce bob (1px bobbing)
      const walkBob = (frame % 2 === 1) ? -1 : 0;
      const dy = sy + walkBob * s;

      // ── Walking Feet Animation ──
      const walkFrame = frame % 4;
      const leftFootX = walkFrame === 1 ? 4 : 5;
      const rightFootX = walkFrame === 3 ? 10 : 9;
      ctx.fillStyle = BLK;
      ctx.fillRect(sx + leftFootX * s, dy + 13 * s, 2 * s, 2 * s);
      ctx.fillRect(sx + rightFootX * s, dy + 13 * s, 2 * s, 2 * s);

      // ── Legs / Trousers ──
      ctx.fillStyle = BLK;
      ctx.fillRect(sx + 5 * s, dy + 11 * s, 2 * s, 3 * s);
      ctx.fillRect(sx + 9 * s, dy + 11 * s, 2 * s, 3 * s);

      // ── Torso / Outfit ──
      const outfitStyle = Math.abs(char.skin_tone) % 4;
      // Body outline
      ctx.fillStyle = BLK;
      ctx.fillRect(sx + 4 * s, dy + 7 * s, 8 * s, 5 * s);
      // Outfit fill
      ctx.fillStyle = WHT;
      ctx.fillRect(sx + 5 * s, dy + 8 * s, 6 * s, 3 * s);

      if (outfitStyle === 0) {
        // Cozy Hoodie: center pocket & collar
        ctx.fillStyle = BLK;
        ctx.fillRect(sx + 6 * s, dy + 9 * s, 4 * s, 2 * s);
        ctx.fillRect(sx + 7 * s, dy + 8 * s, 2 * s, 1 * s);
      } else if (outfitStyle === 1) {
        // Dungarees / Overalls: shoulder straps & buckles
        ctx.fillStyle = BLK;
        ctx.fillRect(sx + 5 * s, dy + 7 * s, 2 * s, 4 * s);
        ctx.fillRect(sx + 9 * s, dy + 7 * s, 2 * s, 4 * s);
        ctx.fillStyle = WHT;
        ctx.fillRect(sx + 5 * s, dy + 8 * s, 1 * s, 1 * s); // buckle
        ctx.fillRect(sx + 10 * s, dy + 8 * s, 1 * s, 1 * s); // buckle
      } else if (outfitStyle === 2) {
        // Jacket / Coat: open lapels & button
        ctx.fillStyle = BLK;
        ctx.fillRect(sx + 7 * s, dy + 8 * s, 2 * s, 3 * s);
        ctx.fillStyle = WHT;
        ctx.fillRect(sx + 7 * s, dy + 8 * s, 1 * s, 1 * s);
      } else {
        // Baker / Shopkeeper Apron: front pocket
        ctx.fillStyle = WHT;
        ctx.fillRect(sx + 5 * s, dy + 7 * s, 6 * s, 4 * s);
        ctx.fillStyle = BLK;
        ctx.fillRect(sx + 6 * s, dy + 9 * s, 4 * s, 2 * s);
      }

      // ── Arms ──
      ctx.fillStyle = BLK;
      ctx.fillRect(sx + 3 * s, dy + 8 * s, 2 * s, 3 * s);
      ctx.fillRect(sx + 11 * s, dy + 8 * s, 2 * s, 3 * s);
      ctx.fillStyle = WHT; // hands
      ctx.fillRect(sx + 3 * s, dy + 10 * s, 2 * s, 1 * s);
      ctx.fillRect(sx + 11 * s, dy + 10 * s, 2 * s, 1 * s);

      // ── Head Base ──
      ctx.fillStyle = BLK;
      ctx.fillRect(sx + 4 * s, dy + 3 * s, 8 * s, 5 * s);
      ctx.fillStyle = WHT;
      ctx.fillRect(sx + 5 * s, dy + 4 * s, 6 * s, 4 * s);

      // ── Eyes ──
      ctx.fillStyle = BLK;
      ctx.fillRect(sx + 6 * s, dy + 5 * s, 1 * s, 2 * s);
      ctx.fillRect(sx + 9 * s, dy + 5 * s, 1 * s, 2 * s);

      // ── Hairstyle / Headwear (8 distinct styles) ──
      const hair = Math.abs(char.hair_style) % 8;
      ctx.fillStyle = BLK;

      switch (hair) {
        case 0:
          // Spiky / Messy RPG Protagonist Hair
          ctx.fillRect(sx + 4 * s, dy + 1 * s, 3 * s, 3 * s);
          ctx.fillRect(sx + 7 * s, dy + 0 * s, 3 * s, 3 * s);
          ctx.fillRect(sx + 9 * s, dy + 1 * s, 3 * s, 3 * s);
          ctx.fillRect(sx + 4 * s, dy + 3 * s, 8 * s, 2 * s);
          ctx.fillRect(sx + 4 * s, dy + 4 * s, 1 * s, 2 * s); // sideburn
          break;

        case 1:
          // Bob / Cute Bangs
          ctx.fillRect(sx + 4 * s, dy + 2 * s, 8 * s, 3 * s);
          ctx.fillRect(sx + 3 * s, dy + 4 * s, 2 * s, 3 * s); // left bob
          ctx.fillRect(sx + 11 * s, dy + 4 * s, 2 * s, 3 * s); // right bob
          break;

        case 2:
          // Cozy Knit Beanie / Toque
          ctx.fillRect(sx + 4 * s, dy + 0 * s, 8 * s, 4 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 5 * s, dy + 2 * s, 6 * s, 1 * s); // beanie band
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 7 * s, dy - 1 * s, 2 * s, 2 * s); // pompom
          break;

        case 3:
          // Baseball Cap / Visor
          ctx.fillRect(sx + 4 * s, dy + 1 * s, 8 * s, 3 * s);
          ctx.fillRect(sx + 2 * s, dy + 3 * s, 4 * s, 1 * s); // cap brim
          break;

        case 4:
          // Long Hair with Ponytail / Ribbon
          ctx.fillRect(sx + 4 * s, dy + 2 * s, 8 * s, 2 * s);
          ctx.fillRect(sx + 3 * s, dy + 3 * s, 2 * s, 6 * s); // flowing hair
          ctx.fillRect(sx + 11 * s, dy + 2 * s, 2 * s, 5 * s); // ponytail tail
          break;

        case 5:
          // Curly / Wavy Textured Hair
          ctx.fillRect(sx + 3 * s, dy + 1 * s, 10 * s, 3 * s);
          ctx.fillRect(sx + 3 * s, dy + 3 * s, 2 * s, 4 * s);
          ctx.fillRect(sx + 11 * s, dy + 3 * s, 2 * s, 4 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 5 * s, dy + 1 * s, 1 * s, 1 * s);
          ctx.fillRect(sx + 9 * s, dy + 1 * s, 1 * s, 1 * s);
          ctx.fillStyle = BLK;
          break;

        case 6:
          // Gardener / Farmer Straw Sunhat
          ctx.fillRect(sx + 1 * s, dy + 2 * s, 14 * s, 2 * s); // wide brim
          ctx.fillRect(sx + 5 * s, dy + 0 * s, 6 * s, 3 * s); // crown
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 5 * s, dy + 2 * s, 6 * s, 1 * s); // ribbon band
          ctx.fillStyle = BLK;
          break;

        default:
          // Beret / Baker Flat Cap
          ctx.fillRect(sx + 3 * s, dy + 1 * s, 9 * s, 3 * s);
          ctx.fillRect(sx + 11 * s, dy + 2 * s, 2 * s, 2 * s);
          ctx.fillRect(sx + 6 * s, dy + 0 * s, 2 * s, 1 * s); // beret stalk
          break;
      }

      // ── Accessories ──
      const acc = char.accessory % 5;
      if (acc === 1) {
        // Scarf wrapped around neck
        ctx.fillStyle = BLK;
        ctx.fillRect(sx + 4 * s, dy + 6 * s, 8 * s, 2 * s);
        ctx.fillRect(sx + 9 * s, dy + 8 * s, 2 * s, 3 * s); // hanging tail
        ctx.fillStyle = WHT;
        ctx.fillRect(sx + 5 * s, dy + 7 * s, 6 * s, 1 * s);
      } else if (acc === 2) {
        // Round Glasses
        ctx.fillStyle = BLK;
        ctx.fillRect(sx + 5 * s, dy + 5 * s, 3 * s, 2 * s);
        ctx.fillRect(sx + 8 * s, dy + 5 * s, 3 * s, 2 * s);
        ctx.fillStyle = WHT;
        ctx.fillRect(sx + 6 * s, dy + 5 * s, 1 * s, 1 * s);
        ctx.fillRect(sx + 9 * s, dy + 5 * s, 1 * s, 1 * s);
      } else if (acc === 3) {
        // Messenger Bag / Backpack Strap
        ctx.fillStyle = BLK;
        ctx.fillRect(sx + 5 * s, dy + 7 * s, 1 * s, 1 * s);
        ctx.fillRect(sx + 6 * s, dy + 8 * s, 1 * s, 1 * s);
        ctx.fillRect(sx + 7 * s, dy + 9 * s, 1 * s, 1 * s);
        ctx.fillRect(sx + 8 * s, dy + 10 * s, 3 * s, 3 * s); // bag
        ctx.fillStyle = WHT;
        ctx.fillRect(sx + 9 * s, dy + 11 * s, 1 * s, 1 * s); // buckle
      } else if (acc === 4) {
        // Steaming Coffee Mug in hand!
        ctx.fillStyle = BLK;
        ctx.fillRect(sx + 12 * s, dy + 8 * s, 3 * s, 3 * s);
        ctx.fillStyle = WHT;
        ctx.fillRect(sx + 13 * s, dy + 8 * s, 1 * s, 2 * s);
        ctx.fillStyle = BLK;
        ctx.fillRect(sx + 13 * s, dy + 6 * s, 1 * s, 1 * s); // steam
      }

      ctx.restore();
    },

    /** Draw character portrait on a 64x64 canvas for HUD */
    drawPortrait(canvas, char) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 64, 64);
      ctx.imageSmoothingEnabled = false;

      // Draw light background matching game aesthetic
      ctx.fillStyle = "#e8ebed";
      ctx.fillRect(0, 0, 64, 64);

      // Draw character centered at scale 3
      this.drawCharacter(ctx, char, 8, 8, 3, 0, true);
    },

    /** Draw cozy retro RPG town structures matching Concept 1 */
    drawBuilding(ctx, type, sx, sy, scale) {
      const s = scale;
      const BLK = GB.BLACK;
      const WHT = GB.WHITE;

      ctx.save();

      switch (type) {
        case "campfire": {
          // ── Town Square Firepit & Bench ──
          // Drop shadow
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 2 * s, sy + 14 * s, 14 * s, 3 * s);

          // Stone ring base
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 8 * s, 8 * s, 6 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 4 * s, sy + 9 * s, 6 * s, 4 * s);

          // Stones along rim
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 9 * s, 2 * s, 2 * s);
          ctx.fillRect(sx + 9 * s, sy + 9 * s, 2 * s, 2 * s);
          ctx.fillRect(sx + 6 * s, sy + 12 * s, 2 * s, 2 * s);

          // Wood logs crossed
          ctx.fillRect(sx + 5 * s, sy + 10 * s, 4 * s, 2 * s);

          // Animated flickering flame
          const f = (Date.now() / 150) | 0;
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 6 * s, sy + (6 + (f % 2)) * s, 2 * s, 4 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 6 * s, sy + (7 + (f % 2)) * s, 1 * s, 2 * s);

          // Cozy Wooden Park Bench on right
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 12 * s, sy + 8 * s, 4 * s, 6 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 13 * s, sy + 9 * s, 2 * s, 4 * s);
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 12 * s, sy + 10 * s, 4 * s, 1 * s); // bench seat
          break;
        }

        case "tent": {
          // ── Traveler's Canvas Tent & Lantern ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 2 * s, sy + 14 * s, 14 * s, 3 * s);

          // A-Frame Canvas Tent
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 4 * s, 10 * s, 10 * s);
          ctx.fillRect(sx + 5 * s, sy + 2 * s, 6 * s, 3 * s);

          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 4 * s, sy + 5 * s, 8 * s, 8 * s);
          ctx.fillRect(sx + 6 * s, sy + 3 * s, 4 * s, 3 * s);

          // Tent Canvas Seams with Hatching
          drawHatch(ctx, sx + 4 * s, sy + 5 * s, 4 * s, 7 * s, s, BLK);

          // Open Tent Flap (dark interior)
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 7 * s, sy + 8 * s, 4 * s, 6 * s);

          // Wooden Lantern Post on side
          ctx.fillRect(sx + 14 * s, sy + 6 * s, 1 * s, 8 * s);
          ctx.fillRect(sx + 13 * s, sy + 6 * s, 3 * s, 1 * s);
          ctx.fillRect(sx + 13 * s, sy + 7 * s, 2 * s, 3 * s); // lantern
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 13 * s, sy + 8 * s, 1 * s, 1 * s); // glowing wick
          break;
        }

        case "hut": {
          // ── Woodcutter's Stone Cottage ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 1 * s, sy + 15 * s, 16 * s, 3 * s);

          // Cottage walls
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 1 * s, sy + 5 * s, 14 * s, 10 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 2 * s, sy + 6 * s, 12 * s, 8 * s);

          // Horizontal timber log lines
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 2 * s, sy + 8 * s, 12 * s, 1 * s);
          ctx.fillRect(sx + 2 * s, sy + 11 * s, 12 * s, 1 * s);

          // Pitched roof with 45° shingle hatching
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 0 * s, sy + 2 * s, 16 * s, 4 * s);
          ctx.fillRect(sx + 2 * s, sy + 1 * s, 12 * s, 2 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 1 * s, sy + 3 * s, 14 * s, 2 * s);
          drawHatch(ctx, sx + 1 * s, sy + 3 * s, 14 * s, 2 * s, s, BLK);

          // Stone Chimney with smoke puff
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 11 * s, sy - 1 * s, 3 * s, 4 * s);
          ctx.fillRect(sx + 12 * s, sy - 3 * s, 2 * s, 2 * s); // smoke

          // Wooden door with brass knob
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 4 * s, sy + 9 * s, 4 * s, 5 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 7 * s, sy + 11 * s, 1 * s, 1 * s);

          // Window with Flowerbox
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 10 * s, sy + 8 * s, 3 * s, 3 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 11 * s, sy + 9 * s, 1 * s, 1 * s);
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 10 * s, sy + 11 * s, 3 * s, 1 * s); // flowerbox
          break;
        }

        case "well": {
          // ── Village Wishing Well ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 13 * s, 12 * s, 3 * s);

          // Stone Well Circular Basin
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 8 * s, 10 * s, 6 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 4 * s, sy + 9 * s, 8 * s, 4 * s);

          // Cobblestone mortar lines
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 6 * s, sy + 9 * s, 1 * s, 2 * s);
          ctx.fillRect(sx + 9 * s, sy + 11 * s, 1 * s, 2 * s);

          // Wooden support beams & pitched shake roof
          ctx.fillRect(sx + 4 * s, sy + 3 * s, 2 * s, 6 * s);
          ctx.fillRect(sx + 10 * s, sy + 3 * s, 2 * s, 6 * s);
          ctx.fillRect(sx + 2 * s, sy + 1 * s, 12 * s, 3 * s);
          ctx.fillRect(sx + 4 * s, sy + 0 * s, 8 * s, 2 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 3 * s, sy + 2 * s, 10 * s, 1 * s);

          // Rope Spindle & Hanging Bucket
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 6 * s, sy + 4 * s, 4 * s, 2 * s);
          ctx.fillRect(sx + 7 * s, sy + 6 * s, 1 * s, 3 * s); // rope
          ctx.fillRect(sx + 6 * s, sy + 8 * s, 3 * s, 2 * s); // bucket
          break;
        }

        case "house": {
          // ── Charming Townhouse with Flowerboxes ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 1 * s, sy + 16 * s, 18 * s, 3 * s);

          // 2-Story Brick Facade
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 1 * s, sy + 4 * s, 16 * s, 12 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 2 * s, sy + 5 * s, 14 * s, 10 * s);

          // Brick pattern texture
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 4 * s, sy + 6 * s, 2 * s, 1 * s);
          ctx.fillRect(sx + 11 * s, sy + 6 * s, 2 * s, 1 * s);
          ctx.fillRect(sx + 2 * s, sy + 10 * s, 2 * s, 1 * s);
          ctx.fillRect(sx + 14 * s, sy + 10 * s, 2 * s, 1 * s);

          // Pitched Roof with Shingle Hatching
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 0 * s, sy + 1 * s, 18 * s, 4 * s);
          ctx.fillRect(sx + 2 * s, sy + 0 * s, 14 * s, 2 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 1 * s, sy + 2 * s, 16 * s, 2 * s);
          drawHatch(ctx, sx + 1 * s, sy + 2 * s, 16 * s, 2 * s, s, BLK);

          // Chimney with smoke
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 13 * s, sy - 2 * s, 3 * s, 4 * s);
          ctx.fillRect(sx + 14 * s, sy - 4 * s, 2 * s, 2 * s);

          // Top Floor Windows with Shutters & Flowerbox
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 6 * s, 4 * s, 4 * s);
          ctx.fillRect(sx + 11 * s, sy + 6 * s, 4 * s, 4 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 4 * s, sy + 7 * s, 2 * s, 2 * s);
          ctx.fillRect(sx + 12 * s, sy + 7 * s, 2 * s, 2 * s);
          // Flowerbox dots
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 10 * s, 4 * s, 1 * s);
          ctx.fillRect(sx + 11 * s, sy + 10 * s, 4 * s, 1 * s);

          // Arched Front Door with step
          ctx.fillRect(sx + 7 * s, sy + 11 * s, 4 * s, 5 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 8 * s, sy + 12 * s, 2 * s, 3 * s);
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 9 * s, sy + 13 * s, 1 * s, 1 * s); // door knob
          break;
        }

        case "farm": {
          // ── Community Vegetable Garden ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 1 * s, sy + 15 * s, 18 * s, 3 * s);

          // Picket fence enclosure
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 1 * s, sy + 4 * s, 17 * s, 11 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 2 * s, sy + 5 * s, 15 * s, 9 * s);

          // Tilled soil garden plots with hatching
          drawHatch(ctx, sx + 3 * s, sy + 6 * s, 13 * s, 3 * s, s, BLK);

          // Crop Rows (cabbage/carrot leafy tops)
          ctx.fillStyle = BLK;
          for (let i = 0; i < 4; i++) {
            ctx.fillRect(sx + (3 + i * 3) * s, sy + 7 * s, 2 * s, 2 * s);
            ctx.fillRect(sx + (3 + i * 3) * s, sy + 10 * s, 2 * s, 2 * s);
          }

          // Big Round Pumpkin on bottom right
          ctx.fillRect(sx + 12 * s, sy + 11 * s, 4 * s, 3 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 13 * s, sy + 12 * s, 2 * s, 1 * s);
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 13 * s, sy + 10 * s, 1 * s, 1 * s); // stem

          // Wooden Water Barrel
          ctx.fillRect(sx + 2 * s, sy + 11 * s, 3 * s, 3 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 3 * s, sy + 12 * s, 1 * s, 1 * s);
          break;
        }

        case "market": {
          // ── Town Square Bakery & Coffee Shop ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 1 * s, sy + 16 * s, 19 * s, 3 * s);

          // Building facade
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 1 * s, sy + 4 * s, 18 * s, 12 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 2 * s, sy + 5 * s, 16 * s, 10 * s);

          // Alternating Black & White Striped Awning
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 0 * s, sy + 3 * s, 19 * s, 4 * s);
          ctx.fillStyle = WHT;
          for (let i = 0; i < 5; i++) {
            ctx.fillRect(sx + (1 + i * 4) * s, sy + 3 * s, 2 * s, 4 * s);
          }

          // Bakery Display Window with bread loaves
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 2 * s, sy + 8 * s, 7 * s, 5 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 3 * s, sy + 9 * s, 5 * s, 3 * s);
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 4 * s, sy + 10 * s, 3 * s, 1 * s); // loaf

          // Shop Door with glass window
          ctx.fillRect(sx + 10 * s, sy + 8 * s, 4 * s, 7 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 11 * s, sy + 9 * s, 2 * s, 3 * s);

          // Sidewalk Menu Chalkboard
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 15 * s, sy + 10 * s, 4 * s, 5 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 16 * s, sy + 11 * s, 2 * s, 3 * s);

          // Bistro Table & Chairs on sidewalk
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 15 * s, sy + 6 * s, 4 * s, 1 * s); // umbrella
          ctx.fillRect(sx + 16 * s, sy + 7 * s, 1 * s, 3 * s); // pole
          break;
        }

        case "watchtower": {
          // ── Town Clock Tower / Windmill ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 4 * s, sy + 16 * s, 14 * s, 3 * s);

          // Tower masonry base
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 4 * s, sy + 4 * s, 12 * s, 12 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 5 * s, sy + 5 * s, 10 * s, 10 * s);

          // Conical shingle roof with weathervane
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 2 * s, 14 * s, 3 * s);
          ctx.fillRect(sx + 6 * s, sy + 0 * s, 8 * s, 2 * s);
          ctx.fillRect(sx + 9 * s, sy - 2 * s, 1 * s, 3 * s); // flagpole
          ctx.fillRect(sx + 10 * s, sy - 2 * s, 3 * s, 2 * s); // banner flag

          // Big Round Clock Face
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 7 * s, sy + 6 * s, 6 * s, 6 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 8 * s, sy + 7 * s, 4 * s, 4 * s);
          // Clock hands pointing to 3 o'clock
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 9 * s, sy + 8 * s, 1 * s, 2 * s);
          ctx.fillRect(sx + 10 * s, sy + 9 * s, 2 * s, 1 * s);

          // Arched door on ground
          ctx.fillRect(sx + 8 * s, sy + 12 * s, 4 * s, 3 * s);
          break;
        }

        case "townhall": {
          // ── Grand Town Hall & Community Center ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 0 * s, sy + 17 * s, 24 * s, 4 * s);

          // Classical facade
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 1 * s, sy + 4 * s, 22 * s, 13 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 2 * s, sy + 5 * s, 20 * s, 11 * s);

          // Pediment roof gable with clock
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 1 * s, 18 * s, 4 * s);
          ctx.fillRect(sx + 6 * s, sy + 0 * s, 12 * s, 2 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 4 * s, sy + 2 * s, 16 * s, 2 * s);

          // Gable Clock Face
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 10 * s, sy + 1 * s, 4 * s, 3 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 11 * s, sy + 2 * s, 2 * s, 1 * s);

          // Classical Columns along front
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 4 * s, sy + 6 * s, 2 * s, 10 * s);
          ctx.fillRect(sx + 8 * s, sy + 6 * s, 2 * s, 10 * s);
          ctx.fillRect(sx + 14 * s, sy + 6 * s, 2 * s, 10 * s);
          ctx.fillRect(sx + 18 * s, sy + 6 * s, 2 * s, 10 * s);

          // Upper Windows
          ctx.fillRect(sx + 5 * s, sy + 6 * s, 2 * s, 3 * s);
          ctx.fillRect(sx + 17 * s, sy + 6 * s, 2 * s, 3 * s);

          // Grand Double Arched Doors & Steps
          ctx.fillRect(sx + 10 * s, sy + 9 * s, 4 * s, 7 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 11 * s, sy + 10 * s, 2 * s, 5 * s);
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 8 * s, sy + 15 * s, 8 * s, 2 * s); // wide steps
          break;
        }

        case "castle": {
          // ── Town Academy & Historic Grand Library ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 0 * s, sy + 17 * s, 24 * s, 4 * s);

          // Main Stone Library Manor
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 1 * s, sy + 4 * s, 22 * s, 13 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 2 * s, sy + 5 * s, 20 * s, 11 * s);

          // Stone battlements on roof
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 1 * s, sy + 2 * s, 4 * s, 3 * s);
          ctx.fillRect(sx + 7 * s, sy + 2 * s, 4 * s, 3 * s);
          ctx.fillRect(sx + 13 * s, sy + 2 * s, 4 * s, 3 * s);
          ctx.fillRect(sx + 19 * s, sy + 2 * s, 4 * s, 3 * s);

          // Ivy Climbing Walls (diagonal hatching)
          drawHatch(ctx, sx + 2 * s, sy + 8 * s, 4 * s, 7 * s, s, BLK);
          drawHatch(ctx, sx + 18 * s, sy + 8 * s, 4 * s, 7 * s, s, BLK);

          // Grand Arched Gothic Windows with mullions
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 4 * s, sy + 6 * s, 3 * s, 5 * s);
          ctx.fillRect(sx + 17 * s, sy + 6 * s, 3 * s, 5 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 5 * s, sy + 7 * s, 1 * s, 3 * s);
          ctx.fillRect(sx + 18 * s, sy + 7 * s, 1 * s, 3 * s);

          // Central Grand Portico & Doors
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 9 * s, sy + 8 * s, 6 * s, 8 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 10 * s, sy + 9 * s, 4 * s, 6 * s);
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 11 * s, sy + 10 * s, 2 * s, 5 * s); // double door
          break;
        }

        case "cathedral": {
          // ── Grand Glass Conservatory / Cathedral of Seasons ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 2 * s, sy + 17 * s, 20 * s, 4 * s);

          // Main Conservatory Body
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 4 * s, 18 * s, 13 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 4 * s, sy + 5 * s, 16 * s, 11 * s);

          // Glass Arches with Lattice Hatching
          drawHatch(ctx, sx + 4 * s, sy + 6 * s, 6 * s, 8 * s, s, BLK);
          drawHatch(ctx, sx + 14 * s, sy + 6 * s, 6 * s, 8 * s, s, BLK);

          // Grand Glass Center Dome & Spire
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 7 * s, sy + 1 * s, 10 * s, 4 * s);
          ctx.fillRect(sx + 9 * s, sy - 2 * s, 6 * s, 4 * s);
          ctx.fillRect(sx + 11 * s, sy - 5 * s, 2 * s, 4 * s); // tall spire
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 8 * s, sy + 2 * s, 8 * s, 2 * s);

          // Grand Entrance Portal
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 9 * s, sy + 9 * s, 6 * s, 8 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 10 * s, sy + 10 * s, 4 * s, 6 * s);
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 11 * s, sy + 11 * s, 2 * s, 5 * s);
          break;
        }
      }

      ctx.restore();
    },

    /** Draw town decorations matching Concept 1 */
    drawDecoration(ctx, type, sx, sy, scale) {
      const s = scale;
      const BLK = GB.BLACK;
      const WHT = GB.WHITE;

      switch (type) {
        case "tree": {
          // ── Lush Oak / Maple Town Tree ──
          // Drop shadow
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 14 * s, 11 * s, 2 * s);

          // Sturdy Wooden Trunk
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 6 * s, sy + 8 * s, 4 * s, 7 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 7 * s, sy + 9 * s, 2 * s, 5 * s);
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 8 * s, sy + 10 * s, 1 * s, 3 * s); // bark knot

          // Full Leafy Canopy
          ctx.fillRect(sx + 2 * s, sy + 1 * s, 12 * s, 9 * s);
          ctx.fillRect(sx + 4 * s, sy + 0 * s, 8 * s, 2 * s);
          ctx.fillRect(sx + 1 * s, sy + 3 * s, 14 * s, 5 * s);

          // White inner foliage
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 3 * s, sy + 2 * s, 10 * s, 7 * s);

          // 45° Diagonal Hatching for Leaf Clusters
          drawHatch(ctx, sx + 3 * s, sy + 2 * s, 10 * s, 7 * s, s, BLK);
          break;
        }

        case "rock": {
          // ── Mossy Garden Boulder ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 12 * s, 11 * s, 2 * s);

          // Boulder facets
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 6 * s, 10 * s, 7 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 4 * s, sy + 7 * s, 8 * s, 5 * s);

          // Shaded side with 45-degree hatching
          drawHatch(ctx, sx + 7 * s, sy + 7 * s, 5 * s, 5 * s, s, BLK);

          // Little grass tuft beside stone
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 2 * s, sy + 10 * s, 1 * s, 3 * s);
          ctx.fillRect(sx + 13 * s, sy + 11 * s, 1 * s, 2 * s);
          break;
        }

        case "flower": {
          // ── Wildflower Garden Cluster ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 4 * s, sy + 13 * s, 9 * s, 1 * s);

          // Stems & Leaves
          ctx.fillRect(sx + 5 * s, sy + 7 * s, 1 * s, 6 * s);
          ctx.fillRect(sx + 8 * s, sy + 5 * s, 1 * s, 8 * s);
          ctx.fillRect(sx + 11 * s, sy + 7 * s, 1 * s, 6 * s);

          // Blooming Flower Heads
          ctx.fillRect(sx + 4 * s, sy + 5 * s, 3 * s, 3 * s);
          ctx.fillRect(sx + 7 * s, sy + 3 * s, 3 * s, 3 * s);
          ctx.fillRect(sx + 10 * s, sy + 5 * s, 3 * s, 3 * s);

          // White Flower Centers
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 5 * s, sy + 6 * s, 1 * s, 1 * s);
          ctx.fillRect(sx + 8 * s, sy + 4 * s, 1 * s, 1 * s);
          ctx.fillRect(sx + 11 * s, sy + 6 * s, 1 * s, 1 * s);
          break;
        }

        case "fence": {
          // ── Wooden Picket Fence ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 0 * s, sy + 8 * s, 16 * s, 2 * s);
          ctx.fillRect(sx + 0 * s, sy + 12 * s, 16 * s, 2 * s);

          // Pointed picket slats
          for (let i = 0; i < 4; i++) {
            ctx.fillRect(sx + (1 + i * 4) * s, sy + 6 * s, 2 * s, 9 * s);
            ctx.fillRect(sx + (1 + i * 4) * s, sy + 5 * s, 1 * s, 1 * s); // pointed tip
          }
          break;
        }

        case "signpost": {
          // ── Rustic Wooden Guidepost ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 6 * s, sy + 13 * s, 5 * s, 2 * s); // base
          ctx.fillRect(sx + 7 * s, sy + 3 * s, 2 * s, 11 * s); // main post

          // Left pointing sign ("<- CAMP")
          ctx.fillRect(sx + 2 * s, sy + 3 * s, 7 * s, 4 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 3 * s, sy + 4 * s, 5 * s, 2 * s);
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 3 * s, sy + 4 * s, 1 * s, 2 * s); // arrow left

          // Right pointing sign ("TOWN ->")
          ctx.fillRect(sx + 7 * s, sy + 8 * s, 7 * s, 4 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 8 * s, sy + 9 * s, 5 * s, 2 * s);
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 12 * s, sy + 9 * s, 1 * s, 2 * s); // arrow right
          break;
        }

        case "bridge": {
          // ── Arched Stone Footbridge ──
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 0 * s, sy + 7 * s, 16 * s, 8 * s);
          ctx.fillStyle = WHT;
          ctx.fillRect(sx + 1 * s, sy + 8 * s, 14 * s, 5 * s);

          // Cobblestone arch balustrades
          ctx.fillStyle = BLK;
          ctx.fillRect(sx + 0 * s, sy + 6 * s, 16 * s, 2 * s);
          ctx.fillRect(sx + 0 * s, sy + 13 * s, 16 * s, 2 * s);
          drawHatch(ctx, sx + 1 * s, sy + 8 * s, 14 * s, 5 * s, s, BLK);
          break;
        }
      }
    },

    /** Draw top-down town tiles with retro paper tone and cobblestone paths */
    drawTile(ctx, type, sx, sy, tileW, tileH) {
      const s = 1;
      const BG = "#e8ebed"; // warm inviting retro paper background
      const BLK = GB.BLACK;

      // Base lawn fill
      ctx.fillStyle = BG;
      ctx.fillRect(sx, sy, tileW, tileH);

      // Subtle boundary grid dots
      ctx.fillStyle = "rgba(12, 12, 15, 0.08)";
      ctx.fillRect(sx, sy, 1, 1);
      ctx.fillRect(sx + tileW - 1, sy, 1, 1);

      if (type === "dirt" || type === "grass_light") {
        // Soft village trail with 45° diagonal hatched borders
        drawHatch(ctx, sx + 4, sy + 4, tileW - 8, tileH - 8, s, "rgba(12, 12, 15, 0.4)");
      } else if (type === "stone") {
        // Village square cobblestone pavers
        ctx.strokeStyle = "rgba(12, 12, 15, 0.4)";
        ctx.lineWidth = 1;
        // Rounded interlocking pavers
        ctx.strokeRect(sx + 2, sy + 2, tileW / 2 - 3, tileH / 2 - 3);
        ctx.strokeRect(sx + tileW / 2 + 1, sy + 2, tileW / 2 - 3, tileH / 2 - 3);
        ctx.strokeRect(sx + 2, sy + tileH / 2 + 1, tileW / 2 - 3, tileH / 2 - 3);
        ctx.strokeRect(sx + tileW / 2 + 1, sy + tileH / 2 + 1, tileW / 2 - 3, tileH / 2 - 3);
      } else {
        // Natural tiny grass blade tufts
        ctx.fillStyle = "rgba(12, 12, 15, 0.3)";
        ctx.fillRect(sx + 8, sy + 10, 1, 2);
        ctx.fillRect(sx + 9, sy + 11, 1, 2);
        ctx.fillRect(sx + 22, sy + 20, 1, 2);
        ctx.fillRect(sx + 23, sy + 21, 1, 2);
      }
    },
  };

  /* ─────────────────────────────────────────────────────
     MODULE 5 — 2D TOP-DOWN ENGINE (Orthographic)
  ───────────────────────────────────────────────────── */
  const TILE_W = 36;
  const TILE_H = 36;

  const Iso = {
    /** Convert grid coordinates to screen position (top-down 2D) */
    gridToScreen(gx, gy, camera) {
      const sx = gx * TILE_W - camera.x + camera.canvasW / 2;
      const sy = gy * TILE_H - camera.y + camera.canvasH / 2;
      return { x: sx, y: sy };
    },

    /** Convert screen position to grid coordinates (top-down 2D) */
    screenToGrid(sx, sy, camera) {
      const worldX = sx - camera.canvasW / 2 + camera.x;
      const worldY = sy - camera.canvasH / 2 + camera.y;
      return {
        x: Math.round(worldX / TILE_W),
        y: Math.round(worldY / TILE_H),
      };
    },

    /** Create a camera object */
    createCamera(canvasW, canvasH) {
      return {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        zoom: 1,
        canvasW,
        canvasH,
        autoPan: false,
        autoPanAngle: 0,
        autoPanSpeed: 0.002,
        autoPanRadius: 80,
      };
    },

    /** Smoothly interpolate camera to target */
    updateCamera(camera) {
      if (camera.autoPan) {
        camera.autoPanAngle += camera.autoPanSpeed;
        camera.targetX = Math.cos(camera.autoPanAngle) * camera.autoPanRadius;
        camera.targetY = Math.sin(camera.autoPanAngle * 0.7) * camera.autoPanRadius * 0.5;
      }
      camera.x += (camera.targetX - camera.x) * 0.05;
      camera.y += (camera.targetY - camera.y) * 0.05;
    },

    /** Sort entities by Y depth for correct top-down overlap */
    depthSort(entities) {
      return entities.sort((a, b) => a.gy - b.gy);
    },
  };

  /* ─────────────────────────────────────────────────────
     MODULE 6 — VILLAGE STAGE SYSTEM
  ───────────────────────────────────────────────────── */
  const ERA_THRESHOLDS = [
    { min: 0,   name: "campsite",   label: "Campsite Era" },
    { min: 4,   name: "settlement", label: "Settlement Era" },
    { min: 11,  name: "hamlet",     label: "Hamlet Era" },
    { min: 26,  name: "village",    label: "Village Era" },
    { min: 51,  name: "town",       label: "Town Era" },
    { min: 101, name: "city",       label: "City Era" },
    { min: 251, name: "metropolis", label: "Metropolis Era" },
  ];

  const Stages = {
    /** Get the era name for a given population count */
    getEraForPopulation(pop) {
      let era = ERA_THRESHOLDS[0];
      for (const t of ERA_THRESHOLDS) {
        if (pop >= t.min) era = t;
      }
      return era.name;
    },

    /** Get the era info (name, label, progress to next) */
    getEraInfo(pop) {
      let currentIdx = 0;
      for (let i = 0; i < ERA_THRESHOLDS.length; i++) {
        if (pop >= ERA_THRESHOLDS[i].min) currentIdx = i;
      }
      const current = ERA_THRESHOLDS[currentIdx];
      const next = ERA_THRESHOLDS[currentIdx + 1];
      let progress = 1;
      if (next) {
        progress = (pop - current.min) / (next.min - current.min);
      }
      return { name: current.name, label: current.label, progress, nextLabel: next ? next.label : null };
    },

    /** Generate the world layout (tiles + buildings + decorations) for a given population */
    generateWorld(population) {
      const era = this.getEraForPopulation(population);
      const world = { tiles: [], buildings: [], decorations: [] };
      const gridSize = Math.max(8, Math.min(30, 6 + Math.floor(population / 5)));

      // ── Ground tiles ──
      for (let gx = -gridSize; gx <= gridSize; gx++) {
        for (let gy = -gridSize; gy <= gridSize; gy++) {
          const dist = Math.abs(gx) + Math.abs(gy);
          let type = "grass";

          // paths near center
          if ((gx === 0 || gy === 0) && dist < gridSize * 0.7) {
            type = population >= 26 ? "stone" : (population >= 4 ? "dirt" : "grass");
          }
          // alternate grass shades
          if (type === "grass" && (gx + gy) % 3 === 0) {
            type = "grass_light";
          }

          world.tiles.push({ gx, gy, type });
        }
      }

      // ── Buildings — spiral placement from center ──
      const buildingPlan = this._getBuildingPlan(era, population);
      const spiralPositions = this._spiralGrid(buildingPlan.length, 2);

      buildingPlan.forEach((btype, i) => {
        const pos = spiralPositions[i];
        world.buildings.push({ gx: pos.x, gy: pos.y, type: btype });
      });

      // ── Decorations — scattered around edges ──
      const decoTypes = ["tree", "rock", "flower"];
      const decoCount = Math.min(25, 8 + Math.floor(population / 3));
      const rng = this._seededRandom(population);

      for (let i = 0; i < decoCount; i++) {
        const gx = Math.floor(rng() * gridSize * 2) - gridSize;
        const gy = Math.floor(rng() * gridSize * 2) - gridSize;
        // don't place on buildings or paths
        const onBuilding = world.buildings.some(
          (b) => Math.abs(b.gx - gx) < 2 && Math.abs(b.gy - gy) < 2,
        );
        const onPath = (gx === 0 || gy === 0) && Math.abs(gx) + Math.abs(gy) < gridSize * 0.7;
        if (!onBuilding && !onPath) {
          world.decorations.push({ gx, gy, type: decoTypes[i % decoTypes.length] });
        }
      }

      // add fences in hamlet+
      if (population >= 11) {
        world.decorations.push({ gx: 3, gy: 3, type: "fence" });
        world.decorations.push({ gx: -3, gy: -3, type: "fence" });
      }
      // add signpost in hamlet+
      if (population >= 11) {
        world.decorations.push({ gx: 1, gy: -1, type: "signpost" });
      }
      // add bridge in town+
      if (population >= 51) {
        world.decorations.push({ gx: 5, gy: 0, type: "bridge" });
      }

      return world;
    },

    /** Get the list of buildings for an era */
    _getBuildingPlan(era, population) {
      const buildings = [];

      // campsite (1-3)
      buildings.push("campfire");
      if (population >= 2) buildings.push("tent");
      if (population >= 3) buildings.push("tent");

      // settlement (4-10)
      if (population >= 4) buildings.push("hut");
      if (population >= 6) buildings.push("hut");
      if (population >= 8) buildings.push("well");
      if (population >= 10) buildings.push("hut");

      // hamlet (11-25)
      if (population >= 11) buildings.push("house");
      if (population >= 15) buildings.push("farm");
      if (population >= 18) buildings.push("house");
      if (population >= 22) buildings.push("house");

      // village (26-50)
      if (population >= 26) buildings.push("market");
      if (population >= 30) buildings.push("house");
      if (population >= 35) buildings.push("watchtower");
      if (population >= 40) buildings.push("house");
      if (population >= 45) buildings.push("farm");

      // town (51-100)
      if (population >= 51) buildings.push("townhall");
      if (population >= 60) buildings.push("house");
      if (population >= 70) buildings.push("house");
      if (population >= 80) buildings.push("market");
      if (population >= 90) buildings.push("house");

      // city (101-250)
      if (population >= 101) buildings.push("castle");
      if (population >= 120) buildings.push("cathedral");
      if (population >= 150) buildings.push("house");
      if (population >= 180) buildings.push("watchtower");
      if (population >= 200) buildings.push("house");
      if (population >= 230) buildings.push("market");

      // metropolis (251+)
      if (population >= 251) {
        buildings.push("townhall");
        buildings.push("house");
        buildings.push("house");
      }

      return buildings;
    },

    /** Generate spiral grid positions starting from center */
    _spiralGrid(count, spacing) {
      const positions = [{ x: 0, y: 0 }];
      let x = 0, y = 0, dx = spacing, dy = 0;
      let steps = 1, stepsTaken = 0, turns = 0;

      while (positions.length < count) {
        x += dx;
        y += dy;
        positions.push({ x, y });
        stepsTaken++;

        if (stepsTaken >= steps) {
          stepsTaken = 0;
          turns++;
          // rotate direction
          [dx, dy] = [-dy, dx];
          if (turns % 2 === 0) steps++;
        }
      }
      return positions;
    },

    /** Simple seeded PRNG for deterministic decoration placement */
    _seededRandom(seed) {
      let s = seed + 1;
      return () => {
        s = (s * 16807 + 0) % 2147483647;
        return s / 2147483647;
      };
    },
  };

  /* ─────────────────────────────────────────────────────
     MODULE 7 — CHARACTER AI
  ───────────────────────────────────────────────────── */
  const AI = {
    /** Initialize AI state for a character */
    initState(char, world) {
      return {
        fingerprint: char.fingerprint,
        gx: char.position_x || (Math.random() * 4 - 2),
        gy: char.position_y || (Math.random() * 4 - 2),
        targetGx: 0,
        targetGy: 0,
        state: "idle", // idle, walking, working
        stateTimer: Math.random() * 3 + 2,
        frame: 0,
        frameTimer: 0,
        facingRight: Math.random() > 0.5,
        isDragged: false,
      };
    },

    /** Update all AI agents */
    updateAll(agents, world, dt) {
      agents.forEach((agent) => {
        if (agent.isDragged) return;

        agent.stateTimer -= dt;
        agent.frameTimer += dt;

        // advance animation frame
        if (agent.frameTimer > 0.25) {
          agent.frameTimer = 0;
          agent.frame++;
        }

        // pick new action when timer expires
        if (agent.stateTimer <= 0) {
          this._pickAction(agent, world);
        }

        // execute current state
        if (agent.state === "walking") {
          const dx = agent.targetGx - agent.gx;
          const dy = agent.targetGy - agent.gy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 0.1) {
            agent.state = "idle";
            agent.stateTimer = Math.random() * 4 + 2;
          } else {
            const speed = 1.5 * dt;
            agent.gx += (dx / dist) * speed;
            agent.gy += (dy / dist) * speed;
            agent.facingRight = dx > 0;
          }
        }
      });
    },

    /** Pick a new action for an agent */
    _pickAction(agent, world) {
      const roll = Math.random();

      if (roll < 0.5 && world.buildings.length > 0) {
        // walk to a building
        const target = world.buildings[Math.floor(Math.random() * world.buildings.length)];
        agent.targetGx = target.gx + (Math.random() * 2 - 1);
        agent.targetGy = target.gy + (Math.random() * 2 - 1);
        agent.state = "walking";
        agent.stateTimer = 8;
      } else if (roll < 0.8) {
        // wander randomly
        agent.targetGx = agent.gx + (Math.random() * 6 - 3);
        agent.targetGy = agent.gy + (Math.random() * 6 - 3);
        agent.state = "walking";
        agent.stateTimer = 6;
      } else {
        // idle
        agent.state = "idle";
        agent.stateTimer = Math.random() * 4 + 2;
      }
    },
  };

  /* ─────────────────────────────────────────────────────
     MODULE 8 — DAY/NIGHT CYCLE
  ───────────────────────────────────────────────────── */
  const DayNight = {
    /** Get the current time-of-day lighting info */
    getTimeInfo() {
      const now = new Date();
      const hour = now.getHours() + now.getMinutes() / 60;
      let phase, overlay, emoji, label;

      if (hour >= 6 && hour < 8) {
        phase = "dawn";
        overlay = "rgba(255, 255, 255, 0.04)";
        emoji = "🌅";
        label = "Dawn";
      } else if (hour >= 8 && hour < 17) {
        phase = "day";
        overlay = "rgba(255, 255, 255, 0.02)";
        emoji = "☀️";
        label = "Day";
      } else if (hour >= 17 && hour < 19) {
        phase = "dusk";
        overlay = "rgba(0, 0, 0, 0.08)";
        emoji = "🌇";
        label = "Dusk";
      } else if (hour >= 19 && hour < 22) {
        phase = "evening";
        overlay = "rgba(0, 0, 0, 0.15)";
        emoji = "🌙";
        label = "Evening";
      } else {
        phase = "night";
        overlay = "rgba(0, 0, 0, 0.25)";
        emoji = "🌙";
        label = "Night";
      }

      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return { phase, overlay, emoji, label, timeStr, hour };
    },

    /** Draw the day/night overlay on the canvas */
    drawOverlay(ctx, width, height, subtle) {
      const info = this.getTimeInfo();
      const overlayColor = subtle ? info.overlay.replace(/[\d.]+\)$/, (m) => parseFloat(m) * 0.5 + ")") : info.overlay;

      ctx.fillStyle = overlayColor;
      ctx.fillRect(0, 0, width, height);

      // stars at night (white dots)
      if (info.phase === "night" || info.phase === "evening") {
        const starCount = info.phase === "night" ? 40 : 15;
        ctx.fillStyle = "#ffffff";
        for (let i = 0; i < starCount; i++) {
          const sx = ((i * 7919 + 1) % width);
          const sy = ((i * 6271 + 3) % (height * 0.4));
          const twinkle = Math.sin(Date.now() * 0.002 + i) * 0.5 + 0.5;
          ctx.globalAlpha = twinkle * 0.6;
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
        ctx.globalAlpha = 1;
      }

      return info;
    },

    /** Draw glow effects for light sources (white glow — monochrome) */
    drawGlow(ctx, sx, sy, radius, intensity) {
      const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${0.15 * intensity})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
    },
  };

  /* ─────────────────────────────────────────────────────
     MODULE 9 — SOUND SYSTEM (Web Audio API)
  ───────────────────────────────────────────────────── */
  const Sound = {
    _ctx: null,
    _masterGain: null,
    _muted: true,
    _initialized: false,
    _activeNodes: [],

    /** Initialize the audio context (must be called after user gesture) */
    init() {
      if (this._initialized) return;
      try {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._masterGain = this._ctx.createGain();
        this._masterGain.gain.value = 0;
        this._masterGain.connect(this._ctx.destination);
        this._initialized = true;
      } catch (e) {
        console.warn("Web Audio API not available:", e);
      }
    },

    /** Toggle mute state */
    toggleMute() {
      if (!this._initialized) this.init();
      this._muted = !this._muted;
      if (this._masterGain) {
        this._masterGain.gain.linearRampToValueAtTime(
          this._muted ? 0 : 0.3,
          this._ctx.currentTime + 0.5,
        );
      }
      return this._muted;
    },

    /** Start the ambient loop for a given era and time-of-day */
    startAmbience(era, timePhase) {
      if (!this._initialized || !this._ctx) return;
      this._stopAll();

      // fire crackle — always present
      this._startFireCrackle();

      // wind — always present, subtle
      this._startWind();

      // birds or crickets based on time
      if (timePhase === "day" || timePhase === "dawn" || timePhase === "dusk") {
        this._startBirds();
      } else {
        this._startCrickets();
      }
    },

    _stopAll() {
      this._activeNodes.forEach((n) => {
        try { n.stop(); } catch {}
      });
      this._activeNodes = [];
    },

    _startFireCrackle() {
      if (!this._ctx) return;
      const bufferSize = this._ctx.sampleRate * 2;
      const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.97 ? 0.8 : 0.02);
      }

      const source = this._ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = this._ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 800;
      filter.Q.value = 0.5;

      const gain = this._ctx.createGain();
      gain.gain.value = 0.15;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this._masterGain);
      source.start();
      this._activeNodes.push(source);
    },

    _startWind() {
      if (!this._ctx) return;
      const bufferSize = this._ctx.sampleRate * 3;
      const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
      }

      const source = this._ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = this._ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 300;

      const gain = this._ctx.createGain();
      gain.gain.value = 0.06;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this._masterGain);
      source.start();
      this._activeNodes.push(source);
    },

    _startBirds() {
      if (!this._ctx) return;
      const chirp = () => {
        if (this._muted || !this._ctx) return;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(2000 + Math.random() * 2000, this._ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
          1000 + Math.random() * 1500,
          this._ctx.currentTime + 0.15,
        );
        gain.gain.setValueAtTime(0.05, this._ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start();
        osc.stop(this._ctx.currentTime + 0.2);
      };

      // random chirps
      const interval = setInterval(() => {
        if (this._muted) return;
        chirp();
        if (Math.random() > 0.6) setTimeout(chirp, 100 + Math.random() * 100);
      }, 2000 + Math.random() * 4000);

      // store interval for cleanup
      this._activeNodes.push({ stop: () => clearInterval(interval) });
    },

    _startCrickets() {
      if (!this._ctx) return;
      const chirp = () => {
        if (this._muted || !this._ctx) return;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 4000 + Math.random() * 1000;
        gain.gain.setValueAtTime(0.02, this._ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start();
        osc.stop(this._ctx.currentTime + 0.08);
      };

      const interval = setInterval(() => {
        if (this._muted) return;
        chirp();
        setTimeout(chirp, 60);
        setTimeout(chirp, 120);
      }, 800 + Math.random() * 1200);

      this._activeNodes.push({ stop: () => clearInterval(interval) });
    },
  };

  /* ─────────────────────────────────────────────────────
     MAIN RENDER LOOP
  ───────────────────────────────────────────────────── */
  const Renderer = {
    /** Render one frame of the civilization */
    renderFrame(ctx, canvas, world, visitors, agents, camera, options) {
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // ── Background (Warm Inviting Retro Paper Tone) ──
      ctx.fillStyle = "#e8ebed";
      ctx.fillRect(0, 0, w, h);

      // ── Ground tiles ──
      world.tiles.forEach((tile) => {
        const pos = Iso.gridToScreen(tile.gx, tile.gy, camera);
        // Only draw tiles visible in viewport
        if (pos.x >= -TILE_W && pos.x <= w + TILE_W && pos.y >= -TILE_H && pos.y <= h + TILE_H) {
          PixelArt.drawTile(ctx, tile.type, pos.x, pos.y, TILE_W, TILE_H);
        }
      });

      // ── Collect all entities for depth sorting ──
      const entities = [];

      world.buildings.forEach((b) => {
        entities.push({ gx: b.gx, gy: b.gy, type: "building", data: b });
      });

      world.decorations.forEach((d) => {
        entities.push({ gx: d.gx, gy: d.gy, type: "decoration", data: d });
      });

      // map agents to visitor data
      const visitorMap = {};
      visitors.forEach((v) => { visitorMap[v.fingerprint] = v; });

      agents.forEach((a) => {
        entities.push({ gx: a.gx, gy: a.gy, type: "character", data: a });
      });

      // ── Depth sort and render (by Y) ──
      Iso.depthSort(entities);

      const timeInfo = DayNight.getTimeInfo();
      const isNight = timeInfo.phase === "night" || timeInfo.phase === "evening";
      const pixelScale = options.pixelScale || 2;

      entities.forEach((e) => {
        const pos = Iso.gridToScreen(e.gx, e.gy, camera);

        if (e.type === "building") {
          PixelArt.drawBuilding(ctx, e.data.type, pos.x - 10 * pixelScale, pos.y - 12 * pixelScale, pixelScale);
          // warm glow at night for windows and firepit
          if (isNight) {
            if (e.data.type === "campfire" || e.data.type === "watchtower") {
              DayNight.drawGlow(ctx, pos.x, pos.y, 40, 0.8);
            } else if (["hut", "house", "townhall", "castle", "cathedral"].includes(e.data.type)) {
              DayNight.drawGlow(ctx, pos.x, pos.y - 4 * pixelScale, 30, 0.4);
            }
          }
        } else if (e.type === "decoration") {
          PixelArt.drawDecoration(ctx, e.data.type, pos.x - 8 * pixelScale, pos.y - 8 * pixelScale, pixelScale);
        } else if (e.type === "character") {
          const charData = visitorMap[e.data.fingerprint];
          if (charData) {
            PixelArt.drawCharacter(
              ctx, charData,
              pos.x - 8 * pixelScale, pos.y - 10 * pixelScale,
              pixelScale, e.data.frame, e.data.facingRight,
            );
          }
        }
      });

      // ── Day/night overlay ──
      DayNight.drawOverlay(ctx, w, h, options.subtleDayNight);

      return timeInfo;
    },
  };

  /* ─────────────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────────────── */
  return {
    DB,
    Fingerprint,
    CharGen,
    PixelArt,
    Iso,
    Stages,
    AI,
    DayNight,
    Sound,
    Renderer,
    GB,
    TILE_W,
    TILE_H,
  };
})();
