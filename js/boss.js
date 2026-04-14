// ============================================
// Boss - Luca the Spider
// ============================================

class Boss extends Entity {
    constructor(x, y) {
        super(x, y, TEAMS.NEUTRAL);
        this.health = BOSS_CONFIG.health;
        this.maxHealth = BOSS_CONFIG.health;
        this.name = BOSS_CONFIG.name;
        this.speed = BOSS_CONFIG.speed;
        this.radius = 25;
        this.phase = 1;

        this.attackTimer = 2;
        this.currentAttack = 'idle';
        this.lungeTarget = null;
        this.lungeTimer = 0;
        this.webCooldown = 0;
        this.legPhase = 0;

        this.minions = [];
        this.minionSpawnTimer = 0;
        this.active = false;
    }

    activate() {
        this.active = true;
        this.attackTimer = 1.5;
    }

    update(dt, player, projectiles, particles) {
        if (!this.active || !this.alive) return;
        super.update(dt);

        this.legPhase += dt * 4;

        // Phase check
        if (this.health / this.maxHealth <= BOSS_CONFIG.phase2Threshold && this.phase === 1) {
            this.phase = 2;
            this.speed = BOSS_CONFIG.speed * 1.3;
        }

        // Face player
        if (player && player.alive) {
            this.facing = angleBetween(this.x, this.y, player.x, player.y);
        }

        // Attack timer
        this.attackTimer -= dt;
        this.webCooldown -= dt;

        if (this.currentAttack === 'lunge') {
            this.updateLunge(dt, player, particles);
            return;
        }

        if (this.attackTimer <= 0 && player && player.alive) {
            this.chooseAttack(player, projectiles, particles);
        }

        // Update minions
        for (const m of this.minions) {
            if (!m.alive) continue;
            this.updateMinion(m, dt, player, particles);
        }
        this.minions = this.minions.filter(m => m.alive || m.deathTimer > 0);

        // Minion spawning in phase 2
        if (this.phase === 2) {
            this.minionSpawnTimer -= dt;
            if (this.minionSpawnTimer <= 0 && this.minions.filter(m => m.alive).length < 4) {
                this.spawnMinion(particles);
                this.minionSpawnTimer = 5;
            }
        }
    }

    chooseAttack(player, projectiles, particles) {
        const dist = distance(this.x, this.y, player.x, player.y);
        const roll = Math.random();

        if (dist < 150 && roll < 0.5) {
            // Lunge
            this.currentAttack = 'lunge';
            this.lungeTarget = { x: player.x, y: player.y };
            this.lungeTimer = 0.4;
            this.attackTimer = this.phase === 2 ? 1.5 : 2.5;
        } else {
            // Web spit
            this.webSpit(player, projectiles);
            this.attackTimer = this.phase === 2 ? 1.2 : 2.0;
        }
    }

    updateLunge(dt, player, particles) {
        if (!this.lungeTarget) {
            this.currentAttack = 'idle';
            return;
        }

        this.lungeTimer -= dt;
        const angle = angleBetween(this.x, this.y, this.lungeTarget.x, this.lungeTarget.y);
        this.x += Math.cos(angle) * BOSS_CONFIG.lungeSpeed * dt;
        this.y += Math.sin(angle) * BOSS_CONFIG.lungeSpeed * dt;

        // Hit check
        if (player && player.alive) {
            if (distance(this.x, this.y, player.x, player.y) < this.radius + player.radius) {
                player.takeDamage(BOSS_CONFIG.damage, this);
                spawnHitParticles(particles, player.x, player.y, '#FF4444', 8);
                particles.push(new DamageNumber(player.x, player.y - 10, BOSS_CONFIG.damage, '#FF0000'));
                // Knockback
                const kb = 20;
                player.x += Math.cos(angle) * kb;
                player.y += Math.sin(angle) * kb;
            }
        }

        if (this.lungeTimer <= 0) {
            this.currentAttack = 'idle';
        }
    }

    webSpit(player, projectiles) {
        const angle = angleBetween(this.x, this.y, player.x, player.y);
        const webWeapon = {
            damage: 15,
            projectileSpeed: BOSS_CONFIG.webSpeed,
            color: '#CCCCCC',
            burn: false,
            pierce: false
        };
        projectiles.push(new Projectile(
            this.x + Math.cos(angle) * 30,
            this.y + Math.sin(angle) * 30,
            angle,
            webWeapon,
            TEAMS.NEUTRAL,
            this
        ));
        // Phase 2: fire 3 webs in a spread
        if (this.phase === 2) {
            projectiles.push(new Projectile(
                this.x, this.y, angle - 0.3, webWeapon, TEAMS.NEUTRAL, this
            ));
            projectiles.push(new Projectile(
                this.x, this.y, angle + 0.3, webWeapon, TEAMS.NEUTRAL, this
            ));
        }
    }

    spawnMinion(particles) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 60;
        const mx = this.x + Math.cos(angle) * dist;
        const my = this.y + Math.sin(angle) * dist;
        const minion = new Entity(mx, my, TEAMS.NEUTRAL);
        minion.health = 30;
        minion.maxHealth = 30;
        minion.speed = 80;
        minion.radius = 8;
        minion.weapon = new Weapon('WOODEN_SWORD');
        this.minions.push(minion);
        spawnHitParticles(particles, mx, my, '#AA44AA', 6);
    }

    updateMinion(minion, dt, player, particles) {
        if (!player || !player.alive) return;
        const dist = distance(minion.x, minion.y, player.x, player.y);
        minion.facing = angleBetween(minion.x, minion.y, player.x, player.y);

        if (dist > 30) {
            minion.x += Math.cos(minion.facing) * minion.speed * dt;
            minion.y += Math.sin(minion.facing) * minion.speed * dt;
            minion.vx = Math.cos(minion.facing) * minion.speed;
            minion.vy = Math.sin(minion.facing) * minion.speed;
        }

        if (dist < 35 && minion.weapon && minion.weapon.canAttack()) {
            player.takeDamage(8, minion);
            minion.weapon.cooldownTimer = 800;
            minion.attackAnim = 1;
            spawnHitParticles(particles, player.x, player.y, '#AA44AA', 3);
            particles.push(new DamageNumber(player.x, player.y - 10, 8, '#AA44AA'));
        }

        minion.update(dt);
    }

    draw(ctx, camera) {
        if (!this.alive && this.deathTimer <= 0) return;
        const pos = camera.worldToScreen(this.x, this.y);
        const { x, y } = pos;
        const isoFacing = worldAngleToIso(this.facing);

        if (!this.alive) {
            ctx.globalAlpha = clamp(this.deathTimer / 0.3, 0, 1);
        }

        ctx.save();

        // Legs (8)
        ctx.strokeStyle = '#2a1a0a';
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
            const side = i < 4 ? -1 : 1;
            const idx = i % 4;
            const baseAngle = (side === -1 ? Math.PI : 0) + (idx - 1.5) * 0.4;
            const legLen = 25;
            const joint = legLen * 0.5;
            const phase = Math.sin(this.legPhase + i * 0.8) * 0.3;

            const jx = x + Math.cos(baseAngle + phase) * joint;
            const jy = y + Math.sin(baseAngle + phase) * joint;
            const ex = jx + Math.cos(baseAngle + phase + 0.5) * joint;
            const ey = jy + Math.abs(Math.sin(baseAngle + phase + 0.5)) * joint;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(jx, jy);
            ctx.lineTo(ex, ey);
            ctx.stroke();
        }

        // Body
        ctx.fillStyle = '#1a0a00';
        ctx.beginPath();
        ctx.ellipse(x, y, 22, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a1500';
        ctx.beginPath();
        ctx.ellipse(x, y, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head (using iso-projected facing)
        ctx.fillStyle = '#1a0a00';
        ctx.beginPath();
        ctx.arc(x + Math.cos(isoFacing) * 18, y + Math.sin(isoFacing) * 18, 10, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        const eyeX = x + Math.cos(isoFacing) * 22;
        const eyeY = y + Math.sin(isoFacing) * 22;
        ctx.fillStyle = this.phase === 2 ? '#FF0000' : '#CC0000';
        ctx.beginPath();
        ctx.arc(eyeX - 4, eyeY - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eyeX + 4, eyeY - 3, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Health bar
        if (this.alive) {
            ctx.fillStyle = '#333';
            ctx.fillRect(x - 30, y - 35, 60, 6);
            const pct = this.health / this.maxHealth;
            ctx.fillStyle = pct > 0.5 ? '#CC44CC' : '#FF4444';
            ctx.fillRect(x - 30, y - 35, 60 * pct, 6);
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 1;
            ctx.strokeRect(x - 30, y - 35, 60, 6);

            // Name
            ctx.fillStyle = '#FF8800';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, x, y - 40);
            if (this.phase === 2) {
                ctx.fillStyle = '#FF0000';
                ctx.font = '10px Arial';
                ctx.fillText('ENRAGED', x, y - 50);
            }
        }

        // Draw minions
        for (const m of this.minions) {
            if (m.deathTimer <= 0 && !m.alive) continue;
            this.drawMinion(ctx, m, camera);
        }

        ctx.globalAlpha = 1;
    }

    drawMinion(ctx, minion, camera) {
        const pos = camera.worldToScreen(minion.x, minion.y);
        ctx.save();
        if (!minion.alive) {
            ctx.globalAlpha = clamp(minion.deathTimer / 0.3, 0, 1);
        }

        // Small spider
        ctx.fillStyle = '#330011';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.fill();

        // 4 legs
        ctx.strokeStyle = '#330011';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + this.legPhase;
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(pos.x + Math.cos(a) * 10, pos.y + Math.sin(a) * 10);
            ctx.stroke();
        }

        // Health
        if (minion.alive && minion.health < minion.maxHealth) {
            drawHealthBar(ctx, pos.x, pos.y - 12, 16, 2, minion.health / minion.maxHealth, '#AA44AA');
        }
        ctx.restore();
    }
}

// ============================================
// Ghost Boss - James the Ghost
// ============================================

class GhostBoss extends Entity {
    constructor(x, y) {
        super(x, y, TEAMS.NEUTRAL);
        this.health = GHOST_BOSS_CONFIG.health;
        this.maxHealth = GHOST_BOSS_CONFIG.health;
        this.name = GHOST_BOSS_CONFIG.name;
        this.speed = GHOST_BOSS_CONFIG.speed;
        this.radius = 20;
        this.phase = 1;

        this.attackTimer = 2;
        this.currentAttack = 'idle';
        this.teleportTimer = 0;
        this.teleportFade = 0; // 0 = visible, 1 = invisible
        this.teleportTarget = null;
        this.wailTimer = 0;
        this.wailRadius = 0;
        this.wailActive = false;
        this.floatPhase = Math.random() * Math.PI * 2;
        this.wispPhase = 0;
        this.flickerTimer = 0;

        this.active = false;
    }

    activate() {
        this.active = true;
        this.attackTimer = 1.5;
    }

    update(dt, player, projectiles, particles) {
        if (!this.active || !this.alive) return;
        super.update(dt);

        this.floatPhase += dt * 2.5;
        this.wispPhase += dt * 3;
        this.flickerTimer += dt;

        // Phase check
        if (this.health / this.maxHealth <= GHOST_BOSS_CONFIG.phase2Threshold && this.phase === 1) {
            this.phase = 2;
            this.speed = GHOST_BOSS_CONFIG.speed * 1.4;
            spawnHitParticles(particles, this.x, this.y, '#8844FF', 15);
        }

        // Face player
        if (player && player.alive) {
            this.facing = angleBetween(this.x, this.y, player.x, player.y);
        }

        // Teleport animation
        if (this.teleportFade > 0 && !this.teleportTarget) {
            this.teleportFade -= dt * 4;
            if (this.teleportFade < 0) this.teleportFade = 0;
        }

        // Handle teleport
        if (this.teleportTarget) {
            this.teleportFade += dt * 5;
            if (this.teleportFade >= 1) {
                this.x = this.teleportTarget.x;
                this.y = this.teleportTarget.y;
                this.teleportTarget = null;
                this.teleportFade = 1;
                spawnHitParticles(particles, this.x, this.y, '#88AAFF', 6);
            }
            return;
        }

        // Wail AoE update
        if (this.wailActive) {
            this.wailRadius += dt * 200;
            this.wailTimer -= dt;
            // Damage player if in range
            if (player && player.alive) {
                const dist = distance(this.x, this.y, player.x, player.y);
                if (Math.abs(dist - this.wailRadius) < 25) {
                    player.takeDamage(15 * dt, this);
                }
            }
            if (this.wailTimer <= 0) {
                this.wailActive = false;
                this.wailRadius = 0;
            }
            return;
        }

        this.attackTimer -= dt;
        this.teleportTimer -= dt;

        // Move toward player (floating)
        if (player && player.alive) {
            const dist = distance(this.x, this.y, player.x, player.y);
            if (dist > 80) {
                this.x += Math.cos(this.facing) * this.speed * dt;
                this.y += Math.sin(this.facing) * this.speed * dt;
                this.vx = Math.cos(this.facing) * this.speed;
                this.vy = Math.sin(this.facing) * this.speed;
            }
        }

        // Choose attack
        if (this.attackTimer <= 0 && player && player.alive) {
            this.chooseAttack(player, projectiles, particles);
        }
    }

    chooseAttack(player, projectiles, particles) {
        const dist = distance(this.x, this.y, player.x, player.y);
        const roll = Math.random();

        if (this.teleportTimer <= 0 && roll < 0.3) {
            // Teleport
            this.teleportTarget = {
                x: clamp(player.x + randomRange(-150, 150), 50, HAUNTED_WIDTH - 50),
                y: clamp(player.y + randomRange(-150, 150), 50, HAUNTED_HEIGHT - 50)
            };
            this.teleportTimer = this.phase === 2 ? 2.0 : 3.0;
            this.attackTimer = 0.8;
        } else if (this.phase === 2 && roll < 0.5 && !this.wailActive) {
            // Wail AoE (phase 2 only)
            this.wailActive = true;
            this.wailTimer = 0.8;
            this.wailRadius = 0;
            this.attackTimer = 2.0;
        } else {
            // Soul bolt
            this.soulBolt(player, projectiles);
            this.attackTimer = this.phase === 2 ? 1.0 : 1.8;
        }
    }

    soulBolt(player, projectiles) {
        const angle = angleBetween(this.x, this.y, player.x, player.y);
        const boltWeapon = {
            damage: GHOST_BOSS_CONFIG.damage,
            projectileSpeed: GHOST_BOSS_CONFIG.boltSpeed,
            color: '#88CCFF',
            burn: false,
            pierce: false
        };
        projectiles.push(new Projectile(
            this.x + Math.cos(angle) * 20,
            this.y + Math.sin(angle) * 20,
            angle, boltWeapon, TEAMS.NEUTRAL, this
        ));
        // Phase 2: fire spread
        if (this.phase === 2) {
            projectiles.push(new Projectile(
                this.x, this.y, angle - 0.25, boltWeapon, TEAMS.NEUTRAL, this
            ));
            projectiles.push(new Projectile(
                this.x, this.y, angle + 0.25, boltWeapon, TEAMS.NEUTRAL, this
            ));
        }
    }

    draw(ctx, camera) {
        if (!this.alive && this.deathTimer <= 0) return;
        const pos = camera.worldToScreen(this.x, this.y);
        const { x, y } = pos;
        const floatY = y + Math.sin(this.floatPhase) * 6;

        ctx.save();

        // Death dissolve
        if (!this.alive) {
            ctx.globalAlpha = clamp(this.deathTimer / 0.5, 0, 1);
        }

        // Teleport fade
        const alpha = 1 - this.teleportFade;
        ctx.globalAlpha *= alpha;

        // Phase 2 flicker
        if (this.phase === 2) {
            ctx.globalAlpha *= 0.7 + Math.sin(this.flickerTimer * 15) * 0.3;
        }

        // Trailing wisps
        ctx.strokeStyle = 'rgba(150, 200, 255, 0.15)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const wa = this.wispPhase + i * 1.3;
            const wx = x + Math.sin(wa) * 12;
            const wy = floatY + 10 + i * 4 + Math.cos(wa * 0.7) * 3;
            ctx.beginPath();
            ctx.moveTo(x + Math.sin(wa + 0.5) * 5, floatY + 5);
            ctx.quadraticCurveTo(wx, wy - 5, wx + Math.sin(wa) * 6, wy + 5);
            ctx.stroke();
        }

        // Ghost body (translucent flowing shape)
        const ghostGrad = ctx.createRadialGradient(x, floatY, 5, x, floatY, 28);
        ghostGrad.addColorStop(0, 'rgba(200, 220, 255, 0.6)');
        ghostGrad.addColorStop(0.6, 'rgba(150, 180, 255, 0.3)');
        ghostGrad.addColorStop(1, 'rgba(100, 140, 255, 0)');
        ctx.fillStyle = ghostGrad;
        ctx.beginPath();
        ctx.ellipse(x, floatY, 22, 28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner glow
        ctx.fillStyle = 'rgba(200, 230, 255, 0.35)';
        ctx.beginPath();
        ctx.ellipse(x, floatY - 4, 14, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wavy bottom edge (no legs — ghostly tail)
        ctx.fillStyle = 'rgba(150, 190, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(x - 16, floatY + 10);
        for (let i = 0; i <= 8; i++) {
            const t = (i / 8) * Math.PI * 2;
            const wx2 = x - 16 + i * 4;
            const wy2 = floatY + 14 + Math.sin(this.wispPhase * 2 + t) * 4;
            ctx.lineTo(wx2, wy2);
        }
        ctx.lineTo(x + 16, floatY + 10);
        ctx.closePath();
        ctx.fill();

        // Face area
        ctx.fillStyle = 'rgba(180, 210, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(x, floatY - 8, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (glowing)
        const eyeColor = this.phase === 2 ? '#FF4444' : '#44FF88';
        const eyeGlow = this.phase === 2 ? 'rgba(255, 50, 50, 0.6)' : 'rgba(50, 255, 100, 0.6)';
        ctx.shadowColor = eyeColor;
        ctx.shadowBlur = 8;
        ctx.fillStyle = eyeGlow;
        ctx.beginPath();
        ctx.arc(x - 5, floatY - 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 5, floatY - 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = eyeColor;
        ctx.beginPath();
        ctx.arc(x - 5, floatY - 10, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 5, floatY - 10, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Mouth (dark hollow)
        ctx.fillStyle = 'rgba(20, 20, 60, 0.5)';
        ctx.beginPath();
        ctx.ellipse(x, floatY - 2, 4, 3 + Math.sin(this.floatPhase * 3) * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Wail ring effect
        if (this.wailActive) {
            const wailAlpha = clamp(1 - this.wailRadius / GHOST_BOSS_CONFIG.wailRadius, 0, 0.6);
            ctx.strokeStyle = `rgba(180, 100, 255, ${wailAlpha})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(x, floatY, this.wailRadius * 0.8, 0, Math.PI * 2);
            ctx.stroke();
            // Inner ring
            ctx.strokeStyle = `rgba(220, 150, 255, ${wailAlpha * 0.5})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, floatY, this.wailRadius * 0.5, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Health bar
        if (this.alive) {
            ctx.fillStyle = '#333';
            ctx.fillRect(x - 30, floatY - 45, 60, 6);
            const pct = this.health / this.maxHealth;
            ctx.fillStyle = pct > 0.5 ? '#44AAFF' : '#FF4444';
            ctx.fillRect(x - 30, floatY - 45, 60 * pct, 6);
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 1;
            ctx.strokeRect(x - 30, floatY - 45, 60, 6);

            // Name
            ctx.fillStyle = '#88CCFF';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, x, floatY - 50);
            if (this.phase === 2) {
                ctx.fillStyle = '#FF4444';
                ctx.font = '10px Arial';
                ctx.fillText('FURIOUS', x, floatY - 60);
            }
        }
    }
}

// ============================================
// Crab Boss - Charlie the Crab
// ============================================

class CrabBoss extends Entity {
    constructor(x, y) {
        super(x, y, TEAMS.NEUTRAL);
        this.health = CRAB_BOSS_CONFIG.health;
        this.maxHealth = CRAB_BOSS_CONFIG.health;
        this.name = CRAB_BOSS_CONFIG.name;
        this.speed = CRAB_BOSS_CONFIG.speed;
        this.radius = 22;
        this.phase = 1;

        this.attackTimer = 2;
        this.currentAttack = 'idle';
        this.chargeTarget = null;
        this.chargeTimer = 0;
        this.chargeWindup = 0; // wind-up before charge
        this.bubbleCooldown = 0;
        this.legPhase = 0;
        this.clawSnap = 0; // claw animation
        this.shellShake = 0;

        this.active = false;
    }

    activate() {
        this.active = true;
        this.attackTimer = 1.5;
    }

    update(dt, player, projectiles, particles) {
        if (!this.active || !this.alive) return;
        super.update(dt);

        this.legPhase += dt * 5;
        if (this.clawSnap > 0) this.clawSnap -= dt * 3;
        if (this.shellShake > 0) this.shellShake -= dt * 4;

        // Phase check
        if (this.health / this.maxHealth <= CRAB_BOSS_CONFIG.phase2Threshold && this.phase === 1) {
            this.phase = 2;
            this.speed = CRAB_BOSS_CONFIG.speed * 1.4;
            this.shellShake = 2;
            spawnHitParticles(particles, this.x, this.y, '#FF6633', 15);
        }

        // Face player
        if (player && player.alive) {
            this.facing = angleBetween(this.x, this.y, player.x, player.y);
        }

        // Wind-up before charge
        if (this.chargeWindup > 0) {
            this.chargeWindup -= dt;
            this.shellShake = 0.5;
            if (this.chargeWindup <= 0) {
                this.currentAttack = 'charge';
                this.chargeTimer = 0.5;
                this.chargeTarget = player ? { x: player.x, y: player.y } : null;
            }
            return;
        }

        // Charging
        if (this.currentAttack === 'charge') {
            this.chargeTimer -= dt;
            if (this.chargeTarget) {
                const angle = angleBetween(this.x, this.y, this.chargeTarget.x, this.chargeTarget.y);
                this.x += Math.cos(angle) * CRAB_BOSS_CONFIG.chargeSpeed * dt;
                this.y += Math.sin(angle) * CRAB_BOSS_CONFIG.chargeSpeed * dt;
                this.vx = Math.cos(angle) * CRAB_BOSS_CONFIG.chargeSpeed;
                this.vy = Math.sin(angle) * CRAB_BOSS_CONFIG.chargeSpeed;
                // Clamp to arena
                this.x = clamp(this.x, 30, SAND_CASTLE_WIDTH - 30);
                this.y = clamp(this.y, 30, SAND_CASTLE_HEIGHT - 30);
            }
            // Hit player during charge
            if (player && player.alive && distance(this.x, this.y, player.x, player.y) < this.radius + player.radius) {
                player.takeDamage(CRAB_BOSS_CONFIG.damage, this);
                spawnHitParticles(particles, player.x, player.y, '#FF6633', 8);
                particles.push(new DamageNumber(player.x, player.y - 10, CRAB_BOSS_CONFIG.damage, '#FF0000'));
                const kb = 25;
                const kbAngle = angleBetween(this.x, this.y, player.x, player.y);
                player.x += Math.cos(kbAngle) * kb;
                player.y += Math.sin(kbAngle) * kb;
                this.chargeTimer = 0; // stop charge on hit
            }
            if (this.chargeTimer <= 0) {
                this.currentAttack = 'idle';
                this.attackTimer = this.phase === 2 ? 1.2 : 2.0;
            }
            return;
        }

        // Normal movement - sideways crab walk
        if (player && player.alive) {
            const dist = distance(this.x, this.y, player.x, player.y);
            if (dist > 60 && dist < 200) {
                // Strafe sideways relative to player
                const perpAngle = this.facing + Math.PI / 2 * (Math.sin(this.legPhase * 0.3) > 0 ? 1 : -1);
                this.x += Math.cos(perpAngle) * this.speed * 0.5 * dt;
                this.y += Math.sin(perpAngle) * this.speed * 0.5 * dt;
                // Also close in slowly
                this.x += Math.cos(this.facing) * this.speed * 0.3 * dt;
                this.y += Math.sin(this.facing) * this.speed * 0.3 * dt;
                this.vx = Math.cos(this.facing) * this.speed;
                this.vy = Math.sin(this.facing) * this.speed;
            } else if (dist > 200) {
                this.x += Math.cos(this.facing) * this.speed * dt;
                this.y += Math.sin(this.facing) * this.speed * dt;
            }
            this.x = clamp(this.x, 30, SAND_CASTLE_WIDTH - 30);
            this.y = clamp(this.y, 30, SAND_CASTLE_HEIGHT - 30);
        }

        // Attack timer
        this.attackTimer -= dt;
        this.bubbleCooldown -= dt;

        if (this.attackTimer <= 0 && player && player.alive) {
            this.chooseAttack(player, projectiles, particles);
        }
    }

    chooseAttack(player, projectiles, particles) {
        const dist = distance(this.x, this.y, player.x, player.y);
        const roll = Math.random();

        if (dist < 60 && roll < 0.4) {
            // Claw snap (melee)
            this.clawSnap = 1;
            player.takeDamage(CRAB_BOSS_CONFIG.damage * 0.8, this);
            spawnHitParticles(particles, player.x, player.y, '#FF6633', 5);
            particles.push(new DamageNumber(player.x, player.y - 10, Math.floor(CRAB_BOSS_CONFIG.damage * 0.8), '#FF4444'));
            this.attackTimer = this.phase === 2 ? 0.8 : 1.5;
        } else if (roll < 0.6) {
            // Charge attack (wind-up first)
            this.chargeWindup = 0.6;
            this.currentAttack = 'windup';
            this.attackTimer = 2.5;
        } else {
            // Bubble spray
            this.bubbleSpray(player, projectiles);
            this.attackTimer = this.phase === 2 ? 1.0 : 1.8;
        }
    }

    bubbleSpray(player, projectiles) {
        const angle = angleBetween(this.x, this.y, player.x, player.y);
        const bubbleWeapon = {
            damage: 12,
            projectileSpeed: CRAB_BOSS_CONFIG.bubbleSpeed,
            color: '#88DDFF',
            burn: false,
            pierce: false
        };
        const count = this.phase === 2 ? 5 : 3;
        const spread = this.phase === 2 ? 0.5 : 0.35;
        for (let i = 0; i < count; i++) {
            const a = angle + (i - (count - 1) / 2) * (spread / (count - 1) * 2);
            projectiles.push(new Projectile(
                this.x + Math.cos(a) * 20,
                this.y + Math.sin(a) * 20,
                a, bubbleWeapon, TEAMS.NEUTRAL, this
            ));
        }
    }

    draw(ctx, camera) {
        if (!this.alive && this.deathTimer <= 0) return;
        const pos = camera.worldToScreen(this.x, this.y);
        let { x, y } = pos;
        const isoFacing = worldAngleToIso(this.facing);

        ctx.save();
        if (!this.alive) {
            ctx.globalAlpha = clamp(this.deathTimer / 0.5, 0, 1);
        }

        // Shell shake
        if (this.shellShake > 0) {
            x += Math.sin(this.shellShake * 30) * 2;
        }

        // Legs (6 — 3 each side, scuttling)
        ctx.strokeStyle = '#CC4422';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 6; i++) {
            const side = i < 3 ? -1 : 1;
            const idx = i % 3;
            const baseAngle = (side === -1 ? Math.PI + 0.3 : -0.3) + (idx - 1) * 0.5;
            const phase = Math.sin(this.legPhase + i * 1.1) * 0.4;
            const legLen = 18;
            const jx = x + Math.cos(baseAngle + phase) * legLen * 0.5;
            const jy = y + Math.sin(baseAngle + phase) * legLen * 0.4;
            const ex = jx + Math.cos(baseAngle + phase + 0.6) * legLen * 0.5;
            const ey = jy + Math.abs(Math.sin(baseAngle + phase + 0.6)) * legLen * 0.4;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(jx, jy);
            ctx.lineTo(ex, ey);
            ctx.stroke();
        }

        // Shell (body)
        ctx.fillStyle = this.phase === 2 ? '#CC3311' : '#DD5533';
        ctx.beginPath();
        ctx.ellipse(x, y, 20, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Shell pattern
        ctx.fillStyle = this.phase === 2 ? '#AA2200' : '#CC4422';
        ctx.beginPath();
        ctx.ellipse(x, y - 2, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // Shell ridges
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        for (let r = 0; r < 3; r++) {
            ctx.beginPath();
            ctx.ellipse(x, y - 2, 14 - r * 4, 10 - r * 3, 0, -0.5, 0.5);
            ctx.stroke();
        }

        // Eyes on stalks
        const eyeBaseX1 = x + Math.cos(isoFacing - 0.4) * 14;
        const eyeBaseY1 = y + Math.sin(isoFacing - 0.4) * 10 - 5;
        const eyeBaseX2 = x + Math.cos(isoFacing + 0.4) * 14;
        const eyeBaseY2 = y + Math.sin(isoFacing + 0.4) * 10 - 5;
        // Stalks
        ctx.strokeStyle = '#DD5533';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(isoFacing) * 10, y - 2);
        ctx.lineTo(eyeBaseX1, eyeBaseY1 - 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(isoFacing) * 10, y - 2);
        ctx.lineTo(eyeBaseX2, eyeBaseY2 - 4);
        ctx.stroke();
        // Eye balls
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(eyeBaseX1, eyeBaseY1 - 6, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eyeBaseX2, eyeBaseY2 - 6, 3, 0, Math.PI * 2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = this.phase === 2 ? '#FF0000' : '#111';
        ctx.beginPath();
        ctx.arc(eyeBaseX1 + Math.cos(isoFacing) * 1.5, eyeBaseY1 - 6, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eyeBaseX2 + Math.cos(isoFacing) * 1.5, eyeBaseY2 - 6, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Claws
        const clawOpen = this.clawSnap > 0 ? Math.sin(this.clawSnap * Math.PI) * 0.5 : 0.3;
        // Left claw
        const lcx = x + Math.cos(isoFacing - 0.8) * 22;
        const lcy = y + Math.sin(isoFacing - 0.8) * 16;
        ctx.fillStyle = '#EE6644';
        ctx.strokeStyle = '#CC4422';
        ctx.lineWidth = 2;
        // Arm
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(isoFacing - 0.6) * 12, y + Math.sin(isoFacing - 0.6) * 8);
        ctx.lineTo(lcx, lcy);
        ctx.stroke();
        // Pincer top
        ctx.beginPath();
        ctx.moveTo(lcx, lcy);
        ctx.lineTo(lcx + Math.cos(isoFacing - clawOpen) * 10, lcy + Math.sin(isoFacing - clawOpen) * 8);
        ctx.lineTo(lcx + Math.cos(isoFacing) * 6, lcy + Math.sin(isoFacing) * 4);
        ctx.fill();
        ctx.stroke();
        // Pincer bottom
        ctx.beginPath();
        ctx.moveTo(lcx, lcy);
        ctx.lineTo(lcx + Math.cos(isoFacing + clawOpen) * 10, lcy + Math.sin(isoFacing + clawOpen) * 8);
        ctx.lineTo(lcx + Math.cos(isoFacing) * 6, lcy + Math.sin(isoFacing) * 4);
        ctx.fill();
        ctx.stroke();

        // Right claw
        const rcx = x + Math.cos(isoFacing + 0.8) * 22;
        const rcy = y + Math.sin(isoFacing + 0.8) * 16;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(isoFacing + 0.6) * 12, y + Math.sin(isoFacing + 0.6) * 8);
        ctx.lineTo(rcx, rcy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rcx, rcy);
        ctx.lineTo(rcx + Math.cos(isoFacing - clawOpen) * 10, rcy + Math.sin(isoFacing - clawOpen) * 8);
        ctx.lineTo(rcx + Math.cos(isoFacing) * 6, rcy + Math.sin(isoFacing) * 4);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rcx, rcy);
        ctx.lineTo(rcx + Math.cos(isoFacing + clawOpen) * 10, rcy + Math.sin(isoFacing + clawOpen) * 8);
        ctx.lineTo(rcx + Math.cos(isoFacing) * 6, rcy + Math.sin(isoFacing) * 4);
        ctx.fill();
        ctx.stroke();

        // Charge wind-up indicator
        if (this.chargeWindup > 0) {
            ctx.strokeStyle = `rgba(255, 100, 50, ${this.chargeWindup})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(x, y, 28, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();

        // Health bar
        if (this.alive) {
            ctx.fillStyle = '#333';
            ctx.fillRect(x - 30, y - 32, 60, 6);
            const pct = this.health / this.maxHealth;
            ctx.fillStyle = pct > 0.5 ? '#FF8844' : '#FF4444';
            ctx.fillRect(x - 30, y - 32, 60 * pct, 6);
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 1;
            ctx.strokeRect(x - 30, y - 32, 60, 6);

            ctx.fillStyle = '#FF8844';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, x, y - 38);
            if (this.phase === 2) {
                ctx.fillStyle = '#FF2200';
                ctx.font = '10px Arial';
                ctx.fillText('ENRAGED', x, y - 48);
            }
        }
    }
}
