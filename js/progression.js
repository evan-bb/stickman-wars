// ============================================
// Progression System - XP, Levels, Cosmetics
// ============================================

class ProgressionSystem {
    constructor() {
        this.xp = 0;
        this.level = 1;
        this.totalKills = 0;
        this.totalBossKills = 0;
        this.gamesPlayed = 0;
        this.bestKills = 0;

        // Equipped cosmetics
        this.equippedHat = 'none';
        this.equippedTrail = 'none';

        // Live trail particles (persistent, world-space)
        this._trailParticles = [];
        this._trailSpawnAccumulator = 0;

        // Level-up animation state
        this.levelUpTimer = 0;
        this.levelUpLevel = 0;
        this.newUnlocks = [];

        // Kill streak tracking (per match)
        this.killStreak = 0;
        this.killStreakTimer = 0;
        this.streakLabel = '';
        this.streakColor = '#FFF';
        this.streakDisplayTimer = 0;

        this.load();
    }

    xpForLevel(lvl) {
        return Math.floor(XP_BASE * Math.pow(XP_GROWTH, lvl - 1));
    }

    xpToNextLevel() {
        return this.xpForLevel(this.level);
    }

    xpProgress() {
        // At max level, bar is full
        if (this.level >= MAX_LEVEL) return 1;
        let remaining = this.xp;
        let lvl = 1;
        while (lvl < this.level) {
            remaining -= this.xpForLevel(lvl);
            lvl++;
        }
        const pct = remaining / this.xpForLevel(this.level);
        return Math.max(0, Math.min(1, pct));
    }

    addXP(amount) {
        this.xp += amount;
        // Check for level ups
        let xpNeeded = this.xpForLevel(this.level);
        let xpInLevel = this.xp;
        let lvl = 1;
        while (lvl < this.level) {
            xpInLevel -= this.xpForLevel(lvl);
            lvl++;
        }

        while (xpInLevel >= xpNeeded) {
            xpInLevel -= xpNeeded;
            this.level++;
            this.levelUpTimer = 3.0;
            this.levelUpLevel = this.level;

            // Check for new unlocks at this level
            const unlocks = LEVEL_UNLOCKS.filter(u => u.level === this.level);
            for (const u of unlocks) {
                this.newUnlocks.push(u);
            }

            xpNeeded = this.xpForLevel(this.level);
        }
    }

    calculateMatchXP(kills, bossKills, sticksCollected, survivalTime) {
        const killXP = kills * XP_PER_KILL;
        const bossXP = bossKills * XP_PER_BOSS;
        const stickXP = Math.floor(sticksCollected * XP_PER_STICK);
        const survivalXP = Math.floor(survivalTime * XP_PER_SURVIVAL_SEC);
        return { killXP, bossXP, stickXP, survivalXP, total: killXP + bossXP + stickXP + survivalXP };
    }

    registerKill() {
        this.killStreak++;
        this.killStreakTimer = 4.0; // reset streak timeout

        // Check for streak announcements
        for (let i = KILL_STREAKS.length - 1; i >= 0; i--) {
            if (this.killStreak === KILL_STREAKS[i].kills) {
                this.streakLabel = KILL_STREAKS[i].label;
                this.streakColor = KILL_STREAKS[i].color;
                this.streakDisplayTimer = 2.0;
                return KILL_STREAKS[i];
            }
        }
        return null;
    }

    resetStreak() {
        this.killStreak = 0;
    }

    updateTimers(dt) {
        if (this.levelUpTimer > 0) this.levelUpTimer -= dt;
        if (this.streakDisplayTimer > 0) this.streakDisplayTimer -= dt;
        if (this.killStreakTimer > 0) {
            this.killStreakTimer -= dt;
            if (this.killStreakTimer <= 0) {
                this.killStreak = 0;
            }
        }
    }

    getUnlockedHats() {
        return LEVEL_UNLOCKS.filter(u => u.type === 'hat' && u.level <= this.level);
    }

    getUnlockedTrails() {
        return LEVEL_UNLOCKS.filter(u => u.type === 'trail' && u.level <= this.level);
    }

    save() {
        const data = {
            xp: this.xp,
            level: this.level,
            totalKills: this.totalKills,
            totalBossKills: this.totalBossKills,
            gamesPlayed: this.gamesPlayed,
            bestKills: this.bestKills,
            equippedHat: this.equippedHat,
            equippedTrail: this.equippedTrail
        };
        try {
            localStorage.setItem('stickmanWarsProgress', JSON.stringify(data));
        } catch (e) {}
    }

    load() {
        try {
            const raw = localStorage.getItem('stickmanWarsProgress');
            if (!raw) return;
            const data = JSON.parse(raw);
            this.xp = data.xp || 0;
            this.level = data.level || 1;
            this.totalKills = data.totalKills || 0;
            this.totalBossKills = data.totalBossKills || 0;
            this.gamesPlayed = data.gamesPlayed || 0;
            this.bestKills = data.bestKills || 0;
            this.equippedHat = data.equippedHat || 'none';
            this.equippedTrail = data.equippedTrail || 'none';
        } catch (e) {}
    }

    drawLevelUpEffect(ctx) {
        if (this.levelUpTimer <= 0) return;

        const alpha = Math.min(1, this.levelUpTimer);
        const scale = 1 + (1 - Math.min(1, (3 - this.levelUpTimer) * 3)) * 0.5;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 140);
        ctx.scale(scale, scale);

        // Gold glow
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 20;

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 42px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LEVEL UP!', 0, 0);

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 28px Arial';
        ctx.fillText('Level ' + this.levelUpLevel, 0, 36);

        // Show new unlocks
        if (this.newUnlocks.length > 0 && this.levelUpTimer > 0.5) {
            ctx.fillStyle = '#44FF44';
            ctx.font = 'bold 16px Arial';
            let uy = 64;
            for (const u of this.newUnlocks) {
                ctx.fillText('Unlocked: ' + u.name + '!', 0, uy);
                uy += 22;
            }
        }

        ctx.restore();

        // Clear unlocks after display
        if (this.levelUpTimer < 0.3) {
            this.newUnlocks = [];
        }
    }

    drawStreakAnnouncement(ctx) {
        if (this.streakDisplayTimer <= 0) return;

        const alpha = Math.min(1, this.streakDisplayTimer);
        const scale = 1 + (1 - Math.min(1, (2 - this.streakDisplayTimer) * 4)) * 0.3;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);
        ctx.scale(scale, scale);

        ctx.shadowColor = this.streakColor;
        ctx.shadowBlur = 15;
        ctx.fillStyle = this.streakColor;
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.streakLabel, 0, 0);

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFF';
        ctx.font = '18px Arial';
        ctx.fillText(this.killStreak + ' kills', 0, 28);

        ctx.restore();
    }

    drawXPBar(ctx) {
        const barW = 140;
        const barH = 7;
        const bx = 20;
        const by = 78;

        // Level badge
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Lv ' + this.level, bx, by + 6);

        // XP bar
        const barStartX = bx + 36;
        ctx.fillStyle = 'rgba(40, 40, 40, 0.8)';
        ctx.fillRect(barStartX, by, barW, barH);

        const pct = this.xpProgress();
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(barStartX, by, barW * pct, barH);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barStartX, by, barW, barH);
    }

    drawHat(ctx, x, headY, hat) {
        if (!hat || hat === 'none') return;

        ctx.save();
        switch (hat) {
            case 'bandana':
                ctx.fillStyle = '#FF3333';
                ctx.fillRect(x - 7, headY - 4, 14, 4);
                // Knot tail
                ctx.beginPath();
                ctx.moveTo(x + 7, headY - 3);
                ctx.lineTo(x + 12, headY - 1);
                ctx.lineTo(x + 11, headY - 5);
                ctx.strokeStyle = '#FF3333';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                break;

            case 'crown':
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.moveTo(x - 7, headY - 3);
                ctx.lineTo(x - 7, headY - 10);
                ctx.lineTo(x - 4, headY - 7);
                ctx.lineTo(x, headY - 12);
                ctx.lineTo(x + 4, headY - 7);
                ctx.lineTo(x + 7, headY - 10);
                ctx.lineTo(x + 7, headY - 3);
                ctx.closePath();
                ctx.fill();
                // Gems
                ctx.fillStyle = '#FF0000';
                ctx.beginPath();
                ctx.arc(x, headY - 8, 1.5, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'pirate':
                ctx.fillStyle = '#222';
                // Brim
                ctx.fillRect(x - 10, headY - 4, 20, 3);
                // Top
                ctx.beginPath();
                ctx.moveTo(x - 8, headY - 4);
                ctx.lineTo(x - 5, headY - 14);
                ctx.lineTo(x + 5, headY - 14);
                ctx.lineTo(x + 8, headY - 4);
                ctx.closePath();
                ctx.fill();
                // Skull
                ctx.fillStyle = '#FFF';
                ctx.beginPath();
                ctx.arc(x, headY - 9, 2.5, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'wizard':
                ctx.fillStyle = '#6633CC';
                ctx.beginPath();
                ctx.moveTo(x, headY - 20);
                ctx.lineTo(x - 9, headY - 4);
                ctx.lineTo(x + 9, headY - 4);
                ctx.closePath();
                ctx.fill();
                // Star
                ctx.fillStyle = '#FFD700';
                ctx.font = '8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('*', x, headY - 9);
                break;

            case 'cat_ears':
                ctx.fillStyle = '#FFB6C1';
                // Left ear
                ctx.beginPath();
                ctx.moveTo(x - 6, headY - 3);
                ctx.lineTo(x - 8, headY - 12);
                ctx.lineTo(x - 1, headY - 5);
                ctx.closePath();
                ctx.fill();
                // Right ear
                ctx.beginPath();
                ctx.moveTo(x + 6, headY - 3);
                ctx.lineTo(x + 8, headY - 12);
                ctx.lineTo(x + 1, headY - 5);
                ctx.closePath();
                ctx.fill();
                // Inner ear
                ctx.fillStyle = '#FF69B4';
                ctx.beginPath();
                ctx.moveTo(x - 5, headY - 4);
                ctx.lineTo(x - 7, headY - 10);
                ctx.lineTo(x - 2, headY - 5);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(x + 5, headY - 4);
                ctx.lineTo(x + 7, headY - 10);
                ctx.lineTo(x + 2, headY - 5);
                ctx.closePath();
                ctx.fill();
                break;

            case 'halo':
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.ellipse(x, headY - 10, 8, 3, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
                break;
        }
        ctx.restore();
    }

    drawTrail(ctx, entity, camera) {
        const trail = this.equippedTrail;
        if (!trail || trail === 'none') {
            this._trailParticles.length = 0;
            return;
        }
        if (!entity.alive) return;

        const dt = (window.game && window.game._lastDt) || 0.016;
        const isMoving = Math.abs(entity.vx || 0) > 5 || Math.abs(entity.vy || 0) > 5;

        // ---- Spawn new particles ----
        if (isMoving) {
            // Spawn rate per second, deterministic via accumulator
            const spawnRate = trail === 'fire' ? 30 : trail === 'sparkle' ? 18 : 22;
            this._trailSpawnAccumulator += dt * spawnRate;
            const toSpawn = Math.floor(this._trailSpawnAccumulator);
            this._trailSpawnAccumulator -= toSpawn;

            for (let i = 0; i < toSpawn; i++) {
                this._trailParticles.push(this._spawnTrailParticle(trail, entity));
            }
        }

        // ---- Update particles ----
        for (const p of this._trailParticles) {
            p.age += dt;
            // Per-trail drift behavior
            if (trail === 'fire' || trail === 'sparkle') {
                p.y -= p.driftY * dt;          // floats up
            }
            p.x += p.driftX * dt;
            p.y += p.gravity * dt;             // settles down (dust/rainbow)
        }
        // Cull expired
        this._trailParticles = this._trailParticles.filter(p => p.age < p.life);

        // ---- Render: oldest first so newest appear on top ----
        ctx.save();
        for (const p of this._trailParticles) {
            if (!camera.isVisible(p.x, p.y, 30)) continue;
            const pos = camera.worldToScreen(p.x, p.y);
            const lifePct = p.age / p.life;
            const alpha = (1 - lifePct) * p.maxAlpha;
            const radius = p.r0 * (1 - lifePct * 0.6);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();

            if (p.sparkle) {
                ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.8})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(pos.x - 4, pos.y);
                ctx.lineTo(pos.x + 4, pos.y);
                ctx.moveTo(pos.x, pos.y - 4);
                ctx.lineTo(pos.x, pos.y + 4);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    _spawnTrailParticle(trail, entity) {
        const baseX = entity.x + randomRange(-4, 4);
        const baseY = entity.y + randomRange(2, 6);
        switch (trail) {
            case 'dust':
                return {
                    x: baseX, y: baseY,
                    driftX: randomRange(-4, 4), gravity: 4,
                    r0: randomRange(2.5, 4.5), color: randomFromArray(['#A89070', '#C4AA80', '#998060']),
                    age: 0, life: randomRange(0.45, 0.7), maxAlpha: 0.45, sparkle: false
                };
            case 'fire':
                return {
                    x: baseX, y: baseY,
                    driftX: randomRange(-3, 3), driftY: randomRange(20, 35), gravity: 0,
                    r0: randomRange(3, 5),
                    color: randomFromArray(['#FFEE66', '#FFB840', '#FF7733', '#FF3322']),
                    age: 0, life: randomRange(0.35, 0.55), maxAlpha: 0.85, sparkle: false
                };
            case 'sparkle':
                return {
                    x: baseX + randomRange(-6, 6), y: baseY + randomRange(-6, 6),
                    driftX: randomRange(-5, 5), driftY: randomRange(8, 18), gravity: 0,
                    r0: randomRange(1.2, 2.2), color: '#FFFFFF',
                    age: 0, life: randomRange(0.5, 0.9), maxAlpha: 0.95, sparkle: true
                };
            case 'rainbow': {
                const rainbow = ['#FF3333', '#FF8833', '#FFE633', '#33CC33', '#3399FF', '#9933CC'];
                return {
                    x: baseX, y: baseY,
                    driftX: randomRange(-4, 4), gravity: 6,
                    r0: randomRange(2.5, 4),
                    color: rainbow[Math.floor(Math.random() * rainbow.length)],
                    age: 0, life: randomRange(0.55, 0.85), maxAlpha: 0.85, sparkle: false
                };
            }
        }
    }
}
