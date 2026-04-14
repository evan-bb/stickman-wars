// ============================================
// Weapon & Projectile System
// ============================================

class Weapon {
    constructor(defKey) {
        const def = WEAPON_DEFS[defKey];
        this.key = defKey;
        this.name = def.name;
        this.damage = def.damage;
        this.range = def.range;
        this.cooldown = def.cooldown;
        this.type = def.type;
        this.color = def.color;
        this.projectileSpeed = def.projectileSpeed || 0;
        this.burn = def.burn || false;
        this.pierce = def.pierce || false;
        this.cooldownTimer = 0;
    }

    canAttack() {
        return this.cooldownTimer <= 0;
    }

    attack(owner, entities, projectiles, particles, accuracyMod) {
        if (!this.canAttack()) return false;
        this.cooldownTimer = this.cooldown;
        owner.attackAnim = 1.0;

        if (this.type === 'melee') {
            return this.meleeAttack(owner, entities, particles, accuracyMod);
        } else {
            this.rangedAttack(owner, projectiles);
            return true;
        }
    }

    meleeAttack(owner, entities, particles, accuracyMod) {
        // Accuracy check for AI
        if (accuracyMod !== undefined && Math.random() > accuracyMod) {
            return false;
        }

        let hit = false;
        for (const target of entities) {
            if (!target.alive || target === owner || target.team === owner.team) continue;
            const dist = distance(owner.x, owner.y, target.x, target.y);
            if (dist > this.range) continue;

            const angleToTarget = angleBetween(owner.x, owner.y, target.x, target.y);
            if (angleDiff(owner.facing, angleToTarget) > Math.PI / 4) continue;

            target.takeDamage(this.damage, owner);
            // Knockback
            const kb = 8;
            target.x += Math.cos(angleToTarget) * kb;
            target.y += Math.sin(angleToTarget) * kb;
            // Particles
            spawnHitParticles(particles, target.x, target.y, TEAM_COLORS[target.team], 5);
            particles.push(new DamageNumber(target.x, target.y - 10, this.damage, '#FF4444'));

            if (this.burn && target.alive) {
                target.burnTimer = 3.0;
                target.burnDamage = 2;
            }
            hit = true;
            break; // Only hit one target for melee
        }
        return hit;
    }

    rangedAttack(owner, projectiles) {
        projectiles.push(new Projectile(
            owner.x + Math.cos(owner.facing) * 15,
            owner.y + Math.sin(owner.facing) * 15,
            owner.facing,
            this,
            owner.team,
            owner
        ));
    }

    update(dt) {
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= dt * 1000;
        }
    }
}

class Projectile {
    constructor(x, y, angle, weapon, team, owner) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = weapon.projectileSpeed;
        this.damage = weapon.damage;
        this.color = weapon.color;
        this.team = team;
        this.owner = owner;
        this.pierce = weapon.pierce;
        this.burn = weapon.burn;
        this.alive = true;
        this.life = 1.8;
        this.radius = 4;
        this.hitEntities = new Set();
    }

    update(dt) {
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;
        this.life -= dt;

        if (this.life <= 0 || this.x < 0 || this.x > WORLD_WIDTH || this.y < 0 || this.y > WORLD_HEIGHT) {
            this.alive = false;
        }
    }

    checkHit(entities, particles) {
        for (const target of entities) {
            if (!target.alive || target.team === this.team || this.hitEntities.has(target)) continue;
            if (circleCollision(this.x, this.y, this.radius, target.x, target.y, target.radius)) {
                target.takeDamage(this.damage, this.owner);
                spawnHitParticles(particles, target.x, target.y, TEAM_COLORS[target.team], 4);
                particles.push(new DamageNumber(target.x, target.y - 10, this.damage, '#FF4444'));

                if (this.burn && target.alive) {
                    target.burnTimer = 3.0;
                    target.burnDamage = 2;
                }

                this.hitEntities.add(target);
                if (!this.pierce) {
                    this.alive = false;
                }
                return;
            }
        }
    }

    draw(ctx, camera) {
        if (!camera.isVisible(this.x, this.y)) return;
        const pos = camera.worldToScreen(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Trail (iso-projected angle)
        const isoAngle = worldAngleToIso(this.angle);
        const tx = pos.x - Math.cos(isoAngle) * 8;
        const ty = pos.y - Math.sin(isoAngle) * 8;
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}
