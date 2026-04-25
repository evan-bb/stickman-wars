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

// ============================================
// Weapon Pickup - Boss Drops
// ============================================

class WeaponPickup {
    constructor(x, y, weaponKey) {
        this.x = x;
        this.y = y;
        this.weaponKey = weaponKey;
        this.def = WEAPON_DEFS[weaponKey];
        this.collected = false;
        this.bobTimer = Math.random() * Math.PI * 2;
        this.spinTimer = 0;
        this.radius = 22;
        this.spawnTimer = 0; // grace animation
    }

    update(dt) {
        this.bobTimer += dt * 2.5;
        this.spinTimer += dt * 2;
        this.spawnTimer += dt;
    }

    draw(ctx, camera) {
        if (this.collected) return;
        if (!camera.isVisible(this.x, this.y)) return;

        const pos = camera.worldToScreen(this.x, this.y);
        const bob = Math.sin(this.bobTimer) * 5;
        const color = this.def.color;

        // Spawn scale-in
        const spawnScale = Math.min(1, this.spawnTimer * 2.5);

        ctx.save();
        ctx.translate(pos.x, pos.y + bob);
        ctx.scale(spawnScale, spawnScale);

        // Big pulsing glow
        const glowPulse = 0.35 + Math.sin(this.bobTimer * 2) * 0.15;
        const glow = ctx.createRadialGradient(0, 0, 5, 0, 0, 40);
        glow.addColorStop(0, this._hexWithAlpha(color, glowPulse * 0.7));
        glow.addColorStop(0.6, this._hexWithAlpha(color, glowPulse * 0.3));
        glow.addColorStop(1, this._hexWithAlpha(color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.fill();

        // Ground ring (light beam on floor)
        ctx.strokeStyle = this._hexWithAlpha(color, 0.7);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 12, 18, 6, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Rotating weapon icon
        ctx.rotate(this.spinTimer * 0.4);

        if (this.def.type === 'ranged') {
            // Bow shape (with nocked arrow)
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            // Bow arc
            ctx.beginPath();
            ctx.arc(0, 0, 18, -Math.PI * 0.6, Math.PI * 0.6, false);
            ctx.stroke();
            // Bowstring
            ctx.strokeStyle = '#EEE';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(0 + 18 * Math.cos(-Math.PI * 0.6), 0 + 18 * Math.sin(-Math.PI * 0.6));
            ctx.lineTo(-4, 0); // pulled-back string
            ctx.lineTo(0 + 18 * Math.cos(Math.PI * 0.6), 0 + 18 * Math.sin(Math.PI * 0.6));
            ctx.stroke();
            // Arrow shaft
            ctx.strokeStyle = '#C9A86A';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(22, 0);
            ctx.stroke();
            // Arrowhead
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(28, 0);
            ctx.lineTo(20, -4);
            ctx.lineTo(20, 4);
            ctx.closePath();
            ctx.fill();
            // Fletching
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(-15, -3);
            ctx.lineTo(-13, 0);
            ctx.lineTo(-15, 3);
            ctx.closePath();
            ctx.fill();
        } else {
            // Sword shape
            ctx.fillStyle = color;
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1.5;
            // Blade
            ctx.beginPath();
            ctx.moveTo(0, -22);
            ctx.lineTo(4, -6);
            ctx.lineTo(3, 6);
            ctx.lineTo(-3, 6);
            ctx.lineTo(-4, -6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Cross-guard
            ctx.fillStyle = '#333';
            ctx.fillRect(-9, 6, 18, 3);
            // Grip
            ctx.fillStyle = '#5A3010';
            ctx.fillRect(-2, 9, 4, 8);
            // Pommel
            ctx.fillStyle = '#B8860B';
            ctx.beginPath();
            ctx.arc(0, 18, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Sparkle star
        if (Math.sin(this.spinTimer * 3) > 0.5) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(6, -10, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // Name label above
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.strokeText(this.def.name, pos.x, pos.y + bob - 34);
        ctx.fillText(this.def.name, pos.x, pos.y + bob - 34);
    }

    _hexWithAlpha(hex, a) {
        // #RRGGBB to rgba()
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
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

// Cache of pre-rendered emoji icons (one offscreen canvas per unique emoji).
// Drawing emoji text every frame is slow; drawImage from a cached canvas is fast.
const FOOD_ICON_CACHE = {};
function getFoodIcon(emoji) {
    if (FOOD_ICON_CACHE[emoji]) return FOOD_ICON_CACHE[emoji];
    const size = 32;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    g.font = '22px Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, size / 2, size / 2 + 1);
    FOOD_ICON_CACHE[emoji] = c;
    return c;
}

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
        this.icon = getFoodIcon(this.emoji);
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

        // Glow circle
        const glowAlpha = 0.2 + Math.sin(this.bobTimer * 1.5) * 0.1;
        ctx.fillStyle = `rgba(0, 255, 100, ${glowAlpha})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y + bob, 12, 0, Math.PI * 2);
        ctx.fill();

        // Cached emoji icon (way faster than fillText every frame)
        ctx.drawImage(this.icon, pos.x - 16, pos.y + bob - 16);

        // Sparkle effect (throttled)
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
