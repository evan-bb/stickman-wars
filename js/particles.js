// ============================================
// Particle System
// ============================================

class Particle {
    constructor(x, y, vx, vy, life, color, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
        this.alive = true;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) this.alive = false;
    }

    draw(ctx, camera) {
        if (!camera.isVisible(this.x, this.y)) return;
        const pos = camera.worldToScreen(this.x, this.y);
        const alpha = clamp(this.life / this.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class DamageNumber {
    constructor(x, y, amount, color) {
        this.x = x;
        this.y = y;
        this.amount = amount;
        this.color = color || '#FFFFFF';
        this.life = 0.8;
        this.maxLife = 0.8;
        this.alive = true;
    }

    update(dt) {
        this.y -= 40 * dt;
        this.life -= dt;
        if (this.life <= 0) this.alive = false;
    }

    draw(ctx, camera) {
        if (!camera.isVisible(this.x, this.y)) return;
        const pos = camera.worldToScreen(this.x, this.y);
        const alpha = clamp(this.life / this.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('-' + this.amount, pos.x, pos.y);
        ctx.globalAlpha = 1;
    }
}

// Floating label particle for the MP center weapon pickup. Looks like a
// damage number but renders an arbitrary string instead of "-N".
class MPPickupLabel {
    constructor(x, y, text) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.life = 1.4;
        this.maxLife = 1.4;
        this.alive = true;
    }
    update(dt) {
        this.y -= 30 * dt;
        this.life -= dt;
        if (this.life <= 0) this.alive = false;
    }
    draw(ctx, camera) {
        if (!camera.isVisible(this.x, this.y)) return;
        const pos = camera.worldToScreen(this.x, this.y);
        const alpha = clamp(this.life / this.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.strokeText(this.text, pos.x, pos.y);
        ctx.fillText(this.text, pos.x, pos.y);
        ctx.globalAlpha = 1;
    }
}

function spawnHitParticles(particles, x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = randomRange(40, 120);
        particles.push(new Particle(
            x, y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            randomRange(0.2, 0.5),
            color,
            randomRange(2, 4)
        ));
    }
}

function spawnDeathParticles(particles, x, y, color) {
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = randomRange(40, 140);
        particles.push(new Particle(
            x, y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed - 40,
            randomRange(0.5, 1.2),
            color,
            randomRange(2, 6)
        ));
    }
}

// Screen flash effect (drawn as a full-screen overlay that fades)
class ScreenFlash {
    constructor(color, duration) {
        this.color = color;
        this.life = duration;
        this.maxLife = duration;
        this.alive = true;
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) this.alive = false;
    }

    draw(ctx) {
        if (!this.alive) return;
        const alpha = (this.life / this.maxLife) * 0.3;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.restore();
    }
}
