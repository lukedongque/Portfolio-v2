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

  const SKIN_TONES = [
    "#fde0c5", "#f5c5a3", "#d4a373", "#b07d56", "#8b5e3c", "#5c3a21",
  ];

  const HAIR_COLORS = [
    "#2c1810", "#4a2c17", "#8b4513", "#d2691e", "#daa520",
    "#f5deb3", "#cd5c5c", "#708090", "#c0c0c0", "#1a1a2e",
  ];

  const OUTFIT_COLORS = [
    "#c0392b", "#2980b9", "#27ae60", "#8e44ad", "#d35400",
    "#16a085", "#2c3e50", "#7f8c8d", "#f39c12", "#1abc9c",
    "#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#e67e22",
  ];

  const ROLES_BY_ERA = {
    campsite:   ["Founder"],
    settlement: ["Pioneer"],
    hamlet:     ["Builder"],
    village:    ["Farmer", "Merchant", "Guard"],
    town:       ["Scholar", "Artisan", "Healer"],
    city:       ["Knight", "Alchemist", "Diplomat"],
    metropolis: ["Citizen", "Engineer", "Architect"],
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
  const PixelArt = {
    /** Draw a character at a screen position.
     *  char = visitor DB row, frame = animation frame index */
    drawCharacter(ctx, char, sx, sy, scale, frame, facingRight) {
      const s = scale; // pixel size
      const skinColor = SKIN_TONES[char.skin_tone] || SKIN_TONES[0];
      const hairColor = HAIR_COLORS[char.hair_color] || HAIR_COLORS[0];
      const outfitColor = char.outfit_color || OUTFIT_COLORS[0];
      const accentColor = char.accent_color || OUTFIT_COLORS[1];

      ctx.save();

      // flip if facing left
      if (!facingRight) {
        ctx.translate(sx + 8 * s, 0);
        ctx.scale(-1, 1);
        ctx.translate(-(sx + 8 * s), 0);
      }

      // ── Shadow ──
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(sx + 2 * s, sy + 15 * s, 12 * s, 2 * s);

      // ── Feet / walk animation ──
      const walkOffset = frame % 4;
      const leftFootX = walkOffset === 1 ? 4 : 5;
      const rightFootX = walkOffset === 3 ? 10 : 9;
      ctx.fillStyle = "#2c1810";
      ctx.fillRect(sx + leftFootX * s, sy + 14 * s, 2 * s, 2 * s);
      ctx.fillRect(sx + rightFootX * s, sy + 14 * s, 2 * s, 2 * s);

      // ── Legs ──
      ctx.fillStyle = "#3d3d56";
      ctx.fillRect(sx + 5 * s, sy + 12 * s, 2 * s, 2 * s);
      ctx.fillRect(sx + 9 * s, sy + 12 * s, 2 * s, 2 * s);

      // ── Body ──
      ctx.fillStyle = outfitColor;
      ctx.fillRect(sx + 4 * s, sy + 8 * s, 8 * s, 4 * s);

      // ── Accent (belt / stripe) ──
      ctx.fillStyle = accentColor;
      ctx.fillRect(sx + 4 * s, sy + 11 * s, 8 * s, 1 * s);

      // ── Arms ──
      ctx.fillStyle = outfitColor;
      ctx.fillRect(sx + 2 * s, sy + 8 * s, 2 * s, 3 * s);
      ctx.fillRect(sx + 12 * s, sy + 8 * s, 2 * s, 3 * s);

      // ── Hands ──
      ctx.fillStyle = skinColor;
      ctx.fillRect(sx + 2 * s, sy + 11 * s, 2 * s, 1 * s);
      ctx.fillRect(sx + 12 * s, sy + 11 * s, 2 * s, 1 * s);

      // ── Head ──
      ctx.fillStyle = skinColor;
      ctx.fillRect(sx + 5 * s, sy + 3 * s, 6 * s, 5 * s);

      // ── Eyes ──
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(sx + 7 * s, sy + 5 * s, 1 * s, 1 * s);
      ctx.fillRect(sx + 9 * s, sy + 5 * s, 1 * s, 1 * s);

      // ── Hair (varies by hair_style) ──
      ctx.fillStyle = hairColor;
      const hs = char.hair_style % 8;
      // top of head — always
      ctx.fillRect(sx + 4 * s, sy + 2 * s, 8 * s, 2 * s);

      if (hs === 0) {
        // short
        ctx.fillRect(sx + 4 * s, sy + 3 * s, 1 * s, 2 * s);
      } else if (hs === 1) {
        // long left
        ctx.fillRect(sx + 4 * s, sy + 3 * s, 1 * s, 5 * s);
      } else if (hs === 2) {
        // long both
        ctx.fillRect(sx + 4 * s, sy + 3 * s, 1 * s, 5 * s);
        ctx.fillRect(sx + 11 * s, sy + 3 * s, 1 * s, 5 * s);
      } else if (hs === 3) {
        // mohawk
        ctx.fillRect(sx + 6 * s, sy + 0 * s, 4 * s, 2 * s);
      } else if (hs === 4) {
        // ponytail
        ctx.fillRect(sx + 11 * s, sy + 2 * s, 2 * s, 4 * s);
      } else if (hs === 5) {
        // bald — just the top strip already drawn
      } else if (hs === 6) {
        // spiky
        ctx.fillRect(sx + 5 * s, sy + 1 * s, 2 * s, 1 * s);
        ctx.fillRect(sx + 8 * s, sy + 0 * s, 2 * s, 2 * s);
        ctx.fillRect(sx + 11 * s, sy + 1 * s, 1 * s, 1 * s);
      } else {
        // bowl cut
        ctx.fillRect(sx + 4 * s, sy + 3 * s, 8 * s, 1 * s);
      }

      // ── Accessory ──
      if (char.accessory === 1) {
        // hat
        ctx.fillStyle = accentColor;
        ctx.fillRect(sx + 3 * s, sy + 1 * s, 10 * s, 2 * s);
        ctx.fillRect(sx + 5 * s, sy + 0 * s, 6 * s, 1 * s);
      } else if (char.accessory === 2) {
        // scarf
        ctx.fillStyle = accentColor;
        ctx.fillRect(sx + 4 * s, sy + 7 * s, 8 * s, 2 * s);
      } else if (char.accessory === 3) {
        // glasses
        ctx.fillStyle = "#e0e0e0";
        ctx.fillRect(sx + 6 * s, sy + 5 * s, 3 * s, 1 * s);
        ctx.fillRect(sx + 10 * s, sy + 5 * s, 1 * s, 1 * s);
      } else if (char.accessory === 4) {
        // bandana
        ctx.fillStyle = accentColor;
        ctx.fillRect(sx + 4 * s, sy + 3 * s, 8 * s, 1 * s);
      }

      ctx.restore();
    },

    /** Draw a character portrait (for the "Your Character" panel) on a 64×64 canvas */
    drawPortrait(canvas, char) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 64, 64);
      ctx.imageSmoothingEnabled = false;

      // draw character centered, scaled up 3x
      this.drawCharacter(ctx, char, 8, 8, 3, 0, true);
    },

    /** Draw a building at screen position */
    drawBuilding(ctx, type, sx, sy, scale) {
      const s = scale;
      ctx.save();

      switch (type) {
        case "campfire":
          // logs
          ctx.fillStyle = "#5c3a21";
          ctx.fillRect(sx + 2 * s, sy + 10 * s, 12 * s, 2 * s);
          ctx.fillRect(sx + 4 * s, sy + 8 * s, 8 * s, 2 * s);
          // flames (animated via frame)
          const flicker = Math.random() > 0.5;
          ctx.fillStyle = "#e74c3c";
          ctx.fillRect(sx + 5 * s, sy + (flicker ? 4 : 5) * s, 6 * s, 4 * s);
          ctx.fillStyle = "#f39c12";
          ctx.fillRect(sx + 6 * s, sy + (flicker ? 3 : 4) * s, 4 * s, 3 * s);
          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(sx + 7 * s, sy + (flicker ? 2 : 3) * s, 2 * s, 2 * s);
          break;

        case "tent":
          ctx.fillStyle = "#8b7355";
          // triangle-ish shape
          ctx.fillRect(sx + 4 * s, sy + 4 * s, 8 * s, 8 * s);
          ctx.fillStyle = "#a0896b";
          ctx.fillRect(sx + 5 * s, sy + 2 * s, 6 * s, 2 * s);
          ctx.fillRect(sx + 6 * s, sy + 0 * s, 4 * s, 2 * s);
          // opening
          ctx.fillStyle = "#2c1810";
          ctx.fillRect(sx + 6 * s, sy + 8 * s, 4 * s, 4 * s);
          break;

        case "hut":
          // walls
          ctx.fillStyle = "#8b7355";
          ctx.fillRect(sx + 2 * s, sy + 6 * s, 12 * s, 8 * s);
          // roof
          ctx.fillStyle = "#5c3a21";
          ctx.fillRect(sx + 1 * s, sy + 4 * s, 14 * s, 3 * s);
          ctx.fillRect(sx + 3 * s, sy + 2 * s, 10 * s, 2 * s);
          // door
          ctx.fillStyle = "#2c1810";
          ctx.fillRect(sx + 6 * s, sy + 10 * s, 4 * s, 4 * s);
          // window
          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(sx + 11 * s, sy + 8 * s, 2 * s, 2 * s);
          break;

        case "well":
          ctx.fillStyle = "#708090";
          ctx.fillRect(sx + 4 * s, sy + 8 * s, 8 * s, 4 * s);
          ctx.fillStyle = "#5c3a21";
          ctx.fillRect(sx + 3 * s, sy + 4 * s, 1 * s, 4 * s);
          ctx.fillRect(sx + 12 * s, sy + 4 * s, 1 * s, 4 * s);
          ctx.fillRect(sx + 3 * s, sy + 3 * s, 10 * s, 1 * s);
          ctx.fillStyle = "#4a90d9";
          ctx.fillRect(sx + 5 * s, sy + 9 * s, 6 * s, 2 * s);
          break;

        case "house":
          // stone walls
          ctx.fillStyle = "#a0896b";
          ctx.fillRect(sx + 1 * s, sy + 6 * s, 14 * s, 10 * s);
          // roof
          ctx.fillStyle = "#c0392b";
          ctx.fillRect(sx + 0 * s, sy + 4 * s, 16 * s, 3 * s);
          ctx.fillRect(sx + 2 * s, sy + 2 * s, 12 * s, 2 * s);
          // door
          ctx.fillStyle = "#5c3a21";
          ctx.fillRect(sx + 6 * s, sy + 11 * s, 4 * s, 5 * s);
          // windows
          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(sx + 3 * s, sy + 8 * s, 2 * s, 2 * s);
          ctx.fillRect(sx + 11 * s, sy + 8 * s, 2 * s, 2 * s);
          break;

        case "farm":
          // soil
          ctx.fillStyle = "#5c3a21";
          ctx.fillRect(sx + 0 * s, sy + 10 * s, 16 * s, 6 * s);
          // crop rows
          ctx.fillStyle = "#27ae60";
          for (let i = 0; i < 4; i++) {
            ctx.fillRect(sx + (1 + i * 4) * s, sy + 8 * s, 2 * s, 2 * s);
            ctx.fillRect(sx + (1 + i * 4) * s, sy + 6 * s, 1 * s, 2 * s);
          }
          break;

        case "market":
          // stall base
          ctx.fillStyle = "#8b7355";
          ctx.fillRect(sx + 1 * s, sy + 8 * s, 14 * s, 6 * s);
          // awning
          ctx.fillStyle = "#e74c3c";
          ctx.fillRect(sx + 0 * s, sy + 5 * s, 16 * s, 3 * s);
          // stripes
          ctx.fillStyle = "#f1f3f5";
          ctx.fillRect(sx + 0 * s, sy + 6 * s, 16 * s, 1 * s);
          // goods
          ctx.fillStyle = "#f39c12";
          ctx.fillRect(sx + 3 * s, sy + 9 * s, 2 * s, 2 * s);
          ctx.fillStyle = "#27ae60";
          ctx.fillRect(sx + 7 * s, sy + 9 * s, 2 * s, 2 * s);
          ctx.fillStyle = "#3498db";
          ctx.fillRect(sx + 11 * s, sy + 9 * s, 2 * s, 2 * s);
          break;

        case "watchtower":
          ctx.fillStyle = "#708090";
          ctx.fillRect(sx + 5 * s, sy + 2 * s, 6 * s, 14 * s);
          ctx.fillStyle = "#5c3a21";
          ctx.fillRect(sx + 3 * s, sy + 0 * s, 10 * s, 3 * s);
          ctx.fillStyle = "#2c1810";
          ctx.fillRect(sx + 7 * s, sy + 12 * s, 2 * s, 4 * s);
          // flag
          ctx.fillStyle = "#e74c3c";
          ctx.fillRect(sx + 10 * s, sy + 0 * s, 4 * s, 2 * s);
          break;

        case "townhall":
          ctx.fillStyle = "#a0896b";
          ctx.fillRect(sx + 0 * s, sy + 6 * s, 16 * s, 10 * s);
          ctx.fillStyle = "#708090";
          ctx.fillRect(sx + 0 * s, sy + 4 * s, 16 * s, 3 * s);
          ctx.fillRect(sx + 2 * s, sy + 2 * s, 12 * s, 2 * s);
          ctx.fillRect(sx + 4 * s, sy + 0 * s, 8 * s, 2 * s);
          // columns
          ctx.fillStyle = "#f1f3f5";
          ctx.fillRect(sx + 2 * s, sy + 7 * s, 2 * s, 8 * s);
          ctx.fillRect(sx + 12 * s, sy + 7 * s, 2 * s, 8 * s);
          // door
          ctx.fillStyle = "#5c3a21";
          ctx.fillRect(sx + 6 * s, sy + 11 * s, 4 * s, 5 * s);
          break;

        case "castle":
          // main body
          ctx.fillStyle = "#708090";
          ctx.fillRect(sx + 2 * s, sy + 4 * s, 12 * s, 12 * s);
          // towers
          ctx.fillRect(sx + 0 * s, sy + 2 * s, 4 * s, 14 * s);
          ctx.fillRect(sx + 12 * s, sy + 2 * s, 4 * s, 14 * s);
          // battlements
          ctx.fillStyle = "#5a6a7a";
          ctx.fillRect(sx + 0 * s, sy + 0 * s, 2 * s, 2 * s);
          ctx.fillRect(sx + 3 * s, sy + 0 * s, 2 * s, 2 * s);
          ctx.fillRect(sx + 12 * s, sy + 0 * s, 2 * s, 2 * s);
          ctx.fillRect(sx + 15 * s, sy + 0 * s, 2 * s, 2 * s);
          // gate
          ctx.fillStyle = "#2c1810";
          ctx.fillRect(sx + 6 * s, sy + 10 * s, 4 * s, 6 * s);
          // windows
          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(sx + 1 * s, sy + 6 * s, 2 * s, 2 * s);
          ctx.fillRect(sx + 13 * s, sy + 6 * s, 2 * s, 2 * s);
          break;

        case "cathedral":
          ctx.fillStyle = "#a0896b";
          ctx.fillRect(sx + 2 * s, sy + 6 * s, 12 * s, 10 * s);
          ctx.fillStyle = "#708090";
          ctx.fillRect(sx + 4 * s, sy + 2 * s, 8 * s, 4 * s);
          ctx.fillRect(sx + 6 * s, sy + 0 * s, 4 * s, 2 * s);
          // cross
          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(sx + 7 * s, sy - 2 * s, 2 * s, 3 * s);
          ctx.fillRect(sx + 6 * s, sy - 1 * s, 4 * s, 1 * s);
          // stained glass
          ctx.fillStyle = "#9b59b6";
          ctx.fillRect(sx + 6 * s, sy + 7 * s, 4 * s, 3 * s);
          // door
          ctx.fillStyle = "#5c3a21";
          ctx.fillRect(sx + 6 * s, sy + 12 * s, 4 * s, 4 * s);
          break;
      }

      ctx.restore();
    },

    /** Draw a decoration (tree, rock, flower, etc.) */
    drawDecoration(ctx, type, sx, sy, scale) {
      const s = scale;

      switch (type) {
        case "tree":
          // trunk
          ctx.fillStyle = "#5c3a21";
          ctx.fillRect(sx + 6 * s, sy + 8 * s, 4 * s, 6 * s);
          // foliage
          ctx.fillStyle = "#27ae60";
          ctx.fillRect(sx + 3 * s, sy + 2 * s, 10 * s, 7 * s);
          ctx.fillRect(sx + 5 * s, sy + 0 * s, 6 * s, 2 * s);
          break;

        case "rock":
          ctx.fillStyle = "#708090";
          ctx.fillRect(sx + 3 * s, sy + 8 * s, 10 * s, 6 * s);
          ctx.fillStyle = "#5a6a7a";
          ctx.fillRect(sx + 5 * s, sy + 6 * s, 6 * s, 2 * s);
          break;

        case "flower":
          // stem
          ctx.fillStyle = "#27ae60";
          ctx.fillRect(sx + 7 * s, sy + 8 * s, 2 * s, 6 * s);
          // petals
          ctx.fillStyle = "#e74c3c";
          ctx.fillRect(sx + 6 * s, sy + 6 * s, 4 * s, 3 * s);
          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(sx + 7 * s, sy + 7 * s, 2 * s, 1 * s);
          break;

        case "fence":
          ctx.fillStyle = "#8b7355";
          ctx.fillRect(sx + 0 * s, sy + 8 * s, 16 * s, 1 * s);
          ctx.fillRect(sx + 0 * s, sy + 11 * s, 16 * s, 1 * s);
          ctx.fillRect(sx + 1 * s, sy + 6 * s, 2 * s, 7 * s);
          ctx.fillRect(sx + 7 * s, sy + 6 * s, 2 * s, 7 * s);
          ctx.fillRect(sx + 13 * s, sy + 6 * s, 2 * s, 7 * s);
          break;

        case "signpost":
          ctx.fillStyle = "#5c3a21";
          ctx.fillRect(sx + 7 * s, sy + 4 * s, 2 * s, 10 * s);
          ctx.fillStyle = "#8b7355";
          ctx.fillRect(sx + 3 * s, sy + 4 * s, 10 * s, 3 * s);
          break;

        case "bridge":
          ctx.fillStyle = "#8b7355";
          ctx.fillRect(sx + 0 * s, sy + 8 * s, 16 * s, 2 * s);
          ctx.fillRect(sx + 0 * s, sy + 12 * s, 16 * s, 2 * s);
          // railings
          ctx.fillRect(sx + 0 * s, sy + 6 * s, 2 * s, 8 * s);
          ctx.fillRect(sx + 14 * s, sy + 6 * s, 2 * s, 8 * s);
          // water underneath
          ctx.fillStyle = "rgba(74, 144, 217, 0.6)";
          ctx.fillRect(sx + 2 * s, sy + 10 * s, 12 * s, 2 * s);
          break;
      }
    },

    /** Draw an isometric ground tile */
    drawTile(ctx, type, sx, sy, tileW, tileH) {
      const colors = {
        grass: "#2d5a1e",
        grass_light: "#3a7a28",
        dirt: "#6b4423",
        stone: "#708090",
        water: "#2980b9",
        farmland: "#5c3a21",
      };

      ctx.fillStyle = colors[type] || colors.grass;
      // draw isometric diamond
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + tileW / 2, sy + tileH / 2);
      ctx.lineTo(sx, sy + tileH);
      ctx.lineTo(sx - tileW / 2, sy + tileH / 2);
      ctx.closePath();
      ctx.fill();

      // subtle outline
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    },
  };

  /* ─────────────────────────────────────────────────────
     MODULE 5 — ISOMETRIC ENGINE
  ───────────────────────────────────────────────────── */
  const TILE_W = 32;
  const TILE_H = 16;

  const Iso = {
    /** Convert grid coordinates to screen position */
    gridToScreen(gx, gy, camera) {
      const sx = (gx - gy) * (TILE_W / 2) - camera.x + camera.canvasW / 2;
      const sy = (gx + gy) * (TILE_H / 2) - camera.y + camera.canvasH / 2;
      return { x: sx, y: sy };
    },

    /** Convert screen position to grid coordinates */
    screenToGrid(sx, sy, camera) {
      const worldX = sx - camera.canvasW / 2 + camera.x;
      const worldY = sy - camera.canvasH / 2 + camera.y;
      const gx = (worldX / (TILE_W / 2) + worldY / (TILE_H / 2)) / 2;
      const gy = (worldY / (TILE_H / 2) - worldX / (TILE_W / 2)) / 2;
      return { x: Math.round(gx), y: Math.round(gy) };
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

    /** Sort entities by depth for correct isometric overlap */
    depthSort(entities) {
      return entities.sort((a, b) => (a.gy + a.gx) - (b.gy + b.gx));
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
        overlay = "rgba(255, 160, 50, 0.12)";
        emoji = "🌅";
        label = "Dawn";
      } else if (hour >= 8 && hour < 17) {
        phase = "day";
        overlay = "rgba(0, 0, 0, 0)";
        emoji = "☀️";
        label = "Day";
      } else if (hour >= 17 && hour < 19) {
        phase = "dusk";
        overlay = "rgba(255, 100, 50, 0.15)";
        emoji = "🌇";
        label = "Dusk";
      } else if (hour >= 19 && hour < 22) {
        phase = "evening";
        overlay = "rgba(30, 30, 80, 0.25)";
        emoji = "🌙";
        label = "Evening";
      } else {
        phase = "night";
        overlay = "rgba(10, 10, 50, 0.4)";
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

      // stars at night
      if (info.phase === "night" || info.phase === "evening") {
        const starCount = info.phase === "night" ? 40 : 15;
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        // deterministic star positions
        for (let i = 0; i < starCount; i++) {
          const sx = ((i * 7919 + 1) % width);
          const sy = ((i * 6271 + 3) % (height * 0.4));
          const twinkle = Math.sin(Date.now() * 0.002 + i) * 0.5 + 0.5;
          ctx.globalAlpha = twinkle * 0.8;
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
        ctx.globalAlpha = 1;
      }

      return info;
    },

    /** Draw glow effects for light sources (campfire, windows) at night */
    drawGlow(ctx, sx, sy, radius, intensity) {
      const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      gradient.addColorStop(0, `rgba(255, 200, 80, ${0.3 * intensity})`);
      gradient.addColorStop(1, "rgba(255, 200, 80, 0)");
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

      // ── Background ──
      ctx.fillStyle = "#1a2a1a";
      ctx.fillRect(0, 0, w, h);

      // ── Ground tiles ──
      world.tiles.forEach((tile) => {
        const pos = Iso.gridToScreen(tile.gx, tile.gy, camera);
        PixelArt.drawTile(ctx, tile.type, pos.x, pos.y, TILE_W, TILE_H);
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

      // ── Depth sort and render ──
      Iso.depthSort(entities);

      const timeInfo = DayNight.getTimeInfo();
      const isNight = timeInfo.phase === "night" || timeInfo.phase === "evening";
      const pixelScale = options.pixelScale || 2;

      entities.forEach((e) => {
        const pos = Iso.gridToScreen(e.gx, e.gy, camera);

        if (e.type === "building") {
          PixelArt.drawBuilding(ctx, e.data.type, pos.x - 8 * pixelScale, pos.y - 12 * pixelScale, pixelScale);
          // glow at night for fire and windows
          if (isNight) {
            if (e.data.type === "campfire") {
              DayNight.drawGlow(ctx, pos.x, pos.y, 60, 1);
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
              pos.x - 8 * pixelScale, pos.y - 14 * pixelScale,
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
    TILE_W,
    TILE_H,
  };
})();
