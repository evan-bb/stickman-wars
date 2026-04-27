// ============================================
// Game - State Machine & Main Loop
// ============================================

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.state = 'LOADING';
        this.loadingTimer = 0;
        this.lastTime = 0;
        this.gameTime = 0;

        // Emote wheel state
        this.emoteWheelOpen = false;
        this.emoteWheelHover = -1;

        // Multiplayer state
        this.mp = null;                   // MultiplayerClient instance during a 1v1
        this.lobby = null;                // LobbyClient (Firebase matchmaking)
        this.mpStatus = '';               // status text for lobby/waiting
        this.mpStatusColor = '#FFFFFF';
        this.mpLobbyMode = 'searching';   // 'searching' | 'failed'
        this.mpSearchStart = 0;
        this.mpOpponent = null;           // remote player snapshot
        this.mpOpponentTarget = null;     // interpolation target
        this.mpSendTimer = 0;
        this.mpResult = null;             // 'win' | 'lose' once match ends
        this.mpProjectiles = [];          // local projectiles in 1v1
        this.mpParticles = [];
        this.mpEntities = [];             // [player, opponent stub] for weapon hit detection

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
        this._lastDt = dt;
        // Update music system
        this.music.update(dt);

        switch (this.state) {
            case 'LOADING': this.updateLoading(dt); break;
            case 'MENU': this.updateMenu(dt); break;
            case 'COSMETICS': this.updateCosmetics(dt); break;
            case 'MP_LOBBY': this.updateMPLobby(dt); break;
            case 'MP_FIGHT': this.updateMPFight(dt); break;
            case 'MP_RESULT': this.updateMPResult(dt); break;
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
            case 'LOADING': this.renderLoading(); break;
            case 'MENU': this.renderMenu(); break;
            case 'COSMETICS': this.renderCosmetics(); break;
            case 'MP_LOBBY': this.renderMPLobby(); break;
            case 'MP_FIGHT': this.renderMPFight(); break;
            case 'MP_RESULT': this.renderMPFight(); this.renderMPResult(); break;
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

    // ==================== LOADING ====================

    updateLoading(dt) {
        this.loadingTimer += dt;
        // Transition to menu right before the sword would connect (~4.9s of 5s)
        if (this.loadingTimer >= 4.9) {
            this.state = 'MENU';
        }
    }

    renderLoading() {
        const ctx = this.ctx;
        const t = this.loadingTimer;
        const totalDuration = 5;
        const progress = Math.min(1, t / totalDuration);

        // Dark gradient background
        const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        bg.addColorStop(0, '#0a0a1e');
        bg.addColorStop(1, '#1a1a3e');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Studio logo — "ECJ games" at top
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = 'rgba(68, 136, 255, 0.7)';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 64px Arial';
        ctx.fillText('ECJ games', CANVAS_WIDTH / 2, 110);
        ctx.shadowBlur = 0;

        // Tagline under logo
        ctx.fillStyle = '#88AAFF';
        ctx.font = '16px Arial';
        ctx.fillText('presents', CANVAS_WIDTH / 2, 140);

        // --- Fighting stickmen in middle of screen ---
        const centerY = CANVAS_HEIGHT / 2 + 20;
        const redX = CANVAS_WIDTH / 2 + 110;

        // Blue stickman slowly advances and raises sword, then thrusts at the end
        // 0s to 3s: Walk from far left toward red (sword held low, jaunty)
        // 3s to 4.5s: Raise sword high (wind-up)
        // 4.5s to 5s: Thrust forward rapidly
        let blueX, swordAngle, thrustExtend;
        if (t < 3) {
            const p = t / 3;
            blueX = CANVAS_WIDTH / 2 - 280 + p * 180; // arrives at x = center - 100
            swordAngle = Math.PI * 0.25; // sword held low/forward
            thrustExtend = 0;
        } else if (t < 4.5) {
            const p = (t - 3) / 1.5;
            blueX = CANVAS_WIDTH / 2 - 100 + p * 20;
            // Raise sword (windup: angle goes up over the head)
            swordAngle = lerp(Math.PI * 0.25, -Math.PI * 0.55, p);
            thrustExtend = 0;
        } else {
            const p = (t - 4.5) / 0.5; // 0..1
            blueX = CANVAS_WIDTH / 2 - 80 + p * 80;
            // Swing down/forward
            swordAngle = lerp(-Math.PI * 0.55, Math.PI * 0.15, p);
            thrustExtend = p * 14;
        }

        // Draw red stickman (idle, slight bob of fear)
        const redBob = Math.sin(t * 6) * (t > 3 ? 2 : 0.5);
        this._drawLoadingStickman(ctx, redX, centerY + redBob, '#FF4444', 0, 0, true);

        // Draw blue stickman attacking
        this._drawLoadingStickman(ctx, blueX, centerY, '#4488FF', swordAngle, thrustExtend, false);

        // Impact sparks right before transition
        if (t > 4.85) {
            const sparkA = (5 - t) / 0.15;
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                ctx.fillStyle = `rgba(255, 230, 100, ${sparkA})`;
                const sx = redX - 10 + Math.cos(a) * 18;
                const sy = centerY - 10 + Math.sin(a) * 18;
                ctx.beginPath();
                ctx.arc(sx, sy, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- Progress bar at bottom ---
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial';
        const dots = '.'.repeat(Math.floor(t * 3) % 4);
        ctx.fillText('Loading' + dots, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 80);

        // Progress bar
        const pbW = 500, pbH = 18;
        const pbX = (CANVAS_WIDTH - pbW) / 2;
        const pbY = CANVAS_HEIGHT - 60;
        // Track
        ctx.fillStyle = '#222';
        ctx.fillRect(pbX, pbY, pbW, pbH);
        // Fill
        const fillGrad = ctx.createLinearGradient(pbX, pbY, pbX + pbW, pbY);
        fillGrad.addColorStop(0, '#4488FF');
        fillGrad.addColorStop(1, '#88CCFF');
        ctx.fillStyle = fillGrad;
        ctx.fillRect(pbX, pbY, pbW * progress, pbH);
        // Border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(pbX, pbY, pbW, pbH);

        // Percentage text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(Math.floor(progress * 100) + '%', CANVAS_WIDTH / 2, pbY + pbH - 4);

        // Version tag (bottom-right)
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '12px Arial';
        ctx.fillText('v' + (window.APP_VERSION || 'dev'), CANVAS_WIDTH - 12, CANVAS_HEIGHT - 12);
    }

    _drawLoadingStickman(ctx, x, y, color, swordAngle, thrustExtend, facingLeft) {
        ctx.save();

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + 50, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        // Head
        ctx.beginPath();
        ctx.arc(x, y - 24, 11, 0, Math.PI * 2);
        ctx.stroke();

        // Spine
        ctx.beginPath();
        ctx.moveTo(x, y - 13);
        ctx.lineTo(x, y + 20);
        ctx.stroke();

        // Legs
        ctx.beginPath();
        ctx.moveTo(x, y + 20);
        ctx.lineTo(x - 8, y + 44);
        ctx.moveTo(x, y + 20);
        ctx.lineTo(x + 8, y + 44);
        ctx.stroke();

        if (facingLeft) {
            // Red stickman arms in defensive position
            ctx.beginPath();
            ctx.moveTo(x, y - 5);
            ctx.lineTo(x - 14, y - 12); // left arm up
            ctx.moveTo(x, y - 5);
            ctx.lineTo(x + 12, y + 4);  // right arm down
            ctx.stroke();
            // A little sweat drop
            ctx.fillStyle = '#88CCFF';
            ctx.beginPath();
            ctx.arc(x + 14, y - 24, 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Blue stickman swinging sword
            // Arms — one hand on sword grip
            const gripDx = Math.cos(swordAngle) * (18 + thrustExtend);
            const gripDy = Math.sin(swordAngle) * (18 + thrustExtend);
            // Back arm (support)
            ctx.beginPath();
            ctx.moveTo(x, y - 5);
            ctx.lineTo(x - 10, y + 2);
            ctx.stroke();
            // Forward arm (sword arm)
            ctx.beginPath();
            ctx.moveTo(x, y - 5);
            ctx.lineTo(x + gripDx, y + gripDy);
            ctx.stroke();

            // Draw sword in the sword hand
            const gripX = x + gripDx;
            const gripY = y + gripDy;
            const bladeLen = 34;
            const tipX = gripX + Math.cos(swordAngle) * bladeLen;
            const tipY = gripY + Math.sin(swordAngle) * bladeLen;

            // Blade
            ctx.strokeStyle = '#E0E0E0';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(gripX, gripY);
            ctx.lineTo(tipX, tipY);
            ctx.stroke();
            // Blade highlight
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(gripX, gripY);
            ctx.lineTo(tipX, tipY);
            ctx.stroke();

            // Cross-guard perpendicular to blade
            const perp = swordAngle + Math.PI / 2;
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(gripX + Math.cos(perp) * 6, gripY + Math.sin(perp) * 6);
            ctx.lineTo(gripX - Math.cos(perp) * 6, gripY - Math.sin(perp) * 6);
            ctx.stroke();

            // Motion streak while swinging
            if (thrustExtend > 4) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.5, thrustExtend / 14 * 0.5)})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(gripX - Math.cos(swordAngle) * 6, gripY - Math.sin(swordAngle) * 6);
                ctx.lineTo(tipX + Math.cos(swordAngle) * 6, tipY + Math.sin(swordAngle) * 6);
                ctx.stroke();
            }
        }

        ctx.restore();
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
            // Cosmetics button (under start)
            else if (mx > CANVAS_WIDTH / 2 - 80 && mx < CANVAS_WIDTH / 2 + 80 &&
                my > CANVAS_HEIGHT / 2 + 150 && my < CANVAS_HEIGHT / 2 + 186) {
                this.music.init();
                this.state = 'COSMETICS';
            }
            // 1v1 ONLINE button
            else if (mx > CANVAS_WIDTH / 2 - 80 && mx < CANVAS_WIDTH / 2 + 80 &&
                my > CANVAS_HEIGHT / 2 + 195 && my < CANVAS_HEIGHT / 2 + 231) {
                this.music.init();
                this.openMPLobby();
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

        // Cosmetics button
        const cosBtnX = CANVAS_WIDTH / 2 - 80;
        const cosBtnY = CANVAS_HEIGHT / 2 + 150;
        const cosMx = this.input.mouseX, cosMy = this.input.mouseY;
        const cosHover = cosMx > cosBtnX && cosMx < cosBtnX + 160 && cosMy > cosBtnY && cosMy < cosBtnY + 36;
        ctx.fillStyle = cosHover ? '#5a4aaa' : '#3a2a88';
        ctx.fillRect(cosBtnX, cosBtnY, 160, 36);
        ctx.strokeStyle = '#8866CC';
        ctx.lineWidth = 2;
        ctx.strokeRect(cosBtnX, cosBtnY, 160, 36);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🎩 COSMETICS', CANVAS_WIDTH / 2, cosBtnY + 23);

        // 1v1 Online button (below cosmetics)
        const mpBtnX = CANVAS_WIDTH / 2 - 80;
        const mpBtnY = CANVAS_HEIGHT / 2 + 195;
        const mpHover = cosMx > mpBtnX && cosMx < mpBtnX + 160 && cosMy > mpBtnY && cosMy < mpBtnY + 36;
        ctx.fillStyle = mpHover ? '#cc6644' : '#aa3322';
        ctx.fillRect(mpBtnX, mpBtnY, 160, 36);
        ctx.strokeStyle = '#FF8866';
        ctx.lineWidth = 2;
        ctx.strokeRect(mpBtnX, mpBtnY, 160, 36);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('⚔️ 1V1 ONLINE', CANVAS_WIDTH / 2, mpBtnY + 23);

        // Controls info
        ctx.fillStyle = '#666';
        ctx.font = '13px Arial';
        if (this.touch.active) {
            ctx.fillText('Left side: move | Right side: aim & attack | Buttons: sprint & interact', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
        } else {
            ctx.fillText('WASD to move | Mouse to aim | Click/Space to attack | E to interact', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
        }

        // Version tag (bottom-right)
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '12px Arial';
        ctx.fillText('v' + (window.APP_VERSION || 'dev'), CANVAS_WIDTH - 12, CANVAS_HEIGHT - 12);
    }

    // ==================== COSMETICS ====================

    updateCosmetics(dt) {
        // Keep menu stickmen animating for visual continuity
        for (const s of this.menuStickmen) {
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.walkTimer += dt;
            if (s.x < 50 || s.x > CANVAS_WIDTH - 50) s.vx *= -1;
            if (s.y < 150 || s.y > CANVAS_HEIGHT - 50) s.vy *= -1;
            s.facing = Math.atan2(s.vy, s.vx);
        }

        // Back to menu on ESC
        if (this.input.isKeyDown('escape')) {
            this.input.keys['escape'] = false;
            this.state = 'MENU';
        }

        if (!this.input.consumeClick()) return;
        const mx = this.input.mouseX, my = this.input.mouseY;
        const prog = this.progression;

        // Back button (top-left)
        if (mx > 20 && mx < 120 && my > 20 && my < 56) {
            this.state = 'MENU';
            return;
        }

        // Build cosmetic grids (same layout as render)
        const hats = LEVEL_UNLOCKS.filter(u => u.type === 'hat');
        const trails = LEVEL_UNLOCKS.filter(u => u.type === 'trail');

        const tileW = 90, tileH = 110, gap = 14;
        const cols = 6;

        // Hats grid
        const hatsStartY = 130;
        const hatsRowW = Math.min(hats.length, cols) * tileW + (Math.min(hats.length, cols) - 1) * gap;
        const hatsStartX = (CANVAS_WIDTH - hatsRowW) / 2;
        for (let i = 0; i < hats.length; i++) {
            const col = i % cols, row = Math.floor(i / cols);
            const tx = hatsStartX + col * (tileW + gap);
            const ty = hatsStartY + row * (tileH + gap);
            if (mx > tx && mx < tx + tileW && my > ty && my < ty + tileH) {
                if (prog.level >= hats[i].level) {
                    prog.equippedHat = (prog.equippedHat === hats[i].key) ? 'none' : hats[i].key;
                    prog.save();
                }
                return;
            }
        }

        // Trails grid
        const hatsRows = Math.ceil(hats.length / cols);
        const trailsStartY = hatsStartY + hatsRows * (tileH + gap) + 60;
        const trailsRowW = Math.min(trails.length, cols) * tileW + (Math.min(trails.length, cols) - 1) * gap;
        const trailsStartX = (CANVAS_WIDTH - trailsRowW) / 2;
        for (let i = 0; i < trails.length; i++) {
            const col = i % cols, row = Math.floor(i / cols);
            const tx = trailsStartX + col * (tileW + gap);
            const ty = trailsStartY + row * (tileH + gap);
            if (mx > tx && mx < tx + tileW && my > ty && my < ty + tileH) {
                if (prog.level >= trails[i].level) {
                    prog.equippedTrail = (prog.equippedTrail === trails[i].key) ? 'none' : trails[i].key;
                    prog.save();
                }
                return;
            }
        }
    }

    renderCosmetics() {
        const ctx = this.ctx;
        const prog = this.progression;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Back button
        const mx = this.input.mouseX, my = this.input.mouseY;
        const backHover = mx > 20 && mx < 120 && my > 20 && my < 56;
        ctx.fillStyle = backHover ? '#3a3a5a' : '#2a2a4a';
        ctx.fillRect(20, 20, 100, 36);
        ctx.strokeStyle = '#4488FF';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, 100, 36);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('← Back', 70, 42);

        // Title
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('COSMETICS', CANVAS_WIDTH / 2, 60);

        ctx.fillStyle = '#AAA';
        ctx.font = '13px Arial';
        ctx.fillText(`Your Level: ${prog.level}  |  Click an item to equip/unequip`, CANVAS_WIDTH / 2, 82);

        const hats = LEVEL_UNLOCKS.filter(u => u.type === 'hat');
        const trails = LEVEL_UNLOCKS.filter(u => u.type === 'trail');

        const tileW = 90, tileH = 110, gap = 14;
        const cols = 6;

        // ====== HATS SECTION ======
        const hatsStartY = 130;
        const hatsRowW = Math.min(hats.length, cols) * tileW + (Math.min(hats.length, cols) - 1) * gap;
        const hatsStartX = (CANVAS_WIDTH - hatsRowW) / 2;

        // Section header
        ctx.fillStyle = '#88AAFF';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('🎩 Hats', hatsStartX, hatsStartY - 12);

        for (let i = 0; i < hats.length; i++) {
            const col = i % cols, row = Math.floor(i / cols);
            const tx = hatsStartX + col * (tileW + gap);
            const ty = hatsStartY + row * (tileH + gap);
            this._drawCosmeticTile(ctx, tx, ty, tileW, tileH, hats[i], 'hat', prog, mx, my);
        }

        // ====== TRAILS SECTION ======
        const hatsRows = Math.ceil(hats.length / cols);
        const trailsStartY = hatsStartY + hatsRows * (tileH + gap) + 60;
        const trailsRowW = Math.min(trails.length, cols) * tileW + (Math.min(trails.length, cols) - 1) * gap;
        const trailsStartX = (CANVAS_WIDTH - trailsRowW) / 2;

        ctx.fillStyle = '#88AAFF';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('✨ Trails', trailsStartX, trailsStartY - 12);

        for (let i = 0; i < trails.length; i++) {
            const col = i % cols, row = Math.floor(i / cols);
            const tx = trailsStartX + col * (tileW + gap);
            const ty = trailsStartY + row * (tileH + gap);
            this._drawCosmeticTile(ctx, tx, ty, tileW, tileH, trails[i], 'trail', prog, mx, my);
        }

        // Hint at bottom
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Locked items show the level required. ESC to go back.', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30);
    }

    _drawCosmeticTile(ctx, tx, ty, tw, th, item, type, prog, mx, my) {
        const unlocked = prog.level >= item.level;
        const equipped = type === 'hat' ? prog.equippedHat === item.key : prog.equippedTrail === item.key;
        const hover = unlocked && mx > tx && mx < tx + tw && my > ty && my < ty + th;

        // Tile background
        if (equipped) {
            ctx.fillStyle = '#3d5a3d';
            ctx.strokeStyle = '#44FF44';
            ctx.lineWidth = 3;
        } else if (hover) {
            ctx.fillStyle = '#2a2a4e';
            ctx.strokeStyle = '#AAAAFF';
            ctx.lineWidth = 2;
        } else if (unlocked) {
            ctx.fillStyle = '#222244';
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
        } else {
            ctx.fillStyle = '#1a1a2a';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
        }
        ctx.fillRect(tx, ty, tw, th);
        ctx.strokeRect(tx, ty, tw, th);

        // Icon area — draw a mini stickman head with the cosmetic
        const iconCx = tx + tw / 2;
        const iconCy = ty + 45;
        ctx.save();
        if (!unlocked) ctx.globalAlpha = 0.3;

        if (type === 'hat') {
            // Draw a small head for context
            ctx.strokeStyle = '#CCC';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(iconCx, iconCy, 10, 0, Math.PI * 2);
            ctx.stroke();
            // Body hint
            ctx.beginPath();
            ctx.moveTo(iconCx, iconCy + 10);
            ctx.lineTo(iconCx, iconCy + 22);
            ctx.stroke();
            // The hat itself — use progression's drawHat helper
            if (item.key !== 'none') {
                prog.drawHat(ctx, iconCx, iconCy - 10, item.key);
            } else {
                ctx.fillStyle = '#888';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('(no hat)', iconCx, iconCy);
            }
        } else {
            // Trail preview: stickman appears to be running rightward, trail follows
            const t = Date.now() / 1000;
            const stickX = iconCx + 12; // shifted right; trail flows from left-behind
            const stickY = iconCy;

            // Draw the trail BEHIND the stickman first so it appears under
            if (item.key !== 'none') {
                this._drawMiniTrail(ctx, stickX, stickY, item.key, t);
            }

            // Mini stickman body — head, spine, walking legs
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            // Head
            ctx.beginPath();
            ctx.arc(stickX, stickY - 8, 5, 0, Math.PI * 2);
            ctx.stroke();
            // Spine
            ctx.beginPath();
            ctx.moveTo(stickX, stickY - 3);
            ctx.lineTo(stickX, stickY + 8);
            ctx.stroke();
            // Walking legs (alternating swing)
            const legSwing = Math.sin(t * 8) * 4;
            ctx.beginPath();
            ctx.moveTo(stickX, stickY + 8);
            ctx.lineTo(stickX + legSwing, stickY + 16);
            ctx.moveTo(stickX, stickY + 8);
            ctx.lineTo(stickX - legSwing, stickY + 16);
            ctx.stroke();
            // Arms (slight swing opposite to legs)
            ctx.beginPath();
            ctx.moveTo(stickX, stickY + 1);
            ctx.lineTo(stickX - legSwing * 0.5, stickY + 6);
            ctx.moveTo(stickX, stickY + 1);
            ctx.lineTo(stickX + legSwing * 0.5, stickY + 6);
            ctx.stroke();

            if (item.key === 'none') {
                ctx.fillStyle = '#888';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('(no trail)', iconCx, iconCy + 25);
            }
        }
        ctx.restore();

        // Name
        ctx.fillStyle = unlocked ? '#FFF' : '#666';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(item.name, iconCx, ty + 82);

        // Level requirement or status
        if (!unlocked) {
            ctx.fillStyle = '#FF6666';
            ctx.font = '10px Arial';
            ctx.fillText(`🔒 Level ${item.level}`, iconCx, ty + 98);
        } else if (equipped) {
            ctx.fillStyle = '#44FF44';
            ctx.font = 'bold 10px Arial';
            ctx.fillText('✓ EQUIPPED', iconCx, ty + 98);
        } else {
            ctx.fillStyle = '#888';
            ctx.font = '10px Arial';
            ctx.fillText(item.level === 1 ? 'Default' : `Lv ${item.level}`, iconCx, ty + 98);
        }
    }

    _drawMiniTrail(ctx, cx, cy, trail, t) {
        // Each particle is anchored to a phase that loops 0..1 over `lifetime` seconds.
        // Particles spawn at the stickman's feet (cx) and drift backward (left).
        const lifetime = 0.9; // seconds per particle cycle
        const count = 8;
        const trailLength = 28; // px from spawn to end-of-life

        switch (trail) {
            case 'dust': {
                for (let i = 0; i < count; i++) {
                    const phase = ((t / lifetime) + i / count) % 1;
                    const px = cx - 4 - phase * trailLength;
                    const py = cy + 12 + Math.sin(phase * Math.PI) * 2;
                    const alpha = (1 - phase) * 0.55;
                    const r = 3 - phase * 1.5;
                    ctx.fillStyle = `rgba(180, 150, 110, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(px, py, r, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
            case 'fire': {
                const fireColors = ['#FFEE66', '#FFA630', '#FF4400'];
                for (let i = 0; i < count; i++) {
                    const phase = ((t / lifetime) + i / count) % 1;
                    const px = cx - 3 - phase * trailLength;
                    const py = cy + 8 + Math.sin(phase * Math.PI * 2 + i) * 2;
                    const alpha = (1 - phase) * 0.85;
                    const r = 4 - phase * 2.5;
                    const c = fireColors[Math.floor(phase * fireColors.length)];
                    ctx.fillStyle = c;
                    ctx.globalAlpha = alpha;
                    ctx.beginPath();
                    ctx.arc(px, py, r, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
                break;
            }
            case 'sparkle': {
                for (let i = 0; i < count; i++) {
                    const phase = ((t / lifetime) + i / count) % 1;
                    // Deterministic per-particle vertical jitter using i as seed
                    const yJitter = Math.sin(i * 12.9898) * 4;
                    const px = cx - 4 - phase * trailLength;
                    const py = cy + 8 + yJitter * (1 - phase);
                    const twinkle = 0.5 + 0.5 * Math.sin(t * 8 + i);
                    const alpha = (1 - phase) * 0.9 * twinkle;
                    const r = 1.6 + 0.6 * twinkle;
                    ctx.fillStyle = '#FFFFFF';
                    ctx.globalAlpha = alpha;
                    ctx.beginPath();
                    ctx.arc(px, py, r, 0, Math.PI * 2);
                    ctx.fill();
                    // Cross-shaped sparkle
                    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(px - 3, py);
                    ctx.lineTo(px + 3, py);
                    ctx.moveTo(px, py - 3);
                    ctx.lineTo(px, py + 3);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
                break;
            }
            case 'rainbow': {
                const rainbowColors = ['#FF3333', '#FF8833', '#FFE633', '#33CC33', '#3399FF', '#9933CC'];
                for (let i = 0; i < count; i++) {
                    const phase = ((t / lifetime) + i / count) % 1;
                    const px = cx - 4 - phase * trailLength;
                    const py = cy + 10 + Math.sin(phase * Math.PI * 2) * 2;
                    const alpha = (1 - phase) * 0.85;
                    const r = 3 - phase * 1.5;
                    ctx.fillStyle = rainbowColors[i % rainbowColors.length];
                    ctx.globalAlpha = alpha;
                    ctx.beginPath();
                    ctx.arc(px, py, r, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
                break;
            }
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

        // Player level display from progression system
        const prog = this.progression;

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Level ${prog.level}`, CANVAS_WIDTH / 2, 95);

        // XP bar
        const xpBarW = 200, xpBarH = 10;
        const xpBarX = CANVAS_WIDTH / 2 - xpBarW / 2;
        const xpBarY = 102;
        ctx.fillStyle = '#222';
        ctx.fillRect(xpBarX, xpBarY, xpBarW, xpBarH);
        const grad = ctx.createLinearGradient(xpBarX, xpBarY, xpBarX + xpBarW, xpBarY);
        grad.addColorStop(0, '#FFC800');
        grad.addColorStop(1, '#FFE680');
        ctx.fillStyle = grad;
        ctx.fillRect(xpBarX, xpBarY, xpBarW * prog.xpProgress(), xpBarH);
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(xpBarX, xpBarY, xpBarW, xpBarH);

        // XP text
        let xpInLevel = prog.xp;
        let lvl = 1;
        while (lvl < prog.level) { xpInLevel -= prog.xpForLevel(lvl); lvl++; }
        ctx.fillStyle = '#AAA';
        ctx.font = '11px Arial';
        ctx.fillText(`${Math.floor(xpInLevel)} / ${prog.xpToNextLevel()} XP`, CANVAS_WIDTH / 2, xpBarY + xpBarH + 14);

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
        this.medkits = spawnMedkits(MEDKIT_SPAWN_COUNT, WORLD_WIDTH, WORLD_HEIGHT);
        this.medkitRespawnTimer = MEDKIT_RESPAWN_TIME;
        this.crates = createCrates();
        this.player.medkits = 0;

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
        this.player.updateEmote(dt);
        this._updateEmoteWheel();

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

        // Medkit collection (player walks over to pick up)
        for (const m of this.medkits) {
            if (m.collected) continue;
            m.update(dt);
            if (distance(this.player.x, this.player.y, m.x, m.y) < MEDKIT_COLLECT_RADIUS) {
                m.collected = true;
                this.player.medkits = (this.player.medkits || 0) + 1;
                this.hud.notify('+1 Medkit (' + this.player.medkits + ' total)', '#FF6666', 1.5);
                if (this.music.playSfx) this.music.playSfx('pickup');
            }
        }
        // Medkit respawn
        this.medkitRespawnTimer -= dt;
        if (this.medkitRespawnTimer <= 0) {
            this.medkitRespawnTimer = MEDKIT_RESPAWN_TIME;
            for (let i = 0; i < 3; i++) {
                this.medkits.push(new MedkitPickup(
                    randomRange(60, WORLD_WIDTH - 60),
                    randomRange(60, WORLD_HEIGHT - 60)
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

        // Check downed teammate revive
        // Find a downed-but-revivable Blue teammate within reach.
        if ((this.player.medkits || 0) > 0 && !this.player.interactTarget) {
            for (const e of this.entities) {
                if (e.isPlayer || e.team !== TEAMS.BLUE) continue;
                if (e.alive) continue;
                if (e.deathTimer <= 0) continue; // already fully dead
                if (distance(this.player.x, this.player.y, e.x, e.y) > MEDKIT_REVIVE_RADIUS) continue;
                this.player.interactPrompt = 'Press E to Revive Teammate (' + this.player.medkits + ' medkit' + (this.player.medkits === 1 ? '' : 's') + ')';
                this.player.interactTarget = e; // entity is the target
                break;
            }
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
            } else if (this.player.interactTarget && typeof this.player.interactTarget === 'object' && this.player.interactTarget.team === TEAMS.BLUE) {
                // Revive a downed teammate
                const t = this.player.interactTarget;
                if (!t.alive && t.deathTimer > 0 && (this.player.medkits || 0) > 0) {
                    t.alive = true;
                    t.health = MEDKIT_REVIVE_HEALTH;
                    t.deathTimer = 0;
                    this.player.medkits--;
                    this.hud.notify('Revived teammate!', '#44FF66', 2);
                    if (this.music.playSfx) this.music.playSfx('pickup');
                    // Spawn green heal sparkles
                    for (let i = 0; i < 12; i++) {
                        const a = Math.random() * Math.PI * 2;
                        const sp = 40 + Math.random() * 40;
                        this.particles.push({
                            x: t.x, y: t.y - 10,
                            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
                            life: 0.8, maxLife: 0.8, size: 3, color: '#44FF66', alive: true,
                            update(dt) {
                                this.x += this.vx * dt;
                                this.y += this.vy * dt;
                                this.vy += 90 * dt;
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
                // Storm just appeared — radius smaller than world diagonal
                // so edges of the map are immediately dangerous
                s.active = true;
                s.radius = 1800;
                this.hud.notify('The storm is closing in!', '#AA44FF', 3);
            }

            if (!s.shrinking) {
                s.phase++;
                if (s.phase > STORM_CONFIG.shrinkPhases) return; // at min size, done shrinking

                // Calculate target radius for this phase
                const startR = 1800;
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

        // Iso-projected ellipse dimensions so visual storm edge matches world damage boundary.
        // A world circle of radius r maps to a screen ellipse with semi-axes (r*√2, r/√2).
        const screenRX = s.radius * Math.SQRT2;
        const screenRY = s.radius / Math.SQRT2;

        // Draw full-screen storm overlay with circle cut-out
        ctx.fillStyle = 'rgba(80, 30, 120, 0.35)';

        // Use composite operation to create the mask
        ctx.beginPath();
        ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        // Cut out the safe zone (ellipse for iso view)
        ctx.moveTo(center.x + screenRX, center.y);
        ctx.ellipse(center.x, center.y, screenRX, screenRY, 0, 0, Math.PI * 2, true); // counter-clockwise to cut
        ctx.fill('evenodd');

        // Storm edge glow (pulsing)
        const pulse = 0.4 + Math.sin(this.gameTime * 3) * 0.15;
        ctx.strokeStyle = `rgba(160, 80, 220, ${pulse})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, screenRX, screenRY, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Inner edge (brighter)
        ctx.strokeStyle = `rgba(200, 120, 255, ${pulse * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, screenRX - 3, screenRY - 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Lightning-like particles at the edge
        ctx.strokeStyle = `rgba(220, 180, 255, ${pulse * 0.5})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 + this.gameTime * 0.5;
            const ex = center.x + Math.cos(a) * screenRX;
            const ey = center.y + Math.sin(a) * screenRY;
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

        // Medkits
        if (this.medkits) {
            for (const m of this.medkits) {
                if (!m.collected) m.draw(ctx, this.camera);
            }
        }

        // Downed teammate "REVIVE" prompt above their head
        for (const e of this.entities) {
            if (e.isPlayer || e.team !== TEAMS.BLUE) continue;
            if (e.alive || e.deathTimer <= 0) continue;
            if (!this.camera.isVisible(e.x, e.y, 30)) continue;
            const pos = this.camera.worldToScreen(e.x, e.y);
            // Pulsing red cross marker so you can spot a downed friend
            const pulse = 0.5 + 0.5 * Math.sin(this.gameTime * 4);
            ctx.fillStyle = `rgba(255, 80, 80, ${0.55 + 0.25 * pulse})`;
            ctx.fillRect(pos.x - 1.5, pos.y - 38, 3, 12);
            ctx.fillRect(pos.x - 6, pos.y - 33, 12, 3);
            // Time-left ring (pie chart)
            const lifePct = e.deathTimer / e.deathMaxTimer;
            ctx.strokeStyle = `rgba(255, 200, 200, ${0.5 * pulse + 0.3})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y - 30, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lifePct);
            ctx.stroke();
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

        // Emote bubble above player (drawn under HUD so it doesn't cover bars)
        this._drawPlayerEmote(ctx, this.camera);

        // HUD
        this.hud.draw(ctx, this.player, this.blueAlive, this.redAlive, this.player.interactPrompt, this.input);

        // Emote button (top-right under minimap)
        this._drawEmoteButton(ctx);

        // Emote wheel (full overlay, on top of everything)
        this._drawEmoteWheel(ctx);

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
            if (!this.bossDefeated) {
                // First frame after death: award sticks/XP, spawn pickup
                this.bossDefeated = true;
                this.player.sticks += 50;
                this.player.addXP(XP_PER_BOSS);
                this.hud.notify('Luca defeated! Pick up the Web Bow!', '#CC44CC', 3);
                this.bossPickup = new WeaponPickup(CAVE_WIDTH / 2, CAVE_HEIGHT / 2, 'WEB_BOW');
            }
            this._handleBossPickup('bossPickup', () => this.exitCave());
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
            if (!this.ghostDefeated) {
                this.ghostDefeated = true;
                this.player.sticks += 50;
                this.player.addXP(XP_PER_BOSS);
                this.hud.notify('James defeated! Pick up the Ghost Sword!', '#88CCFF', 3);
                this.ghostPickup = new WeaponPickup(HAUNTED_WIDTH / 2, HAUNTED_HEIGHT / 2, 'GHOST_SWORD');
            }
            this._handleBossPickup('ghostPickup', () => this.exitHauntedHouse());
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

        // Weapon pickup
        if (this.ghostPickup && !this.ghostPickup.collected) this.ghostPickup.draw(ctx, cam);

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
        this._drawFleeButton(ctx);

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
            if (!this.crabDefeated) {
                this.crabDefeated = true;
                this.player.sticks += 50;
                this.player.addXP(XP_PER_BOSS);
                this.hud.notify('Charlie defeated! Pick up the Sand Sword!', '#E8C070', 3);
                this.crabPickup = new WeaponPickup(SAND_CASTLE_WIDTH / 2, SAND_CASTLE_HEIGHT / 2, 'SAND_SWORD');
            }
            this._handleBossPickup('crabPickup', () => this.exitSandCastle());
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

        // Weapon pickup
        if (this.crabPickup && !this.crabPickup.collected) this.crabPickup.draw(ctx, cam);

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
        this._drawFleeButton(ctx);

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
            if (!this.polarDefeated) {
                this.polarDefeated = true;
                this.player.sticks += 50;
                this.player.addXP(XP_PER_BOSS);
                this.hud.notify('Tommy defeated! Pick up the Ice Bow!', '#66DDFF', 3);
                this.polarPickup = new WeaponPickup(ICE_CASTLE_WIDTH / 2, ICE_CASTLE_HEIGHT / 2, 'ICE_BOW');
            }
            this._handleBossPickup('polarPickup', () => this.exitIceCastle());
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

        // Weapon pickup
        if (this.polarPickup && !this.polarPickup.collected) this.polarPickup.draw(ctx, cam);

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
        this._drawFleeButton(ctx);

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
            if (!this.lavaDefeated) {
                this.lavaDefeated = true;
                this.player.sticks += 50;
                this.player.addXP(XP_PER_BOSS);
                this.hud.notify('Paddy defeated! Pick up the Lava Sword!', '#FF4400', 3);
                this.lavaPickup = new WeaponPickup(VOLCANO_LAIR_WIDTH / 2, VOLCANO_LAIR_HEIGHT / 2, 'LAVA_SWORD');
            }
            this._handleBossPickup('lavaPickup', () => this.exitVolcanoLair());
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

        // Weapon pickup
        if (this.lavaPickup && !this.lavaPickup.collected) this.lavaPickup.draw(ctx, cam);

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
        this._drawFleeButton(ctx);

        if (this.hud.notificationTimer > 0) {
            ctx.globalAlpha = Math.min(1, this.hud.notificationTimer);
            ctx.fillStyle = this.hud.notificationColor;
            ctx.font = 'bold 18px Arial';
            ctx.fillText(this.hud.notification, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);
            ctx.globalAlpha = 1;
        }
    }

    // ---------- Emote wheel ----------
    _updateEmoteWheel() {
        // Open with B key (toggle)
        if (this.input.isKeyDown('b')) {
            this.input.keys['b'] = false;
            this.emoteWheelOpen = !this.emoteWheelOpen;
        }
        if (!this.emoteWheelOpen) {
            this.emoteWheelHover = -1;
            return;
        }

        // Hit-test the radial wheel
        const cx = CANVAS_WIDTH / 2, cy = CANVAS_HEIGHT / 2;
        const innerR = 50, outerR = 130;
        const dx = this.input.mouseX - cx;
        const dy = this.input.mouseY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= innerR && dist <= outerR) {
            // Sectors: angle 0 = right, sweep clockwise
            let angle = Math.atan2(dy, dx);
            if (angle < 0) angle += Math.PI * 2;
            // Offset so first emote is at top
            angle = (angle + Math.PI / 2 + Math.PI / EMOTES.length) % (Math.PI * 2);
            this.emoteWheelHover = Math.floor(angle / (Math.PI * 2 / EMOTES.length));
        } else {
            this.emoteWheelHover = -1;
        }

        // Click on a sector → play emote and close. Click outside → close.
        if (this.input.consumeClick()) {
            if (this.emoteWheelHover >= 0) {
                this.player.playEmote(EMOTES[this.emoteWheelHover]);
            }
            this.emoteWheelOpen = false;
        }

        // ESC closes wheel
        if (this.input.isKeyDown('escape')) {
            this.input.keys['escape'] = false;
            this.emoteWheelOpen = false;
        }
    }

    _drawEmoteWheel(ctx) {
        if (!this.emoteWheelOpen) return;
        const cx = CANVAS_WIDTH / 2, cy = CANVAS_HEIGHT / 2;
        const innerR = 50, outerR = 130;

        // Dim background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Wheel ring
        ctx.fillStyle = 'rgba(20, 20, 40, 0.9)';
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
        ctx.fill('evenodd');
        ctx.strokeStyle = '#4488FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();

        // Sector dividers + emotes
        const n = EMOTES.length;
        const sectorAngle = Math.PI * 2 / n;
        for (let i = 0; i < n; i++) {
            // Sector angle (i=0 at top, going clockwise)
            const startAngle = -Math.PI / 2 + i * sectorAngle - sectorAngle / 2;
            const endAngle = startAngle + sectorAngle;
            const midAngle = (startAngle + endAngle) / 2;

            // Highlight hovered sector
            if (this.emoteWheelHover === i) {
                ctx.fillStyle = 'rgba(68, 136, 255, 0.35)';
                ctx.beginPath();
                ctx.arc(cx, cy, outerR, startAngle, endAngle);
                ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
                ctx.closePath();
                ctx.fill();
            }

            // Divider line
            ctx.strokeStyle = 'rgba(200, 200, 220, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(startAngle) * innerR, cy + Math.sin(startAngle) * innerR);
            ctx.lineTo(cx + Math.cos(startAngle) * outerR, cy + Math.sin(startAngle) * outerR);
            ctx.stroke();

            // Emote icon
            const ex = cx + Math.cos(midAngle) * (innerR + outerR) / 2;
            const ey = cy + Math.sin(midAngle) * (innerR + outerR) / 2;
            const e = EMOTES[i];
            ctx.fillStyle = e.color;
            ctx.font = 'bold 30px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(e.emoji, ex, ey - 10);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 11px Arial';
            ctx.fillText(e.label, ex, ey + 18);
        }

        // Center hint
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EMOTES', cx, cy - 6);
        ctx.fillStyle = '#AAA';
        ctx.font = '10px Arial';
        ctx.fillText('B / ESC to close', cx, cy + 8);
    }

    // Floating emote button — clickable on mobile or desktop
    _drawEmoteButton(ctx) {
        const bw = 44, bh = 44;
        const bx = CANVAS_WIDTH - bw - 12;
        const by = 200;
        const mx = this.input.mouseX, my = this.input.mouseY;
        const hover = mx > bx && mx < bx + bw && my > by && my < by + bh;

        ctx.fillStyle = this.emoteWheelOpen ? '#4488FF' : (hover ? '#3a3a5a' : 'rgba(20, 20, 40, 0.7)');
        ctx.beginPath();
        ctx.arc(bx + bw / 2, by + bh / 2, bw / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#88AAFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('😀', bx + bw / 2, by + bh / 2);

        // 'B' hint badge (desktop)
        if (!this.touch.active) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(bx + bw - 12, by - 4, 16, 14);
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 9px Arial';
            ctx.fillText('B', bx + bw - 4, by + 3);
        }

        // Open the wheel when clicked. Don't consume — wheel logic handles further clicks.
        if (hover && this.input.mouseClicked && !this.emoteWheelOpen) {
            this.input.mouseClicked = false;
            this.emoteWheelOpen = true;
        }
    }

    // Draw emote bubble above player (called during render)
    _drawPlayerEmote(ctx, camera) {
        const p = this.player;
        if (!p || !p.alive || !p.emote) return;
        const t = EMOTE_DURATION - p.emoteTimer; // elapsed time
        const lifePct = p.emoteTimer / EMOTE_DURATION; // 1 → 0
        const screen = camera.worldToScreen(p.x, p.y);
        let bx = screen.x;
        let by = screen.y - 56;

        // Animation modifiers
        let scale = 1, rotate = 0, dripY = 0;
        switch (p.emote.anim) {
            case 'bounce': by -= Math.abs(Math.sin(t * 6)) * 6; break;
            case 'shake': bx += Math.sin(t * 30) * 3; break;
            case 'pop': scale = 1 + Math.max(0, Math.sin(t * 10)) * 0.15; break;
            case 'pulse': scale = 1 + Math.sin(t * 5) * 0.15; break;
            case 'drip': dripY = (Math.sin(t * 4) * 4) + 2; break;
            case 'wiggle': rotate = Math.sin(t * 8) * 0.3; break;
        }

        // Fade in/out
        const fadeIn = Math.min(1, t * 4);
        const fadeOut = Math.min(1, lifePct * 2.5);
        const alpha = Math.min(fadeIn, fadeOut);

        // Bubble background
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(bx, by);
        ctx.rotate(rotate);
        ctx.scale(scale, scale);

        const bubW = 56, bubH = 44;
        // Tail
        ctx.fillStyle = 'rgba(20, 20, 40, 0.92)';
        ctx.beginPath();
        ctx.moveTo(-6, bubH / 2 - 1);
        ctx.lineTo(0, bubH / 2 + 10);
        ctx.lineTo(6, bubH / 2 - 1);
        ctx.closePath();
        ctx.fill();
        // Rounded rect
        ctx.beginPath();
        const r = 10;
        ctx.moveTo(-bubW / 2 + r, -bubH / 2);
        ctx.arcTo(bubW / 2, -bubH / 2, bubW / 2, bubH / 2, r);
        ctx.arcTo(bubW / 2, bubH / 2, -bubW / 2, bubH / 2, r);
        ctx.arcTo(-bubW / 2, bubH / 2, -bubW / 2, -bubH / 2, r);
        ctx.arcTo(-bubW / 2, -bubH / 2, bubW / 2, -bubH / 2, r);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = p.emote.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Emote icon
        ctx.fillStyle = p.emote.color;
        ctx.font = 'bold 26px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emote.emoji, 0, dripY);

        ctx.restore();
    }

    // Per-frame boss pickup handling: update bob, check pickup collision, auto-exit on collect.
    _handleBossPickup(field, exitFn) {
        const pickup = this[field];
        if (!pickup || pickup.collected) return;
        const dt = this._lastDt || 0.016;
        pickup.update(dt);
        // Collision with player (slight grace so walk-over feels reliable)
        const dx = this.player.x - pickup.x;
        const dy = this.player.y - pickup.y;
        if (dx * dx + dy * dy < pickup.radius * pickup.radius + 400) {
            // Don't collect until spawn animation has played briefly
            if (pickup.spawnTimer >= 0.3) {
                pickup.collected = true;
                this.player.addWeapon(pickup.weaponKey);
                // Auto-select the new weapon
                this.player.switchToSlot(this.player.inventory.length - 1);
                this.hud.notify(`Got ${pickup.def.name}!`, pickup.def.color, 3);
                // Exit after a short delay so the pickup notification is visible
                setTimeout(() => exitFn(), 400);
            }
        }
    }

    // Flee/exit button visible during boss fights. Tapping/clicking triggers ESC key.
    _drawFleeButton(ctx) {
        const bx = CANVAS_WIDTH - 110;
        const by = 12;
        const bw = 94;
        const bh = 32;

        const mx = this.input.mouseX, my = this.input.mouseY;
        const hover = mx > bx && mx < bx + bw && my > by && my < by + bh;

        // Mouse click on button acts as ESC
        if (hover && this.input.mouseClicked) {
            this.input.mouseClicked = false;
            this.input.keys['escape'] = true;
        }

        ctx.fillStyle = hover ? 'rgba(180, 50, 50, 0.9)' : 'rgba(120, 30, 30, 0.8)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#FF6666';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✖ FLEE', bx + bw / 2, by + bh / 2);
        ctx.textBaseline = 'alphabetic';
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

        // Weapon pickup
        if (this.bossPickup && !this.bossPickup.collected) this.bossPickup.draw(ctx, cam);

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
        this._drawFleeButton(ctx);

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
        this.renderMenuButton(ctx);
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
        this.renderMenuButton(ctx);
        this.renderBackToEvanbbButton(ctx);
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
        const mx = this.input.mouseX, my = this.input.mouseY;
        const hover = mx > bx && mx < bx + 160 && my > by && my < by + 40;

        ctx.fillStyle = hover ? '#5599FF' : '#4488FF';
        ctx.fillRect(bx, by, 160, 40);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Play Again', CANVAS_WIDTH / 2, by + 27);

        // Only consume click if it landed on this button, so other buttons still see theirs
        if (hover && this.input.mouseClicked) {
            this.input.mouseClicked = false;
            this.initBattle('WOODEN_SWORD');
        }
    }

    renderMenuButton(ctx) {
        const bw = 160, bh = 36;
        const bx = CANVAS_WIDTH / 2 - bw / 2;
        const by = CANVAS_HEIGHT / 2 + 205;
        const mx = this.input.mouseX, my = this.input.mouseY;
        const hover = mx > bx && mx < bx + bw && my > by && my < by + bh;

        ctx.fillStyle = hover ? '#5a4aaa' : '#3a2a88';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#8866CC';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🏠 Main Menu', CANVAS_WIDTH / 2, by + 23);

        if (this.input.mouseClicked && hover) {
            this.input.mouseClicked = false;
            this.state = 'MENU';
            this._matchXPAwarded = false;
        }
    }

    renderBackToEvanbbButton(ctx) {
        const bw = 200, bh = 36;
        const bx = CANVAS_WIDTH / 2 - bw / 2;
        const by = CANVAS_HEIGHT / 2 + 255;
        ctx.fillStyle = '#2a2a4a';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#4488FF';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('← Back to evanbb.com', CANVAS_WIDTH / 2, by + 22);

        // Peek click state; only consume if this button was hit, so replay can still handle its own clicks.
        if (this.input.mouseClicked) {
            const mx = this.input.mouseX;
            const my = this.input.mouseY;
            if (mx > bx && mx < bx + bw && my > by && my < by + bh) {
                this.input.mouseClicked = false;
                window.location.href = 'https://evanbb.com';
            }
        }
    }

    // ==================== 1V1 ONLINE LOBBY ====================

    openMPLobby() {
        this.state = 'MP_LOBBY';
        this.mpStatus = 'Searching for an opponent...';
        this.mpStatusColor = '#FFD700';
        this.mpLobbyMode = 'searching';
        this.mpSearchStart = performance.now();
        if (this.mp) this.mp.leave();
        if (this.lobby) this.lobby.leaveLobby().catch(() => {});
        this.mp = null;
        this._findMatchFlow();
    }

    _bindMPHandlers() {
        const mp = this.mp;
        mp.on('connected', () => {
            // Both ends ready — start the fight
            mp.send('hello', { name: 'Player', weapon: 'WOODEN_SWORD' });
        });
        mp.on('msg:hello', () => {
            // We've heard from opponent — begin the match
            this._startMPFight();
        });
        mp.on('msg:state', (m) => {
            this.mpOpponentTarget = m;
            if (!this.mpOpponent) this.mpOpponent = { ...m };
        });
        mp.on('msg:damage', (m) => {
            // Opponent's attack hit us — apply damage locally
            if (this.player && this.player.alive) {
                this.player.health = Math.max(0, this.player.health - m.amount);
                spawnHitParticles(this.mpParticles, this.player.x, this.player.y, '#FF4444', 6);
                this.mpParticles.push(new DamageNumber(this.player.x, this.player.y - 10, m.amount, '#FF4444'));
                if (this.player.health <= 0) {
                    this._killSelf();
                }
            }
        });
        mp.on('msg:emote', (m) => {
            const e = EMOTES.find(e => e.key === m.key);
            if (e && this.mpOpponent) {
                this.mpOpponent.emote = e;
                this.mpOpponent.emoteTimer = EMOTE_DURATION;
            }
        });
        mp.on('msg:drop', (m) => {
            // Host announces a new center weapon drop. Guest mirrors it.
            if (this.mp && this.mp.role === 'host') return;
            if (!m || !m.id || !m.weaponKey) return;
            this.mpDrops.push({ id: m.id, weaponKey: m.weaponKey, x: m.x, y: m.y, spawnT: 0 });
        });
        mp.on('msg:pickup', (m) => {
            // The other side claimed a drop — remove it from our list (no-op if already gone).
            if (!m || !m.id) return;
            this.mpDrops = this.mpDrops.filter(d => d.id !== m.id);
        });
        mp.on('msg:win', (m) => {
            // Opponent reports they died (or that we lost). If we already saw it locally,
            // do nothing. Otherwise, treat it as authoritative.
            if (this.state !== 'MP_FIGHT' || this._mpPendingResult) return;
            // 'winner' is the role of whoever won. If we're the winner, kill opponent.
            if (m.winner && m.winner === this.mp.role) {
                this._killOpponent();
            } else {
                this._killSelf();
            }
        });
        mp.on('disconnected', () => {
            if (this.state === 'MP_FIGHT' && !this.mpResult) {
                this._endMPFight('win', 'Opponent disconnected');
            } else if (this.state === 'MP_LOBBY') {
                this.mpStatus = 'Connection lost';
                this.mpStatusColor = '#FF6666';
                this.mpLobbyMode = 'failed';
            }
        });
        mp.on('error', (err) => {
            console.warn('mp error', err);
        });
    }

    async _findMatchFlow() {
        if (typeof Peer === 'undefined') {
            this.mpStatus = 'Multiplayer library failed to load. Check your connection.';
            this.mpStatusColor = '#FF6666';
            this.mpLobbyMode = 'failed';
            return;
        }
        if (typeof firebase === 'undefined') {
            this.mpStatus = 'Matchmaking service failed to load.';
            this.mpStatusColor = '#FF6666';
            this.mpLobbyMode = 'failed';
            return;
        }

        // Capture the lobby and mp instances we create on this run so we can
        // detect the user pressing Cancel mid-flow.
        const lobby = this.lobby = new LobbyClient();
        const mp = this.mp = new MultiplayerClient();
        this._bindMPHandlers();

        const cancelled = () => this.lobby !== lobby || this.mp !== mp;

        try {
            const match = await lobby.findMatch('pending-' + Math.random().toString(36).slice(2, 10));
            if (cancelled()) return;

            if (match.role === 'guest') {
                // Opponent is already hosting — connect to them.
                this.mpStatus = 'Opponent found! Connecting...';
                this.mpStatusColor = '#44FF66';
                await mp.connectToPeer(match.opponentPeerId);
                if (cancelled()) return;
                // The lobby slot was already cleared by the transaction.
            } else {
                // We're the host. Register on the broker, publish our peerId
                // to the lobby slot so a guest can find us, then wait.
                const ourId = await mp.hostPeer();
                if (cancelled()) return;
                // Republish — the lobby placeholder we wrote during findMatch
                // used a temp id, swap it for the real PeerJS id.
                await firebase.database().ref('lobby/waiting').set({ peerId: ourId, ts: Date.now() });
                this.mpStatus = 'Waiting for an opponent to join...';
                this.mpStatusColor = '#FFD700';
                // From here, the 'connected' event handler picks up the incoming guest.
            }
        } catch (e) {
            if (cancelled()) return;
            console.warn('matchmaking failed', e);
            this.mpStatus = (e && e.message) || 'Matchmaking failed';
            this.mpStatusColor = '#FF6666';
            this.mpLobbyMode = 'failed';
            try { await lobby.leaveLobby(); } catch (_) {}
            if (mp) mp.leave();
        }
    }

    _cancelMatchmaking() {
        if (this.lobby) this.lobby.leaveLobby().catch(() => {});
        if (this.mp) this.mp.leave();
        this.lobby = null;
        this.mp = null;
        this.state = 'MENU';
    }

    updateMPLobby(dt) {
        if (this.input.isKeyDown('escape')) {
            this.input.keys['escape'] = false;
            this._cancelMatchmaking();
            return;
        }

        // Click handling
        if (!this.input.consumeClick()) return;
        const mx = this.input.mouseX, my = this.input.mouseY;

        // Back button (top-left)
        if (mx > 20 && mx < 120 && my > 20 && my < 56) {
            this._cancelMatchmaking();
            return;
        }

        // Cancel button (centered) — works whether searching or showing failure
        const cx = CANVAS_WIDTH / 2 - 80, cy = 540;
        if (mx > cx && mx < cx + 160 && my > cy && my < cy + 40) {
            if (this.mpLobbyMode === 'failed') {
                // Retry from a failure state
                this.openMPLobby();
            } else {
                this._cancelMatchmaking();
            }
            return;
        }
    }

    renderMPLobby() {
        const ctx = this.ctx;
        ctx.fillStyle = '#1a0a0a';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Back button
        const mx = this.input.mouseX, my = this.input.mouseY;
        const backHover = mx > 20 && mx < 120 && my > 20 && my < 56;
        ctx.fillStyle = backHover ? '#3a3a5a' : '#2a2a4a';
        ctx.fillRect(20, 20, 100, 36);
        ctx.strokeStyle = '#4488FF';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, 100, 36);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('← Back', 70, 42);

        // Title
        ctx.fillStyle = '#FF8866';
        ctx.font = 'bold 44px Arial';
        ctx.fillText('⚔️  1V1 ONLINE  ⚔️', CANVAS_WIDTH / 2, 100);
        ctx.fillStyle = '#AAA';
        ctx.font = '14px Arial';
        ctx.fillText('Win a 1v1 match for +' + MP_WIN_XP + ' XP', CANVAS_WIDTH / 2, 130);

        // Big animated spinner / status ring
        const cx = CANVAS_WIDTH / 2, cy = 340;
        const t = (performance.now() - (this.mpSearchStart || 0)) / 1000;

        if (this.mpLobbyMode === 'searching') {
            // Pulsing crossed-swords animation
            ctx.save();
            ctx.translate(cx, cy);
            const pulse = 1 + Math.sin(t * 3) * 0.05;
            ctx.scale(pulse, pulse);
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 80px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⚔️', 0, 30);
            ctx.restore();

            // Rotating dots ring around it
            ctx.save();
            ctx.translate(cx, cy);
            for (let i = 0; i < 8; i++) {
                const a = (t * 1.5 + i / 8) * Math.PI * 2;
                const r = 90;
                const alpha = 0.3 + 0.7 * ((Math.sin(t * 4 - i * 0.5) + 1) / 2);
                ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 6, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // Status text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 22px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.mpStatus || 'Searching for an opponent...', cx, cy + 140);

            // Elapsed time
            ctx.fillStyle = '#888';
            ctx.font = '14px Arial';
            ctx.fillText(`${Math.floor(t)}s elapsed`, cx, cy + 168);
        }

        if (this.mpLobbyMode === 'failed') {
            ctx.fillStyle = '#FF6666';
            ctx.font = 'bold 60px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⚠️', cx, cy + 20);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 22px Arial';
            ctx.fillText(this.mpStatus || 'Matchmaking failed', cx, cy + 80);
        }

        // Cancel / Retry button
        const bx = CANVAS_WIDTH / 2 - 80, by = 540;
        const bHover = mx > bx && mx < bx + 160 && my > by && my < by + 40;
        ctx.fillStyle = bHover ? '#5a3a3a' : '#3a2a2a';
        ctx.fillRect(bx, by, 160, 40);
        ctx.strokeStyle = '#FF6666';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, 160, 40);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.mpLobbyMode === 'failed' ? 'Retry' : 'Cancel', cx, by + 26);
    }

    // ==================== 1V1 FIGHT ====================

    _startMPFight() {
        this.state = 'MP_FIGHT';
        this.music.play('boss');
        // Match started — release our lobby slot so the next player
        // looking for a game doesn't try to connect to us.
        if (this.lobby) {
            this.lobby.leaveLobby().catch(() => {});
        }
        this.mpResult = null;
        this._mpPendingResult = null;
        this._mpPendingResultDelay = 0;
        this._mpXPAwarded = false;
        this.mpProjectiles = [];
        this.mpParticles = [];
        this.mpOpponent = null;
        this.mpOpponentTarget = null;
        this.mpSendTimer = 0;

        // Center weapon drops. Host owns spawning; both sides handle pickups.
        this.mpDrops = [];
        this._mpDropIdCounter = 1;
        this._mpDropTimer = MP_DROP_FIRST_DELAY;

        // Set up player at one end of arena
        const isHost = this.mp.role === 'host';
        const startX = isHost ? 100 : MP_ARENA_WIDTH - 100;
        const startY = MP_ARENA_HEIGHT / 2;

        // Reset/create the player entity
        if (!this.player) {
            this.player = new Player(startX, startY);
        }
        this.player.x = startX;
        this.player.y = startY;
        this.player.health = 100;
        this.player.maxHealth = 100;
        this.player.alive = true;
        this.player.kills = 0;
        this.player.sticks = 0;
        this.player.inventory = [];
        this.player.activeSlot = 0;
        this.player.weapon = null;
        this.player.addWeapon('WOODEN_SWORD');

        // Build a fake "entities" array used by the player's weapon for hit detection.
        // Slot 0 is the player; slot 1 is a stub representing the opponent.
        this._mpOppStub = {
            x: 0, y: 0, vx: 0, vy: 0, radius: 12, alive: true, health: 100, maxHealth: 100,
            facing: 0, walkTimer: 0, attackAnim: 0, moveFacing: 0,
            deathTimer: 0, deathMaxTimer: 1.8, fallDir: 1,
            isPlayer: false, team: TEAMS.RED, isMPOpponent: true,
            takeDamage: (amount, attacker) => {
                if (!this._mpOppStub.alive) return;
                this.mp.send('damage', { amount });
                spawnHitParticles(this.mpParticles, this._mpOppStub.x, this._mpOppStub.y, '#FFAA44', 5);
                this.mpParticles.push(new DamageNumber(this._mpOppStub.x, this._mpOppStub.y - 10, amount, '#FFAA44'));
                this._mpOppStub.health = Math.max(0, this._mpOppStub.health - amount);
                if (this._mpOppStub.health <= 0) this._killOpponent();
            },
            update: () => {}
        };
        this._mpPlayerDeathTimer = 0;
        this.mpEntities = [this.player, this._mpOppStub];

        this._mpCamera = this._makeRoomCamera(MP_ARENA_WIDTH, MP_ARENA_HEIGHT);
    }

    // Mark the opponent as dying (start death animation locally) and queue the result.
    _killOpponent() {
        if (!this._mpOppStub.alive || this._mpPendingResult) return;
        this._mpOppStub.alive = false;
        this._mpOppStub.deathTimer = 1.8;
        this._mpOppStub.deathMaxTimer = 1.8;
        this._mpOppStub.fallDir = (this._mpOppStub.x >= this.player.x) ? 1 : -1;
        this._mpPendingResult = 'win';
        this._mpPendingResultDelay = 1.5; // wait for animation before showing screen
        // Tell opponent we won (their stick should die)
        if (this.mp) this.mp.send('win', { winner: this.mp.role });
        if (this.progression && !this._mpXPAwarded) {
            this._mpXPAwarded = true;
            this.progression.addXP(MP_WIN_XP);
            this.progression.save();
        }
    }

    _killSelf() {
        if (!this.player.alive || this._mpPendingResult) return;
        this.player.alive = false;
        this.player.deathTimer = 1.8;
        this.player.deathMaxTimer = 1.8;
        this.player.fallDir = this.mpOpponent ? ((this.player.x >= this.mpOpponent.x) ? 1 : -1) : 1;
        this._mpPendingResult = 'lose';
        this._mpPendingResultDelay = 1.5;
    }

    _drawMPPillar(ctx, cam, wx, wy) {
        const base = cam.worldToScreen(wx, wy);
        const top = { x: base.x, y: base.y - 64 };
        // Shadow on the sand
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(base.x + 6, base.y + 4, 18, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Column shaft (warm stone, lighter on the lit side)
        const grad = ctx.createLinearGradient(top.x - 12, 0, top.x + 12, 0);
        grad.addColorStop(0, '#9b7f4f');
        grad.addColorStop(0.5, '#e0c585');
        grad.addColorStop(1, '#7a5e34');
        ctx.fillStyle = grad;
        ctx.fillRect(top.x - 12, top.y, 24, 64);
        // Vertical fluting lines for depth
        ctx.strokeStyle = 'rgba(70, 50, 20, 0.35)';
        ctx.lineWidth = 1;
        for (let i = -8; i <= 8; i += 4) {
            ctx.beginPath();
            ctx.moveTo(top.x + i, top.y + 2);
            ctx.lineTo(top.x + i, top.y + 62);
            ctx.stroke();
        }
        // Capital + base (lighter limestone)
        ctx.fillStyle = '#d4b884';
        ctx.fillRect(top.x - 16, top.y - 8, 32, 9);
        ctx.fillStyle = '#a88a52';
        ctx.fillRect(top.x - 15, base.y - 5, 30, 6);
        // Highlight stripe
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(top.x - 9, top.y + 2, 3, 58);

        // Torch on top — flickering flame
        const flick = 0.75 + 0.25 * Math.sin(this.gameTime * 18 + wx);
        ctx.fillStyle = `rgba(255, 140, 30, ${0.7 * flick})`;
        ctx.beginPath();
        ctx.arc(top.x, top.y - 16, 9 * flick, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 220, 100, ${0.95 * flick})`;
        ctx.beginPath();
        ctx.arc(top.x, top.y - 16, 4, 0, Math.PI * 2);
        ctx.fill();
        // Warm glow puddle on the sand
        ctx.fillStyle = `rgba(255, 160, 60, ${0.10 * flick})`;
        ctx.beginPath();
        ctx.arc(base.x, base.y, 28, 0, Math.PI * 2);
        ctx.fill();
    }

    // Render a center weapon drop in iso. The marker pulses + bobs.
    _drawMPDrop(ctx, cam, drop) {
        const wpn = WEAPON_DEFS[drop.weaponKey];
        if (!wpn) return;
        const pos = cam.worldToScreen(drop.x, drop.y);
        const t = drop.spawnT || 0;
        const bob = Math.sin(t * 4) * 4;
        const glowR = 22 + Math.sin(t * 3) * 4;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 4, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glow halo
        const glow = ctx.createRadialGradient(pos.x, pos.y - 8 + bob, 2, pos.x, pos.y - 8 + bob, glowR);
        glow.addColorStop(0, 'rgba(255, 230, 100, 0.55)');
        glow.addColorStop(1, 'rgba(255, 230, 100, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - 8 + bob, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Weapon icon (simple stylized: line for melee, line + tip for ranged)
        ctx.save();
        ctx.translate(pos.x, pos.y - 8 + bob);
        ctx.rotate(Math.sin(t * 2) * 0.15 - Math.PI / 4);
        if (wpn.type === 'ranged') {
            // Bow-style arc
            ctx.strokeStyle = wpn.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 12, -Math.PI * 0.4, Math.PI * 0.4);
            ctx.stroke();
            // String
            ctx.strokeStyle = '#EEE';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(11, -10);
            ctx.lineTo(11, 10);
            ctx.stroke();
        } else {
            // Sword: blade + crossguard + grip
            ctx.strokeStyle = wpn.color;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-10, 10);
            ctx.lineTo(14, -14);
            ctx.stroke();
            ctx.strokeStyle = '#5a3a1a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-12, 12);
            ctx.lineTo(-4, 4);
            ctx.stroke();
            // Crossguard
            ctx.strokeStyle = '#caa040';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(4, 8);
            ctx.stroke();
        }
        ctx.restore();

        // Weapon name label above
        if (t < 1.2) {
            const a = Math.min(1, t * 2);
            ctx.globalAlpha = a;
            ctx.fillStyle = '#FFD700';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.strokeText(wpn.name, pos.x, pos.y - 28 + bob);
            ctx.fillText(wpn.name, pos.x, pos.y - 28 + bob);
            ctx.globalAlpha = 1;
        }
    }

    // Host-only: pick a random weapon and a random spot in the central
    // band of the arena, push to local list, return the drop.
    _spawnMPDrop() {
        const w = MP_WEAPON_DROP_POOL[Math.floor(Math.random() * MP_WEAPON_DROP_POOL.length)];
        const bandW = MP_ARENA_WIDTH * MP_DROP_CENTER_FRAC;
        const x = MP_ARENA_WIDTH / 2 + (Math.random() - 0.5) * bandW;
        const y = 80 + Math.random() * (MP_ARENA_HEIGHT - 160);
        const drop = { id: this._mpDropIdCounter++, weaponKey: w, x, y, spawnT: 0 };
        this.mpDrops.push(drop);
        return drop;
    }

    // Local player walked over a drop — claim it: equip the weapon, tell the
    // other side, and remove from our list. Idempotent over the network: if
    // both players claim simultaneously, both equip; the duplicate 'pickup'
    // messages are no-ops.
    _claimMPDrop(drop) {
        // Replace current weapon (single-slot inventory in MP).
        this.player.inventory = [];
        this.player.activeSlot = 0;
        this.player.weapon = null;
        this.player.addWeapon(drop.weaponKey);
        spawnHitParticles(this.mpParticles, drop.x, drop.y, '#FFD700', 12);
        // Pickup label as a short-lived particle (reuses the floating-text update from particles.js).
        this.mpParticles.push(new MPPickupLabel(drop.x, drop.y - 14, WEAPON_DEFS[drop.weaponKey].name));
        this.mpDrops = this.mpDrops.filter(d => d.id !== drop.id);
        if (this.mp) this.mp.send('pickup', { id: drop.id });
    }

    _endMPFight(result, customMsg) {
        if (this.mpResult) return;
        this.mpResult = result;
        this.mpResultMsg = customMsg;
        // If we're winning by forfeit (opponent left etc.), award XP if we haven't already.
        if (result === 'win' && !this._mpXPAwarded) {
            this._mpXPAwarded = true;
            if (this.progression) {
                this.progression.addXP(MP_WIN_XP);
                this.progression.save();
            }
            if (this.mp && this.mp.connected) this.mp.send('win', { winner: this.mp.role });
        }
        this.state = 'MP_RESULT';
    }

    updateMPFight(dt) {
        if (!this.mp || !this.mp.connected) {
            this._endMPFight('win', 'Opponent left');
            return;
        }

        // If a death has been triggered, tick down its animation, then show result.
        if (this._mpPendingResult) {
            if (this._mpOppStub.deathTimer > 0) this._mpOppStub.deathTimer -= dt;
            if (this.player.deathTimer > 0) this.player.deathTimer -= dt;
            for (const p of this.mpParticles) p.update(dt);
            this.mpParticles = this.mpParticles.filter(p => p.alive || (p.life !== undefined && p.life > 0));
            this._mpPendingResultDelay -= dt;
            if (this._mpPendingResultDelay <= 0) {
                this._endMPFight(this._mpPendingResult);
            }
            return;
        }

        const cam = this._mpCamera;
        const input = this.input;
        const touchSprint = this.touch.active && this.touch.sprintPressed;

        // Player movement (iso-style like other interior fights). Mirrors
        // player.update() including the R-key sprint with stamina drain so
        // 1v1 has the same feel as the PvE mode.
        let mx = 0, my = 0;
        if (input.isKeyDown('w') || input.isKeyDown('arrowup'))    { mx -= 1; my -= 1; }
        if (input.isKeyDown('s') || input.isKeyDown('arrowdown'))  { mx += 1; my += 1; }
        if (input.isKeyDown('a') || input.isKeyDown('arrowleft'))  { mx -= 1; my += 1; }
        if (input.isKeyDown('d') || input.isKeyDown('arrowright')) { mx += 1; my -= 1; }
        const mLen = Math.sqrt(mx * mx + my * my);
        if (mLen > 0) { mx /= mLen; my /= mLen; }

        // Sprint: R key on desktop, sprint button on mobile.
        const moving = (Math.abs(mx) > 0 || Math.abs(my) > 0);
        const wantsSprint = (input.isKeyDown('r') || touchSprint) && moving;
        let speedMod = 1.0;
        if (wantsSprint && !this.player.staminaExhausted && this.player.stamina > 0) {
            this.player.sprinting = true;
            this.player.stamina -= this.player.staminaDrain * dt;
            if (this.player.stamina <= 0) {
                this.player.stamina = 0;
                this.player.staminaExhausted = true;
                this.player.sprinting = false;
            }
            speedMod = 1.6;
        } else {
            this.player.sprinting = false;
            this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + this.player.staminaRegen * dt);
            if (this.player.staminaExhausted && this.player.stamina >= this.player.maxStamina * 0.3) {
                this.player.staminaExhausted = false;
            }
        }

        this.player.vx = mx * this.player.speed * speedMod;
        this.player.vy = my * this.player.speed * speedMod;
        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;
        this.player.x = clamp(this.player.x, 30, MP_ARENA_WIDTH - 30);
        this.player.y = clamp(this.player.y, 30, MP_ARENA_HEIGHT - 30);
        if (Math.abs(this.player.vx) > 1 || Math.abs(this.player.vy) > 1) {
            this.player.moveFacing = Math.atan2(this.player.vy, this.player.vx);
            this.player.walkTimer += dt;
        }

        // Aim
        const worldMouse = cam.screenToWorld(input.mouseX, input.mouseY);
        this.player.facing = angleBetween(this.player.x, this.player.y, worldMouse.x, worldMouse.y);

        // Interpolate opponent stub toward latest network state
        if (this.mpOpponentTarget) {
            const t = this.mpOpponent || (this.mpOpponent = { ...this.mpOpponentTarget });
            const prevX = t.x;
            const prevY = t.y;
            const lerpAmt = Math.min(1, dt * 12);
            t.x = lerp(t.x ?? this.mpOpponentTarget.x, this.mpOpponentTarget.x, lerpAmt);
            t.y = lerp(t.y ?? this.mpOpponentTarget.y, this.mpOpponentTarget.y, lerpAmt);
            t.facing = this.mpOpponentTarget.facing;
            t.hp = this.mpOpponentTarget.hp;
            t.weapon = this.mpOpponentTarget.weapon || t.weapon;
            // Derive velocity from interpolated position so the walk cycle
            // animates without needing the sender to ship vx/vy.
            if (dt > 0 && prevX !== undefined && prevY !== undefined) {
                t.vx = (t.x - prevX) / dt;
                t.vy = (t.y - prevY) / dt;
            } else {
                t.vx = 0; t.vy = 0;
            }
            const speed = Math.sqrt(t.vx * t.vx + t.vy * t.vy);
            if (speed > 5) {
                t.moveFacing = Math.atan2(t.vy, t.vx);
                t.walkTimer = (t.walkTimer || 0) + dt;
            }
            // Update stub for hit detection
            this._mpOppStub.x = t.x;
            this._mpOppStub.y = t.y;
            this._mpOppStub.alive = t.hp > 0;
            this._mpOppStub.health = t.hp;
        }

        // Opponent emote timer countdown
        if (this.mpOpponent && this.mpOpponent.emoteTimer > 0) {
            this.mpOpponent.emoteTimer -= dt;
            if (this.mpOpponent.emoteTimer <= 0) this.mpOpponent.emote = null;
        }

        // Attack
        if (this.player.weapon && (input.mouseDown || input.isKeyDown(' '))) {
            this.player.weapon.attack(this.player, this.mpEntities, this.mpProjectiles, this.mpParticles);
        }
        for (const wpn of this.player.inventory) wpn.update(dt);
        if (this.player.attackAnim > 0) { this.player.attackAnim -= dt * 4; if (this.player.attackAnim < 0) this.player.attackAnim = 0; }
        this.player.updateEmote(dt);
        this._updateEmoteWheel();

        // Send our state at MP_STATE_HZ
        this.mpSendTimer += dt;
        const sendInterval = 1 / MP_STATE_HZ;
        if (this.mpSendTimer >= sendInterval) {
            this.mpSendTimer = 0;
            this.mp.send('state', {
                x: this.player.x, y: this.player.y,
                facing: this.player.facing,
                hp: this.player.health,
                attack: this.player.attackAnim > 0,
                weapon: this.player.weapon ? this.player.weapon.key : 'WOODEN_SWORD',
                ts: Date.now()
            });
        }

        // Send emote when player plays one (forward to opponent once)
        if (this.player.emote && !this.player._lastSentEmote) {
            this.mp.send('emote', { key: this.player.emote.key });
            this.player._lastSentEmote = this.player.emote.key;
        }
        if (!this.player.emote) this.player._lastSentEmote = null;

        // ---- Center weapon drops ----
        // Host owns the spawn schedule; it broadcasts drops, guest just mirrors.
        if (this.mp.role === 'host' && this.player.alive) {
            this._mpDropTimer -= dt;
            if (this._mpDropTimer <= 0 && this.mpDrops.length < MP_DROP_MAX_COUNT) {
                const drop = this._spawnMPDrop();
                this.mp.send('drop', { id: drop.id, weaponKey: drop.weaponKey, x: drop.x, y: drop.y });
                this._mpDropTimer = MP_DROP_INTERVAL;
            }
        }
        // Animate drops + check pickup distance for our local player.
        for (const d of this.mpDrops) d.spawnT = (d.spawnT || 0) + dt;
        if (this.player.alive && this.mpDrops.length > 0) {
            for (const d of this.mpDrops.slice()) {
                const dx = d.x - this.player.x;
                const dy = d.y - this.player.y;
                if (dx * dx + dy * dy <= MP_DROP_PICKUP_RADIUS * MP_DROP_PICKUP_RADIUS) {
                    this._claimMPDrop(d);
                }
            }
        }

        // Update projectiles
        for (const proj of this.mpProjectiles) {
            proj.update(dt);
            if (proj.team === TEAMS.BLUE && this._mpOppStub.alive) {
                if (circleCollision(proj.x, proj.y, proj.radius, this._mpOppStub.x, this._mpOppStub.y, this._mpOppStub.radius + 10)) {
                    this._mpOppStub.takeDamage(proj.damage, this.player);
                    proj.alive = false;
                }
            }
        }
        this.mpProjectiles = this.mpProjectiles.filter(p => p.alive);

        for (const p of this.mpParticles) p.update(dt);
        this.mpParticles = this.mpParticles.filter(p => p.alive || (p.life !== undefined && p.life > 0));

        // ESC to flee → counts as a loss (opponent wins by default)
        if (input.isKeyDown('escape')) {
            input.keys['escape'] = false;
            this._endMPFight('lose', 'You fled');
        }

        // (Death handled via _killSelf / _killOpponent — see top of update.)
    }

    renderMPFight() {
        const ctx = this.ctx;
        const cam = this._mpCamera;
        if (!cam) return;

        // ---- Sunset sky behind the coliseum ----
        const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        bg.addColorStop(0, '#3a2840');
        bg.addColorStop(0.45, '#7a3a3a');
        bg.addColorStop(1, '#3a2424');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // ---- Stadium tiers (concentric warm-stone rings) ----
        const scx = CANVAS_WIDTH / 2;
        const scy = CANVAS_HEIGHT / 2;
        const tiers = [
            { rx: 760, ry: 540, color: '#6e4622' },
            { rx: 700, ry: 490, color: '#84502a' },
            { rx: 640, ry: 440, color: '#9c5e34' },
            { rx: 580, ry: 390, color: '#b67442' },
            { rx: 520, ry: 340, color: '#c8854a' }
        ];
        for (const t of tiers) {
            ctx.fillStyle = t.color;
            ctx.beginPath();
            ctx.ellipse(scx, scy, t.rx, t.ry, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // ---- Crowd dots in the upper rim, gently bobbing ----
        const time = this.gameTime || 0;
        for (let i = 0; i < 90; i++) {
            const angle = (i / 90) * Math.PI * 2;
            const tier = tiers[1 + (i % 3)];
            const r = tier.rx + 14;
            const ry = tier.ry + 10;
            const px = scx + Math.cos(angle) * r;
            const py = scy + Math.sin(angle) * ry - 6;
            // Skip dots in front of the arena (they'd cover the floor)
            if (py > scy + 220) continue;
            const bob = Math.sin(time * 4 + i * 0.7) * 1.5;
            ctx.fillStyle = ['#FFD700', '#FF6644', '#44CCFF', '#FFFFFF', '#88FF88'][i % 5];
            ctx.fillRect(px, py + bob, 3, 4);
        }

        // ---- Arena floor (sandy radial gradient) ----
        const corners = [
            cam.worldToScreen(0, 0),
            cam.worldToScreen(MP_ARENA_WIDTH, 0),
            cam.worldToScreen(MP_ARENA_WIDTH, MP_ARENA_HEIGHT),
            cam.worldToScreen(0, MP_ARENA_HEIGHT)
        ];
        const sandGrad = ctx.createRadialGradient(scx, scy, 60, scx, scy, 520);
        sandGrad.addColorStop(0, '#e7c178');
        sandGrad.addColorStop(0.7, '#c8a058');
        sandGrad.addColorStop(1, '#a07a3a');
        ctx.fillStyle = sandGrad;
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        ctx.fill();

        // Tile grid: alternating shades for stone-floor texture.
        const tile = 100;
        const cols = Math.ceil(MP_ARENA_WIDTH / tile);
        const rows = Math.ceil(MP_ARENA_HEIGHT / tile);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        ctx.clip();
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if ((r + c) % 2 !== 0) continue;
                const tc = [
                    cam.worldToScreen(c * tile, r * tile),
                    cam.worldToScreen((c + 1) * tile, r * tile),
                    cam.worldToScreen((c + 1) * tile, (r + 1) * tile),
                    cam.worldToScreen(c * tile, (r + 1) * tile)
                ];
                ctx.fillStyle = 'rgba(120, 80, 30, 0.25)';
                ctx.beginPath();
                ctx.moveTo(tc[0].x, tc[0].y);
                ctx.lineTo(tc[1].x, tc[1].y);
                ctx.lineTo(tc[2].x, tc[2].y);
                ctx.lineTo(tc[3].x, tc[3].y);
                ctx.closePath();
                ctx.fill();
            }
        }
        // Subtle grid lines
        ctx.strokeStyle = 'rgba(80, 50, 15, 0.15)';
        ctx.lineWidth = 1;
        for (let c = 0; c <= cols; c++) {
            const a = cam.worldToScreen(c * tile, 0);
            const b = cam.worldToScreen(c * tile, MP_ARENA_HEIGHT);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        for (let r = 0; r <= rows; r++) {
            const a = cam.worldToScreen(0, r * tile);
            const b = cam.worldToScreen(MP_ARENA_WIDTH, r * tile);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }

        // Centre pad — three concentric glowing rings telegraph the drop zone.
        const cwx = MP_ARENA_WIDTH / 2;
        const cwy = MP_ARENA_HEIGHT / 2;
        const pulse = 0.5 + 0.5 * Math.sin(this.gameTime * 1.6);
        for (let i = 3; i >= 1; i--) {
            const r = i * 80;
            const alpha = 0.10 + (i === 1 ? pulse * 0.18 : 0);
            ctx.strokeStyle = `rgba(255, 215, 80, ${alpha})`;
            ctx.lineWidth = i === 1 ? 3 : 2;
            ctx.beginPath();
            // Approximate iso circle as a diamond ellipse.
            const center = cam.worldToScreen(cwx, cwy);
            ctx.ellipse(center.x, center.y, r, r * 0.5, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        // Center marker emblem
        {
            const center = cam.worldToScreen(cwx, cwy);
            ctx.fillStyle = `rgba(255, 215, 80, ${0.10 + pulse * 0.10})`;
            ctx.beginPath();
            ctx.ellipse(center.x, center.y, 22, 11, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Decorative pillars at the four corners (offset slightly inside the wall).
        this._drawMPPillar(ctx, cam, 60, 60);
        this._drawMPPillar(ctx, cam, MP_ARENA_WIDTH - 60, 60);
        this._drawMPPillar(ctx, cam, 60, MP_ARENA_HEIGHT - 60);
        this._drawMPPillar(ctx, cam, MP_ARENA_WIDTH - 60, MP_ARENA_HEIGHT - 60);

        // Wall outline — dark base + warm stone top stripe for depth
        ctx.strokeStyle = '#3a2210';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        ctx.stroke();
        ctx.strokeStyle = '#8a5e30';
        ctx.lineWidth = 3;
        ctx.stroke();

        // ---- Hanging banners along the back edge ----
        const banners = [
            { tx: 0.18, color: '#cc3322' },
            { tx: 0.50, color: '#dca838' },
            { tx: 0.82, color: '#3266bb' }
        ];
        for (const b of banners) {
            const bp = cam.worldToScreen(MP_ARENA_WIDTH * b.tx, 0);
            const top = bp.y - 110;
            ctx.fillStyle = b.color;
            ctx.fillRect(bp.x - 14, top, 28, 36);
            ctx.beginPath();
            ctx.moveTo(bp.x - 14, top + 36);
            ctx.lineTo(bp.x, top + 46);
            ctx.lineTo(bp.x + 14, top + 36);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(bp.x - 14, top + 30, 28, 2);
            ctx.strokeStyle = '#5a3a1a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(bp.x, top - 4);
            ctx.lineTo(bp.x, top + 46);
            ctx.stroke();
        }

        // Center weapon drops (under the fighters so they walk in front).
        for (const d of this.mpDrops) this._drawMPDrop(ctx, cam, d);

        // Opponent stickman (alive: regular draw; dying: death animation)
        if (this.mpOpponent) {
            const opp = {
                x: this._mpOppStub.x ?? this.mpOpponent.x,
                y: this._mpOppStub.y ?? this.mpOpponent.y,
                facing: this.mpOpponent.facing || 0,
                vx: this.mpOpponent.vx || 0,
                vy: this.mpOpponent.vy || 0,
                walkTimer: this.mpOpponent.walkTimer || 0,
                moveFacing: this.mpOpponent.moveFacing != null ? this.mpOpponent.moveFacing : this.mpOpponent.facing,
                attackAnim: this.mpOpponent.attack ? 0.5 : 0,
                health: this.mpOpponent.hp ?? 100, maxHealth: 100,
                alive: this._mpOppStub.alive, isPlayer: false, team: TEAMS.RED,
                emote: this.mpOpponent.emote, emoteTimer: this.mpOpponent.emoteTimer,
                deathTimer: this._mpOppStub.deathTimer,
                deathMaxTimer: this._mpOppStub.deathMaxTimer,
                fallDir: this._mpOppStub.fallDir,
                weapon: (() => {
                    const k = this.mpOpponent.weapon || 'WOODEN_SWORD';
                    const def = WEAPON_DEFS[k] || WEAPON_DEFS.WOODEN_SWORD;
                    return { key: k, color: def.color, type: def.type };
                })()
            };
            if (!opp.alive && opp.deathTimer > 0) {
                drawStickmanDeath(ctx, opp, cam);
            } else if (opp.alive) {
                drawStickman(ctx, opp, cam);
            }
        }

        // Player (alive: regular; dying: death animation)
        if (this.player.alive) {
            drawStickman(ctx, this.player, cam);
        } else if (this.player.deathTimer > 0) {
            drawStickmanDeath(ctx, this.player, cam);
        }

        // Projectiles & particles
        for (const proj of this.mpProjectiles) proj.draw(ctx, cam);
        for (const p of this.mpParticles) p.draw(ctx, cam);

        // Player's emote bubble (uses world camera, not regular camera)
        if (this.player.emote) {
            const bubblePos = cam.worldToScreen(this.player.x, this.player.y);
            this._drawEmoteBubbleAt(ctx, this.player.emote, this.player.emoteTimer, bubblePos.x, bubblePos.y - 56);
        }
        // Opponent's emote bubble
        if (this.mpOpponent && this.mpOpponent.emote && this.mpOpponent.emoteTimer > 0) {
            const op = cam.worldToScreen(this.mpOpponent.x, this.mpOpponent.y);
            this._drawEmoteBubbleAt(ctx, this.mpOpponent.emote, this.mpOpponent.emoteTimer, op.x, op.y - 56);
        }

        // Vignette
        const vig = ctx.createRadialGradient(
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.3,
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.7
        );
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Top HUD bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, 50);
        // My HP (left)
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('YOU', 20, 20);
        ctx.fillStyle = '#222';
        ctx.fillRect(20, 25, 200, 14);
        ctx.fillStyle = '#44CC44';
        ctx.fillRect(20, 25, 200 * (this.player.health / 100), 14);
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 25, 200, 14);
        // Opponent HP (right)
        ctx.fillStyle = '#FFF';
        ctx.textAlign = 'right';
        ctx.fillText('OPPONENT', CANVAS_WIDTH - 20, 20);
        ctx.fillStyle = '#222';
        ctx.fillRect(CANVAS_WIDTH - 220, 25, 200, 14);
        ctx.fillStyle = '#FF4444';
        const oppHp = this.mpOpponent ? Math.max(0, this.mpOpponent.hp || 0) : 100;
        ctx.fillRect(CANVAS_WIDTH - 220, 25, 200 * (oppHp / 100), 14);
        ctx.strokeStyle = '#FFF';
        ctx.strokeRect(CANVAS_WIDTH - 220, 25, 200, 14);

        // Center: match label
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('1V1 ONLINE', CANVAS_WIDTH / 2, 32);

        // Inventory + emote button still useful
        this.hud.drawInventoryBar(ctx, this.player, this.input);
        this._drawEmoteButton(ctx);
        this._drawEmoteWheel(ctx);

        // ESC hint
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '11px Arial';
        ctx.fillText('Press ESC to forfeit', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10);
    }

    _drawEmoteBubbleAt(ctx, emote, timer, bx, by) {
        // Smaller version of _drawPlayerEmote for arbitrary positions
        const t = EMOTE_DURATION - timer;
        const lifePct = timer / EMOTE_DURATION;
        const alpha = Math.min(Math.min(1, t * 4), Math.min(1, lifePct * 2.5));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(bx, by);
        const bubW = 50, bubH = 38;
        ctx.fillStyle = 'rgba(20, 20, 40, 0.92)';
        ctx.beginPath();
        ctx.moveTo(-6, bubH / 2 - 1);
        ctx.lineTo(0, bubH / 2 + 8);
        ctx.lineTo(6, bubH / 2 - 1);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        const r = 8;
        ctx.moveTo(-bubW / 2 + r, -bubH / 2);
        ctx.arcTo(bubW / 2, -bubH / 2, bubW / 2, bubH / 2, r);
        ctx.arcTo(bubW / 2, bubH / 2, -bubW / 2, bubH / 2, r);
        ctx.arcTo(-bubW / 2, bubH / 2, -bubW / 2, -bubH / 2, r);
        ctx.arcTo(-bubW / 2, -bubH / 2, bubW / 2, -bubH / 2, r);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = emote.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = emote.color;
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emote.emoji, 0, 0);
        ctx.restore();
    }

    updateMPResult(dt) {
        if (this.input.consumeClick()) {
            const mx = this.input.mouseX, my = this.input.mouseY;
            // Back to menu button
            if (mx > CANVAS_WIDTH / 2 - 90 && mx < CANVAS_WIDTH / 2 + 90 &&
                my > CANVAS_HEIGHT / 2 + 60 && my < CANVAS_HEIGHT / 2 + 100) {
                if (this.mp) this.mp.leave();
                this.mp = null;
                this.state = 'MENU';
            }
        }
        if (this.input.isKeyDown('escape')) {
            this.input.keys['escape'] = false;
            if (this.mp) this.mp.leave();
            this.mp = null;
            this.state = 'MENU';
        }
    }

    renderMPResult() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const won = this.mpResult === 'win';
        ctx.fillStyle = won ? '#44FF44' : '#FF4444';
        ctx.font = 'bold 64px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(won ? 'VICTORY!' : 'DEFEATED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px Arial';
        if (this.mpResultMsg) {
            ctx.fillText(this.mpResultMsg, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
        }
        if (won) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 22px Arial';
            ctx.fillText('+' + MP_WIN_XP + ' XP', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
        }

        // Back to menu button
        const bx = CANVAS_WIDTH / 2 - 90, by = CANVAS_HEIGHT / 2 + 60;
        const mx = this.input.mouseX, my = this.input.mouseY;
        const hover = mx > bx && mx < bx + 180 && my > by && my < by + 40;
        ctx.fillStyle = hover ? '#5599FF' : '#4488FF';
        ctx.fillRect(bx, by, 180, 40);
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, 180, 40);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🏠 Main Menu', CANVAS_WIDTH / 2, by + 26);
    }
}
