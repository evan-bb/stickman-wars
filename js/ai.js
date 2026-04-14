// ============================================
// AI Controller - 4 State FSM
// ============================================

class AIController {
    constructor(entity) {
        this.entity = entity;
        this.state = AI_STATES.ROAM;
        this.target = null;
        this.roamTarget = { x: entity.x, y: entity.y };
        this.roamTimer = 0;
        this.fleeTimer = 0;
        this.homeX = entity.x;
        this.homeY = entity.y;
    }

    update(dt, spatialGrid, projectiles, particles) {
        const e = this.entity;
        if (!e.alive) return;

        switch (this.state) {
            case AI_STATES.ROAM:
                this.updateRoam(dt, spatialGrid);
                break;
            case AI_STATES.CHASE:
                this.updateChase(dt, spatialGrid);
                break;
            case AI_STATES.ATTACK:
                this.updateAttack(dt, spatialGrid, projectiles, particles);
                break;
            case AI_STATES.FLEE:
                this.updateFlee(dt, spatialGrid);
                break;
        }
    }

    updateRoam(dt, grid) {
        const e = this.entity;

        this.roamTimer -= dt;
        if (this.roamTimer <= 0) {
            // Pick new roam target, biased toward home
            const biasHome = Math.random() < 0.7;
            if (biasHome) {
                this.roamTarget.x = this.homeX + randomRange(-200, 200);
                this.roamTarget.y = this.homeY + randomRange(-200, 200);
            } else {
                this.roamTarget.x = e.x + randomRange(-300, 300);
                this.roamTarget.y = e.y + randomRange(-300, 300);
            }
            this.roamTarget.x = clamp(this.roamTarget.x, 20, WORLD_WIDTH - 20);
            this.roamTarget.y = clamp(this.roamTarget.y, 20, WORLD_HEIGHT - 20);
            this.roamTimer = randomRange(2, 4);
        }

        this.moveToward(this.roamTarget.x, this.roamTarget.y, dt, 1.0);

        // Scan for enemies
        const enemy = this.findNearestEnemy(grid);
        if (enemy) {
            this.target = enemy;
            this.state = AI_STATES.CHASE;
        }
    }

    updateChase(dt, grid) {
        const e = this.entity;

        if (!this.target || !this.target.alive) {
            this.target = null;
            this.state = AI_STATES.ROAM;
            return;
        }

        const dist = distance(e.x, e.y, this.target.x, this.target.y);

        if (dist > AI_DETECTION_RANGE * 1.6) {
            this.target = null;
            this.state = AI_STATES.ROAM;
            return;
        }

        if (e.health / e.maxHealth < AI_FLEE_HEALTH_PCT) {
            this.state = AI_STATES.FLEE;
            this.fleeTimer = 3;
            return;
        }

        const attackRange = e.weapon ? e.weapon.range + AI_ATTACK_RANGE_BUFFER : 40;
        if (dist <= attackRange) {
            this.state = AI_STATES.ATTACK;
            return;
        }

        this.moveToward(this.target.x, this.target.y, dt, 1.0);
    }

    updateAttack(dt, grid, projectiles, particles) {
        const e = this.entity;

        if (!this.target || !this.target.alive) {
            this.target = null;
            this.state = AI_STATES.ROAM;
            return;
        }

        const dist = distance(e.x, e.y, this.target.x, this.target.y);
        const attackRange = e.weapon ? e.weapon.range + AI_ATTACK_RANGE_BUFFER : 40;

        if (dist > attackRange * 1.3) {
            this.state = AI_STATES.CHASE;
            return;
        }

        if (e.health / e.maxHealth < AI_FLEE_HEALTH_PCT) {
            this.state = AI_STATES.FLEE;
            this.fleeTimer = 3;
            return;
        }

        // Face target
        e.facing = angleBetween(e.x, e.y, this.target.x, this.target.y);

        // Slow approach
        if (dist > attackRange * 0.5) {
            this.moveToward(this.target.x, this.target.y, dt, 0.3);
        }

        // Attack
        if (e.weapon && e.weapon.canAttack()) {
            const accuracy = e.weapon.type === 'melee' ? AI_MELEE_ACCURACY : AI_RANGED_ACCURACY;
            const entities = grid.getNearby(e.x, e.y, attackRange + 20);
            e.weapon.attack(e, entities, projectiles, particles, accuracy);
            // Apply AI cooldown penalty (AI attacks 20% slower than player)
            e.weapon.cooldownTimer *= AI_COOLDOWN_PENALTY;
        }
    }

    updateFlee(dt, grid) {
        const e = this.entity;

        this.fleeTimer -= dt;
        if (this.fleeTimer <= 0) {
            this.state = AI_STATES.ROAM;
            return;
        }

        // Run away from nearest enemy
        const enemy = this.findNearestEnemy(grid);
        if (enemy) {
            const angle = angleBetween(enemy.x, enemy.y, e.x, e.y);
            const fleeX = e.x + Math.cos(angle) * 200;
            const fleeY = e.y + Math.sin(angle) * 200;
            this.moveToward(fleeX, fleeY, dt, 1.2);
        } else {
            this.state = AI_STATES.ROAM;
        }
    }

    moveToward(tx, ty, dt, speedMult) {
        const e = this.entity;
        const angle = angleBetween(e.x, e.y, tx, ty);
        e.facing = angle;
        e.moveFacing = angle;
        const spd = e.speed * speedMult;
        e.vx = Math.cos(angle) * spd;
        e.vy = Math.sin(angle) * spd;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.x = clamp(e.x, 10, WORLD_WIDTH - 10);
        e.y = clamp(e.y, 10, WORLD_HEIGHT - 10);
    }

    findNearestEnemy(grid) {
        const e = this.entity;
        const nearby = grid.getNearby(e.x, e.y, AI_DETECTION_RANGE);
        let closest = null;
        let closestDist = Infinity;

        for (const other of nearby) {
            if (!other.alive || other.team === e.team) continue;
            const d = distance(e.x, e.y, other.x, other.y);
            if (d < closestDist && d <= AI_DETECTION_RANGE) {
                closestDist = d;
                closest = other;
            }
        }
        return closest;
    }
}

// Spatial Grid for efficient neighbor queries
class SpatialGrid {
    constructor(worldW, worldH, cellSize) {
        this.cellSize = cellSize;
        this.cols = Math.ceil(worldW / cellSize);
        this.rows = Math.ceil(worldH / cellSize);
        this.cells = new Array(this.cols * this.rows);
    }

    clear() {
        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i] = null;
        }
    }

    insert(entity) {
        const cx = Math.floor(entity.x / this.cellSize);
        const cy = Math.floor(entity.y / this.cellSize);
        if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return;
        const idx = cy * this.cols + cx;
        if (!this.cells[idx]) this.cells[idx] = [];
        this.cells[idx].push(entity);
    }

    getNearby(x, y, range) {
        const results = [];
        const minCX = Math.max(0, Math.floor((x - range) / this.cellSize));
        const maxCX = Math.min(this.cols - 1, Math.floor((x + range) / this.cellSize));
        const minCY = Math.max(0, Math.floor((y - range) / this.cellSize));
        const maxCY = Math.min(this.rows - 1, Math.floor((y + range) / this.cellSize));

        for (let cy = minCY; cy <= maxCY; cy++) {
            for (let cx = minCX; cx <= maxCX; cx++) {
                const cell = this.cells[cy * this.cols + cx];
                if (cell) {
                    for (const e of cell) results.push(e);
                }
            }
        }
        return results;
    }
}
