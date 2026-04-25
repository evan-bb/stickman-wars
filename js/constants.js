// ============================================
// Stickman Wars - Constants & Configuration
// ============================================

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 3000;

const TEAMS = { BLUE: 'blue', RED: 'red', NEUTRAL: 'neutral' };
const TEAM_COLORS = { blue: '#4488FF', red: '#FF4444', neutral: '#AA44AA' };
const BLUE_AI_COUNT = 49;
const RED_AI_COUNT = 50;

// Biome types
const BIOME = {
    VILLAGE: 'village',
    FOREST: 'forest',
    ARCTIC: 'arctic',
    BEACH: 'beach',
    VOLCANO: 'volcano'
};

const BIOME_COLORS = {
    village: '#5a8f3c',
    forest: '#2d5a1e',
    arctic: '#d4e8f0',
    beach: '#e8d5a3',
    volcano: '#4a3a3a'
};

const BIOME_LAYOUTS = [
    { type: BIOME.VILLAGE, x: 0, y: 0, w: 2000, h: 1500 },
    { type: BIOME.FOREST, x: 2000, y: 0, w: 2000, h: 1500 },
    { type: BIOME.ARCTIC, x: 0, y: 1500, w: 1333, h: 1500 },
    { type: BIOME.BEACH, x: 1333, y: 1500, w: 1333, h: 1500 },
    { type: BIOME.VOLCANO, x: 2666, y: 1500, w: 1334, h: 1500 }
];

// Cave entrance in Forest biome
const CAVE_ENTRANCE = { x: 3600, y: 750, radius: 50 };
const CAVE_WIDTH = 800;
const CAVE_HEIGHT = 600;

// Haunted House entrance (village/arctic border)
const HAUNTED_HOUSE_ENTRANCE = { x: 900, y: 1300, radius: 55 };
const HAUNTED_WIDTH = 800;
const HAUNTED_HEIGHT = 600;

// Sand Castle entrance (beach biome)
const SAND_CASTLE_ENTRANCE = { x: 1900, y: 2100, radius: 55 };
const SAND_CASTLE_WIDTH = 800;
const SAND_CASTLE_HEIGHT = 600;

// Ice Castle entrance (arctic biome)
const ICE_CASTLE_ENTRANCE = { x: 700, y: 2200, radius: 55 };
const ICE_CASTLE_WIDTH = 800;
const ICE_CASTLE_HEIGHT = 600;

// Volcano Lair entrance (volcano biome)
const VOLCANO_LAIR_ENTRANCE = { x: 3333, y: 2200, radius: 55 };
const VOLCANO_LAIR_WIDTH = 800;
const VOLCANO_LAIR_HEIGHT = 600;

// Weapon definitions
const WEAPON_DEFS = {
    WOODEN_SWORD: { name: 'Wooden Sword', damage: 15, range: 45, cooldown: 500, type: 'melee', color: '#8B6914' },
    BAT: { name: 'Bat', damage: 20, range: 40, cooldown: 650, type: 'melee', color: '#6B4226' },
    BLOW_DART: { name: 'Blow Dart Gun', damage: 10, range: 220, cooldown: 800, type: 'ranged', projectileSpeed: 350, color: '#228B22' },
    // Crate drops
    DAGGER: { name: 'Dagger', damage: 18, range: 30, cooldown: 300, type: 'melee', color: '#C0C0C0' },
    CLUB: { name: 'Club', damage: 25, range: 38, cooldown: 600, type: 'melee', color: '#5C4033' },
    SLINGSHOT: { name: 'Slingshot', damage: 16, range: 180, cooldown: 700, type: 'ranged', projectileSpeed: 300, color: '#8B4513' },
    IRON_SWORD: { name: 'Iron Sword', damage: 32, range: 48, cooldown: 450, type: 'melee', color: '#A0A0A0' },
    SPEAR: { name: 'Spear', damage: 26, range: 60, cooldown: 550, type: 'melee', color: '#B8860B' },
    SHORTBOW: { name: 'Shortbow', damage: 22, range: 260, cooldown: 650, type: 'ranged', projectileSpeed: 380, color: '#D2691E' },
    FIRE_SWORD: { name: 'Fire Sword', damage: 42, range: 48, cooldown: 420, type: 'melee', color: '#FF4500', burn: true },
    CROSSBOW: { name: 'Crossbow', damage: 36, range: 300, cooldown: 600, type: 'ranged', projectileSpeed: 420, color: '#654321' },
    MAGIC_STAFF: { name: 'Magic Staff', damage: 46, range: 350, cooldown: 550, type: 'ranged', projectileSpeed: 300, color: '#9932CC', pierce: true },
    DIAMOND_SWORD: { name: 'Diamond Sword', damage: 56, range: 50, cooldown: 380, type: 'melee', color: '#00CED1' },
    // Boss drops — all top-tier
    WEB_BOW: { name: 'Web Bow', damage: 60, range: 340, cooldown: 480, type: 'ranged', projectileSpeed: 420, color: '#CC44CC', pierce: true },
    GHOST_SWORD: { name: 'Ghost Sword', damage: 58, range: 55, cooldown: 420, type: 'melee', color: '#88CCFF' },
    ICE_BOW: { name: 'Ice Bow', damage: 65, range: 340, cooldown: 480, type: 'ranged', projectileSpeed: 420, color: '#66DDFF', pierce: true },
    LAVA_SWORD: { name: 'Lava Sword', damage: 65, range: 50, cooldown: 420, type: 'melee', color: '#FF4400', burn: true },
    SAND_SWORD: { name: 'Sand Sword', damage: 54, range: 52, cooldown: 400, type: 'melee', color: '#E8C070' }
};

// Crate tiers
const CRATE_TIERS = {
    NORMAL: { name: 'Normal', cost: 10, color: '#8B4513', outline: '#6B3410', loot: ['DAGGER', 'CLUB', 'SLINGSHOT'] },
    SILVER: { name: 'Silver', cost: 25, color: '#C0C0C0', outline: '#909090', loot: ['IRON_SWORD', 'SPEAR', 'SHORTBOW'] },
    GOLD: { name: 'Gold', cost: 50, color: '#FFD700', outline: '#DAA520', loot: ['FIRE_SWORD', 'CROSSBOW'] },
    DIAMOND: { name: 'Diamond', cost: 100, color: '#00FFFF', outline: '#00BFFF', loot: ['MAGIC_STAFF', 'DIAMOND_SWORD'] }
};

// AI config
const AI_STATES = { ROAM: 0, CHASE: 1, ATTACK: 2, FLEE: 3 };
const AI_DETECTION_RANGE = 160;
const AI_ATTACK_RANGE_BUFFER = 5;
const AI_FLEE_HEALTH_PCT = 0.2;
const AI_MELEE_ACCURACY = 0.6;
const AI_RANGED_ACCURACY = 0.4;
const AI_COOLDOWN_PENALTY = 1.2; // 20% slower than player

// Boss config
const BOSS_CONFIG = {
    name: 'Luca the Spider',
    health: 300,
    damage: 15,
    speed: 80,
    lungeSpeed: 220,
    webSpeed: 180,
    phase2Threshold: 0.5
};

const GHOST_BOSS_CONFIG = {
    name: 'James the Ghost',
    health: 250,
    damage: 12,
    speed: 70,
    boltSpeed: 190,
    teleportCooldown: 3.5,
    wailRadius: 100,
    phase2Threshold: 0.5
};

const CRAB_BOSS_CONFIG = {
    name: 'Charlie the Crab',
    health: 280,
    damage: 14,
    speed: 60,
    chargeSpeed: 240,
    bubbleSpeed: 160,
    phase2Threshold: 0.5
};

const POLAR_BOSS_CONFIG = {
    name: 'Tommy the Polar Bear',
    health: 350,
    damage: 18,
    speed: 65,
    chargeSpeed: 250,
    icicleSpeed: 170,
    freezeDuration: 1.2,
    phase2Threshold: 0.5
};

const LAVA_BOSS_CONFIG = {
    name: 'Paddy the Lava Monster',
    health: 380,
    damage: 16,
    speed: 50,
    magmaSpeed: 150,
    eruptionRadius: 120,
    burnDamage: 3,
    phase2Threshold: 0.5
};

// Stick pickup config
const STICK_SPAWN_COUNT = 200;
const STICK_RESPAWN_TIME = 30; // seconds
const STICK_COLLECT_RADIUS = 30;
const MIN_DEATH_DROP = 3;

// Food pickup config
const FOOD_SPAWN_COUNT = 30;
const FOOD_RESPAWN_TIME = 25; // seconds
const FOOD_COLLECT_RADIUS = 25;
const FOOD_TYPES = [
    { name: 'Apple', heal: 15, color: '#FF3333', emoji: '🍎' },
    { name: 'Banana', heal: 10, color: '#FFD700', emoji: '🍌' },
    { name: 'Chicken', heal: 30, color: '#D2691E', emoji: '🍗' },
    { name: 'Watermelon', heal: 25, color: '#44BB44', emoji: '🍉' },
    { name: 'Bread', heal: 12, color: '#DEB887', emoji: '🍞' },
];

// Storm config
const STORM_CONFIG = {
    startDelay: 60,        // seconds before storm appears
    shrinkInterval: 45,    // seconds between each shrink phase
    shrinkDuration: 12,    // seconds for the circle to animate smaller
    shrinkPhases: 5,       // number of shrink phases
    minRadius: 300,        // minimum radius (shrink limit)
    damage: 15,            // damage per second in the storm
    centerX: WORLD_WIDTH / 2,
    centerY: WORLD_HEIGHT / 2
};

// Grid cell size for spatial partitioning
const GRID_CELL_SIZE = 200;

// Kill streak thresholds
const KILL_STREAKS = [
    { kills: 3, label: 'TRIPLE KILL!', color: '#FFAA00', shake: 4 },
    { kills: 5, label: 'RAMPAGE!', color: '#FF6600', shake: 6 },
    { kills: 7, label: 'DOMINATING!', color: '#FF3300', shake: 7 },
    { kills: 10, label: 'UNSTOPPABLE!', color: '#FFD700', shake: 10 },
    { kills: 15, label: 'GODLIKE!', color: '#FF00FF', shake: 12 },
];

// XP and Leveling
const XP_PER_KILL = 10;
const XP_PER_BOSS = 100;
const XP_PER_STICK = 0.5;
const XP_PER_SURVIVAL_SEC = 0.5;
const XP_BASE = 100;       // XP needed for level 2
const XP_GROWTH = 1.4;     // each level needs 1.4x more XP
const MAX_LEVEL = 20;

// Cumulative XP required to reach each level. XP_LEVELS[n] = total XP for level n.
const XP_LEVELS = (() => {
    const levels = [0];
    let cumulative = 0;
    let cost = XP_BASE;
    for (let i = 1; i <= MAX_LEVEL; i++) {
        cumulative += cost;
        levels.push(Math.floor(cumulative));
        cost *= XP_GROWTH;
    }
    return levels;
})();

// Stick magnet config
const STICK_MAGNET_RANGE = 80;
const STICK_MAGNET_SPEED = 250;

// Cosmetic unlocks by level
const LEVEL_UNLOCKS = [
    { level: 1, type: 'hat', key: 'none', name: 'Default' },
    { level: 2, type: 'trail', key: 'dust', name: 'Dust Trail' },
    { level: 3, type: 'hat', key: 'bandana', name: 'Bandana' },
    { level: 5, type: 'hat', key: 'crown', name: 'Crown' },
    { level: 7, type: 'trail', key: 'fire', name: 'Fire Trail' },
    { level: 8, type: 'hat', key: 'pirate', name: 'Pirate Hat' },
    { level: 10, type: 'hat', key: 'wizard', name: 'Wizard Hat' },
    { level: 12, type: 'trail', key: 'sparkle', name: 'Sparkle Trail' },
    { level: 15, type: 'hat', key: 'cat_ears', name: 'Cat Ears' },
    { level: 18, type: 'trail', key: 'rainbow', name: 'Rainbow Trail' },
    { level: 20, type: 'hat', key: 'halo', name: 'Halo' },
];
