// ============================================
// Minimap (Isometric Diamond)
// ============================================

class Minimap {
    constructor() {
        this.size = 180;
        this.padding = 10;
        // Scale to fit the iso-projected world into the minimap
        this.isoScale = this.size / ISO_WORLD_BOUNDS.width;
        this.displayH = ISO_WORLD_BOUNDS.height * this.isoScale;
    }

    draw(ctx, entities, player, camera, storm) {
        const mx = CANVAS_WIDTH - this.size - this.padding;
        const my = this.padding;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(mx - 2, my - 2, this.size + 4, this.displayH + 4);

        // Biome colors as diamonds
        for (const b of BIOME_LAYOUTS) {
            const diamond = worldRectToIsoDiamond(b.x, b.y, b.w, b.h);
            ctx.fillStyle = BIOME_COLORS[b.type];
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const sx = mx + (diamond[i].x - ISO_WORLD_BOUNDS.minX) * this.isoScale;
                const sy = my + (diamond[i].y - ISO_WORLD_BOUNDS.minY) * this.isoScale;
                if (i === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Entity dots
        for (const e of entities) {
            if (!e.alive) continue;
            const iso = worldToIso(e.x, e.y);
            const dotX = mx + (iso.x - ISO_WORLD_BOUNDS.minX) * this.isoScale;
            const dotY = my + (iso.y - ISO_WORLD_BOUNDS.minY) * this.isoScale;

            if (e.isPlayer) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(dotX - 2, dotY - 2, 4, 4);
            } else {
                ctx.fillStyle = TEAM_COLORS[e.team];
                ctx.fillRect(dotX - 1, dotY - 1, 2, 2);
            }
        }

        // Storm circle on minimap
        if (storm && storm.active) {
            const stormIso = worldToIso(storm.centerX, storm.centerY);
            const stormX = mx + (stormIso.x - ISO_WORLD_BOUNDS.minX) * this.isoScale;
            const stormY = my + (stormIso.y - ISO_WORLD_BOUNDS.minY) * this.isoScale;
            const stormR = storm.radius * this.isoScale;
            ctx.strokeStyle = 'rgba(160, 80, 220, 0.7)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(stormX, stormY, stormR, stormR * 0.5, 0, 0, Math.PI * 2);
            ctx.stroke();
            // Tint outside storm on minimap
            ctx.fillStyle = 'rgba(80, 30, 120, 0.25)';
            ctx.beginPath();
            ctx.rect(mx - 2, my - 2, this.size + 4, this.displayH + 4);
            ctx.moveTo(stormX + stormR, stormY);
            ctx.ellipse(stormX, stormY, stormR, stormR * 0.5, 0, 0, Math.PI * 2, true);
            ctx.fill('evenodd');
        }

        // Camera viewport outline (diamond-ish shape showing visible area)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        const camX = mx + (camera.isoX - ISO_WORLD_BOUNDS.minX) * this.isoScale;
        const camY = my + (camera.isoY - ISO_WORLD_BOUNDS.minY) * this.isoScale;
        const camW = CANVAS_WIDTH * this.isoScale;
        const camH = CANVAS_HEIGHT * this.isoScale;
        ctx.strokeRect(camX, camY, camW, camH);

        // Border
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx - 2, my - 2, this.size + 4, this.displayH + 4);
    }
}
