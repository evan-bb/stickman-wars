// ============================================
// Player - Human-controlled Entity
// ============================================

class Player extends Entity {
    constructor(x, y) {
        super(x, y, TEAMS.BLUE);
        this.isPlayer = true;
        this.interactTarget = null;
        this.interactPrompt = '';

        // Inventory
        this.inventory = []; // array of Weapon objects
        this.activeSlot = 0; // index into inventory

        // Sprint
        this.stamina = 100;
        this.maxStamina = 100;
        this.staminaDrain = 35;    // per second while sprinting
        this.staminaRegen = 20;    // per second while not sprinting
        this.sprinting = false;
        this.staminaExhausted = false; // true when drained to 0, must refill to 30% before sprinting again
    }

    hasWeapon(weaponKey) {
        return this.inventory.some(w => w.key === weaponKey);
    }

    addWeapon(weaponKey) {
        // Don't add duplicates
        if (this.hasWeapon(weaponKey)) return null;

        const wpn = new Weapon(weaponKey);
        this.inventory.push(wpn);
        // Auto-equip if it's the only weapon, otherwise keep current
        if (this.inventory.length === 1) {
            this.activeSlot = 0;
            this.weapon = this.inventory[0];
        }
        return wpn;
    }

    switchToSlot(slot) {
        if (slot < 0 || slot >= this.inventory.length) return;
        if (slot === this.activeSlot) return;
        this.activeSlot = slot;
        this.weapon = this.inventory[slot];
        this.weaponSwitched = true; // flag for HUD/SFX
    }

    cycleWeapon(dir) {
        if (this.inventory.length <= 1) return;
        this.activeSlot = (this.activeSlot + dir + this.inventory.length) % this.inventory.length;
        this.weapon = this.inventory[this.activeSlot];
        this.weaponSwitched = true;
    }

    update(dt, input, camera, entities, projectiles, particles, biomeAt) {
        super.update(dt);
        if (!this.alive) return;

        // Update all inventory weapon cooldowns (not just active one)
        for (const wpn of this.inventory) {
            if (wpn !== this.weapon) wpn.update(dt);
        }

        // Movement - mapped to isometric axes
        let mx = 0, my = 0;
        if (input.isKeyDown('w') || input.isKeyDown('arrowup'))    { mx -= 1; my -= 1; }
        if (input.isKeyDown('s') || input.isKeyDown('arrowdown'))  { mx += 1; my += 1; }
        if (input.isKeyDown('a') || input.isKeyDown('arrowleft'))  { mx -= 1; my += 1; }
        if (input.isKeyDown('d') || input.isKeyDown('arrowright')) { mx += 1; my -= 1; }

        // Normalize
        const moveLen = Math.sqrt(mx * mx + my * my);
        if (moveLen > 0) { mx /= moveLen; my /= moveLen; }

        // Speed modifier for biome
        let speedMod = 1.0;
        if (biomeAt && biomeAt === BIOME.ARCTIC) speedMod = 0.85;

        // Sprint (R key) with stamina
        const wantsSprint = input.isKeyDown('r') && (Math.abs(mx) > 0 || Math.abs(my) > 0);
        if (wantsSprint && !this.staminaExhausted && this.stamina > 0) {
            this.sprinting = true;
            this.stamina -= this.staminaDrain * dt;
            if (this.stamina <= 0) {
                this.stamina = 0;
                this.staminaExhausted = true;
                this.sprinting = false;
            }
            speedMod *= 1.6;
        } else {
            this.sprinting = false;
            this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * dt);
            // Allow sprinting again once recharged to 30%
            if (this.staminaExhausted && this.stamina >= this.maxStamina * 0.3) {
                this.staminaExhausted = false;
            }
        }

        this.vx = mx * this.speed * speedMod;
        this.vy = my * this.speed * speedMod;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Track movement direction for walk animation
        if (Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1) {
            this.moveFacing = Math.atan2(this.vy, this.vx);
        }

        // Face toward mouse (for aiming/attacking)
        const worldMouse = input.getWorldMouse(camera);
        this.facing = angleBetween(this.x, this.y, worldMouse.x, worldMouse.y);

        // Weapon switching - number keys 1-9
        for (let i = 1; i <= 9; i++) {
            if (input.isKeyDown(i.toString())) {
                this.switchToSlot(i - 1);
                input.keys[i.toString()] = false; // consume
            }
        }

        // Weapon switching - scroll wheel
        const scroll = input.consumeScroll();
        if (scroll !== 0) {
            this.cycleWeapon(scroll > 0 ? 1 : -1);
        }

        // Attack on click or space
        if (this.weapon && (input.mouseDown || input.isKeyDown(' '))) {
            this.weapon.attack(this, entities, projectiles, particles);
        }
    }

    // Forward XP to the global progression system
    addXP(amount) {
        if (window.game && window.game.progression) {
            const before = window.game.progression.level;
            window.game.progression.addXP(amount);
            if (window.game.progression.level > before) {
                this.leveledUp = true;
            }
        }
    }

    get level() {
        return window.game && window.game.progression ? window.game.progression.level : 1;
    }
}
