// ============================================
// HUD - Heads Up Display
// ============================================

class HUD {
    constructor() {
        this.notification = '';
        this.notificationTimer = 0;
        this.notificationColor = '#FFFFFF';
    }

    notify(text, color, duration) {
        this.notification = text;
        this.notificationColor = color || '#FFFFFF';
        this.notificationTimer = duration || 2;
    }

    update(dt) {
        if (this.notificationTimer > 0) {
            this.notificationTimer -= dt;
        }
    }

    draw(ctx, player, blueAlive, redAlive, interactPrompt, input) {
        // Health bar (top-left)
        const hx = 20, hy = 20;
        ctx.fillStyle = '#333';
        ctx.fillRect(hx, hy, 200, 20);
        const hpPct = player.health / player.maxHealth;
        ctx.fillStyle = hpPct > 0.5 ? '#44CC44' : hpPct > 0.25 ? '#CCCC44' : '#CC4444';
        ctx.fillRect(hx, hy, 200 * hpPct, 20);
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(hx, hy, 200, 20);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`HP: ${Math.ceil(player.health)} / ${player.maxHealth}`, hx + 100, hy + 15);

        // Sprint bar (below health bar)
        const sprintPct = player.stamina / player.maxStamina;
        ctx.fillStyle = '#222';
        ctx.fillRect(hx, hy + 24, 200, 8);
        ctx.fillStyle = player.staminaExhausted ? '#884400' : (player.sprinting ? '#FFAA00' : '#44AAFF');
        ctx.fillRect(hx, hy + 24, 200 * sprintPct, 8);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(hx, hy + 24, 200, 8);
        if (player.sprinting || player.staminaExhausted || sprintPct < 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '9px Arial';
            ctx.textAlign = 'center';
            const sprintHint = player.staminaExhausted ? 'EXHAUSTED' : (player.sprinting ? 'SPRINTING' : 'R to sprint');
            ctx.fillText(sprintHint, hx + 100, hy + 31);
        }

        // Sticks (below sprint bar)
        ctx.textAlign = 'left';
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`Sticks: ${player.sticks}`, hx, hy + 50);

        // Inventory bar (bottom center)
        this.drawInventoryBar(ctx, player, input);

        // Team scores (top center)
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px Arial';
        const scoreY = 28;
        ctx.fillStyle = TEAM_COLORS.blue;
        ctx.fillText(`Blue: ${blueAlive}`, CANVAS_WIDTH / 2 - 60, scoreY);
        ctx.fillStyle = '#FFF';
        ctx.fillText('vs', CANVAS_WIDTH / 2, scoreY);
        ctx.fillStyle = TEAM_COLORS.red;
        ctx.fillText(`Red: ${redAlive}`, CANVAS_WIDTH / 2 + 60, scoreY);

        // Kills
        ctx.fillStyle = '#FFF';
        ctx.font = '12px Arial';
        ctx.fillText(`Your Kills: ${player.kills}`, CANVAS_WIDTH / 2, scoreY + 20);

        // Interaction prompt (bottom center)
        if (interactPrompt) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(interactPrompt, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
        }

        // Active weapon info (above inventory bar)
        if (player.weapon) {
            ctx.fillStyle = player.weapon.color;
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            const infoY = CANVAS_HEIGHT - 78;
            ctx.fillText(player.weapon.name, CANVAS_WIDTH / 2, infoY);
            ctx.fillStyle = '#AAA';
            ctx.font = '11px Arial';
            ctx.fillText(`DMG: ${player.weapon.damage}  RNG: ${player.weapon.range}  ${player.weapon.type.toUpperCase()}`, CANVAS_WIDTH / 2, infoY + 14);
        }

        // Notification
        if (this.notificationTimer > 0) {
            const alpha = Math.min(1, this.notificationTimer);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.notificationColor;
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.notification, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);
            ctx.globalAlpha = 1;
        }
    }

    drawInventoryBar(ctx, player, input) {
        const inv = player.inventory;
        if (inv.length === 0) return;

        const slotSize = 48;
        const slotGap = 4;
        const maxSlots = Math.max(inv.length, 5); // Show at least 5 slots
        const totalW = maxSlots * slotSize + (maxSlots - 1) * slotGap;
        const barX = (CANVAS_WIDTH - totalW) / 2;
        const barY = CANVAS_HEIGHT - 56;

        // Check for click on inventory slots
        const mx = input ? input.mouseX : -1;
        const my = input ? input.mouseY : -1;
        const clicked = input ? input.mouseClicked : false;

        // Background bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        const pad = 6;
        ctx.beginPath();
        ctx.roundRect(barX - pad, barY - pad, totalW + pad * 2, slotSize + pad * 2, 8);
        ctx.fill();

        for (let i = 0; i < maxSlots; i++) {
            const sx = barX + i * (slotSize + slotGap);
            const sy = barY;
            const isActive = i === player.activeSlot;
            const hasWeapon = i < inv.length;

            // Hover detection
            const hover = mx >= sx && mx <= sx + slotSize && my >= sy && my <= sy + slotSize;

            // Click to select weapon
            if (hover && clicked && hasWeapon) {
                player.switchToSlot(i);
                input.mouseClicked = false; // consume click so it doesn't attack
            }

            // Slot background
            if (isActive) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.strokeStyle = '#FFF';
                ctx.lineWidth = 2;
            } else if (hover && hasWeapon) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 1.5;
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.lineWidth = 1;
            }
            ctx.beginPath();
            ctx.roundRect(sx, sy, slotSize, slotSize, 4);
            ctx.fill();
            ctx.stroke();

            if (hasWeapon) {
                const wpn = inv[i];
                // Draw weapon icon
                this.drawWeaponIcon(ctx, sx + slotSize / 2, sy + slotSize / 2 - 2, wpn);

                // Active glow
                if (isActive) {
                    ctx.shadowColor = wpn.color;
                    ctx.shadowBlur = 8;
                    ctx.strokeStyle = wpn.color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.roundRect(sx, sy, slotSize, slotSize, 4);
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            }

            // Slot number
            ctx.fillStyle = isActive ? '#FFF' : 'rgba(255,255,255,0.4)';
            ctx.font = '10px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(i + 1, sx + 3, sy + 11);
        }

        // Hint text
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(window.game && window.game.touch && window.game.touch.active
            ? 'Tap slot to switch weapon'
            : 'Click, scroll, or 1-9 to switch', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 2);
    }

    drawWeaponIcon(ctx, cx, cy, weapon) {
        ctx.save();
        ctx.translate(cx, cy);

        if (weapon.type === 'melee') {
            // Blade
            ctx.strokeStyle = weapon.color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 10);
            ctx.lineTo(0, -12);
            ctx.stroke();
            // Guard
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-6, 2);
            ctx.lineTo(6, 2);
            ctx.stroke();
            // Pommel
            ctx.fillStyle = '#666';
            ctx.beginPath();
            ctx.arc(0, 12, 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Ranged - bow/gun shape
            ctx.strokeStyle = weapon.color;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            // Body
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(8, 0);
            ctx.stroke();
            // Curve
            ctx.beginPath();
            ctx.arc(0, 0, 7, -1.2, 1.2);
            ctx.stroke();
            // Projectile
            ctx.fillStyle = weapon.color;
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(14, -2);
            ctx.lineTo(14, 2);
            ctx.closePath();
            ctx.fill();
        }

        // Weapon name abbreviation
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(weapon.name.split(' ').map(w => w[0]).join(''), 0, 20);

        ctx.restore();
    }
}
