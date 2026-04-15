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
        let remaining = this.xp;
        let lvl = 1;
        while (lvl < this.level) {
            remaining -= this.xpForLevel(lvl);
            lvl++;
        }
        return remaining / this.xpForLevel(this.level);
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
        const barW = 160;
        const barH = 6;
        const bx = 20;
        const by = 75;

        // Level badge
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Lv.' + this.level, bx, by - 2);

        // XP bar background
        const barStartX = bx + 35;
        ctx.fillStyle = '#333';
        ctx.fillRect(barStartX, by - 8, barW, barH);

        // XP bar fill
        const pct = this.xpProgress();
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(barStartX, by - 8, barW * pct, barH);

        // XP bar border
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barStartX, by - 8, barW, barH);
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
        if (!trail || trail === 'none') return;
        if (!entity.alive) return;
        const isMoving = Math.abs(entity.vx || 0) > 5 || Math.abs(entity.vy || 0) > 5;
        if (!isMoving) return;

        const pos = camera.worldToScreen(entity.x, entity.y);
        ctx.save();

        switch (trail) {
            case 'dust':
                for (let i = 0; i < 2; i++) {
                    const ox = randomRange(-8, 8);
                    const oy = randomRange(8, 16);
                    ctx.globalAlpha = 0.25;
                    ctx.fillStyle = '#AA9977';
                    ctx.beginPath();
                    ctx.arc(pos.x + ox, pos.y + oy, randomRange(2, 4), 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'fire':
                for (let i = 0; i < 3; i++) {
                    const ox = randomRange(-6, 6);
                    const oy = randomRange(4, 14);
                    ctx.globalAlpha = 0.5;
                    ctx.fillStyle = ['#FF4400', '#FF8800', '#FFCC00'][i];
                    ctx.beginPath();
                    ctx.arc(pos.x + ox, pos.y + oy, randomRange(2, 5), 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'sparkle':
                for (let i = 0; i < 2; i++) {
                    const ox = randomRange(-10, 10);
                    const oy = randomRange(-5, 15);
                    ctx.globalAlpha = 0.7;
                    ctx.fillStyle = '#FFFFFF';
                    ctx.beginPath();
                    ctx.arc(pos.x + ox, pos.y + oy, randomRange(1, 3), 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'rainbow':
                const colors = ['#FF0000', '#FF7700', '#FFFF00', '#00FF00', '#0077FF', '#8800FF'];
                for (let i = 0; i < 3; i++) {
                    const ox = randomRange(-6, 6);
                    const oy = randomRange(5, 15);
                    ctx.globalAlpha = 0.5;
                    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                    ctx.beginPath();
                    ctx.arc(pos.x + ox, pos.y + oy, randomRange(2, 4), 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
        }
        ctx.restore();
    }
}
