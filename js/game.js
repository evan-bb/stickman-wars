// ============================================
// Game - State Machine & Main Loop
// ============================================

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.state = 'MENU';
        this.lastTime = 0;
        this.gameTime = 0;

        this.input = new InputHandler(canvas);
        this.touch = new TouchControls(canvas, this.input);
        this.camera = new Camera();
        this.biomes = new BiomeRenderer();
        this.minimap = new Minimap();
        this.hud = new HUD();
        this.music = new MusicSystem();
        this.grid = new SpatialGrid(WORLD_WIDTH, WORLD_HEIGHT, GRID_CELL_SIZE);
        this.progression = new ProgressionSystem();
        this.screenFlashes = [];

        // Match stats tracking
        this.matchBossKills = 0;
        this.matchSticksCollected = 0;

        this.player = null;
        this.entities = [];
        this.projectiles = [];
        this.particles = [];
        this.pickups = [];
        this.food = [];
        this.foodRespawnTimer = FOOD_RESPAWN_TIME;
        this.crates = [];
        this.boss = null;

        this.blueAlive = 0;
        this.redAlive = 0;

        this.inCave = false;
        this.selectedWeapon = null;
        this.countdownTimer = 0;

        // Menu animation
        this.menuStickmen = [];
        for (let i = 0; i < 20; i++) {
            this.menuStickmen.push({
                x: randomRange(100, CANVAS_WIDTH - 100),
                y: randomRange(200, CANVAS_HEIGHT - 100),
                vx: randomRange(-60, 60),
                vy: randomRange(-60, 60),
                team: i < 10 ? TEAMS.BLUE : TEAMS.RED,
                facing: 0, walkTimer: Math.random() * 10,
                attackAnim: 0, health: 100, maxHealth: 100,
                alive: true, weapon: null, isPlayer: false
            });
        }

        // Stick respawn timer
        this.stickRespawnTimer = STICK_RESPAWN_TIME;

        // Boss loot given
        this.bossDefeated = false;
        this.ghostDefeated = false;
        this.ghostBoss = null;
        this.crabDefeated = false;
        this.crabBoss = null;
        this.polarDefeated = false;
        this.polarBoss = null;
        this.lavaDefeated = false;
        this.lavaBoss = null;

        // Storm system
        this.storm = {
            active: false,
            phase: 0,
            radius: 2200,
            targetRadius: Math.max(WORLD_WIDTH, WORLD_HEIGHT),
            centerX: STORM_CONFIG.centerX,
            centerY: STORM_CONFIG.centerY,
            shrinking: false,
            nextShrinkTime: STORM_CONFIG.startDelay,
            warningShown: false
        };

        // Generate biome props
        this.biomes.generate();
    }

    start() {
        requestAnimationFrame((t) => this.loop(t));
    }

    loop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;

        this.update(dt);
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // Update music system
        this.music.update(dt);

        switch (this.state) {
            case 'MENU': this.updateMenu(dt); break;
            case 'WEAPON_SELECT': break;
            case 'COUNTDOWN': this.updateCountdown(dt); break;
            case 'PLAYING': this.updatePlaying(dt); break;
            case 'BOSS_FIGHT': this.updateBossFight(dt); break;
            case 'GHOST_FIGHT': this.updateGhostFight(dt); break;
            case 'CRAB_FIGHT': this.updateCrabFight(dt); break;
            case 'POLAR_FIGHT': this.updatePolarFight(dt); break;
            case 'LAVA_FIGHT': this.updateLavaFight(dt); break;
            case 'WIN': break;
            case 'LOSE': break;
        }
    }

    render() {
        this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        switch (this.state) {
            case 'MENU': this.renderMenu(); break;
            case 'WEAPON_SELECT': this.renderWeaponSelect(); break;
            case 'COUNTDOWN': this.renderPlaying(); this.renderCountdown(); break;
            case 'PLAYING': this.renderPlaying(); break;
            case 'BOSS_FIGHT': this.renderBossFight(); break;
            case 'GHOST_FIGHT': this.renderGhostFight(); break;
            case 'CRAB_FIGHT': this.renderCrabFight(); break;
            case 'POLAR_FIGHT': this.renderPolarFight(); break;
            case 'LAVA_FIGHT': this.renderLavaFight(); break;
            case 'WIN': this.renderPlaying(); this.renderWin(); break;
            case 'LOSE': this.renderPlaying(); this.renderLose(); break;
        }

        // Draw touch controls overlay (on top of everything)
        if (this.touch.active && (this.state === 'PLAYING' || this.state === 'BOSS_FIGHT' || this.state === 'GHOST_FIGHT' || this.state === 'CRAB_FIGHT')) {
            this.touch.draw(this.ctx);
        }
    }

    // ==================== MENU ====================

    updateMenu(dt) {
        for (const s of this.menuStickmen) {
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.walkTimer += dt;
            if (s.x < 50 || s.x > CANVAS_WIDTH - 50) s.vx *= -1;
            if (s.y < 150 || s.y > CANVAS_HEIGHT - 50) s.vy *= -1;
            s.facing = Math.atan2(s.vy, s.vx);
        }

        if (this.input.consumeClick()) {
            // Check start button
            const mx = this.input.mouseX;
            const my = this.input.mouseY;
            if (mx > CANVAS_WIDTH / 2 - 80 && mx < CANVAS_WIDTH / 2 + 80 &&
                my > CANVAS_HEIGHT / 2 + 20 && my < CANVAS_HEIGHT / 2 + 60) {
                this.music.init(); // First click starts AudioContext
                this.initBattle('WOODEN_SWORD');
            }
            // Check "Back to evanbb.com" button (top-left)
            else if (mx > 20 && mx < 220 && my > 20 && my < 56) {
                window.location.href = 'https://evanbb.com';
            }
        }
    }

    renderMenu() {
        const ctx = this.ctx;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Animated stickmen in background (iso-projected)
        const menuCenterIso = worldToIso(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        const fakeCamera = {
            worldToScreen: (wx, wy) => {
                const iso = worldToIso(wx, wy);
                return { x: iso.x - menuCenterIso.x + CANVAS_WIDTH / 2, y: iso.y - menuCenterIso.y + CANVAS_HEIGHT / 2 };
            },
            isVisible: () => true, shakeX: 0, shakeY: 0
        };
        for (const s of this.menuStickmen) {
            drawStickman(ctx, s, fakeCamera);
        }

        // Back to evanbb.com button (top-left)
        ctx.fillStyle = '#2a2a4a';
        ctx.fillRect(20, 20, 200, 36);
        ctx.strokeStyle = '#4488FF';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, 200, 36);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('← Back to evanbb.com', 120, 42);

        // Title
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 56px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('STICKMAN WARS', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

        ctx.fillStyle = '#AAA';
        ctx.font = '18px Arial';
        ctx.fillText('Blue Team vs Red Team - Battle Royale', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

        // Start button
        ctx.fillStyle = '#4488FF';
        ctx.fillRect(CANVAS_WIDTH / 2 - 80, CANVAS_HEIGHT / 2 + 20, 160, 40);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('START', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 46);

        // Level badge on menu
        const prog = this.progression;
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Level ${prog.level}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80);

        // XP progress bar
        const barW = 120, barH = 6;
        const barX = CANVAS_WIDTH / 2 - barW / 2;
        const barY = CANVAS_HEIGHT / 2 + 86;
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(barX, barY, barW * prog.xpProgress(), barH);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX, barY, barW, barH);

        // Stats
        ctx.fillStyle = '#888';
        ctx.font = '11px Arial';
        ctx.fillText(`Games: ${prog.gamesPlayed}  |  Total Kills: ${prog.totalKills}  |  Best: ${prog.bestKills}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 108);

        // Equipped cosmetics preview
        if (prog.equippedHat !== 'none' || prog.equippedTrail !== 'none') {
            ctx.fillStyle = '#777';
            ctx.font = '11px Arial';
            const cosmeticParts = [];
            if (prog.equippedHat !== 'none') {
                const hatInfo = LEVEL_UNLOCKS.find(u => u.key === prog.equippedHat);
                cosmeticParts.push(hatInfo ? hatInfo.name : prog.equippedHat);
            }
            if (prog.equippedTrail !== 'none') {
                const trailInfo = LEVEL_UNLOCKS.find(u => u.key === prog.equippedTrail);
                cosmeticParts.push(trailInfo ? trailInfo.name : prog.equippedTrail);
            }
            ctx.fillText('Equipped: ' + cosmeticParts.join(', '), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 124);
        }

        // Hat/Trail cycle with Q and T keys
        if (this.input.isKeyDown('q')) {
            this.input.keys['q'] = false;
            const hats = prog.getUnlockedHats();
            const idx = hats.findIndex(h => h.key === prog.equippedHat);
            const next = hats[(idx + 1) % hats.length];
            prog.equippedHat = next.key;
            prog.save();
        }
        if (this.input.isKeyDown('t')) {
            this.input.keys['t'] = false;
            const trails = prog.getUnlockedTrails();
            if (trails.length > 0) {
                const current = trails.findIndex(t => t.key === prog.equippedTrail);
                if (current === -1) {
                    prog.equippedTrail = trails[0].key;
                } else {
                    const nextIdx = (current + 1) % (trails.length + 1);
                    prog.equippedTrail = nextIdx < trails.length ? trails[nextIdx].key : 'none';
                }
                prog.save();
            }
        }

        // Cosmetic cycle hint
        if (prog.level >= 2) {
            ctx.fillStyle = '#555';
            ctx.font = '11px Arial';
            ctx.fillText('Q: cycle hats  |  T: cycle trails', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 60);
        }

        // Controls info
        ctx.fillStyle = '#666';
        ctx.font = '13px Arial';
        if (this.touch.active) {
            ctx.fillText('Left side: move | Right side: aim & attack | Buttons: sprint & interact', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
        } else {
            ctx.fillText('WASD to move | Mouse to aim | Click/Space to attack | E to interact', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
        }
    }

    // ==================== WEAPON SELECT ====================

    renderWeaponSelect() {
        const ctx = this.ctx;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Choose Your Starter Weapon', CANVAS_WIDTH / 2, 60);

        // Player level display
        const savedXP = parseInt(localStorage.getItem('stickman_xp') || '0');
        let playerLevel = 0;
        for (let i = 1; i < XP_LEVELS.length; i++) {
            if (savedXP >= XP_LEVELS[i]) playerLevel = i;
            else break;
        }
        if (savedXP >= XP_LEVELS[XP_LEVELS.length - 1]) playerLevel = XP_LEVELS.length - 1;

        // Level badge
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Level ${playerLevel}`, CANVAS_WIDTH / 2, 95);

        // XP bar
        const xpBarW = 200, xpBarH = 10;
        const xpBarX = CANVAS_WIDTH / 2 - xpBarW / 2;
        const xpBarY = 102;
        ctx.fillStyle = '#333';
        ctx.fillRect(xpBarX, xpBarY, xpBarW, xpBarH);
        let xpPct = 1;
        if (playerLevel < XP_LEVELS.length - 1) {
            const curLvlXP = XP_LEVELS[playerLevel];
            const nxtLvlXP = XP_LEVELS[playerLevel + 1];
            xpPct = (savedXP - curLvlXP) / (nxtLvlXP - curLvlXP);
        }
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(xpBarX, xpBarY, xpBarW * xpPct, xpBarH);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(xpBarX, xpBarY, xpBarW, xpBarH);

        // XP text
        ctx.fillStyle = '#AAA';
        ctx.font = '11px Arial';
        if (playerLevel < XP_LEVELS.length - 1) {
            ctx.fillText(`${savedXP} / ${XP_LEVELS[playerLevel + 1]} XP`, CANVAS_WIDTH / 2, xpBarY + xpBarH + 14);
        } else {
            ctx.fillText(`${savedXP} XP (MAX LEVEL)`, CANVAS_WIDTH / 2, xpBarY + xpBarH + 14);
        }

        const weapons = [
            { key: 'WOODEN_SWORD', desc: 'Balanced melee weapon.\nGood range and speed.' },
            { key: 'BAT', desc: 'Heavy hitter.\nSlower but more damage.' },
            { key: 'BLOW_DART', desc: 'Ranged weapon.\nLow damage, long range.' }
        ];

        const cardW = 250, cardH = 300, gap = 40;
        const totalW = weapons.length * cardW + (weapons.length - 1) * gap;
        const startX = (CANVAS_WIDTH - totalW) / 2;

        for (let i = 0; i < weapons.length; i++) {
            const wx = startX + i * (cardW + gap);
            const wy = 130;
            const def = WEAPON_DEFS[weapons[i].key];

            // Hover detection
            const mx = this.input.mouseX;
            const my = this.input.mouseY;
            const hover = mx > wx && mx < wx + cardW && my > wy && my < wy + cardH;

            // Card background
            ctx.fillStyle = hover ? '#2a2a4e' : '#222244';
            ctx.fillRect(wx, wy, cardW, cardH);
            ctx.strokeStyle = hover ? def.color : '#444';
            ctx.lineWidth = hover ? 3 : 1;
            ctx.strokeRect(wx, wy, cardW, cardH);

            // Weapon name
            ctx.fillStyle = def.color;
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(def.name, wx + cardW / 2, wy + 40);

            // Weapon icon (drawn)
            ctx.save();
            ctx.translate(wx + cardW / 2, wy + 110);
            if (def.type === 'melee') {
                ctx.strokeStyle = def.color;
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(0, 20);
                ctx.lineTo(0, -25);
                ctx.stroke();
                // Guard
                ctx.beginPath();
                ctx.moveTo(-10, -5);
                ctx.lineTo(10, -5);
                ctx.stroke();
            } else {
                ctx.strokeStyle = def.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(-15, 0);
                ctx.lineTo(15, 0);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, 10, -1, 1);
                ctx.stroke();
                // Dart
                ctx.fillStyle = def.color;
                ctx.beginPath();
                ctx.moveTo(15, 0);
                ctx.lineTo(25, -2);
                ctx.lineTo(25, 2);
                ctx.fill();
            }
            ctx.restore();

            // Stats
            ctx.fillStyle = '#CCC';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Damage: ${def.damage}`, wx + cardW / 2, wy + 170);
            ctx.fillText(`Range: ${def.range}`, wx + cardW / 2, wy + 192);
            ctx.fillText(`Type: ${def.type.toUpperCase()}`, wx + cardW / 2, wy + 214);

            // Description
            ctx.fillStyle = '#999';
            ctx.font = '12px Arial';
            const lines = weapons[i].desc.split('\n');
            for (let l = 0; l < lines.length; l++) {
                ctx.fillText(lines[l], wx + cardW / 2, wy + 245 + l * 16);
            }

            // Click to select
            if (hover && this.input.consumeClick()) {
                this.selectedWeapon = weapons[i].key;
                this.initBattle(weapons[i].key);
            }
        }
    }

    // ==================== INIT BATTLE ====================

    initBattle(weaponKey) {
        this.entities = [];
        this.projectiles = [];
        this.particles = [];

        // Create player
        this.player = new Player(1000, 750);
        this.player.addWeapon(weaponKey);
        this.entities.push(this.player);

        // Create blue AI
        for (let i = 0; i < BLUE_AI_COUNT; i++) {
            const pos = this.randomSpawnPos();
            const ai = new Entity(pos.x, pos.y, TEAMS.BLUE);
            ai.weapon = new Weapon(randomFromArray(['WOODEN_SWORD', 'BAT', 'BLOW_DART']));
            ai.aiController = new AIController(ai);
            this.entities.push(ai);
        }

        // Create red AI
        for (let i = 0; i < RED_AI_COUNT; i++) {
            // Bias red team toward east side
            const pos = this.randomSpawnPos(true);
            const ai = new Entity(pos.x, pos.y, TEAMS.RED);
            ai.weapon = new Weapon(randomFromArray(['WOODEN_SWORD', 'BAT', 'BLOW_DART']));
            ai.aiController = new AIController(ai);
            this.entities.push(ai);
        }

        // Create pickups
        this.pickups = spawnSticks(STICK_SPAWN_COUNT, WORLD_WIDTH, WORLD_HEIGHT);
        this.food = spawnFood(FOOD_SPAWN_COUNT, WORLD_WIDTH, WORLD_HEIGHT);
        this.foodRespawnTimer = FOOD_RESPAWN_TIME;
        this.crates = createCrates();

        // Create boss (dormant)
        this.boss = new Boss(CAVE_WIDTH / 2, CAVE_HEIGHT / 2);

        this.inCave = false;
        this.bossDefeated = false;
        this.ghostDefeated = false;
        this.crabDefeated = false;
        this.gameTime = 0;
        this.countdownTimer = 3;
        this.state = 'COUNTDOWN';
        this.music.play('battle');

        // Reset match tracking
        this._matchXPAwarded = false;
        this._matchXP = null;
        this.matchBossKills = 0;
        this.matchSticksCollected = 0;
        this.progression.resetStreak();
        this.screenFlashes = [];

        // Reset storm
        this.storm = {
            active: false,
            phase: 0,
            radius: 2200,
            targetRadius: Math.max(WORLD_WIDTH, WORLD_HEIGHT),
            centerX: STORM_CONFIG.centerX,
            centerY: STORM_CONFIG.centerY,
            shrinking: false,
            nextShrinkTime: STORM_CONFIG.startDelay,
            warningShown: false
        };
    }

    randomSpawnPos(biasEast) {
        if (biasEast && Math.random() < 0.6) {
            return {
                x: randomRange(WORLD_WIDTH * 0.5, WORLD_WIDTH - 50),
                y: randomRange(50, WORLD_HEIGHT - 50)
            };
        }
        return {
            x: randomRange(50, WORLD_WIDTH - 50),
            y: randomRange(50, WORLD_HEIGHT - 50)
        };
    }

    // ==================== COUNTDOWN ====================

    updateCountdown(dt) {
        const prevNum = Math.ceil(this.countdownTimer);
        this.countdownTimer -= dt;
        this.camera.follow(this.player);
        const curNum = Math.ceil(this.countdownTimer);

        // Play sound on each number tick (3, 2, 1)
        if (curNum !== prevNum && curNum > 0 && curNum <= 3) {
            this.music.playSfx('countdown');
        }
        // Play FIGHT sound
        if (prevNum > 0 && curNum <= 0) {
            this.music.playSfx('fight');
        }

        if (this.countdownTimer <= 0) {
            this.state = 'PLAYING';
        }
    }

    renderCountdown() {
        const ctx = this.ctx;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 72px Arial';
        ctx.textAlign = 'center';
        const num = Math.ceil(this.countdownTimer);
        const text = num > 0 ? num.toString() : 'FIGHT!';
        const scale = 1 + (this.countdownTimer % 1) * 0.3;
        ctx.save();
        ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.scale(scale, scale);
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }

    // ==================== PLAYING ====================

    updatePlaying(dt) {
        this.gameTime += dt;
        this.hud.update(dt);
        this.progression.updateTimers(dt);

        // Track kills this frame for streak detection
        const prevKills = this.player.kills;

        // Update screen flashes
        for (const f of this.screenFlashes) f.update(dt);
        this.screenFlashes = this.screenFlashes.filter(f => f.alive);

        // Update environmental particles (snow, embers, leaves)
        this.biomes.updateEnvParticles(dt);

        const biomeAt = this.biomes.getBiomeAt(this.player.x, this.player.y);

        // Update player
        this.player.update(dt, this.input, this.camera, this.entities, this.projectiles, this.particles, biomeAt);
        // Weapon switch feedback
        if (this.player.weaponSwitched) {
            this.player.weaponSwitched = false;
            this.music.playSfx('weapon_switch');
            if (this.player.weapon) {
                this.hud.notify(`Switched to ${this.player.weapon.name}`, this.player.weapon.color, 1.2);
            }
        }
        // Level-up notification
        if (this.player.leveledUp) {
            this.player.leveledUp = false;
            this.hud.notify(`LEVEL UP! You are now Level ${this.player.level}!`, '#FFD700', 3);
        }
        this.camera.follow(this.player);
        this.camera.update(dt);

        // Rebuild spatial grid
        this.grid.clear();
        for (const e of this.entities) {
            if (e.alive) this.grid.insert(e);
        }

        // Update AI
        for (const e of this.entities) {
            if (e.isPlayer) continue;
            // Dead entities still need update for death timer countdown
            if (!e.alive) {
                e.update(dt);
                continue;
            }
            if (e.aiController) {
                e.aiController.update(dt, this.grid, this.projectiles, this.particles);
            }
            e.update(dt);

            // Biome hazards for AI
            this.checkHazards(e, dt);
        }

        // Check hazards for player
        this.checkHazards(this.player, dt);

        // Update projectiles
        for (const p of this.projectiles) {
            p.update(dt);
            p.checkHit(this.entities, this.particles);
        }
        this.projectiles = this.projectiles.filter(p => p.alive);

        // Update particles
        for (const p of this.particles) p.update(dt);
        this.particles = this.particles.filter(p => p.alive);

        // Detect new player kills this frame
        if (this.player.kills > prevKills) {
            const newKills = this.player.kills - prevKills;
            for (let i = 0; i < newKills; i++) {
                this.music.playSfx('kill');
                this.screenFlashes.push(new ScreenFlash('#FFFFFF', 0.15));
                const streak = this.progression.registerKill();
                if (streak) {
                    this.camera.shake(streak.shake, 0.3);
                    this.music.playSfx('streak');
                }
            }
        }

        // Pickup collection (player only) with magnet effect
        for (const pickup of this.pickups) {
            if (pickup.collected) continue;
            pickup.update(dt);

            const dist = distance(this.player.x, this.player.y, pickup.x, pickup.y);

            // Magnet: pull sticks toward player when nearby
            if (dist < STICK_MAGNET_RANGE && dist > STICK_COLLECT_RADIUS) {
                const angle = angleBetween(pickup.x, pickup.y, this.player.x, this.player.y);
                pickup.x += Math.cos(angle) * STICK_MAGNET_SPEED * dt;
                pickup.y += Math.sin(angle) * STICK_MAGNET_SPEED * dt;
            }

            if (dist < STICK_COLLECT_RADIUS) {
                pickup.collected = true;
                this.player.sticks += pickup.amount;
                this.matchSticksCollected += pickup.amount;
            }
        }

        // AI collect sticks
        for (const e of this.entities) {
            if (!e.alive || e.isPlayer) continue;
            for (const pickup of this.pickups) {
                if (pickup.collected) continue;
                if (distance(e.x, e.y, pickup.x, pickup.y) < 20) {
                    pickup.collected = true;
                    e.sticks += pickup.amount;
                }
            }
        }

        // Food collection (player only - heals on pickup)
        for (const f of this.food) {
            if (f.collected) continue;
            f.update(dt);
            if (distance(this.player.x, this.player.y, f.x, f.y) < FOOD_COLLECT_RADIUS) {
                f.collected = true;
                const oldHealth = this.player.health;
                this.player.health = Math.min(this.player.maxHealth, this.player.health + f.heal);
                const healed = Math.round(this.player.health - oldHealth);
                if (healed > 0) {
                    this.hud.notify('+' + healed + ' HP (' + f.name + ')', '#44FF44', 1.5);
                    this.music.playSfx('pickup');
                    // Green heal particles
                    for (let i = 0; i < 6; i++) {
                        this.particles.push({
                            x: this.player.x, y: this.player.y - 10,
                            vx: randomRange(-40, 40), vy: randomRange(-60, -20),
                            life: 0.6, maxLife: 0.6, size: 3,
                            color: '#44FF44', alive: true,
                            update(dt) {
                                this.x += this.vx * dt;
                                this.y += this.vy * dt;
                                this.life -= dt;
                                if (this.life <= 0) this.alive = false;
                            },
                            draw(ctx, camera) {
                                if (!camera.isVisible(this.x, this.y)) return;
                                const p = camera.worldToScreen(this.x, this.y);
                                ctx.globalAlpha = this.life / this.maxLife;
                                ctx.fillStyle = this.color;
                                ctx.fillRect(p.x - 1, p.y - 1, this.size, this.size);
                                ctx.globalAlpha = 1;
                            }
                        });
                    }
                } else {
                    this.hud.notify(f.name + ' (full HP)', '#AAFFAA', 1);
                }
            }
        }

        // Food respawn
        this.foodRespawnTimer -= dt;
        if (this.foodRespawnTimer <= 0) {
            this.foodRespawnTimer = FOOD_RESPAWN_TIME;
            for (let i = 0; i < 8; i++) {
                this.food.push(new FoodPickup(
                    randomRange(50, WORLD_WIDTH - 50),
                    randomRange(50, WORLD_HEIGHT - 50)
                ));
            }
        }

        // Stick respawn
        this.stickRespawnTimer -= dt;
        if (this.stickRespawnTimer <= 0) {
            this.stickRespawnTimer = STICK_RESPAWN_TIME;
            for (let i = 0; i < 20; i++) {
                this.pickups.push(new StickPickup(
                    randomRange(30, WORLD_WIDTH - 30),
                    randomRange(30, WORLD_HEIGHT - 30),
                    randomInt(1, 3)
                ));
            }
        }

        // Drop sticks from dead entities
        for (const e of this.entities) {
            if (!e.alive && e.deathTimer > 0 && e.deathTimer - dt <= 0 && e.sticks > 0) {
                const drops = spawnSticksAt(e.x, e.y, e.getDropSticks());
                this.pickups.push(...drops);
                e.sticks = 0;
            }
        }

        // Respawn dead AI to keep the battle active
        // Disabled once the storm is active so numbers can dwindle to a fair fight
        const minBlue = 15, minRed = 15;
        if (!this.storm.active && (this.blueAlive < minBlue || this.redAlive < minRed)) {
            for (const e of this.entities) {
                if (e.alive || e.isPlayer || e.deathTimer > 0) continue;
                // Check if this team needs reinforcements
                if ((e.team === TEAMS.BLUE && this.blueAlive < minBlue) ||
                    (e.team === TEAMS.RED && this.redAlive < minRed)) {
                    // Respawn at a random location
                    const pos = this.randomSpawnPos(e.team === TEAMS.RED);
                    e.x = pos.x;
                    e.y = pos.y;
                    e.health = e.maxHealth;
                    e.alive = true;
                    e.deathTimer = 0;
                    e.burnTimer = 0;
                    if (e.team === TEAMS.BLUE) this.blueAlive++;
                    else this.redAlive++;
                    break; // Only respawn one per frame to spread out reinforcements
                }
            }
        }

        // Storm system
        this.updateStorm(dt);

        // Interaction prompts
        this.player.interactPrompt = '';
        this.player.interactTarget = null;

        // Check crate proximity
        for (const crate of this.crates) {
            if (crate.opened) continue;
            if (distance(this.player.x, this.player.y, crate.x, crate.y) < 50) {
                if (crate.canOpen(this.player)) {
                    this.player.interactPrompt = `Press E to open ${crate.tier.name} Crate (${crate.tier.cost} sticks)`;
                } else {
                    this.player.interactPrompt = `${crate.tier.name} Crate - Need ${crate.tier.cost} sticks (you have ${this.player.sticks})`;
                }
                this.player.interactTarget = crate;
                break;
            }
        }

        // Check cave entrance
        if (!this.bossDefeated && distance(this.player.x, this.player.y, CAVE_ENTRANCE.x, CAVE_ENTRANCE.y) < CAVE_ENTRANCE.radius) {
            this.player.interactPrompt = 'Press E to enter the Cave (Boss: Luca the Spider)';
            this.player.interactTarget = 'cave';
        }

        // Check haunted house entrance
        if (!this.ghostDefeated && distance(this.player.x, this.player.y, HAUNTED_HOUSE_ENTRANCE.x, HAUNTED_HOUSE_ENTRANCE.y) < HAUNTED_HOUSE_ENTRANCE.radius) {
            this.player.interactPrompt = 'Press E to enter the Haunted House (Boss: James the Ghost)';
            this.player.interactTarget = 'haunted';
        }

        // Check sand castle entrance
        if (!this.crabDefeated && distance(this.player.x, this.player.y, SAND_CASTLE_ENTRANCE.x, SAND_CASTLE_ENTRANCE.y) < SAND_CASTLE_ENTRANCE.radius) {
            this.player.interactPrompt = 'Press E to enter the Sand Castle (Boss: Charlie the Crab)';
            this.player.interactTarget = 'sandcastle';
        }

        // Check ice castle entrance
        if (!this.polarDefeated && distance(this.player.x, this.player.y, ICE_CASTLE_ENTRANCE.x, ICE_CASTLE_ENTRANCE.y) < ICE_CASTLE_ENTRANCE.radius) {
            this.player.interactPrompt = 'Press E to enter the Ice Castle (Boss: Tommy the Polar Bear)';
            this.player.interactTarget = 'icecastle';
        }

        // Check volcano lair entrance
        if (!this.lavaDefeated && distance(this.player.x, this.player.y, VOLCANO_LAIR_ENTRANCE.x, VOLCANO_LAIR_ENTRANCE.y) < VOLCANO_LAIR_ENTRANCE.radius) {
            this.player.interactPrompt = 'Press E to enter the Volcano (Boss: Paddy the Lava Monster)';
            this.player.interactTarget = 'volcano';
        }

        // Handle E key interaction
        if (this.input.isKeyDown('e') && this.player.interactTarget) {
            if (this.player.interactTarget === 'cave') {
                this.enterCave();
            } else if (this.player.interactTarget === 'haunted') {
                this.enterHauntedHouse();
            } else if (this.player.interactTarget === 'sandcastle') {
                this.enterSandCastle();
            } else if (this.player.interactTarget === 'icecastle') {
                this.enterIceCastle();
            } else if (this.player.interactTarget === 'volcano') {
                this.enterVolcanoLair();
            } else if (this.player.interactTarget instanceof Crate) {
                const loot = this.player.interactTarget.open(this.player);
                if (loot) {
                    this.hud.notify(`Got ${loot.name}! (Scroll or 1-${this.player.inventory.length} to switch)`, loot.color || '#FFD700', 3);
                }
            }
            this.input.keys['e'] = false; // consume
        }

        // Count alive
        this.blueAlive = this.entities.filter(e => e.team === TEAMS.BLUE && e.alive).length;
        this.redAlive = this.entities.filter(e => e.team === TEAMS.RED && e.alive).length;

        // Win/lose check (require at least 30s of gameplay before win can trigger)
        if (this.redAlive === 0 && this.gameTime > 30) {
            this.state = 'WIN';
            this.music.stop();
            this.music.playSfx('victory');
        }
        if (!this.player.alive) {
            this.state = 'LOSE';
            this.music.stop();
            this.music.playSfx('player_death');
        }
    }

    checkHazards(entity, dt) {
        if (!entity.alive) return;

        // Lava damage
        const lavaZones = this.biomes.getLavaZones();
        for (const lava of lavaZones) {
            if (distance(entity.x, entity.y, lava.x, lava.y) < lava.radius) {
                entity.takeDamage(5 * dt, null);
            }
        }

        // Water boundary (push back)
        const water = this.biomes.getWaterZone();
        if (water && pointInRect(entity.x, entity.y, water.x, water.y, water.w, water.h)) {
            entity.y = water.y - 5;
        }
    }

    updateStorm(dt) {
        const s = this.storm;

        // Check if it's time for the storm to start or shrink
        if (this.gameTime >= s.nextShrinkTime && s.phase <= STORM_CONFIG.shrinkPhases) {
            if (!s.active) {
                // Storm just appeared — radius must be smaller than world diagonal
                // so edges of the map are immediately dangerous
                s.active = true;
                s.radius = 2200;
                this.hud.notify('The storm is closing in!', '#AA44FF', 3);
            }

            if (!s.shrinking) {
                s.phase++;
                if (s.phase > STORM_CONFIG.shrinkPhases) return; // at min size, done shrinking

                // Calculate target radius for this phase
                const startR = 2200;
                const frac = 1 - (s.phase / STORM_CONFIG.shrinkPhases);
                s.targetRadius = Math.max(STORM_CONFIG.minRadius, startR * frac);
                s.shrinking = true;
                s.nextShrinkTime = this.gameTime + STORM_CONFIG.shrinkInterval;

                if (s.phase > 1) {
                    this.hud.notify('The storm is shrinking!', '#AA44FF', 2.5);
                }
            }
        }

        // Smoothly shrink radius toward target
        if (s.shrinking) {
            const shrinkSpeed = (s.radius - s.targetRadius) / STORM_CONFIG.shrinkDuration;
            s.radius -= Math.max(shrinkSpeed, 1) * dt;
            if (s.radius <= s.targetRadius) {
                s.radius = s.targetRadius;
                s.shrinking = false;
            }
        }

        // Deal damage to entities outside the storm circle
        if (s.active) {
            for (const e of this.entities) {
                if (!e.alive) continue;
                const dist = distance(e.x, e.y, s.centerX, s.centerY);
                if (dist > s.radius) {
                    e.takeDamage(STORM_CONFIG.damage * dt, null);
                }
            }
        }
    }

    renderStorm(ctx) {
        const s = this.storm;

        // Always draw the storm HUD (countdown, phase info)
        this.renderStormHUD(ctx, s);

        if (!s.active) return;

        // Draw storm as a purple/dark overlay OUTSIDE the safe circle
        // We use a clipping approach: fill screen, then cut out the safe zone
        ctx.save();

        // Convert storm center to screen space
        const center = this.camera.worldToScreen(s.centerX, s.centerY);

        // The safe radius in screen pixels (iso projection makes it roughly 1:1 in screen)
        // Since iso squishes Y by 0.5, draw as ellipse
        const screenR = s.radius;

        // Draw full-screen storm overlay with circle cut-out
        ctx.fillStyle = 'rgba(80, 30, 120, 0.35)';

        // Use composite operation to create the mask
        ctx.beginPath();
        ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        // Cut out the safe zone (ellipse for iso view)
        ctx.moveTo(center.x + screenR, center.y);
        ctx.ellipse(center.x, center.y, screenR, screenR * 0.5, 0, 0, Math.PI * 2, true); // counter-clockwise to cut
        ctx.fill('evenodd');

        // Storm edge glow (pulsing)
        const pulse = 0.4 + Math.sin(this.gameTime * 3) * 0.15;
        ctx.strokeStyle = `rgba(160, 80, 220, ${pulse})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, screenR, screenR * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Inner edge (brighter)
        ctx.strokeStyle = `rgba(200, 120, 255, ${pulse * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, screenR - 3, screenR * 0.5 - 1.5, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Lightning-like particles at the edge
        ctx.strokeStyle = `rgba(220, 180, 255, ${pulse * 0.5})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 + this.gameTime * 0.5;
            const ex = center.x + Math.cos(a) * screenR;
            const ey = center.y + Math.sin(a) * screenR * 0.5;
            const jitter = Math.sin(this.gameTime * 10 + i * 3) * 8;
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + jitter, ey + jitter * 0.5);
            ctx.stroke();
        }

        ctx.restore();

        // Player-in-storm damage indicator (red vignette)
        if (this.player && this.player.alive) {
            const playerDist = distance(this.player.x, this.player.y, s.centerX, s.centerY);
            if (playerDist > s.radius) {
                const intensity = Math.min(0.4, (playerDist - s.radius) / 500 * 0.3 + 0.1);
                const pulse = intensity + Math.sin(this.gameTime * 4) * 0.05;
                // Red vignette edges
                const gradient = ctx.createRadialGradient(
                    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.3,
                    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.8
                );
                gradient.addColorStop(0, 'rgba(150, 0, 0, 0)');
                gradient.addColorStop(1, `rgba(150, 0, 0, ${pulse})`);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

                // Warning text
                ctx.fillStyle = '#FF4444';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('GET TO THE SAFE ZONE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 110);
            }
        }

        // Storm HUD timer
        this.renderStormHUD(ctx, s);
    }

    renderStormHUD(ctx, s) {
        ctx.textAlign = 'center';

        // Pre-storm countdown
        if (!s.active) {
            const timeUntilStorm = Math.max(0, Math.ceil(STORM_CONFIG.startDelay - this.gameTime));
            if (timeUntilStorm <= 30) {
                // Urgent: last 30 seconds before storm
                const urgency = timeUntilStorm <= 10 ? 1.0 : 0.6;
                ctx.fillStyle = `rgba(160, 80, 220, ${urgency})`;
                ctx.font = timeUntilStorm <= 10 ? 'bold 16px Arial' : '13px Arial';
                const mins = Math.floor(timeUntilStorm / 60);
                const secs = timeUntilStorm % 60;
                const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
                ctx.fillText(`Storm in ${timeStr}`, CANVAS_WIDTH / 2, 60);
            } else if (this.gameTime > 5) {
                // Passive countdown after first 5 seconds
                const timeUntil = Math.ceil(STORM_CONFIG.startDelay - this.gameTime);
                const mins = Math.floor(timeUntil / 60);
                const secs = timeUntil % 60;
                ctx.fillStyle = 'rgba(160, 80, 220, 0.35)';
                ctx.font = '11px Arial';
                ctx.fillText(`Storm in ${mins}:${secs.toString().padStart(2, '0')}`, CANVAS_WIDTH / 2, 60);
            }
            return;
        }

        // Storm is active
        if (s.shrinking) {
            ctx.fillStyle = 'rgba(160, 80, 220, 0.8)';
            ctx.font = 'bold 15px Arial';
            ctx.fillText('STORM CLOSING', CANVAS_WIDTH / 2, 60);
            ctx.fillStyle = 'rgba(160, 80, 220, 0.5)';
            ctx.font = '11px Arial';
            ctx.fillText(`Phase ${s.phase} / ${STORM_CONFIG.shrinkPhases}`, CANVAS_WIDTH / 2, 76);
        } else if (s.phase <= STORM_CONFIG.shrinkPhases) {
            const timeLeft = Math.max(0, Math.ceil(s.nextShrinkTime - this.gameTime));
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
            const urgent = timeLeft <= 15;
            ctx.fillStyle = urgent ? 'rgba(160, 80, 220, 0.7)' : 'rgba(160, 80, 220, 0.4)';
            ctx.font = urgent ? 'bold 14px Arial' : '12px Arial';
            ctx.fillText(`Storm Phase ${s.phase}/${STORM_CONFIG.shrinkPhases} — shrinks in ${timeStr}`, CANVAS_WIDTH / 2, 60);
        } else {
            // Final phase, no more shrinking
            ctx.fillStyle = 'rgba(160, 80, 220, 0.4)';
            ctx.font = '11px Arial';
            ctx.fillText('Final Storm — fight!', CANVAS_WIDTH / 2, 60);
        }
    }

    renderPlaying() {
        const ctx = this.ctx;

        // Ocean water background (instead of black void)
        ctx.fillStyle = '#1a5f8a';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Animated wave pattern
        const t = this.gameTime || 0;
        ctx.strokeStyle = 'rgba(100, 180, 220, 0.25)';
        ctx.lineWidth = 1.5;
        for (let row = -1; row < CANVAS_HEIGHT / 30 + 2; row++) {
            ctx.beginPath();
            for (let col = 0; col <= CANVAS_WIDTH; col += 6) {
                const wy = row * 30 + Math.sin(col * 0.015 + t * 1.5 + row) * 8 + Math.sin(col * 0.008 + t * 0.7) * 4;
                if (col === 0) ctx.moveTo(col, wy);
                else ctx.lineTo(col, wy);
            }
            ctx.stroke();
        }

        // Subtle foam/highlights
        ctx.fillStyle = 'rgba(150, 210, 240, 0.08)';
        for (let i = 0; i < 12; i++) {
            const fx = ((i * 137 + t * 8) % (CANVAS_WIDTH + 200)) - 100;
            const fy = ((i * 89 + t * 3) % (CANVAS_HEIGHT + 100)) - 50;
            ctx.beginPath();
            ctx.ellipse(fx, fy, 30 + Math.sin(t + i) * 10, 6, 0.3 + i * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }

        // Biome backgrounds
        this.biomes.drawBackgrounds(ctx, this.camera);

        // Biome props
        this.biomes.drawProps(ctx, this.camera, this.gameTime);

        // Pickups
        for (const p of this.pickups) {
            if (!p.collected) p.draw(ctx, this.camera);
        }

        // Food
        for (const f of this.food) {
            if (!f.collected) f.draw(ctx, this.camera);
        }

        // Crates
        for (const c of this.crates) c.draw(ctx, this.camera);

        // Draw player trail (behind entities)
        if (this.player && this.player.alive) {
            this.progression.drawTrail(ctx, this.player, this.camera);
        }

        // Sort entities by Y for depth
        const sorted = [...this.entities].sort((a, b) => (a.x + a.y) - (b.x + b.y));
        for (const e of sorted) e.draw(ctx, this.camera);

        // Projectiles
        for (const p of this.projectiles) p.draw(ctx, this.camera);

        // Particles
        for (const p of this.particles) p.draw(ctx, this.camera);

        // Environmental particles (snow, embers, leaves)
        this.biomes.drawEnvParticles(ctx, this.camera);

        // Storm overlay
        this.renderStorm(ctx);

        // HUD
        this.hud.draw(ctx, this.player, this.blueAlive, this.redAlive, this.player.interactPrompt, this.input);

        // Minimap
        this.minimap.draw(ctx, this.entities, this.player, this.camera, this.storm);

        // XP bar in HUD
        this.progression.drawXPBar(ctx);

        // Screen flashes
        for (const f of this.screenFlashes) f.draw(ctx);

        // Kill streak announcement
        this.progression.drawStreakAnnouncement(ctx);

        // Level up effect
        this.progression.drawLevelUpEffect(ctx);
    }

    // ==================== BOSS FIGHT ====================

    enterCave() {
        this.inCave = true;
        this.state = 'BOSS_FIGHT';
        this.music.play('boss');
        // Reset boss
        this.boss = new Boss(CAVE_WIDTH / 2, 200);
        this.boss.activate();
        // Move player into cave
        this.player.x = CAVE_WIDTH / 2;
        this.player.y = CAVE_HEIGHT - 80;
        this.bossProjectiles = [];
        this.bossParticles = [];
        // Create cave camera with iso projection centered on cave
        this._caveCamera = this._makeCaveCamera();
    }

    updateBossFight(dt) {
        this.hud.update(dt);

        // Cave camera is fixed with iso projection
        this._caveCamera = this._makeCaveCamera();

        // Player movement clamped to cave
        const input = this.input;
        // Movement - mapped to isometric axes
        let mx = 0, my = 0;
        if (input.isKeyDown('w') || input.isKeyDown('arrowup'))    { mx -= 1; my -= 1; }
        if (input.isKeyDown('s') || input.isKeyDown('arrowdown'))  { mx += 1; my += 1; }
        if (input.isKeyDown('a') || input.isKeyDown('arrowleft'))  { mx -= 1; my += 1; }
        if (input.isKeyDown('d') || input.isKeyDown('arrowright')) { mx += 1; my -= 1; }
        const caveLen = Math.sqrt(mx * mx + my * my);
        if (caveLen > 0) { mx /= caveLen; my /= caveLen; }

        this.player.vx = mx * this.player.speed;
        this.player.vy = my * this.player.speed;
        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;
        this.player.x = clamp(this.player.x, 30, CAVE_WIDTH - 30);
        this.player.y = clamp(this.player.y, 30, CAVE_HEIGHT - 30);

        if (Math.abs(mx) > 0 || Math.abs(my) > 0) this.player.walkTimer += dt;

        // Mouse aim in cave coords - use cave camera inverse iso
        const caveWorld = this._caveCamera.screenToWorld(input.mouseX, input.mouseY);
        this.player.facing = angleBetween(this.player.x, this.player.y, caveWorld.x, caveWorld.y);

        // Player attack
        const bossAndMinions = [this.boss, ...this.boss.minions].filter(e => e && e.alive);
        if (this.player.weapon && (input.mouseDown || input.isKeyDown(' '))) {
            this.player.weapon.attack(this.player, bossAndMinions, this.bossProjectiles, this.bossParticles);
        }
        this.player.weapon.update(dt);
        if (this.player.attackAnim > 0) this.player.attackAnim -= dt * 4;

        // Boss update
        this.boss.update(dt, this.player, this.bossProjectiles, this.bossParticles);

        // Boss projectiles target player
        for (const p of this.bossProjectiles) {
            p.update(dt);
            // Check hit on player
            if (p.team === TEAMS.NEUTRAL && this.player.alive) {
                if (circleCollision(p.x, p.y, p.radius, this.player.x, this.player.y, this.player.radius)) {
                    this.player.takeDamage(p.damage, this.boss);
                    spawnHitParticles(this.bossParticles, this.player.x, this.player.y, '#FF4444', 5);
                    this.bossParticles.push(new DamageNumber(this.player.x, this.player.y - 10, p.damage, '#FF0000'));
                    p.alive = false;
                }
            }
            // Player projectiles hit boss
            if (p.team === TEAMS.BLUE && this.boss.alive) {
                if (circleCollision(p.x, p.y, p.radius, this.boss.x, this.boss.y, this.boss.radius)) {
                    this.boss.takeDamage(p.damage, this.player);
                    spawnHitParticles(this.bossParticles, this.boss.x, this.boss.y, '#AA44AA', 5);
                    this.bossParticles.push(new DamageNumber(this.boss.x, this.boss.y - 10, p.damage, '#FF4444'));
                    p.alive = false;
                }
            }
        }
        this.bossProjectiles = this.bossProjectiles.filter(p => p.alive);

        // Particles
        for (const p of this.bossParticles) p.update(dt);
        this.bossParticles = this.bossParticles.filter(p => p.alive);

        // Escape key to flee the cave
        if (this.input.isKeyDown('escape')) {
            this.input.keys['escape'] = false;
            this.exitCave();
            this.hud.notify('Fled the cave!', '#FFAA00', 2);
            return;
        }

        // Boss defeated
        if (!this.boss.alive) {
            this.bossDefeated = true;
            if (this.boss.deathTimer <= 0) {
                this.exitCave();
                this.hud.notify('Luca the Spider defeated! +50 sticks! +100 XP!', '#FFD700', 3);
                this.player.sticks += 50;
                this.player.addXP(XP_PER_BOSS);
            }
        }

        // Player died
        if (!this.player.alive) {
            this.state = 'LOSE';
            this.music.stop();
            this.music.playSfx('player_death');
        }
    }

    exitCave() {
        this.inCave = false;
        this.state = 'PLAYING';
        this.music.play('battle');
        // Place player outside cave
        this.player.x = CAVE_ENTRANCE.x;
        this.player.y = CAVE_ENTRANCE.y + 60;
    }

    // ==================== GHOST FIGHT ====================

    enterHauntedHouse() {
        this.inCave = true; // reuse cave flag for "inside boss room"
        this.state = 'GHOST_FIGHT';
        this.music.play('boss');
        this.ghostBoss = new GhostBoss(HAUNTED_WIDTH / 2, 180);
        this.ghostBoss.activate();
        this.player.x = HAUNTED_WIDTH / 2;
        this.player.y = HAUNTED_HEIGHT - 80;
        this.ghostProjectiles = [];
        this.ghostParticles = [];
        this._ghostCamera = this._makeRoomCamera(HAUNTED_WIDTH, HAUNTED_HEIGHT);
    }

    exitHauntedHouse() {
        this.inCave = false;
        this.state = 'PLAYING';
        this.music.play('battle');
        this.player.x = HAUNTED_HOUSE_ENTRANCE.x;
        this.player.y = HAUNTED_HOUSE_ENTRANCE.y + 60;
    }

    updateGhostFight(dt) {
        const cam = this._ghostCamera || this._makeRoomCamera(HAUNTED_WIDTH, HAUNTED_HEIGHT);
        this._ghostCamera = cam;

        // Player movement (same iso mapping as boss fight)
        let mx = 0, my = 0;
        if (this.input.isKeyDown('w') || this.input.isKeyDown('arrowup'))    { mx -= 1; my -= 1; }
        if (this.input.isKeyDown('s') || this.input.isKeyDown('arrowdown'))  { mx += 1; my += 1; }
        if (this.input.isKeyDown('a') || this.input.isKeyDown('arrowleft'))  { mx -= 1; my += 1; }
        if (this.input.isKeyDown('d') || this.input.isKeyDown('arrowright')) { mx += 1; my -= 1; }
        const mLen = Math.sqrt(mx * mx + my * my);
        if (mLen > 0) { mx /= mLen; my /= mLen; }
        this.player.vx = mx * this.player.speed;
        this.player.vy = my * this.player.speed;
        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;
        this.player.x = clamp(this.player.x, 30, HAUNTED_WIDTH - 30);
        this.player.y = clamp(this.player.y, 30, HAUNTED_HEIGHT - 30);

        // Track movement direction
        if (Math.abs(this.player.vx) > 1 || Math.abs(this.player.vy) > 1) {
            this.player.moveFacing = Math.atan2(this.player.vy, this.player.vx);
            this.player.walkTimer += dt;
        }

        // Mouse aiming
        const worldMouse = cam.screenToWorld(this.input.mouseX, this.input.mouseY);
        this.player.facing = angleBetween(this.player.x, this.player.y, worldMouse.x, worldMouse.y);

        // Weapon switching
        for (let i = 1; i <= 9; i++) {
            if (this.input.isKeyDown(i.toString())) {
                this.player.switchToSlot(i - 1);
                this.input.keys[i.toString()] = false;
            }
        }
        const scroll = this.input.consumeScroll();
        if (scroll !== 0) this.player.cycleWeapon(scroll > 0 ? 1 : -1);

        // Weapon switch feedback
        if (this.player.weaponSwitched) {
            this.player.weaponSwitched = false;
            this.music.playSfx('weapon_switch');
            if (this.player.weapon) {
                this.hud.notify(`Switched to ${this.player.weapon.name}`, this.player.weapon.color, 1.2);
            }
        }

        // Player attack (against ghost boss)
        const ghostEntities = [this.ghostBoss];
        if (this.player.weapon && (this.input.mouseDown || this.input.isKeyDown(' '))) {
            this.player.weapon.attack(this.player, ghostEntities, this.ghostProjectiles, this.ghostParticles);
        }
        // Update weapons
        for (const wpn of this.player.inventory) { wpn.update(dt); }
        if (this.player.attackAnim > 0) { this.player.attackAnim -= dt * 4; if (this.player.attackAnim < 0) this.player.attackAnim = 0; }

        // Update ghost boss
        this.ghostBoss.update(dt, this.player, this.ghostProjectiles, this.ghostParticles);

        // Update projectiles
        for (const proj of this.ghostProjectiles) {
            proj.update(dt);
            // Boss projectiles hit player
            if (proj.team === TEAMS.NEUTRAL && this.player.alive) {
                if (circleCollision(proj.x, proj.y, proj.radius, this.player.x, this.player.y, this.player.radius)) {
                    this.player.takeDamage(proj.damage, this.ghostBoss);
                    spawnHitParticles(this.ghostParticles, this.player.x, this.player.y, '#88CCFF', 5);
                    this.ghostParticles.push(new DamageNumber(this.player.x, this.player.y - 10, proj.damage, '#88CCFF'));
                    proj.alive = false;
                }
            }
            // Player projectiles hit boss
            if (proj.team === TEAMS.BLUE && this.ghostBoss.alive) {
                if (circleCollision(proj.x, proj.y, proj.radius, this.ghostBoss.x, this.ghostBoss.y, this.ghostBoss.radius)) {
                    this.ghostBoss.takeDamage(proj.damage, this.player);
                    spawnHitParticles(this.ghostParticles, this.ghostBoss.x, this.ghostBoss.y, '#88CCFF', 5);
                    this.ghostParticles.push(new DamageNumber(this.ghostBoss.x, this.ghostBoss.y - 10, proj.damage, '#FFAA44'));
                    proj.alive = false;
                }
            }
        }
        this.ghostProjectiles = this.ghostProjectiles.filter(p => p.alive);

        // Update particles
        for (const p of this.ghostParticles) { p.update(dt); }
        this.ghostParticles = this.ghostParticles.filter(p => p.alive || (p.life !== undefined && p.life > 0));

        // HUD update
        this.hud.update(dt);

        // ESC to flee
        if (this.input.isKeyDown('escape')) {
            this.exitHauntedHouse();
            this.hud.notify('Fled the Haunted House!', '#88FF88', 2);
            this.input.keys['escape'] = false;
            return;
        }

        // Ghost defeated
        if (!this.ghostBoss.alive) {
            this.ghostDefeated = true;
            if (this.ghostBoss.deathTimer <= 0) {
                this.exitHauntedHouse();
                this.hud.notify('James the Ghost defeated! +50 sticks! +100 XP!', '#88CCFF', 3);
                this.player.sticks += 50;
                this.player.addXP(XP_PER_BOSS);
            }
        }

        // Player died
        if (!this.player.alive) {
            this.state = 'LOSE';
            this.music.stop();
            this.music.playSfx('player_death');
        }
    }

    renderGhostFight() {
        const ctx = this.ctx;
        const cam = this._ghostCamera || this._makeRoomCamera(HAUNTED_WIDTH, HAUNTED_HEIGHT);

        // Dark background
        ctx.fillStyle = '#0a0808';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Room floor (dark wooden boards)
        const roomCorners = [
            cam.worldToScreen(0, 0),
            cam.worldToScreen(HAUNTED_WIDTH, 0),
            cam.worldToScreen(HAUNTED_WIDTH, HAUNTED_HEIGHT),
            cam.worldToScreen(0, HAUNTED_HEIGHT)
        ];
        ctx.fillStyle = '#2a1a10';
        ctx.beginPath();
        ctx.moveTo(roomCorners[0].x, roomCorners[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(roomCorners[i].x, roomCorners[i].y);
        ctx.closePath();
        ctx.fill();

        // Floorboard lines
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 8; i++) {
            const frac = i / 8;
            const left = cam.worldToScreen(HAUNTED_WIDTH * frac, 0);
            const right = cam.worldToScreen(HAUNTED_WIDTH * frac, HAUNTED_HEIGHT);
            ctx.beginPath();
            ctx.moveTo(left.x, left.y);
            ctx.lineTo(right.x, right.y);
            ctx.stroke();
        }

        // Walls
        ctx.fillStyle = '#1a1018';
        // Back wall (top-left to top-right)
        const tl = cam.worldToScreen(0, 0);
        const tr = cam.worldToScreen(HAUNTED_WIDTH, 0);
        ctx.fillRect(Math.min(tl.x, tr.x), Math.min(tl.y, tr.y) - 60,
            Math.abs(tr.x - tl.x), 60);

        // Candelabras
        const candelPositions = [
            cam.worldToScreen(100, 50),
            cam.worldToScreen(HAUNTED_WIDTH - 100, 50),
            cam.worldToScreen(100, HAUNTED_HEIGHT - 50),
            cam.worldToScreen(HAUNTED_WIDTH - 100, HAUNTED_HEIGHT - 50)
        ];
        for (const cp of candelPositions) {
            // Stand
            ctx.strokeStyle = '#8B7530';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cp.x, cp.y + 8);
            ctx.lineTo(cp.x, cp.y - 8);
            ctx.stroke();
            // Flames (flickering)
            const flicker = Math.sin((Date.now() / 150) + cp.x) * 2;
            ctx.fillStyle = '#FFAA00';
            ctx.beginPath();
            ctx.arc(cp.x, cp.y - 10 + flicker, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FF6600';
            ctx.beginPath();
            ctx.arc(cp.x, cp.y - 12 + flicker, 2, 0, Math.PI * 2);
            ctx.fill();
            // Glow
            ctx.fillStyle = `rgba(255, 170, 0, ${0.08 + Math.sin(Date.now() / 200 + cp.x) * 0.03})`;
            ctx.beginPath();
            ctx.arc(cp.x, cp.y - 8, 25, 0, Math.PI * 2);
            ctx.fill();
        }

        // Cobwebs in corners
        const cobwebPositions = [
            cam.worldToScreen(30, 30),
            cam.worldToScreen(HAUNTED_WIDTH - 30, 30)
        ];
        for (const cw of cobwebPositions) {
            ctx.strokeStyle = 'rgba(200, 200, 200, 0.15)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 6; i++) {
                const a = -Math.PI / 2 + (i / 5) * Math.PI * 0.6 - 0.3;
                ctx.beginPath();
                ctx.moveTo(cw.x, cw.y);
                ctx.lineTo(cw.x + Math.cos(a) * 35, cw.y + Math.sin(a) * 35);
                ctx.stroke();
            }
        }

        // Floating dust particles
        ctx.fillStyle = 'rgba(200, 200, 180, 0.15)';
        for (let i = 0; i < 20; i++) {
            const dx = Math.sin(Date.now() / 2000 + i * 2.3) * HAUNTED_WIDTH * 0.3 + HAUNTED_WIDTH / 2;
            const dy = Math.sin(Date.now() / 1500 + i * 1.7) * HAUNTED_HEIGHT * 0.3 + HAUNTED_HEIGHT / 2;
            const dp = cam.worldToScreen(dx, dy);
            ctx.beginPath();
            ctx.arc(dp.x, dp.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw ghost boss
        if (this.ghostBoss.alive || this.ghostBoss.deathTimer > 0) {
            this.ghostBoss.draw(ctx, cam);
        }

        // Draw player
        drawStickman(ctx, this.player, cam);

        // Draw projectiles
        for (const proj of this.ghostProjectiles) {
            proj.draw(ctx, cam);
        }

        // Draw particles
        for (const p of this.ghostParticles) {
            p.draw(ctx, cam);
        }

        // Vignette
        const vigGrad = ctx.createRadialGradient(
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.3,
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.7
        );
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Greenish ambient overlay
        ctx.fillStyle = 'rgba(0, 80, 40, 0.06)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Boss name bar (top center)
        if (this.ghostBoss.alive) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(CANVAS_WIDTH / 2 - 120, 10, 240, 30);
            ctx.fillStyle = '#88CCFF';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('James the Ghost', CANVAS_WIDTH / 2, 32);
        }

        // Player health bar (bottom center)
        const phx = CANVAS_WIDTH / 2 - 100;
        const phy = CANVAS_HEIGHT - 40;
        ctx.fillStyle = '#333';
        ctx.fillRect(phx, phy, 200, 16);
        const phpct = this.player.health / this.player.maxHealth;
        ctx.fillStyle = phpct > 0.5 ? '#44CC44' : phpct > 0.25 ? '#CCCC44' : '#CC4444';
        ctx.fillRect(phx, phy, 200 * phpct, 16);
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(phx, phy, 200, 16);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`HP: ${Math.ceil(this.player.health)} / ${this.player.maxHealth}`, CANVAS_WIDTH / 2, phy + 13);

        // Inventory bar
        this.hud.drawInventoryBar(ctx, this.player, this.input);

        // Active weapon info
        if (this.player.weapon) {
            ctx.fillStyle = this.player.weapon.color;
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.player.weapon.name, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 78);
        }

        // ESC hint
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Press ESC to flee', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 55);

        // Notification
        if (this.hud.notificationTimer > 0) {
            ctx.globalAlpha = Math.min(1, this.hud.notificationTimer);
            ctx.fillStyle = this.hud.notificationColor;
            ctx.font = 'bold 18px Arial';
            ctx.fillText(this.hud.notification, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);
            ctx.globalAlpha = 1;
        }
    }

    // ==================== CRAB FIGHT ====================

    enterSandCastle() {
        this.inCave = true;
        this.state = 'CRAB_FIGHT';
        this.music.play('boss');
        this.crabBoss = new CrabBoss(SAND_CASTLE_WIDTH / 2, 180);
        this.crabBoss.activate();
        this.player.x = SAND_CASTLE_WIDTH / 2;
        this.player.y = SAND_CASTLE_HEIGHT - 80;
        this.crabProjectiles = [];
        this.crabParticles = [];
        this._crabCamera = this._makeRoomCamera(SAND_CASTLE_WIDTH, SAND_CASTLE_HEIGHT);
    }

    exitSandCastle() {
        this.inCave = false;
        this.state = 'PLAYING';
        this.music.play('battle');
        this.player.x = SAND_CASTLE_ENTRANCE.x;
        this.player.y = SAND_CASTLE_ENTRANCE.y + 60;
    }

    updateCrabFight(dt) {
        const cam = this._crabCamera || this._makeRoomCamera(SAND_CASTLE_WIDTH, SAND_CASTLE_HEIGHT);
        this._crabCamera = cam;

        // Player movement
        let mx = 0, my = 0;
        if (this.input.isKeyDown('w') || this.input.isKeyDown('arrowup'))    { mx -= 1; my -= 1; }
        if (this.input.isKeyDown('s') || this.input.isKeyDown('arrowdown'))  { mx += 1; my += 1; }
        if (this.input.isKeyDown('a') || this.input.isKeyDown('arrowleft'))  { mx -= 1; my += 1; }
        if (this.input.isKeyDown('d') || this.input.isKeyDown('arrowright')) { mx += 1; my -= 1; }
        const mLen = Math.sqrt(mx * mx + my * my);
        if (mLen > 0) { mx /= mLen; my /= mLen; }
        this.player.vx = mx * this.player.speed;
        this.player.vy = my * this.player.speed;
        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;
        this.player.x = clamp(this.player.x, 30, SAND_CASTLE_WIDTH - 30);
        this.player.y = clamp(this.player.y, 30, SAND_CASTLE_HEIGHT - 30);

        if (Math.abs(this.player.vx) > 1 || Math.abs(this.player.vy) > 1) {
            this.player.moveFacing = Math.atan2(this.player.vy, this.player.vx);
            this.player.walkTimer += dt;
        }

        const worldMouse = cam.screenToWorld(this.input.mouseX, this.input.mouseY);
        this.player.facing = angleBetween(this.player.x, this.player.y, worldMouse.x, worldMouse.y);

        // Weapon switching
        for (let i = 1; i <= 9; i++) {
            if (this.input.isKeyDown(i.toString())) { this.player.switchToSlot(i - 1); this.input.keys[i.toString()] = false; }
        }
        const scroll = this.input.consumeScroll();
        if (scroll !== 0) this.player.cycleWeapon(scroll > 0 ? 1 : -1);
        if (this.player.weaponSwitched) {
            this.player.weaponSwitched = false;
            this.music.playSfx('weapon_switch');
            if (this.player.weapon) this.hud.notify(`Switched to ${this.player.weapon.name}`, this.player.weapon.color, 1.2);
        }

        // Attack
        const crabEntities = [this.crabBoss];
        if (this.player.weapon && (this.input.mouseDown || this.input.isKeyDown(' '))) {
            this.player.weapon.attack(this.player, crabEntities, this.crabProjectiles, this.crabParticles);
        }
        for (const wpn of this.player.inventory) { wpn.update(dt); }
        if (this.player.attackAnim > 0) { this.player.attackAnim -= dt * 4; if (this.player.attackAnim < 0) this.player.attackAnim = 0; }

        // Update crab boss
        this.crabBoss.update(dt, this.player, this.crabProjectiles, this.crabParticles);

        // Projectiles
        for (const proj of this.crabProjectiles) {
            proj.update(dt);
            if (proj.team === TEAMS.NEUTRAL && this.player.alive) {
                if (circleCollision(proj.x, proj.y, proj.radius, this.player.x, this.player.y, this.player.radius)) {
                    this.player.takeDamage(proj.damage, this.crabBoss);
                    spawnHitParticles(this.crabParticles, this.player.x, this.player.y, '#88DDFF', 5);
                    this.crabParticles.push(new DamageNumber(this.player.x, this.player.y - 10, proj.damage, '#88DDFF'));
                    proj.alive = false;
                }
            }
            if (proj.team === TEAMS.BLUE && this.crabBoss.alive) {
                if (circleCollision(proj.x, proj.y, proj.radius, this.crabBoss.x, this.crabBoss.y, this.crabBoss.radius)) {
                    this.crabBoss.takeDamage(proj.damage, this.player);
                    spawnHitParticles(this.crabParticles, this.crabBoss.x, this.crabBoss.y, '#FF8844', 5);
                    this.crabParticles.push(new DamageNumber(this.crabBoss.x, this.crabBoss.y - 10, proj.damage, '#FFAA44'));
                    proj.alive = false;
                }
            }
        }
        this.crabProjectiles = this.crabProjectiles.filter(p => p.alive);

        for (const p of this.crabParticles) { p.update(dt); }
        this.crabParticles = this.crabParticles.filter(p => p.alive || (p.life !== undefined && p.life > 0));

        this.hud.update(dt);

        // ESC to flee
        if (this.input.isKeyDown('escape')) {
            this.exitSandCastle();
            this.hud.notify('Fled the Sand Castle!', '#FFD700', 2);
            this.input.keys['escape'] = false;
            return;
        }

        // Crab defeated
        if (!this.crabBoss.alive) {
            this.crabDefeated = true;
            if (this.crabBoss.deathTimer <= 0) {
                this.exitSandCastle();
                this.hud.notify('Charlie the Crab defeated! +50 sticks! +100 XP!', '#FF8844', 3);
                this.player.sticks += 50;
                this.player.addXP(XP_PER_BOSS);
            }
        }

        if (!this.player.alive) {
            this.state = 'LOSE';
            this.music.stop();
            this.music.playSfx('player_death');
        }
    }

    renderCrabFight() {
        const ctx = this.ctx;
        const cam = this._crabCamera || this._makeRoomCamera(SAND_CASTLE_WIDTH, SAND_CASTLE_HEIGHT);

        // Background
        ctx.fillStyle = '#1a1408';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Sand floor
        const roomCorners = [
            cam.worldToScreen(0, 0),
            cam.worldToScreen(SAND_CASTLE_WIDTH, 0),
            cam.worldToScreen(SAND_CASTLE_WIDTH, SAND_CASTLE_HEIGHT),
            cam.worldToScreen(0, SAND_CASTLE_HEIGHT)
        ];
        ctx.fillStyle = '#C4A454';
        ctx.beginPath();
        ctx.moveTo(roomCorners[0].x, roomCorners[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(roomCorners[i].x, roomCorners[i].y);
        ctx.closePath();
        ctx.fill();

        // Sand texture (scattered dots)
        ctx.fillStyle = 'rgba(180, 150, 80, 0.3)';
        for (let i = 0; i < 40; i++) {
            const sx = Math.sin(i * 3.7) * SAND_CASTLE_WIDTH * 0.4 + SAND_CASTLE_WIDTH / 2;
            const sy = Math.cos(i * 2.3) * SAND_CASTLE_HEIGHT * 0.4 + SAND_CASTLE_HEIGHT / 2;
            const sp = cam.worldToScreen(sx, sy);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, randomRange(1, 3), 0, Math.PI * 2);
            ctx.fill();
        }

        // Sandy walls (top edges)
        ctx.fillStyle = '#B89844';
        const tl = cam.worldToScreen(0, 0);
        const tr = cam.worldToScreen(SAND_CASTLE_WIDTH, 0);
        ctx.fillRect(Math.min(tl.x, tr.x), Math.min(tl.y, tr.y) - 40,
            Math.abs(tr.x - tl.x), 40);

        // Wall crenellations
        ctx.fillStyle = '#C4A454';
        for (let i = 0; i < 12; i++) {
            const cx = Math.min(tl.x, tr.x) + i * Math.abs(tr.x - tl.x) / 12;
            if (i % 2 === 0) {
                ctx.fillRect(cx, Math.min(tl.y, tr.y) - 48, Math.abs(tr.x - tl.x) / 12, 8);
            }
        }

        // Water puddles on floor
        ctx.fillStyle = 'rgba(80, 160, 220, 0.2)';
        const puddles = [[200, 150], [600, 400], [150, 450]];
        for (const [px, py] of puddles) {
            const pp = cam.worldToScreen(px, py);
            ctx.beginPath();
            ctx.ellipse(pp.x, pp.y, 20, 10, 0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Seaweed decorations
        ctx.strokeStyle = 'rgba(40, 120, 60, 0.4)';
        ctx.lineWidth = 2;
        const seaweedPositions = [
            cam.worldToScreen(50, 100),
            cam.worldToScreen(SAND_CASTLE_WIDTH - 50, 100),
            cam.worldToScreen(50, SAND_CASTLE_HEIGHT - 50)
        ];
        for (const sw of seaweedPositions) {
            for (let s = 0; s < 3; s++) {
                ctx.beginPath();
                ctx.moveTo(sw.x + s * 6, sw.y + 10);
                ctx.quadraticCurveTo(
                    sw.x + s * 6 + Math.sin(Date.now() / 500 + s) * 8,
                    sw.y - 10,
                    sw.x + s * 6 + Math.sin(Date.now() / 400 + s * 2) * 5,
                    sw.y - 20
                );
                ctx.stroke();
            }
        }

        // Draw crab boss
        if (this.crabBoss.alive || this.crabBoss.deathTimer > 0) {
            this.crabBoss.draw(ctx, cam);
        }

        // Draw player
        drawStickman(ctx, this.player, cam);

        // Projectiles & particles
        for (const proj of this.crabProjectiles) { proj.draw(ctx, cam); }
        for (const p of this.crabParticles) { p.draw(ctx, cam); }

        // Vignette
        const vigGrad = ctx.createRadialGradient(
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.3,
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.7
        );
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Warm sandy overlay
        ctx.fillStyle = 'rgba(80, 60, 20, 0.05)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Boss name bar
        if (this.crabBoss.alive) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(CANVAS_WIDTH / 2 - 120, 10, 240, 30);
            ctx.fillStyle = '#FF8844';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Charlie the Crab', CANVAS_WIDTH / 2, 32);
        }

        // Player HP
        const phx = CANVAS_WIDTH / 2 - 100;
        const phy = CANVAS_HEIGHT - 40;
        ctx.fillStyle = '#333';
        ctx.fillRect(phx, phy, 200, 16);
        const phpct = this.player.health / this.player.maxHealth;
        ctx.fillStyle = phpct > 0.5 ? '#44CC44' : phpct > 0.25 ? '#CCCC44' : '#CC4444';
        ctx.fillRect(phx, phy, 200 * phpct, 16);
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(phx, phy, 200, 16);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`HP: ${Math.ceil(this.player.health)} / ${this.player.maxHealth}`, CANVAS_WIDTH / 2, phy + 13);

        // Inventory
        this.hud.drawInventoryBar(ctx, this.player, this.input);
        if (this.player.weapon) {
            ctx.fillStyle = this.player.weapon.color;
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.player.weapon.name, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 78);
        }

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Press ESC to flee', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 55);

        if (this.hud.notificationTimer > 0) {
            ctx.globalAlpha = Math.min(1, this.hud.notificationTimer);
            ctx.fillStyle = this.hud.notificationColor;
            ctx.font = 'bold 18px Arial';
            ctx.fillText(this.hud.notification, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);
            ctx.globalAlpha = 1;
        }
    }

    // ==================== POLAR BEAR FIGHT ====================

    enterIceCastle() {
        this.inCave = true;
        this.state = 'POLAR_FIGHT';
        this.music.play('boss');
        this.polarBoss = new PolarBoss(ICE_CASTLE_WIDTH / 2, 180);
        this.polarBoss.activate();
        this.player.x = ICE_CASTLE_WIDTH / 2;
        this.player.y = ICE_CASTLE_HEIGHT - 80;
        this.polarProjectiles = [];
        this.polarParticles = [];
        this._polarCamera = this._makeRoomCamera(ICE_CASTLE_WIDTH, ICE_CASTLE_HEIGHT);
    }

    exitIceCastle() {
        this.inCave = false;
        this.state = 'PLAYING';
        this.music.play('battle');
        this.player.x = ICE_CASTLE_ENTRANCE.x;
        this.player.y = ICE_CASTLE_ENTRANCE.y + 60;
    }

    updatePolarFight(dt) {
        const cam = this._polarCamera || this._makeRoomCamera(ICE_CASTLE_WIDTH, ICE_CASTLE_HEIGHT);
        this._polarCamera = cam;

        // Player movement
        let mx = 0, my = 0;
        if (this.input.isKeyDown('w') || this.input.isKeyDown('arrowup'))    { mx -= 1; my -= 1; }
        if (this.input.isKeyDown('s') || this.input.isKeyDown('arrowdown'))  { mx += 1; my += 1; }
        if (this.input.isKeyDown('a') || this.input.isKeyDown('arrowleft'))  { mx -= 1; my += 1; }
        if (this.input.isKeyDown('d') || this.input.isKeyDown('arrowright')) { mx += 1; my -= 1; }
        const mLen = Math.sqrt(mx * mx + my * my);
        if (mLen > 0) { mx /= mLen; my /= mLen; }
        this.player.vx = mx * this.player.speed;
        this.player.vy = my * this.player.speed;
        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;
        this.player.x = clamp(this.player.x, 30, ICE_CASTLE_WIDTH - 30);
        this.player.y = clamp(this.player.y, 30, ICE_CASTLE_HEIGHT - 30);

        if (Math.abs(this.player.vx) > 1 || Math.abs(this.player.vy) > 1) {
            this.player.moveFacing = Math.atan2(this.player.vy, this.player.vx);
            this.player.walkTimer += dt;
        }

        const worldMouse = cam.screenToWorld(this.input.mouseX, this.input.mouseY);
        this.player.facing = angleBetween(this.player.x, this.player.y, worldMouse.x, worldMouse.y);

        // Weapon switching
        for (let i = 1; i <= 9; i++) {
            if (this.input.isKeyDown(i.toString())) { this.player.switchToSlot(i - 1); this.input.keys[i.toString()] = false; }
        }
        const scroll = this.input.consumeScroll();
        if (scroll !== 0) this.player.cycleWeapon(scroll > 0 ? 1 : -1);
        if (this.player.weaponSwitched) {
            this.player.weaponSwitched = false;
            this.music.playSfx('weapon_switch');
            if (this.player.weapon) this.hud.notify(`Switched to ${this.player.weapon.name}`, this.player.weapon.color, 1.2);
        }

        // Attack
        const polarEntities = [this.polarBoss];
        if (this.player.weapon && (this.input.mouseDown || this.input.isKeyDown(' '))) {
            this.player.weapon.attack(this.player, polarEntities, this.polarProjectiles, this.polarParticles);
        }
        for (const wpn of this.player.inventory) { wpn.update(dt); }
        if (this.player.attackAnim > 0) { this.player.attackAnim -= dt * 4; if (this.player.attackAnim < 0) this.player.attackAnim = 0; }

        // Update polar boss
        this.polarBoss.update(dt, this.player, this.polarProjectiles, this.polarParticles);

        // Projectiles
        for (const proj of this.polarProjectiles) {
            proj.update(dt);
            if (proj.team === TEAMS.NEUTRAL && this.player.alive) {
                if (circleCollision(proj.x, proj.y, proj.radius, this.player.x, this.player.y, this.player.radius)) {
                    this.player.takeDamage(proj.damage, this.polarBoss);
                    spawnHitParticles(this.polarParticles, this.player.x, this.player.y, '#88DDFF', 5);
                    this.polarParticles.push(new DamageNumber(this.player.x, this.player.y - 10, proj.damage, '#88DDFF'));
                    proj.alive = false;
                }
            }
            if (proj.team === TEAMS.BLUE && this.polarBoss.alive) {
                if (circleCollision(proj.x, proj.y, proj.radius, this.polarBoss.x, this.polarBoss.y, this.polarBoss.radius)) {
                    this.polarBoss.takeDamage(proj.damage, this.player);
                    spawnHitParticles(this.polarParticles, this.polarBoss.x, this.polarBoss.y, '#88DDFF', 5);
                    this.polarParticles.push(new DamageNumber(this.polarBoss.x, this.polarBoss.y - 10, proj.damage, '#FFAA44'));
                    proj.alive = false;
                }
            }
        }
        this.polarProjectiles = this.polarProjectiles.filter(p => p.alive);

        for (const p of this.polarParticles) { p.update(dt); }
        this.polarParticles = this.polarParticles.filter(p => p.alive || (p.life !== undefined && p.life > 0));

        this.hud.update(dt);

        // ESC to flee
        if (this.input.isKeyDown('escape')) {
            this.exitIceCastle();
            this.hud.notify('Fled the Ice Castle!', '#88DDFF', 2);
            this.input.keys['escape'] = false;
            return;
        }

        // Polar bear defeated
        if (!this.polarBoss.alive) {
            this.polarDefeated = true;
            if (this.polarBoss.deathTimer <= 0) {
                this.exitIceCastle();
                this.hud.notify('Tommy the Polar Bear defeated! +50 sticks! +100 XP!', '#88DDFF', 3);
                this.player.sticks += 50;
                this.player.addXP(XP_PER_BOSS);
            }
        }

        if (!this.player.alive) {
            this.state = 'LOSE';
            this.music.stop();
            this.music.playSfx('player_death');
        }
    }

    renderPolarFight() {
        const ctx = this.ctx;
        const cam = this._polarCamera || this._makeRoomCamera(ICE_CASTLE_WIDTH, ICE_CASTLE_HEIGHT);

        // Background
        ctx.fillStyle = '#0a1520';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Ice floor
        const roomCorners = [
            cam.worldToScreen(0, 0),
            cam.worldToScreen(ICE_CASTLE_WIDTH, 0),
            cam.worldToScreen(ICE_CASTLE_WIDTH, ICE_CASTLE_HEIGHT),
            cam.worldToScreen(0, ICE_CASTLE_HEIGHT)
        ];
        ctx.fillStyle = '#B8D8E8';
        ctx.beginPath();
        ctx.moveTo(roomCorners[0].x, roomCorners[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(roomCorners[i].x, roomCorners[i].y);
        ctx.closePath();
        ctx.fill();

        // Ice floor reflections
        ctx.fillStyle = 'rgba(200, 230, 255, 0.3)';
        for (let i = 0; i < 30; i++) {
            const sx = Math.sin(i * 4.1) * ICE_CASTLE_WIDTH * 0.4 + ICE_CASTLE_WIDTH / 2;
            const sy = Math.cos(i * 2.7) * ICE_CASTLE_HEIGHT * 0.4 + ICE_CASTLE_HEIGHT / 2;
            const sp = cam.worldToScreen(sx, sy);
            ctx.beginPath();
            ctx.ellipse(sp.x, sp.y, randomRange(3, 12), randomRange(1, 4), randomRange(0, Math.PI), 0, Math.PI * 2);
            ctx.fill();
        }

        // Ice walls
        ctx.fillStyle = '#7AB8D0';
        const tl = cam.worldToScreen(0, 0);
        const tr = cam.worldToScreen(ICE_CASTLE_WIDTH, 0);
        ctx.fillRect(Math.min(tl.x, tr.x), Math.min(tl.y, tr.y) - 50,
            Math.abs(tr.x - tl.x), 50);

        // Wall icicles
        ctx.fillStyle = '#A0D8F0';
        for (let i = 0; i < 16; i++) {
            const ix = Math.min(tl.x, tr.x) + i * Math.abs(tr.x - tl.x) / 16 + 10;
            const iy = Math.min(tl.y, tr.y);
            const ilen = randomRange(8, 20);
            ctx.beginPath();
            ctx.moveTo(ix - 3, iy);
            ctx.lineTo(ix, iy + ilen);
            ctx.lineTo(ix + 3, iy);
            ctx.closePath();
            ctx.fill();
        }

        // Ice crystal decorations
        ctx.strokeStyle = 'rgba(150, 220, 255, 0.3)';
        ctx.lineWidth = 2;
        const crystalPositions = [
            cam.worldToScreen(60, 60),
            cam.worldToScreen(ICE_CASTLE_WIDTH - 60, 60),
            cam.worldToScreen(60, ICE_CASTLE_HEIGHT - 60),
            cam.worldToScreen(ICE_CASTLE_WIDTH - 60, ICE_CASTLE_HEIGHT - 60)
        ];
        for (const cp of crystalPositions) {
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2 + Date.now() / 3000;
                ctx.beginPath();
                ctx.moveTo(cp.x, cp.y);
                ctx.lineTo(cp.x + Math.cos(a) * 20, cp.y + Math.sin(a) * 20);
                ctx.stroke();
            }
        }

        // Snowflake particles
        ctx.fillStyle = 'rgba(220, 240, 255, 0.4)';
        for (let i = 0; i < 25; i++) {
            const sx = Math.sin(Date.now() / 2000 + i * 2.1) * ICE_CASTLE_WIDTH * 0.4 + ICE_CASTLE_WIDTH / 2;
            const sy = (Date.now() / 30 + i * 100) % ICE_CASTLE_HEIGHT;
            const sp = cam.worldToScreen(sx, sy);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw polar boss
        if (this.polarBoss.alive || this.polarBoss.deathTimer > 0) {
            this.polarBoss.draw(ctx, cam);
        }

        // Draw player
        drawStickman(ctx, this.player, cam);

        // Projectiles & particles
        for (const proj of this.polarProjectiles) { proj.draw(ctx, cam); }
        for (const p of this.polarParticles) { p.draw(ctx, cam); }

        // Vignette
        const vigGrad = ctx.createRadialGradient(
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.3,
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.7
        );
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Cool blue overlay
        ctx.fillStyle = 'rgba(50, 100, 150, 0.06)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Boss name bar
        if (this.polarBoss.alive) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(CANVAS_WIDTH / 2 - 140, 10, 280, 30);
            ctx.fillStyle = '#88DDFF';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Tommy the Polar Bear', CANVAS_WIDTH / 2, 32);
        }

        // Player HP
        const phx = CANVAS_WIDTH / 2 - 100;
        const phy = CANVAS_HEIGHT - 40;
        ctx.fillStyle = '#333';
        ctx.fillRect(phx, phy, 200, 16);
        const phpct = this.player.health / this.player.maxHealth;
        ctx.fillStyle = phpct > 0.5 ? '#44CC44' : phpct > 0.25 ? '#CCCC44' : '#CC4444';
        ctx.fillRect(phx, phy, 200 * phpct, 16);
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(phx, phy, 200, 16);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`HP: ${Math.ceil(this.player.health)} / ${this.player.maxHealth}`, CANVAS_WIDTH / 2, phy + 13);

        // Inventory
        this.hud.drawInventoryBar(ctx, this.player, this.input);
        if (this.player.weapon) {
            ctx.fillStyle = this.player.weapon.color;
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.player.weapon.name, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 78);
        }

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Press ESC to flee', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 55);

        if (this.hud.notificationTimer > 0) {
            ctx.globalAlpha = Math.min(1, this.hud.notificationTimer);
            ctx.fillStyle = this.hud.notificationColor;
            ctx.font = 'bold 18px Arial';
            ctx.fillText(this.hud.notification, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);
            ctx.globalAlpha = 1;
        }
    }

    // ==================== LAVA MONSTER FIGHT ====================

    enterVolcanoLair() {
        this.inCave = true;
        this.state = 'LAVA_FIGHT';
        this.music.play('boss');
        this.lavaBoss = new LavaBoss(VOLCANO_LAIR_WIDTH / 2, 180);
        this.lavaBoss.activate();
        this.player.x = VOLCANO_LAIR_WIDTH / 2;
        this.player.y = VOLCANO_LAIR_HEIGHT - 80;
        this.lavaProjectiles = [];
        this.lavaParticles = [];
        this._lavaCamera = this._makeRoomCamera(VOLCANO_LAIR_WIDTH, VOLCANO_LAIR_HEIGHT);
    }

    exitVolcanoLair() {
        this.inCave = false;
        this.state = 'PLAYING';
        this.music.play('battle');
        this.player.x = VOLCANO_LAIR_ENTRANCE.x;
        this.player.y = VOLCANO_LAIR_ENTRANCE.y + 60;
    }

    updateLavaFight(dt) {
        const cam = this._lavaCamera || this._makeRoomCamera(VOLCANO_LAIR_WIDTH, VOLCANO_LAIR_HEIGHT);
        this._lavaCamera = cam;

        // Player movement
        let mx = 0, my = 0;
        if (this.input.isKeyDown('w') || this.input.isKeyDown('arrowup'))    { mx -= 1; my -= 1; }
        if (this.input.isKeyDown('s') || this.input.isKeyDown('arrowdown'))  { mx += 1; my += 1; }
        if (this.input.isKeyDown('a') || this.input.isKeyDown('arrowleft'))  { mx -= 1; my += 1; }
        if (this.input.isKeyDown('d') || this.input.isKeyDown('arrowright')) { mx += 1; my -= 1; }
        const mLen = Math.sqrt(mx * mx + my * my);
        if (mLen > 0) { mx /= mLen; my /= mLen; }
        this.player.vx = mx * this.player.speed;
        this.player.vy = my * this.player.speed;
        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;
        this.player.x = clamp(this.player.x, 30, VOLCANO_LAIR_WIDTH - 30);
        this.player.y = clamp(this.player.y, 30, VOLCANO_LAIR_HEIGHT - 30);

        if (Math.abs(this.player.vx) > 1 || Math.abs(this.player.vy) > 1) {
            this.player.moveFacing = Math.atan2(this.player.vy, this.player.vx);
            this.player.walkTimer += dt;
        }

        const worldMouse = cam.screenToWorld(this.input.mouseX, this.input.mouseY);
        this.player.facing = angleBetween(this.player.x, this.player.y, worldMouse.x, worldMouse.y);

        // Weapon switching
        for (let i = 1; i <= 9; i++) {
            if (this.input.isKeyDown(i.toString())) { this.player.switchToSlot(i - 1); this.input.keys[i.toString()] = false; }
        }
        const scroll = this.input.consumeScroll();
        if (scroll !== 0) this.player.cycleWeapon(scroll > 0 ? 1 : -1);
        if (this.player.weaponSwitched) {
            this.player.weaponSwitched = false;
            this.music.playSfx('weapon_switch');
            if (this.player.weapon) this.hud.notify(`Switched to ${this.player.weapon.name}`, this.player.weapon.color, 1.2);
        }

        // Attack
        const lavaEntities = [this.lavaBoss];
        if (this.player.weapon && (this.input.mouseDown || this.input.isKeyDown(' '))) {
            this.player.weapon.attack(this.player, lavaEntities, this.lavaProjectiles, this.lavaParticles);
        }
        for (const wpn of this.player.inventory) { wpn.update(dt); }
        if (this.player.attackAnim > 0) { this.player.attackAnim -= dt * 4; if (this.player.attackAnim < 0) this.player.attackAnim = 0; }

        // Update lava boss
        this.lavaBoss.update(dt, this.player, this.lavaProjectiles, this.lavaParticles);

        // Projectiles
        for (const proj of this.lavaProjectiles) {
            proj.update(dt);
            if (proj.team === TEAMS.NEUTRAL && this.player.alive) {
                if (circleCollision(proj.x, proj.y, proj.radius, this.player.x, this.player.y, this.player.radius)) {
                    this.player.takeDamage(proj.damage, this.lavaBoss);
                    spawnHitParticles(this.lavaParticles, this.player.x, this.player.y, '#FF4400', 5);
                    this.lavaParticles.push(new DamageNumber(this.player.x, this.player.y - 10, proj.damage, '#FF4400'));
                    proj.alive = false;
                }
            }
            if (proj.team === TEAMS.BLUE && this.lavaBoss.alive) {
                if (circleCollision(proj.x, proj.y, proj.radius, this.lavaBoss.x, this.lavaBoss.y, this.lavaBoss.radius)) {
                    this.lavaBoss.takeDamage(proj.damage, this.player);
                    spawnHitParticles(this.lavaParticles, this.lavaBoss.x, this.lavaBoss.y, '#FF6600', 5);
                    this.lavaParticles.push(new DamageNumber(this.lavaBoss.x, this.lavaBoss.y - 10, proj.damage, '#FFAA44'));
                    proj.alive = false;
                }
            }
        }
        this.lavaProjectiles = this.lavaProjectiles.filter(p => p.alive);

        for (const p of this.lavaParticles) { p.update(dt); }
        this.lavaParticles = this.lavaParticles.filter(p => p.alive || (p.life !== undefined && p.life > 0));

        this.hud.update(dt);

        // ESC to flee
        if (this.input.isKeyDown('escape')) {
            this.exitVolcanoLair();
            this.hud.notify('Fled the Volcano!', '#FF6600', 2);
            this.input.keys['escape'] = false;
            return;
        }

        // Lava boss defeated
        if (!this.lavaBoss.alive) {
            this.lavaDefeated = true;
            if (this.lavaBoss.deathTimer <= 0) {
                this.exitVolcanoLair();
                this.hud.notify('Paddy the Lava Monster defeated! +50 sticks! +100 XP!', '#FF6600', 3);
                this.player.sticks += 50;
                this.player.addXP(XP_PER_BOSS);
            }
        }

        if (!this.player.alive) {
            this.state = 'LOSE';
            this.music.stop();
            this.music.playSfx('player_death');
        }
    }

    renderLavaFight() {
        const ctx = this.ctx;
        const cam = this._lavaCamera || this._makeRoomCamera(VOLCANO_LAIR_WIDTH, VOLCANO_LAIR_HEIGHT);

        // Background
        ctx.fillStyle = '#1a0800';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Volcanic rock floor
        const roomCorners = [
            cam.worldToScreen(0, 0),
            cam.worldToScreen(VOLCANO_LAIR_WIDTH, 0),
            cam.worldToScreen(VOLCANO_LAIR_WIDTH, VOLCANO_LAIR_HEIGHT),
            cam.worldToScreen(0, VOLCANO_LAIR_HEIGHT)
        ];
        ctx.fillStyle = '#3A2A1A';
        ctx.beginPath();
        ctx.moveTo(roomCorners[0].x, roomCorners[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(roomCorners[i].x, roomCorners[i].y);
        ctx.closePath();
        ctx.fill();

        // Lava glow cracks in floor
        ctx.strokeStyle = `rgba(255, 80, 0, ${0.3 + Math.sin(Date.now() / 500) * 0.1})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 15; i++) {
            const cx = Math.sin(i * 3.3) * VOLCANO_LAIR_WIDTH * 0.35 + VOLCANO_LAIR_WIDTH / 2;
            const cy = Math.cos(i * 2.1) * VOLCANO_LAIR_HEIGHT * 0.35 + VOLCANO_LAIR_HEIGHT / 2;
            const cp = cam.worldToScreen(cx, cy);
            const angle = i * 1.7;
            ctx.beginPath();
            ctx.moveTo(cp.x, cp.y);
            ctx.lineTo(cp.x + Math.cos(angle) * 25, cp.y + Math.sin(angle) * 15);
            ctx.stroke();
        }

        // Rock walls
        ctx.fillStyle = '#2A1A0A';
        const tl = cam.worldToScreen(0, 0);
        const tr = cam.worldToScreen(VOLCANO_LAIR_WIDTH, 0);
        ctx.fillRect(Math.min(tl.x, tr.x), Math.min(tl.y, tr.y) - 50,
            Math.abs(tr.x - tl.x), 50);

        // Wall lava drips
        ctx.fillStyle = '#FF4400';
        for (let i = 0; i < 8; i++) {
            const dx = Math.min(tl.x, tr.x) + (i + 0.5) * Math.abs(tr.x - tl.x) / 8;
            const dy = Math.min(tl.y, tr.y) + Math.sin(Date.now() / 400 + i * 2) * 5;
            ctx.beginPath();
            ctx.ellipse(dx, dy, 2, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Ember particles floating up
        ctx.fillStyle = 'rgba(255, 120, 0, 0.5)';
        for (let i = 0; i < 20; i++) {
            const ex = Math.sin(Date.now() / 1500 + i * 2.3) * VOLCANO_LAIR_WIDTH * 0.3 + VOLCANO_LAIR_WIDTH / 2;
            const ey = VOLCANO_LAIR_HEIGHT - (Date.now() / 20 + i * 80) % VOLCANO_LAIR_HEIGHT;
            const ep = cam.worldToScreen(ex, ey);
            ctx.beginPath();
            ctx.arc(ep.x, ep.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw lava boss
        if (this.lavaBoss.alive || this.lavaBoss.deathTimer > 0) {
            this.lavaBoss.draw(ctx, cam);
        }

        // Draw player
        drawStickman(ctx, this.player, cam);

        // Projectiles & particles
        for (const proj of this.lavaProjectiles) { proj.draw(ctx, cam); }
        for (const p of this.lavaParticles) { p.draw(ctx, cam); }

        // Vignette
        const vigGrad = ctx.createRadialGradient(
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.3,
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.7
        );
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Hot red overlay
        ctx.fillStyle = 'rgba(100, 30, 0, 0.06)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Boss name bar
        if (this.lavaBoss.alive) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(CANVAS_WIDTH / 2 - 150, 10, 300, 30);
            ctx.fillStyle = '#FF6600';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Paddy the Lava Monster', CANVAS_WIDTH / 2, 32);
        }

        // Player HP
        const phx = CANVAS_WIDTH / 2 - 100;
        const phy = CANVAS_HEIGHT - 40;
        ctx.fillStyle = '#333';
        ctx.fillRect(phx, phy, 200, 16);
        const phpct = this.player.health / this.player.maxHealth;
        ctx.fillStyle = phpct > 0.5 ? '#44CC44' : phpct > 0.25 ? '#CCCC44' : '#CC4444';
        ctx.fillRect(phx, phy, 200 * phpct, 16);
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(phx, phy, 200, 16);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`HP: ${Math.ceil(this.player.health)} / ${this.player.maxHealth}`, CANVAS_WIDTH / 2, phy + 13);

        // Inventory
        this.hud.drawInventoryBar(ctx, this.player, this.input);
        if (this.player.weapon) {
            ctx.fillStyle = this.player.weapon.color;
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.player.weapon.name, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 78);
        }

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Press ESC to flee', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 55);

        if (this.hud.notificationTimer > 0) {
            ctx.globalAlpha = Math.min(1, this.hud.notificationTimer);
            ctx.fillStyle = this.hud.notificationColor;
            ctx.font = 'bold 18px Arial';
            ctx.fillText(this.hud.notification, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);
            ctx.globalAlpha = 1;
        }
    }

    _makeRoomCamera(roomW, roomH) {
        const centerIso = worldToIso(roomW / 2, roomH / 2);
        const isoOffX = centerIso.x;
        const isoOffY = centerIso.y;
        return {
            x: 0, y: 0, shakeX: 0, shakeY: 0,
            worldToScreen: (wx, wy) => {
                const iso = worldToIso(wx, wy);
                return {
                    x: iso.x - isoOffX + CANVAS_WIDTH / 2,
                    y: iso.y - isoOffY + CANVAS_HEIGHT / 2
                };
            },
            screenToWorld: (sx, sy) => {
                const ix = sx - CANVAS_WIDTH / 2 + isoOffX;
                const iy = sy - CANVAS_HEIGHT / 2 + isoOffY;
                return isoToWorld(ix, iy);
            },
            isVisible: () => true
        };
    }

    _makeCaveCamera() {
        // Iso project the cave center to get the offset
        const caveCenterIso = worldToIso(CAVE_WIDTH / 2, CAVE_HEIGHT / 2);
        const isoOffX = caveCenterIso.x;
        const isoOffY = caveCenterIso.y;
        return {
            x: 0, y: 0, shakeX: 0, shakeY: 0,
            isoX: isoOffX - CANVAS_WIDTH / 2,
            isoY: isoOffY - CANVAS_HEIGHT / 2,
            worldToScreen: (wx, wy) => {
                const iso = worldToIso(wx, wy);
                return {
                    x: iso.x - isoOffX + CANVAS_WIDTH / 2,
                    y: iso.y - isoOffY + CANVAS_HEIGHT / 2
                };
            },
            screenToWorld: (sx, sy) => {
                const isoX = sx + isoOffX - CANVAS_WIDTH / 2;
                const isoY = sy + isoOffY - CANVAS_HEIGHT / 2;
                return isoToWorld(isoX, isoY);
            },
            isVisible: () => true
        };
    }

    renderBossFight() {
        const ctx = this.ctx;
        const cam = this._caveCamera;

        // Dark background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Cave room as iso diamond
        const caveDiamond = worldRectToIsoDiamond(0, 0, CAVE_WIDTH, CAVE_HEIGHT);
        const caveScreenPts = caveDiamond.map(p => cam.worldToScreen(
            p.x * 0.5 + p.y, -p.x * 0.5 + p.y // isoToWorld inline since these are already iso coords
        ));
        // Actually just project the 4 world corners
        const caveCorners = [
            cam.worldToScreen(0, 0),
            cam.worldToScreen(CAVE_WIDTH, 0),
            cam.worldToScreen(CAVE_WIDTH, CAVE_HEIGHT),
            cam.worldToScreen(0, CAVE_HEIGHT)
        ];
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(caveCorners[0].x, caveCorners[0].y);
        ctx.lineTo(caveCorners[1].x, caveCorners[1].y);
        ctx.lineTo(caveCorners[2].x, caveCorners[2].y);
        ctx.lineTo(caveCorners[3].x, caveCorners[3].y);
        ctx.closePath();
        ctx.fill();

        // Stone wall texture (scattered in cave area)
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            const rwx = randomInt(20, CAVE_WIDTH - 20);
            const rwy = randomInt(20, CAVE_HEIGHT - 20);
            const rp = cam.worldToScreen(rwx, rwy);
            ctx.strokeRect(rp.x - 8, rp.y - 5, randomInt(10, 25), randomInt(8, 14));
        }

        // Cobwebs in corners
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
        ctx.lineWidth = 1;
        const drawWeb = (wx, wy) => {
            const cp = cam.worldToScreen(wx, wy);
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI / 2;
                ctx.beginPath();
                ctx.moveTo(cp.x, cp.y);
                ctx.lineTo(cp.x + Math.cos(a) * 40, cp.y + Math.sin(a) * 40);
                ctx.stroke();
            }
        };
        drawWeb(20, 20);
        drawWeb(CAVE_WIDTH - 20, 20);

        // Vignette effect
        const grad = ctx.createRadialGradient(
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CAVE_WIDTH * 0.3,
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CAVE_WIDTH * 0.6
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Boss
        this.boss.draw(ctx, cam);

        // Player
        drawStickman(ctx, this.player, cam);

        // Projectiles
        for (const p of this.bossProjectiles) p.draw(ctx, cam);

        // Particles
        for (const p of this.bossParticles) p.draw(ctx, cam);

        // Boss name bar at top
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.boss.name, CANVAS_WIDTH / 2, 30);

        // Player health (bottom of screen)
        const hx = CANVAS_WIDTH / 2 - 100, hy = CANVAS_HEIGHT - 40;
        ctx.fillStyle = '#333';
        ctx.fillRect(hx, hy, 200, 16);
        const hpPct = this.player.health / this.player.maxHealth;
        ctx.fillStyle = hpPct > 0.5 ? '#44CC44' : hpPct > 0.25 ? '#CCCC44' : '#CC4444';
        ctx.fillRect(hx, hy, 200 * hpPct, 16);
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(hx, hy, 200, 16);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`HP: ${Math.ceil(this.player.health)} / ${this.player.maxHealth}`, hx + 100, hy + 12);

        // Escape hint
        ctx.fillStyle = '#888';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Press ESC to flee', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 15);

        this.hud.update(0);
        if (this.hud.notificationTimer > 0) {
            const alpha = Math.min(1, this.hud.notificationTimer);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.hud.notificationColor;
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.hud.notification, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);
            ctx.globalAlpha = 1;
        }
    }

    // ==================== WIN / LOSE ====================

    renderWin() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = '#44FF44';
        ctx.font = 'bold 56px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('VICTORY!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);

        ctx.fillStyle = '#FFF';
        ctx.font = '20px Arial';
        ctx.fillText('Blue Team Wins!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);

        this.renderStats(ctx);
        this.renderReplayButton(ctx);
    }

    renderLose() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = '#FF4444';
        ctx.font = 'bold 56px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('DEFEATED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);

        ctx.fillStyle = '#FFF';
        ctx.font = '20px Arial';
        ctx.fillText('You have fallen in battle.', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);

        this.renderStats(ctx);
        this.renderReplayButton(ctx);
    }

    renderStats(ctx) {
        // Award XP once per match end (use a flag to prevent re-awarding on every frame)
        if (!this._matchXPAwarded) {
            this._matchXPAwarded = true;
            const bossKills = (this.bossDefeated ? 1 : 0) + (this.ghostDefeated ? 1 : 0) + (this.crabDefeated ? 1 : 0);
            this._matchXP = this.progression.calculateMatchXP(
                this.player.kills, bossKills, this.matchSticksCollected, this.gameTime
            );
            const prevLevel = this.progression.level;
            this.progression.addXP(this._matchXP.total);
            this.progression.totalKills += this.player.kills;
            this.progression.totalBossKills += bossKills;
            this.progression.gamesPlayed++;
            if (this.player.kills > this.progression.bestKills) {
                this.progression.bestKills = this.player.kills;
            }
            this.progression.save();
            if (this.progression.level > prevLevel) {
                this.music.playSfx('levelup');
            }
        }

        const cx = CANVAS_WIDTH / 2;
        let y = CANVAS_HEIGHT / 2 + 5;

        const minutes = Math.floor(this.gameTime / 60);
        const seconds = Math.floor(this.gameTime % 60);
        ctx.fillStyle = '#CCC';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Time: ${minutes}m ${seconds}s`, cx, y);
        y += 20;
        ctx.fillText(`Kills: ${this.player.kills}`, cx - 80, y);
        ctx.fillText(`Sticks: ${this.matchSticksCollected}`, cx + 80, y);
        y += 20;
        if (this.bossDefeated || this.ghostDefeated || this.crabDefeated) {
            ctx.fillStyle = '#FFD700';
            const bosses = [this.bossDefeated && 'Spider', this.ghostDefeated && 'Ghost', this.crabDefeated && 'Crab'].filter(Boolean);
            ctx.fillText('Bosses: ' + bosses.join(', '), cx, y);
            y += 20;
        }

        // XP breakdown
        if (this._matchXP) {
            const xp = this._matchXP;
            y += 6;
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(`+${xp.total} XP`, cx, y);
            y += 18;
            ctx.fillStyle = '#AAA';
            ctx.font = '11px Arial';
            const parts = [];
            if (xp.killXP > 0) parts.push(`Kills: +${xp.killXP}`);
            if (xp.bossXP > 0) parts.push(`Bosses: +${xp.bossXP}`);
            if (xp.stickXP > 0) parts.push(`Sticks: +${xp.stickXP}`);
            if (xp.survivalXP > 0) parts.push(`Survival: +${xp.survivalXP}`);
            ctx.fillText(parts.join('  |  '), cx, y);
            y += 16;

            // Level progress bar
            ctx.fillStyle = '#555';
            const barW = 200, barH = 10;
            ctx.fillRect(cx - barW / 2, y, barW, barH);
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(cx - barW / 2, y, barW * this.progression.xpProgress(), barH);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - barW / 2, y, barW, barH);
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 10px Arial';
            ctx.fillText(`Level ${this.progression.level}`, cx, y + 9);
        }
    }

    renderReplayButton(ctx) {
        const bx = CANVAS_WIDTH / 2 - 80;
        const by = CANVAS_HEIGHT / 2 + 155;
        ctx.fillStyle = '#4488FF';
        ctx.fillRect(bx, by, 160, 40);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Play Again', CANVAS_WIDTH / 2, by + 27);

        if (this.input.consumeClick()) {
            const mx = this.input.mouseX;
            const my = this.input.mouseY;
            if (mx > bx && mx < bx + 160 && my > by && my < by + 40) {
                this.initBattle('WOODEN_SWORD');
            }
        }
    }
}
