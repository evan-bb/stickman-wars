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
    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = randomRange(30, 100);
        particles.push(new Particle(
            x, y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed - 30,
            randomRange(0.5, 1.0),
            color,
            randomRange(2, 5)
        ));
    }
}
