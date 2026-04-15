// ============================================
// Base Entity
// ============================================

class Entity {
    constructor(x, y, team) {
        this.x = x;
        this.y = y;
        this.team = team;
        this.health = 100;
        this.maxHealth = 100;
        this.alive = true;
        this.weapon = null;
        this.speed = 100;
        this.facing = 0;
        this.moveFacing = 0;
        this.radius = 12;
        this.isPlayer = false;

        this.sticks = 0;
        this.kills = 0;

        // Animation
        this.walkTimer = 0;
        this.attackAnim = 0;
        this.deathTimer = 0;
        this.deathMaxTimer = 1.8;
        this.fallDir = 1;

        // Status effects
        this.burnTimer = 0;
        this.burnDamage = 0;

        // Movement velocity
        this.vx = 0;
        this.vy = 0;
    }

    takeDamage(amount, attacker) {
        if (!this.alive) return;
        this.health -= amount;

        // Screen shake when player takes a hit
        if (this.isPlayer && amount >= 5 && window.game && window.game.camera) {
            window.game.camera.shake(3 + amount * 0.1, 0.15);
        }

        if (this.health <= 0) {
            this.health = 0;
            this.die(attacker);
        }
    }

    die(killer) {
        this.alive = false;
        this.deathTimer = 1.8;
        this.deathMaxTimer = 1.8;
        // Pick a fall direction (left or right based on last hit direction)
        this.fallDir = (this.vx >= 0) ? 1 : -1;
        if (killer && killer.alive) {
            killer.kills++;
            // Fall away from killer
            this.fallDir = (this.x >= killer.x) ? 1 : -1;
        }
    }

    update(dt) {
        if (!this.alive) {
            this.deathTimer -= dt;
            return;
        }

        // Burn damage
        if (this.burnTimer > 0) {
            this.burnTimer -= dt;
            this.takeDamage(this.burnDamage * dt, null);
        }

        // Attack animation decay
        if (this.attackAnim > 0) {
            this.attackAnim -= dt * 4;
            if (this.attackAnim < 0) this.attackAnim = 0;
        }

        // Walk timer for animation
        if (Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1) {
            this.walkTimer += dt;
        }

        // Weapon cooldown
        if (this.weapon) {
            this.weapon.update(dt);
        }

        // Clamp to world
        this.x = clamp(this.x, 10, WORLD_WIDTH - 10);
        this.y = clamp(this.y, 10, WORLD_HEIGHT - 10);
    }

    draw(ctx, camera) {
        if (!this.alive && this.deathTimer <= 0) return;
        if (!camera.isVisible(this.x, this.y, 30)) return;

        if (!this.alive) {
            drawStickmanDeath(ctx, this, camera);
            return;
        }

        drawStickman(ctx, this, camera);
    }

    getDropSticks() {
        return Math.max(MIN_DEATH_DROP, Math.floor(this.sticks * 0.5));
    }
}
