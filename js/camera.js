// ============================================
// Camera - Isometric Viewport
// ============================================

class Camera {
    constructor() {
        // Camera position in iso-projected space
        this.isoX = 0;
        this.isoY = 0;
        // Legacy x/y for minimap compatibility (set during follow)
        this.x = 0;
        this.y = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeTimer = 0;
    }

    follow(target) {
        // Store world pos for minimap
        this.x = target.x;
        this.y = target.y;

        // Project target to iso, then center on screen
        const iso = worldToIso(target.x, target.y);
        this.isoX = clamp(
            iso.x - CANVAS_WIDTH / 2,
            ISO_WORLD_BOUNDS.minX - 100,
            ISO_WORLD_BOUNDS.maxX - CANVAS_WIDTH + 100
        );
        this.isoY = clamp(
            iso.y - CANVAS_HEIGHT / 2,
            ISO_WORLD_BOUNDS.minY - 100,
            ISO_WORLD_BOUNDS.maxY - CANVAS_HEIGHT + 100
        );
    }

    shake(intensity, duration) {
        this.shakeTimer = duration;
        this._shakeIntensity = intensity;
    }

    update(dt) {
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            this.shakeX = (Math.random() - 0.5) * this._shakeIntensity * 2;
            this.shakeY = (Math.random() - 0.5) * this._shakeIntensity * 2;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }
    }

    worldToScreen(wx, wy) {
        const iso = worldToIso(wx, wy);
        return {
            x: iso.x - this.isoX + this.shakeX,
            y: iso.y - this.isoY + this.shakeY
        };
    }

    screenToWorld(sx, sy) {
        const isoX = sx + this.isoX;
        const isoY = sy + this.isoY;
        return isoToWorld(isoX, isoY);
    }

    isVisible(wx, wy, margin = 50) {
        const iso = worldToIso(wx, wy);
        return iso.x > this.isoX - margin &&
               iso.x < this.isoX + CANVAS_WIDTH + margin &&
               iso.y > this.isoY - margin &&
               iso.y < this.isoY + CANVAS_HEIGHT + margin;
    }
}
