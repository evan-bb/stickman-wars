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

        // Storm system
        this.storm = {
            active: false,
            phase: 0,
            radius: Math.max(WORLD_WIDTH, WORLD_HEIGHT), // starts huge
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
        ctx.fillText('Choose Your Starter Weapon', CANVAS_WIDTH / 2, 80);

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

        // Reset storm
        this.storm = {
            active: false,
            phase: 0,
            radius: Math.max(WORLD_WIDTH, WORLD_HEIGHT),
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

        // Pickup collection (player only)
        for (const pickup of this.pickups) {
            if (pickup.collected) continue;
            pickup.update(dt);
            if (distance(this.player.x, this.player.y, pickup.x, pickup.y) < STICK_COLLECT_RADIUS) {
                pickup.collected = true;
                this.player.sticks += pickup.amount;
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

        // Handle E key interaction
        if (this.input.isKeyDown('e') && this.player.interactTarget) {
            if (this.player.interactTarget === 'cave') {
                this.enterCave();
            } else if (this.player.interactTarget === 'haunted') {
                this.enterHauntedHouse();
            } else if (this.player.interactTarget === 'sandcastle') {
                this.enterSandCastle();
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
                // Storm just appeared
                s.active = true;
                s.radius = Math.max(WORLD_WIDTH, WORLD_HEIGHT) * 0.9;
                this.hud.notify('The storm is closing in!', '#AA44FF', 3);
            }

            if (!s.shrinking) {
                s.phase++;
                if (s.phase > STORM_CONFIG.shrinkPhases) return; // at min size, done shrinking

                // Calculate target radius for this phase
                const maxR = Math.max(WORLD_WIDTH, WORLD_HEIGHT) * 0.9;
                const frac = 1 - (s.phase / STORM_CONFIG.shrinkPhases);
                s.targetRadius = Math.max(STORM_CONFIG.minRadius, maxR * frac);
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

        // Storm timer/warning HUD
        if (s.shrinking) {
            ctx.fillStyle = 'rgba(160, 80, 220, 0.7)';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⚡ STORM CLOSING ⚡', CANVAS_WIDTH / 2, 55);
        } else if (s.active && s.phase <= STORM_CONFIG.shrinkPhases) {
            const timeLeft = Math.max(0, Math.ceil(s.nextShrinkTime - this.gameTime));
            if (timeLeft <= 15) {
                ctx.fillStyle = 'rgba(160, 80, 220, 0.6)';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`Storm shrinks in ${timeLeft}s`, CANVAS_WIDTH / 2, 55);
            }
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
                this.hud.notify('Luca the Spider defeated! +50 sticks!', '#FFD700', 3);
                this.player.sticks += 50;
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
                this.hud.notify('James the Ghost defeated! +50 sticks!', '#88CCFF', 3);
                this.player.sticks += 50;
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
                this.hud.notify('Charlie the Crab defeated! +50 sticks!', '#FF8844', 3);
                this.player.sticks += 50;
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
        const minutes = Math.floor(this.gameTime / 60);
        const seconds = Math.floor(this.gameTime % 60);
        ctx.fillStyle = '#CCC';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Time: ${minutes}m ${seconds}s`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);
        ctx.fillText(`Your Kills: ${this.player.kills}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35);
        ctx.fillText(`Sticks Collected: ${this.player.sticks}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 58);
        if (this.bossDefeated) {
            ctx.fillStyle = '#FFD700';
            ctx.fillText('Boss Defeated!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 82);
        }
    }

    renderReplayButton(ctx) {
        const bx = CANVAS_WIDTH / 2 - 80;
        const by = CANVAS_HEIGHT / 2 + 110;
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
