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

        // ---- Map markers for entrances ----
        // Each marker shows where you can press E to enter a boss room or
        // a special zone. Boss entries fade out once the boss is defeated.
        const game = window.game;
        const markers = [
            { wx: CAVE_ENTRANCE.x, wy: CAVE_ENTRANCE.y, color: '#CC44CC', label: '🕷', defeated: !!(game && game.bossDefeated) },
            { wx: HAUNTED_HOUSE_ENTRANCE.x, wy: HAUNTED_HOUSE_ENTRANCE.y, color: '#88CCFF', label: '👻', defeated: !!(game && game.ghostDefeated) },
            { wx: SAND_CASTLE_ENTRANCE.x, wy: SAND_CASTLE_ENTRANCE.y, color: '#FF8844', label: '🦀', defeated: !!(game && game.crabDefeated) },
            { wx: ICE_CASTLE_ENTRANCE.x, wy: ICE_CASTLE_ENTRANCE.y, color: '#88DDFF', label: '🐻‍❄', defeated: !!(game && game.polarDefeated) },
            { wx: VOLCANO_LAIR_ENTRANCE.x, wy: VOLCANO_LAIR_ENTRANCE.y, color: '#FF4400', label: '🌋', defeated: !!(game && game.lavaDefeated) },
            { wx: LION_DEN_ENTRANCE.x, wy: LION_DEN_ENTRANCE.y, color: '#FFAA00', label: '🦁', defeated: !!(game && game.lionDefeated) },
            { wx: OCEAN_ENTRANCE.x, wy: OCEAN_ENTRANCE.y, color: '#33CCEE', label: '🌊', defeated: false }
        ];
        for (const mk of markers) {
            const iso = worldToIso(mk.wx, mk.wy);
            const px = mx + (iso.x - ISO_WORLD_BOUNDS.minX) * this.isoScale;
            const py = my + (iso.y - ISO_WORLD_BOUNDS.minY) * this.isoScale;
            ctx.globalAlpha = mk.defeated ? 0.25 : 1;
            // Pulsing dot under the icon
            const pulse = 0.6 + Math.sin(Date.now() / 300 + mk.wx) * 0.4;
            ctx.fillStyle = mk.color;
            ctx.beginPath();
            ctx.arc(px, py, 4 * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();
            // Tiny emoji label above
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(mk.label, px, py - 5);
        }
        ctx.globalAlpha = 1;

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
