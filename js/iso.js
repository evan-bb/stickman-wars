// ============================================
// Isometric Projection Utilities
// ============================================

// 2:1 diamond isometric projection
function worldToIso(wx, wy) {
    return {
        x: (wx - wy),
        y: (wx + wy) * 0.5
    };
}

// Inverse: iso screen coords back to world
function isoToWorld(ix, iy) {
    return {
        x: ix * 0.5 + iy,
        y: -ix * 0.5 + iy
    };
}

// Project a world-space angle to iso screen-space angle
function worldAngleToIso(angle) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const isoX = dx - dy;
    const isoY = (dx + dy) * 0.5;
    return Math.atan2(isoY, isoX);
}

// Convert a world-space rectangle to 4 iso diamond points
// Returns points in order: top, right, bottom, left (for drawing)
function worldRectToIsoDiamond(x, y, w, h) {
    return [
        worldToIso(x, y),         // top-left corner → top of diamond
        worldToIso(x + w, y),     // top-right corner → right of diamond
        worldToIso(x + w, y + h), // bottom-right corner → bottom of diamond
        worldToIso(x, y + h)      // bottom-left corner → left of diamond
    ];
}

// Precomputed iso bounds for the full world (4000x3000)
// World corners: (0,0), (4000,0), (4000,3000), (0,3000)
// Iso:           (0,0), (4000,2000), (1000,3500), (-3000,1500)
const ISO_WORLD_BOUNDS = {
    minX: -3000,
    maxX: 4000,
    minY: 0,
    maxY: 3500,
    width: 7000,
    height: 3500
};
