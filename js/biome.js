// ============================================
// Biome Rendering & Props - Enhanced Terrain
// ============================================

class BiomeRenderer {
    constructor() {
        this.props = [];
        this.groundDetails = [];  // Dense ground clutter drawn first
        this.generated = false;
        this.envParticles = [];   // Ambient particles (snow, embers, leaves)
        this._lavaZones = [];
        this._waterZone = null;

        // Pre-generate a seeded noise table for terrain blending
        this.noiseTable = [];
        for (let i = 0; i < 256; i++) this.noiseTable[i] = Math.random();
    }

    noise(x, y) {
        const ix = Math.floor(x) & 255;
        const iy = Math.floor(y) & 255;
        return this.noiseTable[(ix + iy * 47) & 255];
    }

    generate() {
        if (this.generated) return;
        this.generated = true;

        for (const layout of BIOME_LAYOUTS) {
            this.generateGroundDetail(layout);
            this.generateBiomeProps(layout);
        }

        // Sort props by iso depth (x+y) for depth ordering
        this.props.sort((a, b) => ((a.x || 0) + a.y + (a.sortOffset || 0)) - ((b.x || 0) + b.y + (b.sortOffset || 0)));

        // Spawn initial environmental particles
        this.spawnEnvParticles();
    }

    generateGroundDetail(b) {
        // Grass tufts, pebbles, ground variation - dense scatter
        const density = 0.0004; // per sq pixel
        const count = Math.floor(b.w * b.h * density);

        switch (b.type) {
            case BIOME.VILLAGE:
                for (let i = 0; i < count; i++) {
                    const gx = b.x + randomRange(10, b.w - 10);
                    const gy = b.y + randomRange(10, b.h - 10);
                    this.groundDetails.push({
                        x: gx, y: gy,
                        type: Math.random() < 0.7 ? 'grass_tuft' : 'pebble',
                        shade: randomRange(0.85, 1.15),
                        size: randomRange(0.6, 1.2)
                    });
                }
                // Dirt paths between houses
                this.groundDetails.push({ x: b.x + 200, y: b.y + 200, type: 'dirt_path', points: this._genPath(b, 200, 200, 1500, 900, 8) });
                this.groundDetails.push({ x: b.x + 600, y: b.y + 150, type: 'dirt_path', points: this._genPath(b, 600, 150, 900, 600, 6) });
                break;

            case BIOME.FOREST:
                for (let i = 0; i < count * 0.6; i++) {
                    const gx = b.x + randomRange(10, b.w - 10);
                    const gy = b.y + randomRange(10, b.h - 10);
                    this.groundDetails.push({
                        x: gx, y: gy,
                        type: randomFromArray(['grass_tuft', 'moss', 'fallen_leaf']),
                        shade: randomRange(0.7, 1.0),
                        size: randomRange(0.5, 1.3),
                        color: randomFromArray(['#2a5e1a', '#3b6e2a', '#1e4e12', '#4a7e32'])
                    });
                }
                break;

            case BIOME.ARCTIC:
                for (let i = 0; i < count * 0.5; i++) {
                    const gx = b.x + randomRange(10, b.w - 10);
                    const gy = b.y + randomRange(10, b.h - 10);
                    this.groundDetails.push({
                        x: gx, y: gy,
                        type: Math.random() < 0.5 ? 'snow_patch' : 'ice_shard',
                        shade: randomRange(0.9, 1.1),
                        size: randomRange(0.7, 1.5)
                    });
                }
                break;

            case BIOME.BEACH:
                for (let i = 0; i < count * 0.4; i++) {
                    const gx = b.x + randomRange(10, b.w - 10);
                    const gy = b.y + randomRange(10, b.h * 0.6);
                    this.groundDetails.push({
                        x: gx, y: gy,
                        type: randomFromArray(['sand_ripple', 'pebble', 'seaweed_bit']),
                        shade: randomRange(0.9, 1.1),
                        size: randomRange(0.5, 1.0)
                    });
                }
                break;

            case BIOME.VOLCANO:
                for (let i = 0; i < count * 0.5; i++) {
                    const gx = b.x + randomRange(10, b.w - 10);
                    const gy = b.y + randomRange(10, b.h - 10);
                    this.groundDetails.push({
                        x: gx, y: gy,
                        type: randomFromArray(['ash_patch', 'ember_ground', 'scorched']),
                        shade: randomRange(0.7, 1.0),
                        size: randomRange(0.5, 1.5)
                    });
                }
                break;
        }
    }

    _genPath(b, x1, y1, x2, y2, segments) {
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            points.push({
                x: b.x + lerp(x1, x2, t) + randomRange(-40, 40),
                y: b.y + lerp(y1, y2, t) + randomRange(-40, 40),
                w: randomRange(20, 35)
            });
        }
        return points;
    }

    generateBiomeProps(b) {
        switch (b.type) {
            case BIOME.VILLAGE: this.generateVillage(b); break;
            case BIOME.FOREST: this.generateForest(b); break;
            case BIOME.ARCTIC: this.generateArctic(b); break;
            case BIOME.BEACH: this.generateBeach(b); break;
            case BIOME.VOLCANO: this.generateVolcano(b); break;
        }
    }

    generateVillage(b) {
        // Houses - more and varied sizes
        const houses = [
            { x: 200, y: 200, w: 55, h: 45 }, { x: 600, y: 150, w: 50, h: 40 },
            { x: 1100, y: 300, w: 60, h: 50 }, { x: 400, y: 700, w: 50, h: 40 },
            { x: 900, y: 600, w: 55, h: 45 }, { x: 1500, y: 400, w: 65, h: 50 },
            { x: 300, y: 1100, w: 50, h: 40 }, { x: 1600, y: 900, w: 55, h: 45 },
            { x: 1200, y: 800, w: 45, h: 38 }, { x: 700, y: 1000, w: 52, h: 42 },
            { x: 1000, y: 150, w: 48, h: 40 }, { x: 150, y: 600, w: 50, h: 42 }
        ];
        for (const h of houses) {
            this.props.push({
                type: 'house', x: b.x + h.x, y: b.y + h.y,
                w: h.w, h: h.h,
                roofColor: randomFromArray(['#8B0000', '#5C3A1E', '#4A2800', '#6B3A2A']),
                wallColor: randomFromArray(['#D2B48C', '#C4A676', '#BDA06A', '#E0C8A0']),
                hasChimney: Math.random() < 0.4,
                hasWindow2: Math.random() < 0.5
            });
        }

        // Fountain in village center
        this.props.push({ type: 'fountain', x: b.x + 1000, y: b.y + 750 });

        // Lampposts along paths
        const lampPositions = [
            { x: 350, y: 450 }, { x: 700, y: 400 }, { x: 1050, y: 500 },
            { x: 1300, y: 650 }, { x: 500, y: 850 }, { x: 1100, y: 1000 }
        ];
        for (const lp of lampPositions) {
            this.props.push({ type: 'lamppost', x: b.x + lp.x, y: b.y + lp.y });
        }

        // Market stalls
        this.props.push({ type: 'market_stall', x: b.x + 800, y: b.y + 750, color: '#CC4444' });
        this.props.push({ type: 'market_stall', x: b.x + 900, y: b.y + 820, color: '#4488CC' });

        // Flowers - more of them, clustered in gardens
        for (let g = 0; g < 8; g++) {
            const gx = b.x + randomRange(100, b.w - 100);
            const gy = b.y + randomRange(100, b.h - 100);
            const flowerCount = randomInt(4, 10);
            for (let i = 0; i < flowerCount; i++) {
                this.props.push({
                    type: 'flower',
                    x: gx + randomRange(-25, 25),
                    y: gy + randomRange(-25, 25),
                    color: randomFromArray(['#FF69B4', '#FFD700', '#FF4500', '#9370DB', '#00CED1', '#FF6B9D', '#FFAA44']),
                    size: randomRange(0.7, 1.3)
                });
            }
        }

        // Fences around some houses
        for (let i = 0; i < 12; i++) {
            this.props.push({
                type: 'fence',
                x: b.x + randomRange(100, b.w - 100),
                y: b.y + randomRange(100, b.h - 100),
                length: randomRange(40, 100),
                angle: randomFromArray([0, Math.PI / 2])
            });
        }

        // Scattered village trees (fruit/decorative)
        for (let i = 0; i < 20; i++) {
            this.props.push({
                type: 'village_tree',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h - 50),
                size: randomRange(0.8, 1.2),
                fruit: Math.random() < 0.3
            });
        }

        // Sparkles
        for (let i = 0; i < 25; i++) {
            this.props.push({
                type: 'sparkle',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h - 50),
                timer: Math.random() * Math.PI * 2
            });
        }

        // Haunted House (large spooky building near village/arctic border)
        this.props.push({
            type: 'haunted_house',
            x: HAUNTED_HOUSE_ENTRANCE.x,
            y: HAUNTED_HOUSE_ENTRANCE.y,
            w: 80, h: 65
        });
        // Dead trees around haunted house
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            this.props.push({
                type: 'dead_tree',
                x: HAUNTED_HOUSE_ENTRANCE.x + Math.cos(angle) * randomRange(90, 140),
                y: HAUNTED_HOUSE_ENTRANCE.y + Math.sin(angle) * randomRange(90, 140),
                size: randomRange(0.7, 1.1)
            });
        }
        // Gravestones
        for (let i = 0; i < 6; i++) {
            this.props.push({
                type: 'gravestone',
                x: HAUNTED_HOUSE_ENTRANCE.x + randomRange(-120, 120),
                y: HAUNTED_HOUSE_ENTRANCE.y + randomRange(60, 150),
                tilt: randomRange(-0.15, 0.15)
            });
        }
    }

    generateForest(b) {
        // Lots of trees - clustered in groups
        for (let g = 0; g < 15; g++) {
            const cx = b.x + randomRange(100, b.w - 100);
            const cy = b.y + randomRange(100, b.h - 100);
            const count = randomInt(4, 10);
            for (let i = 0; i < count; i++) {
                this.props.push({
                    type: 'tree',
                    x: cx + randomRange(-80, 80),
                    y: cy + randomRange(-80, 80),
                    size: randomRange(0.7, 1.5),
                    variant: randomInt(0, 2) // different tree shapes
                });
            }
        }
        // Additional scattered trees
        for (let i = 0; i < 40; i++) {
            this.props.push({
                type: 'tree',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h - 50),
                size: randomRange(0.6, 1.4),
                variant: randomInt(0, 2)
            });
        }

        // Bushes - more
        for (let i = 0; i < 35; i++) {
            this.props.push({
                type: 'bush',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h - 50),
                size: randomRange(0.6, 1.4)
            });
        }

        // Mushrooms
        for (let i = 0; i < 20; i++) {
            this.props.push({
                type: 'mushroom',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h - 50),
                color: randomFromArray(['#CC3333', '#DDAA33', '#886622']),
                size: randomRange(0.6, 1.2)
            });
        }

        // Tree stumps
        for (let i = 0; i < 8; i++) {
            this.props.push({
                type: 'stump',
                x: b.x + randomRange(100, b.w - 100),
                y: b.y + randomRange(100, b.h - 100),
                size: randomRange(0.8, 1.3)
            });
        }

        // Fallen logs
        for (let i = 0; i < 6; i++) {
            this.props.push({
                type: 'log',
                x: b.x + randomRange(100, b.w - 100),
                y: b.y + randomRange(100, b.h - 100),
                angle: Math.random() * Math.PI,
                length: randomRange(30, 60)
            });
        }

        // Stream running through forest
        this.props.push({
            type: 'stream',
            x: b.x, y: b.y,
            points: this._genStreamPoints(b)
        });

        // Winding dirt path
        this.groundDetails.push({
            x: b.x, y: b.y,
            type: 'dirt_path',
            points: this._genPath(b, 0, 700, b.w, 750, 12)
        });

        // Rocks
        for (let i = 0; i < 12; i++) {
            this.props.push({
                type: 'rock',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h - 50),
                size: randomRange(6, 18),
                shade: randomRange(0.7, 1.0)
            });
        }

        // Cave entrance
        this.props.push({ type: 'cave', x: CAVE_ENTRANCE.x, y: CAVE_ENTRANCE.y, sortOffset: -40 });
    }

    _genStreamPoints(b) {
        const pts = [];
        const startX = randomRange(b.w * 0.3, b.w * 0.7);
        for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            pts.push({
                x: b.x + startX + Math.sin(t * 4) * 80 + randomRange(-20, 20),
                y: b.y + t * b.h,
                w: randomRange(12, 22)
            });
        }
        return pts;
    }

    generateArctic(b) {
        // Snowdrifts - more, various sizes
        for (let i = 0; i < 30; i++) {
            this.props.push({
                type: 'snowdrift',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h - 50),
                size: randomRange(15, 55),
                height: randomRange(0.3, 0.6)
            });
        }

        // Ice crystals - more
        for (let i = 0; i < 18; i++) {
            this.props.push({
                type: 'ice',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h - 50),
                size: randomRange(0.7, 1.5),
                rotation: Math.random() * Math.PI
            });
        }

        // Frozen ponds - multiple
        this.props.push({ type: 'pond', x: b.x + 600, y: b.y + 800, radius: 90 });
        this.props.push({ type: 'pond', x: b.x + 300, y: b.y + 400, radius: 50 });
        this.props.push({ type: 'pond', x: b.x + 900, y: b.y + 1200, radius: 65 });

        // Frozen/dead trees
        for (let i = 0; i < 12; i++) {
            this.props.push({
                type: 'frozen_tree',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h - 50),
                size: randomRange(0.6, 1.2)
            });
        }

        // Snow-covered rocks
        for (let i = 0; i < 15; i++) {
            this.props.push({
                type: 'snow_rock',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h - 50),
                size: randomRange(8, 22)
            });
        }

        // Igloos
        this.props.push({ type: 'igloo', x: b.x + 500, y: b.y + 600 });
        this.props.push({ type: 'igloo', x: b.x + 1000, y: b.y + 1000 });

        // Ice Castle (boss entrance)
        this.props.push({
            type: 'ice_castle',
            x: ICE_CASTLE_ENTRANCE.x,
            y: ICE_CASTLE_ENTRANCE.y,
            w: 80, h: 65
        });
    }

    generateBeach(b) {
        // Curved shoreline stored as points
        const shorePoints = [];
        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            shorePoints.push({
                x: b.x + t * b.w,
                y: b.y + b.h * 0.55 + Math.sin(t * Math.PI * 3) * 40 + randomRange(-15, 15)
            });
        }
        this._waterZone = { x: b.x, y: b.y + b.h * 0.55, w: b.w, h: b.h * 0.45 };
        this.props.push({ type: 'water_curved', x: b.x, y: b.y, w: b.w, h: b.h, shorePoints: shorePoints, sortOffset: -9999 });

        // Palm trees - more, varied
        for (let i = 0; i < 20; i++) {
            this.props.push({
                type: 'palm',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h * 0.50),
                size: randomRange(0.7, 1.3),
                lean: randomRange(-0.3, 0.3)
            });
        }

        // Shells - more varied
        for (let i = 0; i < 25; i++) {
            this.props.push({
                type: 'shell',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(b.h * 0.35, b.h * 0.58),
                variant: randomInt(0, 2),
                size: randomRange(0.6, 1.2)
            });
        }

        // Umbrellas with towels
        for (let i = 0; i < 6; i++) {
            this.props.push({
                type: 'umbrella',
                x: b.x + randomRange(100, b.w - 100),
                y: b.y + randomRange(b.h * 0.15, b.h * 0.45),
                color: randomFromArray(['#FF4444', '#4444FF', '#44FF44', '#FFFF44', '#FF44FF', '#FF8800'])
            });
        }

        // Driftwood
        for (let i = 0; i < 8; i++) {
            this.props.push({
                type: 'driftwood',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(b.h * 0.4, b.h * 0.58),
                angle: randomRange(-0.3, 0.3),
                length: randomRange(20, 50)
            });
        }

        // Sandcastles
        this.props.push({ type: 'sandcastle', x: b.x + 400, y: b.y + 500 });
        this.props.push({ type: 'sandcastle', x: b.x + 900, y: b.y + 400 });

        // Tide pools
        for (let i = 0; i < 4; i++) {
            this.props.push({
                type: 'tidepool',
                x: b.x + randomRange(100, b.w - 100),
                y: b.y + randomRange(b.h * 0.48, b.h * 0.56),
                radius: randomRange(10, 20)
            });
        }

        // Coconuts near palms
        for (let i = 0; i < 8; i++) {
            this.props.push({
                type: 'coconut',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h * 0.5),
            });
        }

        // Giant Sand Castle (boss entrance)
        this.props.push({
            type: 'sand_castle_boss',
            x: SAND_CASTLE_ENTRANCE.x,
            y: SAND_CASTLE_ENTRANCE.y,
            w: 70, h: 60
        });
    }

    generateVolcano(b) {
        // Volcano mountain in background (large prop, drawn behind everything)
        this.props.push({ type: 'volcano_mountain', x: b.x + b.w / 2, y: b.y + 200, sortOffset: -9999 });

        // Lava pools
        this._lavaZones = [];
        for (let i = 0; i < 10; i++) {
            const pool = {
                type: 'lava',
                x: b.x + randomRange(80, b.w - 80),
                y: b.y + randomRange(300, b.h - 80),
                radius: randomRange(20, 55)
            };
            this.props.push(pool);
            this._lavaZones.push(pool);
        }

        // Lava streams connecting some pools
        for (let i = 0; i < 3; i++) {
            const p1 = this._lavaZones[randomInt(0, this._lavaZones.length - 1)];
            const p2 = this._lavaZones[randomInt(0, this._lavaZones.length - 1)];
            if (p1 !== p2) {
                this.props.push({ type: 'lava_stream', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2, sortOffset: -100 });
            }
        }

        // Rocks - lots more, varied
        for (let i = 0; i < 35; i++) {
            this.props.push({
                type: 'rock',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h - 50),
                size: randomRange(6, 25),
                shade: randomRange(0.5, 0.8)
            });
        }

        // Charred trees
        for (let i = 0; i < 10; i++) {
            this.props.push({
                type: 'charred_tree',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(200, b.h - 50),
                size: randomRange(0.7, 1.2)
            });
        }

        // Volcanic vents (smoke columns)
        for (let i = 0; i < 5; i++) {
            this.props.push({
                type: 'vent',
                x: b.x + randomRange(100, b.w - 100),
                y: b.y + randomRange(300, b.h - 100)
            });
        }

        // Cracks - more, branching
        for (let i = 0; i < 20; i++) {
            const cx = b.x + randomRange(50, b.w - 50);
            const cy = b.y + randomRange(50, b.h - 50);
            const angle = Math.random() * Math.PI;
            const len = randomRange(20, 70);
            this.props.push({ type: 'crack', x: cx, y: cy, angle: angle, length: len, sortOffset: -200 });
            // Branch
            if (Math.random() < 0.5) {
                this.props.push({
                    type: 'crack', sortOffset: -200,
                    x: cx + Math.cos(angle) * len * 0.6,
                    y: cy + Math.sin(angle) * len * 0.6,
                    angle: angle + randomRange(-0.8, 0.8),
                    length: len * 0.5
                });
            }
        }

        // Ash mounds
        for (let i = 0; i < 12; i++) {
            this.props.push({
                type: 'ash_mound',
                x: b.x + randomRange(50, b.w - 50),
                y: b.y + randomRange(50, b.h - 50),
                size: randomRange(15, 35)
            });
        }

        // Volcano Lair entrance (cave opening in the volcano)
        this.props.push({
            type: 'volcano_lair',
            x: VOLCANO_LAIR_ENTRANCE.x,
            y: VOLCANO_LAIR_ENTRANCE.y,
            sortOffset: -40
        });
    }

    spawnEnvParticles() {
        // Arctic snow
        const arctic = BIOME_LAYOUTS[2];
        for (let i = 0; i < 60; i++) {
            this.envParticles.push({
                type: 'snow',
                x: arctic.x + randomRange(0, arctic.w),
                y: arctic.y + randomRange(0, arctic.h),
                speed: randomRange(15, 40),
                drift: randomRange(-10, 10),
                size: randomRange(1.5, 3.5),
                biome: arctic
            });
        }
        // Volcano embers
        const volcano = BIOME_LAYOUTS[4];
        for (let i = 0; i < 30; i++) {
            this.envParticles.push({
                type: 'ember',
                x: volcano.x + randomRange(0, volcano.w),
                y: volcano.y + randomRange(0, volcano.h),
                speed: randomRange(20, 50),
                drift: randomRange(-15, 15),
                size: randomRange(1, 3),
                life: randomRange(0, 3),
                maxLife: 3,
                biome: volcano
            });
        }
        // Forest leaves
        const forest = BIOME_LAYOUTS[1];
        for (let i = 0; i < 25; i++) {
            this.envParticles.push({
                type: 'leaf',
                x: forest.x + randomRange(0, forest.w),
                y: forest.y + randomRange(0, forest.h),
                speed: randomRange(10, 25),
                drift: randomRange(-20, 20),
                size: randomRange(2, 4),
                rotation: Math.random() * Math.PI * 2,
                biome: forest,
                color: randomFromArray(['#4a7e32', '#6B8E23', '#8B6914', '#CC8833'])
            });
        }
    }

    updateEnvParticles(dt) {
        for (const p of this.envParticles) {
            if (p.type === 'snow') {
                p.y += p.speed * dt;
                p.x += p.drift * dt + Math.sin(p.y * 0.02) * 5 * dt;
                if (p.y > p.biome.y + p.biome.h) { p.y = p.biome.y; p.x = p.biome.x + randomRange(0, p.biome.w); }
                if (p.x < p.biome.x) p.x = p.biome.x + p.biome.w;
                if (p.x > p.biome.x + p.biome.w) p.x = p.biome.x;
            } else if (p.type === 'ember') {
                p.y -= p.speed * dt;
                p.x += p.drift * dt + Math.sin(p.y * 0.03) * 8 * dt;
                p.life -= dt;
                if (p.life <= 0 || p.y < p.biome.y) {
                    p.y = p.biome.y + p.biome.h - randomRange(0, 100);
                    p.x = p.biome.x + randomRange(0, p.biome.w);
                    p.life = p.maxLife;
                }
            } else if (p.type === 'leaf') {
                p.y += p.speed * dt * 0.5;
                p.x += p.drift * dt + Math.sin(p.y * 0.01 + p.rotation) * 15 * dt;
                p.rotation += dt * 2;
                if (p.y > p.biome.y + p.biome.h) { p.y = p.biome.y; p.x = p.biome.x + randomRange(0, p.biome.w); }
                if (p.x < p.biome.x) p.x += p.biome.w;
                if (p.x > p.biome.x + p.biome.w) p.x -= p.biome.w;
            }
        }
    }

    // ===================== DRAWING =====================

    drawBackgrounds(ctx, camera) {
        for (const b of BIOME_LAYOUTS) {
            if (!camera.isVisible(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) * 1.5)) continue;
            // Draw biome as iso diamond
            const diamond = worldRectToIsoDiamond(b.x, b.y, b.w, b.h);
            ctx.fillStyle = BIOME_COLORS[b.type];
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const sx = diamond[i].x - camera.isoX + camera.shakeX;
                const sy = diamond[i].y - camera.isoY + camera.shakeY;
                if (i === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fill();
        }

        // Soft biome transition edges (semi-transparent diamond overlaps)
        this._drawBiomeTransitions(ctx, camera);

        // Draw ground details
        this._drawGroundDetails(ctx, camera);
    }

    _drawBiomeTransitions(ctx, camera) {
        // Multi-step gradient blending along shared edges
        const blendSize = 150; // total blend zone width in world units
        const steps = 6;       // number of gradient steps per side
        for (let i = 0; i < BIOME_LAYOUTS.length; i++) {
            for (let j = i + 1; j < BIOME_LAYOUTS.length; j++) {
                const a = BIOME_LAYOUTS[i];
                const bm = BIOME_LAYOUTS[j];
                // Check for shared vertical edge (side by side)
                if (Math.abs((a.x + a.w) - bm.x) < 5) {
                    this._blendVerticalEdge(ctx, camera, a, bm, blendSize, steps);
                }
                if (Math.abs((bm.x + bm.w) - a.x) < 5) {
                    this._blendVerticalEdge(ctx, camera, bm, a, blendSize, steps);
                }
                // Check for shared horizontal edge (top/bottom)
                if (Math.abs((a.y + a.h) - bm.y) < 5) {
                    this._blendHorizontalEdge(ctx, camera, a, bm, blendSize, steps);
                }
                if (Math.abs((bm.y + bm.h) - a.y) < 5) {
                    this._blendHorizontalEdge(ctx, camera, bm, a, blendSize, steps);
                }
            }
        }
    }

    _blendVerticalEdge(ctx, camera, leftBiome, rightBiome, totalSize, steps) {
        // leftBiome is on the left, rightBiome on the right
        const edgeX = leftBiome.x + leftBiome.w;
        const overlapY = Math.max(leftBiome.y, rightBiome.y);
        const overlapH = Math.min(leftBiome.y + leftBiome.h, rightBiome.y + rightBiome.h) - overlapY;
        if (overlapH <= 0) return;

        const stepSize = totalSize / steps;

        // Draw right biome's color bleeding INTO the left biome (fading as it goes further left)
        for (let s = 0; s < steps; s++) {
            const alpha = Math.round(((steps - s) / (steps + 1)) * 0.45 * 255);
            const hexAlpha = alpha.toString(16).padStart(2, '0');
            const stripX = edgeX - (s + 1) * stepSize;
            const strip = worldRectToIsoDiamond(stripX, overlapY, stepSize, overlapH);
            ctx.fillStyle = BIOME_COLORS[rightBiome.type] + hexAlpha;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const sx = strip[i].x - camera.isoX + camera.shakeX;
                const sy = strip[i].y - camera.isoY + camera.shakeY;
                if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fill();
        }

        // Draw left biome's color bleeding INTO the right biome (fading as it goes further right)
        for (let s = 0; s < steps; s++) {
            const alpha = Math.round(((steps - s) / (steps + 1)) * 0.45 * 255);
            const hexAlpha = alpha.toString(16).padStart(2, '0');
            const stripX = edgeX + s * stepSize;
            const strip = worldRectToIsoDiamond(stripX, overlapY, stepSize, overlapH);
            ctx.fillStyle = BIOME_COLORS[leftBiome.type] + hexAlpha;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const sx = strip[i].x - camera.isoX + camera.shakeX;
                const sy = strip[i].y - camera.isoY + camera.shakeY;
                if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    _blendHorizontalEdge(ctx, camera, topBiome, bottomBiome, totalSize, steps) {
        // topBiome is above, bottomBiome below
        const edgeY = topBiome.y + topBiome.h;
        const overlapX = Math.max(topBiome.x, bottomBiome.x);
        const overlapW = Math.min(topBiome.x + topBiome.w, bottomBiome.x + bottomBiome.w) - overlapX;
        if (overlapW <= 0) return;

        const stepSize = totalSize / steps;

        // Bottom biome color bleeding into top biome
        for (let s = 0; s < steps; s++) {
            const alpha = Math.round(((steps - s) / (steps + 1)) * 0.45 * 255);
            const hexAlpha = alpha.toString(16).padStart(2, '0');
            const stripY = edgeY - (s + 1) * stepSize;
            const strip = worldRectToIsoDiamond(overlapX, stripY, overlapW, stepSize);
            ctx.fillStyle = BIOME_COLORS[bottomBiome.type] + hexAlpha;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const sx = strip[i].x - camera.isoX + camera.shakeX;
                const sy = strip[i].y - camera.isoY + camera.shakeY;
                if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fill();
        }

        // Top biome color bleeding into bottom biome
        for (let s = 0; s < steps; s++) {
            const alpha = Math.round(((steps - s) / (steps + 1)) * 0.45 * 255);
            const hexAlpha = alpha.toString(16).padStart(2, '0');
            const stripY = edgeY + s * stepSize;
            const strip = worldRectToIsoDiamond(overlapX, stripY, overlapW, stepSize);
            ctx.fillStyle = BIOME_COLORS[topBiome.type] + hexAlpha;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const sx = strip[i].x - camera.isoX + camera.shakeX;
                const sy = strip[i].y - camera.isoY + camera.shakeY;
                if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    _drawGroundDetails(ctx, camera) {
        for (const d of this.groundDetails) {
            if (d.type === 'dirt_path') {
                this._drawDirtPath(ctx, camera, d);
                continue;
            }
            if (!camera.isVisible(d.x, d.y, 10)) continue;
            const pos = camera.worldToScreen(d.x, d.y);

            switch (d.type) {
                case 'grass_tuft':
                    ctx.strokeStyle = `rgba(80, ${Math.floor(140 * d.shade)}, 50, 0.5)`;
                    ctx.lineWidth = 1;
                    for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(pos.x + i * 2 - 2, pos.y);
                        ctx.lineTo(pos.x + i * 2 - 2 + randomRange(-2, 2), pos.y - 4 * d.size);
                        ctx.stroke();
                    }
                    break;

                case 'moss':
                    ctx.fillStyle = d.color || '#2a5e1a';
                    ctx.globalAlpha = 0.4;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 4 * d.size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    break;

                case 'fallen_leaf':
                    ctx.fillStyle = d.color || '#6B8E23';
                    ctx.globalAlpha = 0.5;
                    ctx.beginPath();
                    ctx.ellipse(pos.x, pos.y, 3 * d.size, 1.5 * d.size, d.shade * 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    break;

                case 'pebble':
                    ctx.fillStyle = `rgba(${Math.floor(130 * d.shade)}, ${Math.floor(120 * d.shade)}, ${Math.floor(100 * d.shade)}, 0.5)`;
                    ctx.beginPath();
                    ctx.ellipse(pos.x, pos.y, 2 * d.size, 1.5 * d.size, 0, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 'snow_patch':
                    ctx.fillStyle = `rgba(240, 248, 255, ${0.3 * d.shade})`;
                    ctx.beginPath();
                    ctx.ellipse(pos.x, pos.y, 8 * d.size, 5 * d.size, 0, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 'ice_shard':
                    ctx.fillStyle = 'rgba(180, 220, 255, 0.3)';
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y - 3 * d.size);
                    ctx.lineTo(pos.x + 2 * d.size, pos.y + 2 * d.size);
                    ctx.lineTo(pos.x - 2 * d.size, pos.y + 2 * d.size);
                    ctx.fill();
                    break;

                case 'sand_ripple':
                    ctx.strokeStyle = 'rgba(200, 180, 140, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 6 * d.size, 0, Math.PI);
                    ctx.stroke();
                    break;

                case 'seaweed_bit':
                    ctx.strokeStyle = 'rgba(50, 120, 50, 0.4)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y);
                    ctx.quadraticCurveTo(pos.x + 3, pos.y - 5, pos.x - 1, pos.y - 8 * d.size);
                    ctx.stroke();
                    break;

                case 'ash_patch':
                    ctx.fillStyle = `rgba(60, 55, 50, ${0.4 * d.shade})`;
                    ctx.beginPath();
                    ctx.ellipse(pos.x, pos.y, 8 * d.size, 5 * d.size, 0, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 'ember_ground':
                    ctx.fillStyle = `rgba(200, 80, 0, ${0.15 * d.shade})`;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 3 * d.size, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 'scorched':
                    ctx.fillStyle = 'rgba(30, 20, 15, 0.3)';
                    ctx.beginPath();
                    ctx.ellipse(pos.x, pos.y, 6 * d.size, 4 * d.size, d.shade, 0, Math.PI * 2);
                    ctx.fill();
                    break;
            }
        }
    }

    _drawDirtPath(ctx, camera, d) {
        if (!d.points || d.points.length < 2) return;
        ctx.fillStyle = 'rgba(139, 119, 80, 0.45)';
        // Draw circles along the path for a soft rounded trail
        for (let i = 0; i < d.points.length - 1; i++) {
            const p0 = d.points[i];
            const p1 = d.points[i + 1];
            const steps = 8;
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const px = lerp(p0.x, p1.x, t);
                const py = lerp(p0.y, p1.y, t);
                const pw = lerp(p0.w, p1.w, t);
                if (!camera.isVisible(px, py, pw)) continue;
                const pos = camera.worldToScreen(px, py);
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y, pw, pw * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    drawProps(ctx, camera, time) {
        for (const p of this.props) {
            const px = p.x || 0;
            const py = p.y || 0;
            if (!camera.isVisible(px, py, 100)) continue;
            const pos = camera.worldToScreen(px, py);
            this.drawProp(ctx, pos, p, time, camera);
        }
    }

    drawEnvParticles(ctx, camera) {
        for (const p of this.envParticles) {
            if (!camera.isVisible(p.x, p.y, 5)) continue;
            const pos = camera.worldToScreen(p.x, p.y);

            if (p.type === 'snow') {
                ctx.fillStyle = 'rgba(240, 248, 255, 0.8)';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'ember') {
                const alpha = clamp(p.life / p.maxLife, 0, 1);
                ctx.fillStyle = `rgba(255, ${Math.floor(100 + Math.random() * 80)}, 0, ${alpha * 0.8})`;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'leaf') {
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.rotate(p.rotation);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.restore();
            }
        }
    }

    drawProp(ctx, pos, p, time, camera) {
        ctx.save();
        switch (p.type) {
            case 'house': {
                const hw = p.w / 2, hh = p.h / 2;
                const wallH = p.h * 0.7; // wall height in screen pixels

                // Iso shadow (ellipse on ground plane)
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 6, p.w * 0.5, p.w * 0.25, 0, 0, Math.PI * 2);
                ctx.fill();

                // Iso house: front face (right-facing parallelogram) and side face (left-facing)
                const footW = hw;      // half-width of iso footprint
                const footH = hh * 0.5; // half-height of iso footprint

                // Front face (right side visible)
                ctx.fillStyle = p.wallColor;
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y + footH);             // bottom center
                ctx.lineTo(pos.x + footW, pos.y);              // bottom right
                ctx.lineTo(pos.x + footW, pos.y - wallH);      // top right
                ctx.lineTo(pos.x, pos.y + footH - wallH);      // top center
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Side face (left side visible, slightly darker)
                ctx.fillStyle = this._darken(p.wallColor, 0.8);
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y + footH);              // bottom center
                ctx.lineTo(pos.x - footW, pos.y);              // bottom left
                ctx.lineTo(pos.x - footW, pos.y - wallH);      // top left
                ctx.lineTo(pos.x, pos.y + footH - wallH);      // top center
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                ctx.stroke();

                // Roof (pointed iso shape)
                const roofPeak = pos.y + footH - wallH - 22;
                ctx.fillStyle = p.roofColor;
                ctx.beginPath();
                ctx.moveTo(pos.x - footW - 4, pos.y - wallH);          // left eave
                ctx.lineTo(pos.x, roofPeak);                            // peak
                ctx.lineTo(pos.x + footW + 4, pos.y - wallH);          // right eave
                ctx.lineTo(pos.x, pos.y + footH - wallH);              // front eave
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.stroke();

                // Door on front face (isometric parallelogram matching wall slant)
                const doorSlant = footH / footW;
                const doorFrac = 0.3; // position along front wall width
                const doorW = 5; // half-width
                const doorH = 14;
                const doorBX = pos.x + footW * doorFrac;
                const doorBY = pos.y + footH * (1 - doorFrac);
                ctx.fillStyle = '#4A3218';
                ctx.beginPath();
                // Bottom-left
                ctx.moveTo(doorBX - doorW, doorBY + doorW * doorSlant);
                // Top-left
                ctx.lineTo(doorBX - doorW, doorBY + doorW * doorSlant - doorH);
                // Top-right (arch approximation with slant)
                ctx.lineTo(doorBX - doorW * 0.3, doorBY + doorW * 0.3 * doorSlant - doorH - 3);
                ctx.lineTo(doorBX + doorW * 0.3, doorBY - doorW * 0.3 * doorSlant - doorH - 3);
                ctx.lineTo(doorBX + doorW, doorBY - doorW * doorSlant - doorH);
                // Bottom-right
                ctx.lineTo(doorBX + doorW, doorBY - doorW * doorSlant);
                ctx.closePath();
                ctx.fill();
                // Door handle
                ctx.fillStyle = '#8B7530';
                ctx.beginPath();
                ctx.arc(doorBX + doorW * 0.4, doorBY - doorH * 0.3, 1.5, 0, Math.PI * 2);
                ctx.fill();

                // Window on front face (parallelogram matching wall slant)
                // Front wall slants: for each unit right, goes 0.5 units up (footH/footW ratio)
                const frontSlant = footH / footW; // vertical offset per horizontal unit
                const winSize = 8;
                const winFrac = 0.6; // position along wall width
                const winBaseX = pos.x + footW * winFrac;
                const winBaseY = pos.y + footH * (1 - winFrac) - wallH + 16;
                ctx.fillStyle = 'rgba(135, 206, 235, 0.7)';
                ctx.beginPath();
                ctx.moveTo(winBaseX - 4, winBaseY);
                ctx.lineTo(winBaseX + 4, winBaseY - 4 * frontSlant);
                ctx.lineTo(winBaseX + 4, winBaseY - 4 * frontSlant - winSize);
                ctx.lineTo(winBaseX - 4, winBaseY - winSize);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#5C3A1E';
                ctx.lineWidth = 1;
                ctx.stroke();
                // Window cross
                ctx.beginPath();
                ctx.moveTo(winBaseX, winBaseY - 2 * frontSlant);
                ctx.lineTo(winBaseX, winBaseY - 2 * frontSlant - winSize);
                ctx.moveTo(winBaseX - 4, winBaseY - winSize / 2);
                ctx.lineTo(winBaseX + 4, winBaseY - winSize / 2 - 4 * frontSlant);
                ctx.stroke();

                // Window on side face (parallelogram matching left wall slant)
                // Left wall: bottom-center to bottom-left, moving left = moving up
                // So left edge of window is HIGHER than right edge (opposite of front face)
                if (p.hasWindow2) {
                    const sideSlant = footH / footW;
                    const win2Frac = 0.5;
                    const win2BaseX = pos.x - footW * win2Frac;
                    const win2BaseY = pos.y + footH * (1 - win2Frac) - wallH + 16;
                    ctx.fillStyle = 'rgba(110, 180, 210, 0.6)';
                    ctx.beginPath();
                    // Right edge (closer to center) is lower, left edge (further from center) is higher
                    ctx.moveTo(win2BaseX + 4, win2BaseY + 4 * sideSlant);          // bottom-right
                    ctx.lineTo(win2BaseX + 4, win2BaseY + 4 * sideSlant - winSize); // top-right
                    ctx.lineTo(win2BaseX - 4, win2BaseY - winSize);                 // top-left (higher)
                    ctx.lineTo(win2BaseX - 4, win2BaseY);                           // bottom-left
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#5C3A1E';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    // Window cross following the slant
                    ctx.beginPath();
                    // Vertical divider
                    ctx.moveTo(win2BaseX, win2BaseY + 2 * sideSlant);
                    ctx.lineTo(win2BaseX, win2BaseY + 2 * sideSlant - winSize);
                    // Horizontal divider (follows wall slant)
                    ctx.moveTo(win2BaseX + 4, win2BaseY + 4 * sideSlant - winSize / 2);
                    ctx.lineTo(win2BaseX - 4, win2BaseY - winSize / 2);
                    ctx.stroke();
                }

                // Chimney
                if (p.hasChimney) {
                    ctx.fillStyle = '#666';
                    ctx.fillRect(pos.x + footW * 0.2, roofPeak - 4, 7, 12);
                }
                break;
            }

            case 'village_tree': {
                const s = p.size;
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.12)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 14 * s, 12 * s, 5 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                // Trunk
                ctx.fillStyle = '#6B4226';
                ctx.fillRect(pos.x - 3 * s, pos.y - 2 * s, 6 * s, 16 * s);
                // Round canopy
                ctx.fillStyle = '#3D8B37';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y - 12 * s, 14 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#4CA24A';
                ctx.beginPath();
                ctx.arc(pos.x - 4 * s, pos.y - 14 * s, 10 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(pos.x + 5 * s, pos.y - 10 * s, 9 * s, 0, Math.PI * 2);
                ctx.fill();
                // Fruit
                if (p.fruit) {
                    ctx.fillStyle = '#FF3333';
                    for (let i = 0; i < 4; i++) {
                        ctx.beginPath();
                        ctx.arc(pos.x + randomRange(-8, 8) * s, pos.y - randomRange(6, 18) * s, 2.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                break;
            }

            case 'tree': {
                const sz = p.size || 1;
                const v = p.variant || 0;
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.12)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 14 * sz, 10 * sz, 4 * sz, 0, 0, Math.PI * 2);
                ctx.fill();
                // Trunk
                ctx.fillStyle = '#5C3A1E';
                ctx.beginPath();
                ctx.moveTo(pos.x - 3 * sz, pos.y + 12 * sz);
                ctx.lineTo(pos.x - 2 * sz, pos.y - 4 * sz);
                ctx.lineTo(pos.x + 2 * sz, pos.y - 4 * sz);
                ctx.lineTo(pos.x + 3 * sz, pos.y + 12 * sz);
                ctx.fill();

                if (v === 0) {
                    // Round canopy (bushy)
                    ctx.fillStyle = '#1B5E20';
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y - 14 * sz, 13 * sz, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#2E7D32';
                    ctx.beginPath();
                    ctx.arc(pos.x - 5 * sz, pos.y - 16 * sz, 9 * sz, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(pos.x + 6 * sz, pos.y - 12 * sz, 8 * sz, 0, Math.PI * 2);
                    ctx.fill();
                } else if (v === 1) {
                    // Pine/conifer
                    ctx.fillStyle = '#1B5E20';
                    ctx.beginPath();
                    ctx.moveTo(pos.x - 12 * sz, pos.y);
                    ctx.lineTo(pos.x, pos.y - 24 * sz);
                    ctx.lineTo(pos.x + 12 * sz, pos.y);
                    ctx.fill();
                    ctx.fillStyle = '#2E7D32';
                    ctx.beginPath();
                    ctx.moveTo(pos.x - 9 * sz, pos.y - 8 * sz);
                    ctx.lineTo(pos.x, pos.y - 30 * sz);
                    ctx.lineTo(pos.x + 9 * sz, pos.y - 8 * sz);
                    ctx.fill();
                } else {
                    // Wide oak
                    ctx.fillStyle = '#2E6B1E';
                    ctx.beginPath();
                    ctx.ellipse(pos.x, pos.y - 15 * sz, 16 * sz, 11 * sz, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#3A8528';
                    ctx.beginPath();
                    ctx.ellipse(pos.x + 3 * sz, pos.y - 18 * sz, 11 * sz, 8 * sz, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }

            case 'bush': {
                const bs = p.size || 1;
                ctx.fillStyle = 'rgba(0,0,0,0.08)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 4, 10 * bs, 3 * bs, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#2E7D32';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 9 * bs, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#388E3C';
                ctx.beginPath();
                ctx.arc(pos.x + 5 * bs, pos.y - 2 * bs, 7 * bs, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#43A047';
                ctx.beginPath();
                ctx.arc(pos.x - 3 * bs, pos.y - 4 * bs, 6 * bs, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'mushroom': {
                const ms = p.size || 1;
                ctx.fillStyle = '#D2C0A0';
                ctx.fillRect(pos.x - 1.5 * ms, pos.y, 3 * ms, 6 * ms);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 5 * ms, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.beginPath();
                ctx.arc(pos.x - 2 * ms, pos.y - 2 * ms, 1.2 * ms, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(pos.x + 1.5 * ms, pos.y - 1 * ms, 0.8 * ms, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'stump': {
                const ss = p.size || 1;
                ctx.fillStyle = '#5C3A1E';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 4 * ss, 8 * ss, 5 * ss, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#7A5230';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y, 8 * ss, 5 * ss, 0, 0, Math.PI * 2);
                ctx.fill();
                // Rings
                ctx.strokeStyle = 'rgba(90,55,25,0.4)';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y, 5 * ss, 3 * ss, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y, 2.5 * ss, 1.5 * ss, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }

            case 'log': {
                ctx.fillStyle = 'rgba(0,0,0,0.08)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 4, p.length / 2, 4, p.angle, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#5C3A1E';
                ctx.lineWidth = 6;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(pos.x - Math.cos(p.angle) * p.length / 2, pos.y - Math.sin(p.angle) * p.length / 2);
                ctx.lineTo(pos.x + Math.cos(p.angle) * p.length / 2, pos.y + Math.sin(p.angle) * p.length / 2);
                ctx.stroke();
                ctx.strokeStyle = '#7A5230';
                ctx.lineWidth = 4;
                ctx.stroke();
                break;
            }

            case 'stream': {
                if (!p.points) break;
                ctx.strokeStyle = 'rgba(60, 140, 200, 0.6)';
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                for (let i = 0; i < p.points.length - 1; i++) {
                    const p0 = p.points[i];
                    const p1 = p.points[i + 1];
                    const s0 = camera.worldToScreen(p0.x, p0.y);
                    const s1 = camera.worldToScreen(p1.x, p1.y);
                    ctx.lineWidth = lerp(p0.w, p1.w, 0.5);
                    ctx.beginPath();
                    ctx.moveTo(s0.x, s0.y);
                    ctx.lineTo(s1.x, s1.y);
                    ctx.stroke();
                    // Highlight
                    ctx.strokeStyle = 'rgba(130, 200, 240, 0.3)';
                    ctx.lineWidth = lerp(p0.w, p1.w, 0.5) * 0.4;
                    ctx.beginPath();
                    ctx.moveTo(s0.x + 2, s0.y);
                    ctx.lineTo(s1.x + 2, s1.y);
                    ctx.stroke();
                    ctx.strokeStyle = 'rgba(60, 140, 200, 0.6)';
                }
                break;
            }

            case 'flower': {
                const fs = p.size || 1;
                // Stem
                ctx.strokeStyle = '#3B7A2B';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y + 4 * fs);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
                // Petals
                ctx.fillStyle = p.color;
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.ellipse(pos.x + Math.cos(a) * 3.5 * fs, pos.y + Math.sin(a) * 3.5 * fs, 2.5 * fs, 1.5 * fs, a, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 1.8 * fs, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'fountain': {
                // Base pool
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 6, 28, 10, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#6688AA';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y, 25, 12, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#88AACC';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y - 2, 20, 9, 0, 0, Math.PI * 2);
                ctx.fill();
                // Center column
                ctx.fillStyle = '#888';
                ctx.fillRect(pos.x - 3, pos.y - 18, 6, 18);
                // Water spray
                const spray = Math.sin((time || 0) * 4) * 3;
                ctx.strokeStyle = 'rgba(130, 190, 255, 0.6)';
                ctx.lineWidth = 1.5;
                for (let i = 0; i < 4; i++) {
                    const a = (i / 4) * Math.PI * 2 + (time || 0);
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y - 18);
                    ctx.quadraticCurveTo(pos.x + Math.cos(a) * 12, pos.y - 24 + spray, pos.x + Math.cos(a) * 8, pos.y - 5);
                    ctx.stroke();
                }
                break;
            }

            case 'lamppost': {
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 2, 5, 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#444';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(pos.x, pos.y - 28);
                ctx.stroke();
                // Lamp
                ctx.fillStyle = '#FFE4AA';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y - 30, 4, 0, Math.PI * 2);
                ctx.fill();
                // Glow
                ctx.fillStyle = 'rgba(255, 230, 150, 0.15)';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y - 30, 18, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'market_stall': {
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 14, 22, 6, 0, 0, Math.PI * 2);
                ctx.fill();
                // Counter
                ctx.fillStyle = '#8B6914';
                ctx.fillRect(pos.x - 20, pos.y, 40, 12);
                // Awning
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.moveTo(pos.x - 24, pos.y);
                ctx.lineTo(pos.x - 20, pos.y - 18);
                ctx.lineTo(pos.x + 20, pos.y - 18);
                ctx.lineTo(pos.x + 24, pos.y);
                ctx.fill();
                // Scalloped edge
                ctx.fillStyle = p.color;
                for (let i = 0; i < 5; i++) {
                    ctx.beginPath();
                    ctx.arc(pos.x - 16 + i * 8, pos.y + 1, 4, 0, Math.PI);
                    ctx.fill();
                }
                break;
            }

            case 'fence': {
                const fAngle = p.angle || 0;
                const fLen = p.length || 60;
                ctx.strokeStyle = '#8B6914';
                ctx.lineWidth = 2;
                const dx = Math.cos(fAngle) * fLen;
                const dy = Math.sin(fAngle) * fLen;
                // Rails
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y - 4);
                ctx.lineTo(pos.x + dx, pos.y + dy - 4);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(pos.x + dx, pos.y + dy);
                ctx.stroke();
                // Posts
                const posts = Math.floor(fLen / 15);
                for (let i = 0; i <= posts; i++) {
                    const t = i / posts;
                    const px = pos.x + dx * t;
                    const py = pos.y + dy * t;
                    ctx.beginPath();
                    ctx.moveTo(px, py + 3);
                    ctx.lineTo(px, py - 8);
                    ctx.stroke();
                }
                break;
            }

            case 'sparkle': {
                const sparkAlpha = (Math.sin((time || 0) * 3 + (p.timer || 0)) + 1) / 2 * 0.6;
                ctx.fillStyle = `rgba(255, 255, 200, ${sparkAlpha})`;
                const sparkSize = 2 + sparkAlpha * 2;
                // Cross shape
                ctx.fillRect(pos.x - sparkSize, pos.y - 0.5, sparkSize * 2, 1);
                ctx.fillRect(pos.x - 0.5, pos.y - sparkSize, 1, sparkSize * 2);
                break;
            }

            case 'cave': {
                // Rock face
                ctx.fillStyle = '#555';
                ctx.beginPath();
                ctx.moveTo(pos.x - 55, pos.y + 10);
                ctx.quadraticCurveTo(pos.x - 55, pos.y - 55, pos.x - 20, pos.y - 55);
                ctx.lineTo(pos.x + 20, pos.y - 55);
                ctx.quadraticCurveTo(pos.x + 55, pos.y - 55, pos.x + 55, pos.y + 10);
                ctx.fill();
                // Rock texture
                ctx.fillStyle = '#4a4a4a';
                ctx.beginPath();
                ctx.arc(pos.x - 30, pos.y - 30, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(pos.x + 25, pos.y - 40, 10, 0, Math.PI * 2);
                ctx.fill();
                // Cave opening
                ctx.fillStyle = '#0d0d0d';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y - 15, 32, Math.PI, 0);
                ctx.fill();
                ctx.fillRect(pos.x - 32, pos.y - 15, 64, 25);
                // Gradient into darkness
                const caveGrad = ctx.createRadialGradient(pos.x, pos.y - 5, 5, pos.x, pos.y - 5, 30);
                caveGrad.addColorStop(0, 'rgba(0,0,0,0.9)');
                caveGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = caveGrad;
                ctx.fillRect(pos.x - 35, pos.y - 30, 70, 40);
                // Label
                ctx.fillStyle = '#FF8800';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('CAVE', pos.x, pos.y + 25);
                ctx.fillStyle = '#FF6644';
                ctx.font = '10px Arial';
                ctx.fillText('Press E to Enter', pos.x, pos.y + 38);
                break;
            }

            case 'snowdrift': {
                const sd = p.size;
                ctx.fillStyle = '#E8F0F8';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y, sd, sd * (p.height || 0.4), 0, 0, Math.PI * 2);
                ctx.fill();
                // Highlight
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.beginPath();
                ctx.ellipse(pos.x - sd * 0.2, pos.y - sd * 0.1, sd * 0.5, sd * 0.2, -0.3, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'ice': {
                const is = p.size || 1;
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.rotate(p.rotation || 0);
                ctx.fillStyle = 'rgba(130, 210, 255, 0.55)';
                ctx.beginPath();
                ctx.moveTo(0, -14 * is);
                ctx.lineTo(8 * is, 0);
                ctx.lineTo(3 * is, 14 * is);
                ctx.lineTo(-5 * is, 10 * is);
                ctx.lineTo(-8 * is, -2 * is);
                ctx.fill();
                // Highlight
                ctx.fillStyle = 'rgba(200, 240, 255, 0.4)';
                ctx.beginPath();
                ctx.moveTo(-2 * is, -8 * is);
                ctx.lineTo(3 * is, -2 * is);
                ctx.lineTo(0, 4 * is);
                ctx.lineTo(-4 * is, 0);
                ctx.fill();
                ctx.restore();
                break;
            }

            case 'frozen_tree': {
                const ft = p.size || 1;
                ctx.strokeStyle = '#6a6a7a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y + 10 * ft);
                ctx.lineTo(pos.x, pos.y - 18 * ft);
                ctx.stroke();
                // Bare branches
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y - 10 * ft);
                ctx.lineTo(pos.x - 10 * ft, pos.y - 16 * ft);
                ctx.moveTo(pos.x, pos.y - 14 * ft);
                ctx.lineTo(pos.x + 8 * ft, pos.y - 20 * ft);
                ctx.moveTo(pos.x, pos.y - 6 * ft);
                ctx.lineTo(pos.x + 10 * ft, pos.y - 10 * ft);
                ctx.stroke();
                // Frost
                ctx.fillStyle = 'rgba(200, 230, 255, 0.4)';
                ctx.beginPath();
                ctx.arc(pos.x - 6 * ft, pos.y - 14 * ft, 4 * ft, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(pos.x + 5 * ft, pos.y - 18 * ft, 3 * ft, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'snow_rock': {
                const sr = p.size;
                // Rock body
                ctx.fillStyle = '#6a6a7a';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, sr, 0, Math.PI * 2);
                ctx.fill();
                // Snow cap
                ctx.fillStyle = '#E8F0F8';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y - sr * 0.3, sr * 0.85, Math.PI + 0.3, -0.3);
                ctx.fill();
                break;
            }

            case 'igloo': {
                ctx.fillStyle = 'rgba(0,0,0,0.08)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 14, 22, 6, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#E0E8F0';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 20, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = '#CCD8E4';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 20, Math.PI, 0);
                ctx.closePath();
                ctx.stroke;
                // Entrance
                ctx.fillStyle = '#3a3a4a';
                ctx.beginPath();
                ctx.arc(pos.x + 18, pos.y, 8, Math.PI * 0.5, Math.PI * 1.5, true);
                ctx.fill();
                // Ice block lines
                ctx.strokeStyle = 'rgba(180, 200, 220, 0.3)';
                ctx.lineWidth = 0.5;
                for (let a = Math.PI; a < Math.PI * 2; a += 0.4) {
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 20, a, a + 0.3);
                    ctx.stroke();
                }
                break;
            }

            case 'pond': {
                const pr = p.radius;
                ctx.fillStyle = 'rgba(160, 210, 240, 0.45)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y, pr, pr * 0.65, 0, 0, Math.PI * 2);
                ctx.fill();
                // Ice surface reflection
                ctx.fillStyle = 'rgba(220, 240, 255, 0.3)';
                ctx.beginPath();
                ctx.ellipse(pos.x - pr * 0.2, pos.y - pr * 0.1, pr * 0.5, pr * 0.25, -0.2, 0, Math.PI * 2);
                ctx.fill();
                // Cracks in ice
                ctx.strokeStyle = 'rgba(180, 210, 240, 0.3)';
                ctx.lineWidth = 0.5;
                for (let i = 0; i < 4; i++) {
                    const a = Math.random() * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y);
                    ctx.lineTo(pos.x + Math.cos(a) * pr * 0.6, pos.y + Math.sin(a) * pr * 0.4);
                    ctx.stroke();
                }
                break;
            }

            case 'water_curved': {
                const sp = p.shorePoints;
                // Deep water
                ctx.fillStyle = '#1a6fa8';
                ctx.fillRect(pos.x, pos.y + p.h * 0.7, p.w, p.h * 0.3);
                // Shallow water
                ctx.fillStyle = '#2288CC';
                // Draw water with curved shoreline
                ctx.beginPath();
                ctx.moveTo(camera.worldToScreen(sp[0].x, sp[0].y).x, camera.worldToScreen(sp[0].x, sp[0].y).y);
                for (let i = 1; i < sp.length; i++) {
                    const s = camera.worldToScreen(sp[i].x, sp[i].y);
                    const prev = camera.worldToScreen(sp[i-1].x, sp[i-1].y);
                    const cpx = (prev.x + s.x) / 2;
                    const cpy = (prev.y + s.y) / 2;
                    ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
                }
                const bottomR = camera.worldToScreen(p.x + p.w, p.y + p.h);
                const bottomL = camera.worldToScreen(p.x, p.y + p.h);
                ctx.lineTo(bottomR.x, bottomR.y);
                ctx.lineTo(bottomL.x, bottomL.y);
                ctx.closePath();
                ctx.fill();
                // Animated waves along shore
                ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < sp.length; i++) {
                    const waveOffset = Math.sin((time || 0) * 2 + i * 0.8) * 6;
                    const s = camera.worldToScreen(sp[i].x, sp[i].y + waveOffset);
                    if (i === 0) ctx.moveTo(s.x, s.y);
                    else ctx.lineTo(s.x, s.y);
                }
                ctx.stroke();
                // Foam line
                ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                for (let i = 0; i < sp.length; i++) {
                    const waveOffset = Math.sin((time || 0) * 1.5 + i * 0.6) * 4 + 8;
                    const s = camera.worldToScreen(sp[i].x, sp[i].y + waveOffset);
                    if (i === 0) ctx.moveTo(s.x, s.y);
                    else ctx.lineTo(s.x, s.y);
                }
                ctx.stroke();
                break;
            }

            case 'palm': {
                const ps = p.size || 1;
                const lean = p.lean || 0;
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath();
                ctx.ellipse(pos.x + 10 * ps, pos.y + 12, 15 * ps, 5 * ps, 0.3, 0, Math.PI * 2);
                ctx.fill();
                // Curved trunk
                ctx.strokeStyle = '#8B7540';
                ctx.lineWidth = 5 * ps;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y + 10);
                ctx.quadraticCurveTo(pos.x + 12 * ps + lean * 20, pos.y - 12 * ps, pos.x + 6 * ps + lean * 10, pos.y - 30 * ps);
                ctx.stroke();
                // Trunk texture
                ctx.strokeStyle = '#7A6535';
                ctx.lineWidth = 1;
                for (let i = 0; i < 5; i++) {
                    const ty = pos.y + 10 - i * 8 * ps;
                    ctx.beginPath();
                    ctx.arc(pos.x + (i * 2 * ps + lean * i * 3), ty, 3 * ps, 0, Math.PI);
                    ctx.stroke();
                }
                // Leaves (drooping fronds)
                const topX = pos.x + 6 * ps + lean * 10;
                const topY = pos.y - 30 * ps;
                ctx.strokeStyle = '#228B22';
                ctx.lineWidth = 2;
                ctx.fillStyle = '#2D9B2D';
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
                    const droop = 0.5;
                    const frondLen = 18 * ps;
                    const endX = topX + Math.cos(a) * frondLen;
                    const endY = topY + Math.sin(a) * frondLen + frondLen * droop;
                    ctx.beginPath();
                    ctx.moveTo(topX, topY);
                    ctx.quadraticCurveTo(topX + Math.cos(a) * frondLen * 0.6, topY + Math.sin(a) * frondLen * 0.3, endX, endY);
                    ctx.stroke();
                    // Leaf blade
                    ctx.beginPath();
                    ctx.moveTo(topX, topY);
                    ctx.quadraticCurveTo(topX + Math.cos(a + 0.15) * frondLen * 0.5, topY + Math.sin(a + 0.15) * frondLen * 0.3, endX, endY);
                    ctx.quadraticCurveTo(topX + Math.cos(a - 0.15) * frondLen * 0.5, topY + Math.sin(a - 0.15) * frondLen * 0.3, topX, topY);
                    ctx.globalAlpha = 0.3;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
                break;
            }

            case 'shell': {
                const shs = p.size || 1;
                if (p.variant === 1) {
                    ctx.fillStyle = '#FFD4B8';
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 4 * shs, 0, Math.PI);
                    ctx.fill();
                    ctx.strokeStyle = '#D4A088';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                } else {
                    ctx.fillStyle = '#FFDAB9';
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 3.5 * shs, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#D4A088';
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 2 * shs, 0, Math.PI);
                    ctx.stroke();
                }
                break;
            }

            case 'umbrella': {
                ctx.fillStyle = 'rgba(0,0,0,0.08)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 8, 18, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                // Towel
                ctx.fillStyle = p.color + '55';
                ctx.fillRect(pos.x - 14, pos.y + 2, 28, 12);
                // Pole
                ctx.strokeStyle = '#555';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y + 10);
                ctx.lineTo(pos.x, pos.y - 20);
                ctx.stroke();
                // Canopy
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y - 20, 20, Math.PI, 0);
                ctx.fill();
                // Stripes
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y - 20, 20, Math.PI + 0.5, Math.PI + 1.0);
                ctx.lineTo(pos.x, pos.y - 20);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(pos.x, pos.y - 20, 20, Math.PI + 1.6, Math.PI + 2.1);
                ctx.lineTo(pos.x, pos.y - 20);
                ctx.fill();
                break;
            }

            case 'driftwood': {
                ctx.strokeStyle = '#9B8B70';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                const dAngle = p.angle || 0;
                ctx.moveTo(pos.x - Math.cos(dAngle) * p.length / 2, pos.y - Math.sin(dAngle) * p.length / 2);
                ctx.lineTo(pos.x + Math.cos(dAngle) * p.length / 2, pos.y + Math.sin(dAngle) * p.length / 2);
                ctx.stroke();
                break;
            }

            case 'sandcastle': {
                ctx.fillStyle = '#D4B87A';
                // Base
                ctx.fillRect(pos.x - 12, pos.y, 24, 10);
                // Towers
                ctx.fillRect(pos.x - 10, pos.y - 10, 8, 12);
                ctx.fillRect(pos.x + 2, pos.y - 14, 8, 16);
                // Battlements
                ctx.fillRect(pos.x - 11, pos.y - 13, 3, 3);
                ctx.fillRect(pos.x - 5, pos.y - 13, 3, 3);
                ctx.fillRect(pos.x + 2, pos.y - 17, 3, 3);
                ctx.fillRect(pos.x + 7, pos.y - 17, 3, 3);
                // Flag
                ctx.strokeStyle = '#666';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(pos.x + 6, pos.y - 17);
                ctx.lineTo(pos.x + 6, pos.y - 24);
                ctx.stroke();
                ctx.fillStyle = '#FF4444';
                ctx.fillRect(pos.x + 6, pos.y - 24, 6, 4);
                break;
            }

            case 'tidepool': {
                ctx.fillStyle = 'rgba(50, 120, 160, 0.5)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y, p.radius, p.radius * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(80, 160, 200, 0.3)';
                ctx.beginPath();
                ctx.ellipse(pos.x - 2, pos.y - 1, p.radius * 0.5, p.radius * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'coconut': {
                ctx.fillStyle = '#5C3A1E';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'volcano_mountain': {
                // Large background mountain
                ctx.fillStyle = '#3a2a2a';
                ctx.beginPath();
                ctx.moveTo(pos.x - 250, pos.y + 200);
                ctx.quadraticCurveTo(pos.x - 120, pos.y - 80, pos.x - 40, pos.y - 140);
                ctx.lineTo(pos.x + 40, pos.y - 140);
                ctx.quadraticCurveTo(pos.x + 120, pos.y - 80, pos.x + 250, pos.y + 200);
                ctx.fill();
                // Darker side
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y - 140);
                ctx.lineTo(pos.x + 40, pos.y - 140);
                ctx.quadraticCurveTo(pos.x + 120, pos.y - 80, pos.x + 250, pos.y + 200);
                ctx.lineTo(pos.x, pos.y + 200);
                ctx.fill();
                // Crater glow
                ctx.fillStyle = 'rgba(255, 100, 0, 0.5)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y - 140, 30, 10, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255, 200, 0, 0.3)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y - 140, 18, 6, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'lava': {
                const lg = 0.6 + Math.sin((time || 0) * 3 + p.x * 0.01) * 0.2;
                // Outer glow
                ctx.fillStyle = `rgba(255, 60, 0, ${lg * 0.2})`;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, p.radius * 1.4, 0, Math.PI * 2);
                ctx.fill();
                // Main pool
                ctx.fillStyle = `rgba(255, 80, 0, ${lg})`;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
                // Hot center
                ctx.fillStyle = `rgba(255, 200, 0, ${lg * 0.6})`;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, p.radius * 0.5, 0, Math.PI * 2);
                ctx.fill();
                // Bright core
                ctx.fillStyle = `rgba(255, 255, 150, ${lg * 0.3})`;
                ctx.beginPath();
                ctx.arc(pos.x + p.radius * 0.1, pos.y - p.radius * 0.1, p.radius * 0.2, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'lava_stream': {
                const lsg = 0.4 + Math.sin((time || 0) * 2 + (p.x1 || 0) * 0.01) * 0.15;
                const s1 = camera.worldToScreen(p.x1, p.y1);
                const s2 = camera.worldToScreen(p.x2, p.y2);
                ctx.strokeStyle = `rgba(255, 80, 0, ${lsg})`;
                ctx.lineWidth = 8;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                ctx.quadraticCurveTo((s1.x + s2.x) / 2 + randomRange(-5, 5), (s1.y + s2.y) / 2 + randomRange(-5, 5), s2.x, s2.y);
                ctx.stroke();
                ctx.strokeStyle = `rgba(255, 200, 0, ${lsg * 0.5})`;
                ctx.lineWidth = 3;
                ctx.stroke();
                break;
            }

            case 'rock': {
                const rsize = p.size;
                const shade = p.shade || 0.8;
                const r = Math.floor(85 * shade);
                const g = Math.floor(80 * shade);
                const b = Math.floor(75 * shade);
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, rsize, 0, Math.PI * 2);
                ctx.fill();
                // Highlight
                ctx.fillStyle = `rgba(255,255,255,0.1)`;
                ctx.beginPath();
                ctx.arc(pos.x - rsize * 0.2, pos.y - rsize * 0.25, rsize * 0.5, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'charred_tree': {
                const ct = p.size || 1;
                ctx.strokeStyle = '#2a2020';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y + 10 * ct);
                ctx.lineTo(pos.x + ct, pos.y - 18 * ct);
                ctx.stroke();
                // Dead branches
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(pos.x + ct, pos.y - 12 * ct);
                ctx.lineTo(pos.x - 8 * ct, pos.y - 18 * ct);
                ctx.moveTo(pos.x + ct, pos.y - 8 * ct);
                ctx.lineTo(pos.x + 9 * ct, pos.y - 14 * ct);
                ctx.stroke();
                break;
            }

            case 'vent': {
                // Ground vent
                ctx.fillStyle = 'rgba(60, 50, 40, 0.6)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y, 8, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                // Smoke
                const smokePhase = (time || 0) * 1.5;
                for (let i = 0; i < 4; i++) {
                    const sy = pos.y - 10 - i * 12 - (smokePhase % 15) * 3;
                    const sx = pos.x + Math.sin(smokePhase + i * 1.2) * 5;
                    const alpha = 0.3 - i * 0.07;
                    if (alpha <= 0) continue;
                    ctx.fillStyle = `rgba(100, 90, 80, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 5 + i * 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }

            case 'crack': {
                const crackGlow = 0.5 + Math.sin((time || 0) * 2 + (p.x || 0) * 0.01) * 0.2;
                ctx.strokeStyle = `rgba(255, 80, 0, ${crackGlow})`;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                const cLen = p.length || 40;
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(pos.x + Math.cos(p.angle) * cLen, pos.y + Math.sin(p.angle) * cLen);
                ctx.stroke();
                // Glow
                ctx.strokeStyle = `rgba(255, 150, 0, ${crackGlow * 0.3})`;
                ctx.lineWidth = 5;
                ctx.stroke();
                break;
            }

            case 'ash_mound': {
                ctx.fillStyle = 'rgba(70, 60, 55, 0.5)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(90, 80, 70, 0.3)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y - 2, p.size * 0.7, p.size * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'haunted_house': {
                const hw = p.w / 2, hh = p.h / 2;
                const wallH = p.h * 0.85;
                const footW = hw;
                const footH = hh * 0.5;

                // Eerie ground glow
                const glowPulse = 0.15 + Math.sin((time || 0) * 1.5) * 0.05;
                ctx.fillStyle = `rgba(100, 200, 100, ${glowPulse})`;
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 10, p.w * 0.7, p.w * 0.35, 0, 0, Math.PI * 2);
                ctx.fill();

                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 8, p.w * 0.55, p.w * 0.25, 0, 0, Math.PI * 2);
                ctx.fill();

                // Front face (dark gray-purple walls)
                ctx.fillStyle = '#3a3040';
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y + footH);
                ctx.lineTo(pos.x + footW, pos.y);
                ctx.lineTo(pos.x + footW, pos.y - wallH);
                ctx.lineTo(pos.x, pos.y + footH - wallH);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Side face (darker)
                ctx.fillStyle = '#2a2030';
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y + footH);
                ctx.lineTo(pos.x - footW, pos.y);
                ctx.lineTo(pos.x - footW, pos.y - wallH);
                ctx.lineTo(pos.x, pos.y + footH - wallH);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.stroke();

                // Crooked roof (slightly tilted)
                const roofPeak = pos.y + footH - wallH - 28;
                ctx.fillStyle = '#1a1520';
                ctx.beginPath();
                ctx.moveTo(pos.x - footW - 6, pos.y - wallH + 2);
                ctx.lineTo(pos.x + 3, roofPeak - 3); // slightly off-center peak
                ctx.lineTo(pos.x + footW + 6, pos.y - wallH);
                ctx.lineTo(pos.x, pos.y + footH - wallH);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.stroke();

                // Broken windows (glowing eerie green)
                const winGlow = 0.5 + Math.sin((time || 0) * 2) * 0.15;
                ctx.fillStyle = `rgba(80, 255, 80, ${winGlow})`;
                const wfx = pos.x + footW * 0.5;
                const wfy = pos.y - wallH + 18;
                ctx.fillRect(wfx - 5, wfy, 10, 10);
                // Crack in window
                ctx.strokeStyle = '#2a2030';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(wfx - 3, wfy);
                ctx.lineTo(wfx + 2, wfy + 10);
                ctx.moveTo(wfx + 4, wfy + 3);
                ctx.lineTo(wfx - 2, wfy + 7);
                ctx.stroke();

                // Side window
                ctx.fillStyle = `rgba(80, 255, 80, ${winGlow * 0.7})`;
                const wsx = pos.x - footW * 0.5;
                ctx.fillRect(wsx - 4, wfy, 8, 8);
                // Boards over window
                ctx.strokeStyle = '#4a3020';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(wsx - 5, wfy + 1);
                ctx.lineTo(wsx + 5, wfy + 7);
                ctx.stroke();

                // Door (dark, slightly ajar)
                const hdoorX = pos.x + footW * 0.25;
                const hdoorBaseY = pos.y + footH * 0.8;
                ctx.fillStyle = '#1a1010';
                ctx.beginPath();
                ctx.moveTo(hdoorX - 6, hdoorBaseY);
                ctx.lineTo(hdoorX - 6, hdoorBaseY - 16);
                ctx.arc(hdoorX, hdoorBaseY - 16, 6, Math.PI, 0);
                ctx.lineTo(hdoorX + 6, hdoorBaseY);
                ctx.fill();
                // Green glow from door opening
                ctx.fillStyle = `rgba(80, 255, 80, ${winGlow * 0.3})`;
                ctx.fillRect(hdoorX - 2, hdoorBaseY - 14, 3, 14);

                // Label
                ctx.fillStyle = '#88FF88';
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('HAUNTED HOUSE', pos.x, pos.y + footH + 16);
                ctx.fillStyle = '#66CC66';
                ctx.font = '9px Arial';
                ctx.fillText('Press E to Enter', pos.x, pos.y + footH + 28);
                break;
            }

            case 'sand_castle_boss': {
                const scw = p.w / 2;
                const sch = p.h / 2;
                const scWallH = p.h * 0.7;
                const scFootW = scw;
                const scFootH = sch * 0.5;

                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y + 8, p.w * 0.6, p.w * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();

                // Front wall (sandy)
                ctx.fillStyle = '#D4A854';
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y + scFootH);
                ctx.lineTo(pos.x + scFootW, pos.y);
                ctx.lineTo(pos.x + scFootW, pos.y - scWallH);
                ctx.lineTo(pos.x, pos.y + scFootH - scWallH);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Side wall (darker sand)
                ctx.fillStyle = '#C49A44';
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y + scFootH);
                ctx.lineTo(pos.x - scFootW, pos.y);
                ctx.lineTo(pos.x - scFootW, pos.y - scWallH);
                ctx.lineTo(pos.x, pos.y + scFootH - scWallH);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Crenellations (castle top)
                const crenTop = pos.y + scFootH - scWallH;
                ctx.fillStyle = '#D4A854';
                for (let ci = 0; ci < 4; ci++) {
                    const cx = pos.x + (ci - 1.5) * 10;
                    ctx.fillRect(cx - 3, crenTop - 8, 6, 8);
                }
                // Side crenellations
                ctx.fillStyle = '#C49A44';
                for (let ci = 0; ci < 3; ci++) {
                    const cx = pos.x - scFootW + 8 + ci * 12;
                    ctx.fillRect(cx - 3, crenTop - 6, 5, 6);
                }

                // Tower (center back)
                const towerH = 18;
                ctx.fillStyle = '#DAAE58';
                ctx.fillRect(pos.x - 8, crenTop - towerH, 16, towerH);
                // Tower top
                ctx.fillStyle = '#D4A854';
                ctx.fillRect(pos.x - 10, crenTop - towerH - 4, 20, 4);
                // Flag
                ctx.strokeStyle = '#8B4513';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(pos.x, crenTop - towerH - 4);
                ctx.lineTo(pos.x, crenTop - towerH - 18);
                ctx.stroke();
                const flagWave = Math.sin((time || 0) * 3) * 2;
                ctx.fillStyle = '#FF4444';
                ctx.beginPath();
                ctx.moveTo(pos.x, crenTop - towerH - 18);
                ctx.lineTo(pos.x + 10 + flagWave, crenTop - towerH - 14);
                ctx.lineTo(pos.x, crenTop - towerH - 10);
                ctx.fill();

                // Door (arch)
                ctx.fillStyle = '#3a2a10';
                const sdoorX = pos.x + scFootW * 0.3;
                const sdoorBase = pos.y + scFootH * 0.75;
                ctx.beginPath();
                ctx.moveTo(sdoorX - 7, sdoorBase);
                ctx.lineTo(sdoorX - 7, sdoorBase - 14);
                ctx.arc(sdoorX, sdoorBase - 14, 7, Math.PI, 0);
                ctx.lineTo(sdoorX + 7, sdoorBase);
                ctx.fill();

                // Sand texture dots
                ctx.fillStyle = 'rgba(180, 140, 60, 0.3)';
                for (let si = 0; si < 8; si++) {
                    ctx.beginPath();
                    ctx.arc(
                        pos.x + Math.sin(si * 2.7) * scFootW * 0.6,
                        pos.y - scWallH * 0.3 + Math.cos(si * 1.9) * scWallH * 0.3,
                        2, 0, Math.PI * 2
                    );
                    ctx.fill();
                }

                // Label
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('SAND CASTLE', pos.x, pos.y + scFootH + 16);
                ctx.fillStyle = '#DDAA44';
                ctx.font = '9px Arial';
                ctx.fillText('Press E to Enter', pos.x, pos.y + scFootH + 28);
                break;
            }

            case 'ice_castle': {
                const { x, y } = pos;
                // Castle base
                ctx.fillStyle = '#A0D0E8';
                ctx.fillRect(x - 35, y - 30, 70, 50);
                // Castle walls (frosted stone)
                ctx.fillStyle = '#88C0D8';
                ctx.fillRect(x - 38, y - 30, 76, 8);
                // Towers
                ctx.fillStyle = '#90C8E0';
                ctx.fillRect(x - 40, y - 50, 18, 35);
                ctx.fillRect(x + 22, y - 50, 18, 35);
                // Tower tops (pointed)
                ctx.fillStyle = '#70B0D0';
                ctx.beginPath();
                ctx.moveTo(x - 42, y - 50);
                ctx.lineTo(x - 31, y - 65);
                ctx.lineTo(x - 20, y - 50);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(x + 20, y - 50);
                ctx.lineTo(x + 31, y - 65);
                ctx.lineTo(x + 42, y - 50);
                ctx.closePath();
                ctx.fill();
                // Crenellations
                ctx.fillStyle = '#A0D0E8';
                for (let i = 0; i < 8; i++) {
                    if (i % 2 === 0) ctx.fillRect(x - 38 + i * 9.5, y - 38, 9.5, 6);
                }
                // Gate (dark entrance)
                ctx.fillStyle = '#1a2a3a';
                ctx.beginPath();
                ctx.moveTo(x - 12, y + 20);
                ctx.lineTo(x - 12, y - 5);
                ctx.arc(x, y - 5, 12, Math.PI, 0);
                ctx.lineTo(x + 12, y + 20);
                ctx.closePath();
                ctx.fill();
                // Icicles on gate
                ctx.fillStyle = '#C0E8FF';
                for (let i = 0; i < 5; i++) {
                    const ix = x - 10 + i * 5;
                    ctx.beginPath();
                    ctx.moveTo(ix - 1, y - 15);
                    ctx.lineTo(ix, y - 8);
                    ctx.lineTo(ix + 1, y - 15);
                    ctx.closePath();
                    ctx.fill();
                }
                // Frost sparkles
                ctx.fillStyle = `rgba(200, 240, 255, ${0.5 + Math.sin(Date.now() / 400) * 0.3})`;
                ctx.beginPath();
                ctx.arc(x - 25, y - 45, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x + 25, y - 45, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x, y - 55, 2.5, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'volcano_lair': {
                const { x, y } = pos;
                // Rocky volcanic cave entrance
                // Outer rock arch
                ctx.fillStyle = '#3A2A1A';
                ctx.beginPath();
                ctx.moveTo(x - 35, y + 25);
                ctx.lineTo(x - 40, y - 10);
                ctx.quadraticCurveTo(x - 30, y - 35, x, y - 40);
                ctx.quadraticCurveTo(x + 30, y - 35, x + 40, y - 10);
                ctx.lineTo(x + 35, y + 25);
                ctx.closePath();
                ctx.fill();
                // Dark cave opening
                ctx.fillStyle = '#0a0500';
                ctx.beginPath();
                ctx.moveTo(x - 22, y + 25);
                ctx.lineTo(x - 25, y - 5);
                ctx.quadraticCurveTo(x, y - 28, x + 25, y - 5);
                ctx.lineTo(x + 22, y + 25);
                ctx.closePath();
                ctx.fill();
                // Lava glow from inside
                const lavaGlow = ctx.createRadialGradient(x, y + 5, 5, x, y + 5, 30);
                lavaGlow.addColorStop(0, `rgba(255, 100, 0, ${0.4 + Math.sin(Date.now() / 300) * 0.15})`);
                lavaGlow.addColorStop(1, 'rgba(255, 50, 0, 0)');
                ctx.fillStyle = lavaGlow;
                ctx.beginPath();
                ctx.arc(x, y + 5, 30, 0, Math.PI * 2);
                ctx.fill();
                // Smoke wisps
                ctx.fillStyle = `rgba(80, 80, 80, ${0.2 + Math.sin(Date.now() / 600) * 0.1})`;
                for (let i = 0; i < 3; i++) {
                    const sx = x + Math.sin(Date.now() / 800 + i * 2) * 10;
                    const sy = y - 30 - i * 12 - Math.sin(Date.now() / 500 + i) * 5;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 5 + i * 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Lava drips on rocks
                ctx.fillStyle = `rgba(255, 80, 0, ${0.6 + Math.sin(Date.now() / 250) * 0.2})`;
                ctx.beginPath();
                ctx.ellipse(x - 18, y + 10, 2, 4, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(x + 20, y + 5, 2, 3, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'dead_tree': {
                const ds = p.size || 1;
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.beginPath();
                ctx.ellipse(pos.x + 5, pos.y + 8, 10 * ds, 4 * ds, 0, 0, Math.PI * 2);
                ctx.fill();
                // Trunk (gray, lifeless)
                ctx.strokeStyle = '#4a4040';
                ctx.lineWidth = 4 * ds;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y + 8);
                ctx.lineTo(pos.x - 1, pos.y - 20 * ds);
                ctx.stroke();
                // Bare branches
                ctx.lineWidth = 2 * ds;
                ctx.beginPath();
                ctx.moveTo(pos.x - 1, pos.y - 14 * ds);
                ctx.lineTo(pos.x - 12 * ds, pos.y - 22 * ds);
                ctx.moveTo(pos.x - 1, pos.y - 18 * ds);
                ctx.lineTo(pos.x + 10 * ds, pos.y - 26 * ds);
                ctx.moveTo(pos.x + 10 * ds, pos.y - 26 * ds);
                ctx.lineTo(pos.x + 16 * ds, pos.y - 24 * ds);
                ctx.moveTo(pos.x - 1, pos.y - 20 * ds);
                ctx.lineTo(pos.x - 6 * ds, pos.y - 30 * ds);
                ctx.stroke();
                break;
            }

            case 'gravestone': {
                const tilt = p.tilt || 0;
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.rotate(tilt);
                // Stone
                ctx.fillStyle = '#6a6a6a';
                ctx.beginPath();
                ctx.moveTo(-6, 6);
                ctx.lineTo(-6, -6);
                ctx.arc(0, -6, 6, Math.PI, 0);
                ctx.lineTo(6, 6);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#555';
                ctx.lineWidth = 1;
                ctx.stroke();
                // RIP text
                ctx.fillStyle = '#888';
                ctx.font = 'bold 5px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('RIP', 0, 1);
                ctx.restore();
                break;
            }
        }
        ctx.restore();
    }

    getBiomeAt(x, y) {
        for (const b of BIOME_LAYOUTS) {
            if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) {
                return b.type;
            }
        }
        return BIOME.VILLAGE;
    }

    getLavaZones() {
        return this._lavaZones;
    }

    getWaterZone() {
        return this._waterZone;
    }

    // Darken a hex color by a factor (0-1)
    _darken(hex, factor) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
    }
}
