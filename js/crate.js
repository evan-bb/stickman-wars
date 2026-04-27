// ============================================
// Crate System
// ============================================

class Crate {
    constructor(x, y, tierKey) {
        this.x = x;
        this.y = y;
        this.tierKey = tierKey;
        this.tier = CRATE_TIERS[tierKey];
        this.opened = false;
        this.radius = 18;
        this.glowTimer = Math.random() * Math.PI * 2;
    }

    canOpen(player) {
        return !this.opened && player.sticks >= this.tier.cost;
    }

    open(player) {
        if (!this.canOpen(player)) return null;

        // Filter out weapons the player already has
        const available = this.tier.loot.filter(key => !player.hasWeapon(key));
        if (available.length === 0) {
            // Player owns all possible drops - don't charge, don't open
            return { name: 'Nothing new! (You own all drops)', color: '#FF8888' };
        }

        player.sticks -= this.tier.cost;
        this.opened = true;
        const lootKey = randomFromArray(available);
        // Add to inventory and auto-switch to new weapon
        player.addWeapon(lootKey);
        player.switchToSlot(player.inventory.length - 1);
        return WEAPON_DEFS[lootKey];
    }

    draw(ctx, camera) {
        if (this.opened) return;
        if (!camera.isVisible(this.x, this.y)) return;

        const pos = camera.worldToScreen(this.x, this.y);
        this.glowTimer += 0.02;

        // Glow
        const glow = 0.2 + Math.sin(this.glowTimer) * 0.1;
        ctx.fillStyle = this.tier.color;
        ctx.globalAlpha = glow;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Box
        const s = 16;
        ctx.fillStyle = this.tier.color;
        ctx.fillRect(pos.x - s, pos.y - s, s * 2, s * 2);
        ctx.strokeStyle = this.tier.outline;
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x - s, pos.y - s, s * 2, s * 2);

        // Middle line
        ctx.beginPath();
        ctx.moveTo(pos.x - s, pos.y);
        ctx.lineTo(pos.x + s, pos.y);
        ctx.stroke();

        // ? symbol
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', pos.x, pos.y - 4);

        // Cost label
        ctx.fillStyle = '#FFD700';
        ctx.font = '10px Arial';
        ctx.fillText(this.tier.cost + ' sticks', pos.x, pos.y + s + 12);
    }
}

function createCrates() {
    return [
        // Village: 4 Normal, 1 Silver, 1 Gold
        new Crate(300, 400, 'NORMAL'),
        new Crate(800, 300, 'NORMAL'),
        new Crate(1500, 600, 'NORMAL'),
        new Crate(1200, 1100, 'NORMAL'),
        new Crate(600, 900, 'SILVER'),
        new Crate(1700, 1300, 'GOLD'),
        // Forest: 3 Normal, 2 Silver, 2 Gold, 1 Diamond
        new Crate(2400, 300, 'NORMAL'),
        new Crate(2900, 800, 'NORMAL'),
        new Crate(3200, 400, 'NORMAL'),
        new Crate(2600, 1100, 'SILVER'),
        new Crate(3400, 1200, 'SILVER'),
        new Crate(3000, 600, 'GOLD'),
        new Crate(3700, 800, 'GOLD'),
        new Crate(2700, 700, 'DIAMOND'),
        // Arctic: 1 Silver, 1 Gold, 1 Diamond
        new Crate(400, 2000, 'SILVER'),
        new Crate(900, 2400, 'GOLD'),
        new Crate(600, 2700, 'DIAMOND'),
        // Beach: 2 Normal, 1 Silver, 1 Gold, 1 Diamond (near the water)
        new Crate(1600, 2000, 'NORMAL'),
        new Crate(2100, 2500, 'NORMAL'),
        new Crate(1900, 2200, 'SILVER'),
        new Crate(1500, 2700, 'GOLD'),
        new Crate(2200, 2300, 'DIAMOND'),
        // Volcano: 1 Silver, 1 Gold, 1 Diamond
        new Crate(3000, 2000, 'SILVER'),
        new Crate(3400, 2400, 'GOLD'),
        new Crate(3700, 2200, 'DIAMOND')
    ];
}
