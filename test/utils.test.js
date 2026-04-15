import { describe, it, expect } from 'vitest';

// Re-declare the pure utility functions for testing (they're global in the browser)
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleBetween(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

function circleCollision(x1, y1, r1, x2, y2, r2) {
  const dist = distance(x1, y1, x2, y2);
  return dist < r1 + r2;
}

function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function angleDiff(a, b) {
  return Math.abs(normalizeAngle(a - b));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('clamps to min when below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it('clamps to max when above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it('handles equal min and max', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});

describe('distance', () => {
  it('returns 0 for same point', () => {
    expect(distance(0, 0, 0, 0)).toBe(0);
  });
  it('calculates horizontal distance', () => {
    expect(distance(0, 0, 3, 0)).toBe(3);
  });
  it('calculates diagonal distance (3-4-5 triangle)', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
  });
});

describe('angleBetween', () => {
  it('returns 0 for point directly to the right', () => {
    expect(angleBetween(0, 0, 1, 0)).toBe(0);
  });
  it('returns PI/2 for point directly below', () => {
    expect(angleBetween(0, 0, 0, 1)).toBeCloseTo(Math.PI / 2);
  });
  it('returns PI for point directly to the left', () => {
    expect(angleBetween(0, 0, -1, 0)).toBeCloseTo(Math.PI);
  });
});

describe('randomRange', () => {
  it('returns values within range', () => {
    for (let i = 0; i < 100; i++) {
      const val = randomRange(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThan(10);
    }
  });
});

describe('randomInt', () => {
  it('returns integers within range', () => {
    for (let i = 0; i < 100; i++) {
      const val = randomInt(1, 6);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(6);
      expect(Number.isInteger(val)).toBe(true);
    }
  });
});

describe('circleCollision', () => {
  it('detects overlapping circles', () => {
    expect(circleCollision(0, 0, 10, 5, 0, 10)).toBe(true);
  });
  it('detects non-overlapping circles', () => {
    expect(circleCollision(0, 0, 5, 20, 0, 5)).toBe(false);
  });
  it('touching circles are not colliding (strict less-than)', () => {
    expect(circleCollision(0, 0, 5, 10, 0, 5)).toBe(false);
  });
});

describe('pointInRect', () => {
  it('detects point inside rect', () => {
    expect(pointInRect(5, 5, 0, 0, 10, 10)).toBe(true);
  });
  it('detects point outside rect', () => {
    expect(pointInRect(15, 5, 0, 0, 10, 10)).toBe(false);
  });
  it('point on edge is inside', () => {
    expect(pointInRect(0, 0, 0, 0, 10, 10)).toBe(true);
  });
});

describe('normalizeAngle', () => {
  it('keeps angle in [-PI, PI]', () => {
    const result = normalizeAngle(3 * Math.PI);
    expect(result).toBeCloseTo(Math.PI);
  });
  it('normalizes negative angle', () => {
    const result = normalizeAngle(-3 * Math.PI);
    expect(result).toBeCloseTo(-Math.PI);
  });
});

describe('lerp', () => {
  it('returns a at t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });
  it('returns b at t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });
  it('returns midpoint at t=0.5', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
});
