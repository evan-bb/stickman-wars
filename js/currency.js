// ============================================
// Currency - Stick Pickups
// ============================================

class StickPickup {
    constructor(x, y, amount) {
        this.x = x;
        this.y = y;
        this.amount = amount || randomInt(1, 5);
        this.collected = false;
        this.bobTimer = Math.random() * Math.PI * 2;
        this.radius = 10;
    }

    update(dt) {
        this.bobTimer += dt * 2;
    }

    draw(ctx, camera) {
        if (this.collected) return;
        if (!camera.isVisible(this.x, this.y)) return;

        const pos = camera.worldToScreen(this.x, this.y);
        const bob = Math.sin(this.bobTimer) * 3;

        ctx.save();

        // Subtle gold sparkle (small, not a big circle)
        ctx.fillStyle = `rgba(255, 215, 0, ${0.15 + Math.sin(this.bobTimer * 2) * 0.1})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y + bob, 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw stick - thicker, more visible, with wood grain look
        // Dark outline
        ctx.strokeStyle = '#5a4510';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pos.x - 8, pos.y + bob + 5);
        ctx.lineTo(pos.x + 8, pos.y + bob - 5);
        ctx.stroke();
        // Light wood color
        ctx.strokeStyle = '#B8860B';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pos.x - 8, pos.y + bob + 5);
        ctx.lineTo(pos.x + 8, pos.y + bob - 5);
        ctx.stroke();
        // Small knot/bump for detail
        ctx.fillStyle = '#8B6914';
        ctx.beginPath();
        ctx.arc(pos.x + 2, pos.y + bob - 1, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Amount text
        if (this.amount > 1) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('x' + this.amount, pos.x, pos.y + bob - 10);
        }
        ctx.restore();
    }
}

function spawnSticks(count, worldW, worldH) {
    const sticks = [];
    for (let i = 0; i < count; i++) {
        sticks.push(new StickPickup(
            randomRange(30, worldW - 30),
            randomRange(30, worldH - 30),
            randomInt(1, 5)
        ));
    }
    return sticks;
}

// ============================================
// Food Pickups - Health Regeneration
// ============================================

class FoodPickup {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        const type = FOOD_TYPES[randomInt(0, FOOD_TYPES.length - 1)];
        this.name = type.name;
        this.heal = type.heal;
        this.color = type.color;
        this.emoji = type.emoji;
        this.collected = false;
        this.bobTimer = Math.random() * Math.PI * 2;
        this.radius = 10;
        this.sparkleTimer = 0;
    }

    update(dt) {
        this.bobTimer += dt * 2.5;
        this.sparkleTimer += dt;
    }

    draw(ctx, camera) {
        if (this.collected) return;
        if (!camera.isVisible(this.x, this.y)) return;

        const pos = camera.worldToScreen(this.x, this.y);
        const bob = Math.sin(this.bobTimer) * 4;

        ctx.save();

        // Glow circle
        const glowAlpha = 0.2 + Math.sin(this.bobTimer * 1.5) * 0.1;
        ctx.fillStyle = `rgba(0, 255, 100, ${glowAlpha})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y + bob, 12, 0, Math.PI * 2);
        ctx.fill();

        // Food icon
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, pos.x, pos.y + bob);

        // Sparkle effect
        if (this.sparkleTimer % 0.8 < 0.4) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            const sparkleAngle = this.sparkleTimer * 3;
            const sx = pos.x + Math.cos(sparkleAngle) * 10;
            const sy = pos.y + bob + Math.sin(sparkleAngle) * 8;
            ctx.fillRect(sx - 1, sy - 1, 2, 2);
        }

        // Heal amount text
        ctx.fillStyle = '#44FF44';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('+' + this.heal, pos.x, pos.y + bob - 14);

        ctx.restore();
    }
}

function spawnFood(count, worldW, worldH) {
    const food = [];
    for (let i = 0; i < count; i++) {
        food.push(new FoodPickup(
            randomRange(50, worldW - 50),
            randomRange(50, worldH - 50)
        ));
    }
    return food;
}

function spawnSticksAt(x, y, amount) {
    const sticks = [];
    for (let i = 0; i < Math.ceil(amount / 3); i++) {
        sticks.push(new StickPickup(
            x + randomRange(-30, 30),
            y + randomRange(-30, 30),
            Math.min(3, amount - i * 3)
        ));
    }
    return sticks;
}
