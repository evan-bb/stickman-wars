// ============================================
// Stickman Drawing
// ============================================

function drawStickman(ctx, entity, camera) {
    if (!camera.isVisible(entity.x, entity.y, 30)) return;
    const pos = camera.worldToScreen(entity.x, entity.y);
    const { x, y } = pos;
    const color = TEAM_COLORS[entity.team] || '#FFFFFF';
    const isPlayer = entity.isPlayer;

    // Dance emote: play a full custom dance animation instead of the usual pose
    if (isPlayer && entity.alive && entity.emote && entity.emote.key === 'dance') {
        drawDancingStickman(ctx, entity, x, y, color);
        if (window.game && window.game.progression) {
            // Compute current head position for hat (matches dance routine)
            const t = (EMOTE_DURATION - entity.emoteTimer) * 6;
            const bounce = -Math.abs(Math.sin(t)) * 4;
            const sway = Math.sin(t * 0.5) * 4;
            const headY = y - 24 + bounce;
            window.game.progression.drawHat(ctx, x + sway, headY, window.game.progression.equippedHat);
        }
        // Health bar still shown if hurt
        if (entity.health < entity.maxHealth) {
            drawHealthBar(ctx, x, y - 32, 24, 3, entity.health / entity.maxHealth, color);
        }
        return;
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = isPlayer ? 2.5 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isPlayer) {
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = 6;
    }

    const attackSwing = entity.attackAnim > 0 ? entity.attackAnim : 0;
    const isoFacing = worldAngleToIso(entity.facing);

    // Movement detection
    const isMoving = entity.alive && (Math.abs(entity.vx || 0) > 5 || Math.abs(entity.vy || 0) > 5);
    const wt = entity.walkTimer * 8;
    const sin1 = isMoving ? Math.sin(wt) : 0;
    const sin2 = isMoving ? Math.sin(wt + Math.PI) : 0;
    const abs1 = Math.abs(sin1);
    const abs2 = Math.abs(sin2);

    // Use movement direction for stride, not aiming direction
    // Player faces mouse for aiming but walks in WASD direction
    const moveFacing = entity.moveFacing != null
        ? worldAngleToIso(entity.moveFacing)
        : isoFacing;

    // Iso stride direction - legs/arms swing along movement direction
    const faceDx = isMoving ? Math.cos(moveFacing) : 0;
    const faceDy = isMoving ? Math.sin(moveFacing) : 0;

    // Body bounce (up at mid-stride)
    const bounce = isMoving ? -abs1 * 1.8 : 0;

    // Anchor points
    const hipX = x;
    const hipY = y + bounce;
    const shoulderX = hipX;
    const shoulderY = hipY - 16;
    const headY = shoulderY - 8 + (isMoving ? -abs1 * 1.5 : 0);

    // -- HEAD --
    ctx.beginPath();
    ctx.arc(x, headY, 6, 0, Math.PI * 2);
    ctx.stroke();
    if (isPlayer) {
        ctx.fillStyle = color;
        ctx.fill();
    }

    // -- TORSO --
    ctx.beginPath();
    ctx.moveTo(x, shoulderY);
    ctx.lineTo(hipX, hipY);
    ctx.stroke();

    // -- LEGS --
    // Each leg steps along the iso-facing direction on the ground plane.
    // The stride is projected: big horizontal component along faceDx,
    // smaller vertical component (foreshortened by iso), plus knee bend.
    const strideLen = 7;  // how far forward/back foot goes
    const legDrop = 14;   // vertical distance hip to foot at rest

    // Helper: compute knee+foot for one leg given its stride phase (-1 to 1)
    function legPoints(phase) {
        // Foot position: stride along facing direction on ground plane
        const footFwdX = phase * strideLen * faceDx;
        const footFwdY = phase * strideLen * faceDy * 0.5; // iso foreshorten Y
        // Foot lifts off ground at mid-stride
        const footLift = (1 - phase * phase) * 4; // parabolic lift
        const footX = hipX + footFwdX;
        const footY = hipY + legDrop + footFwdY - (isMoving ? footLift : 0);
        // Knee bends outward from the midpoint, more when foot is lifted
        const midX = (hipX + footX) / 2;
        const midY = (hipY + footY) / 2;
        const kneeBend = isMoving ? (1 - phase * phase) * 3 : 1;
        // Knee offsets perpendicular to stride direction
        const perpX = -faceDy;
        const perpY = faceDx * 0.5;
        const kneeX = midX + perpX * kneeBend * 0.3;
        const kneeY = midY - kneeBend; // knees bend upward
        return { kneeX, kneeY, footX, footY };
    }

    const lLeg = legPoints(sin1);
    const rLeg = legPoints(sin2);

    // Idle splay when standing still
    if (!isMoving) {
        lLeg.footX = hipX - 5;
        lLeg.footY = hipY + legDrop;
        lLeg.kneeX = hipX - 3;
        lLeg.kneeY = hipY + 7;
        rLeg.footX = hipX + 5;
        rLeg.footY = hipY + legDrop;
        rLeg.kneeX = hipX + 3;
        rLeg.kneeY = hipY + 7;
    }

    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(lLeg.kneeX, lLeg.kneeY);
    ctx.lineTo(lLeg.footX, lLeg.footY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(rLeg.kneeX, rLeg.kneeY);
    ctx.lineTo(rLeg.footX, rLeg.footY);
    ctx.stroke();

    // -- ARMS --
    const armLen = 10;

    if (attackSwing > 0) {
        // Attack arm
        const swingAngle = isoFacing - 0.5 + attackSwing * 1.5;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY + 2);
        ctx.lineTo(shoulderX + Math.cos(swingAngle) * 12, shoulderY + 2 + Math.sin(swingAngle) * 12);
        ctx.stroke();
        // Back arm hangs
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY + 2);
        ctx.lineTo(shoulderX - faceDx * 4, shoulderY + armLen);
        ctx.stroke();

        if (entity.weapon) {
            drawWeaponSwing(ctx, shoulderX, shoulderY + 2, isoFacing, attackSwing, entity.weapon);
        }
    } else {
        // Arms swing opposite to legs, along facing direction
        // Left arm swings with right leg (natural cross-gait)
        const lArmFwd = sin2 * 0.7; // opposite leg
        const rArmFwd = sin1 * 0.7;

        // Left arm
        const lElbowX = shoulderX + lArmFwd * strideLen * faceDx * 0.4 - 3;
        const lElbowY = shoulderY + 5 + lArmFwd * strideLen * faceDy * 0.2;
        const lHandX = lElbowX + (isMoving ? lArmFwd * 2 * faceDx : -2);
        const lHandY = lElbowY + 5;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY + 2);
        ctx.lineTo(lElbowX, lElbowY);
        ctx.lineTo(lHandX, lHandY);
        ctx.stroke();

        // Right arm
        const rElbowX = shoulderX + rArmFwd * strideLen * faceDx * 0.4 + 3;
        const rElbowY = shoulderY + 5 + rArmFwd * strideLen * faceDy * 0.2;
        const rHandX = rElbowX + (isMoving ? rArmFwd * 2 * faceDx : 2);
        const rHandY = rElbowY + 5;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY + 2);
        ctx.lineTo(rElbowX, rElbowY);
        ctx.lineTo(rHandX, rHandY);
        ctx.stroke();

        if (entity.weapon) {
            drawWeaponHeld(ctx, rHandX, rHandY, isoFacing, entity.weapon);
        }
    }

    ctx.restore();

    // Draw hat on player
    if (isPlayer && window.game && window.game.progression) {
        window.game.progression.drawHat(ctx, x, headY, window.game.progression.equippedHat);
    }

    // Health bar
    if (entity.health < entity.maxHealth && entity.alive) {
        drawHealthBar(ctx, x, headY - 10, 24, 3, entity.health / entity.maxHealth, color);
    }
}

function drawStickmanDeath(ctx, entity, camera) {
    if (!camera.isVisible(entity.x, entity.y, 40)) return;
    const pos = camera.worldToScreen(entity.x, entity.y);
    const { x, y } = pos;
    const color = TEAM_COLORS[entity.team] || '#FFFFFF';
    const isPlayer = entity.isPlayer;

    const maxTimer = entity.deathMaxTimer || 1.8;
    const elapsed = maxTimer - entity.deathTimer;
    const progress = clamp(elapsed / maxTimer, 0, 1);

    // Phase 1: Fall over (0 to 0.4s) - rotate from upright to lying on side
    // Phase 2: Lie on ground (0.4s to 1.2s) - stay flat
    // Phase 3: Fade out (1.2s to 1.8s) - alpha drops to 0
    const fallDuration = 0.4;
    const fallProgress = clamp(elapsed / fallDuration, 0, 1);
    // Ease-in fall (accelerating like gravity)
    const fallAngle = fallProgress * fallProgress * (Math.PI / 2) * (entity.fallDir || 1);
    // Slide along ground as they fall
    const slideX = fallProgress * 8 * (entity.fallDir || 1);

    // Fade out in final phase
    const fadeStart = 1.2;
    const fadeDuration = maxTimer - fadeStart;
    let alpha = 1;
    if (elapsed > fadeStart) {
        alpha = clamp(1 - (elapsed - fadeStart) / fadeDuration, 0, 1);
    }
    // Brief red flash on initial hit
    const hitFlash = elapsed < 0.1;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Translate to feet position, rotate around the base
    ctx.translate(x + slideX, y);
    ctx.rotate(fallAngle);

    ctx.strokeStyle = hitFlash ? '#FF8888' : color;
    ctx.lineWidth = isPlayer ? 2.5 : 2;
    ctx.lineCap = 'round';

    if (isPlayer && hitFlash) {
        ctx.shadowColor = '#FF4444';
        ctx.shadowBlur = 10;
    }

    // Head
    ctx.beginPath();
    ctx.arc(0, -22, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(0, 0);
    ctx.stroke();

    // Arms (limp, hanging down)
    const armY = -12;
    const armDroop = fallProgress * 6;
    ctx.beginPath();
    ctx.moveTo(-8, armY + armDroop);
    ctx.lineTo(0, armY);
    ctx.lineTo(8, armY + armDroop + 2);
    ctx.stroke();

    // Legs (limp)
    const legDroop = fallProgress * 4;
    ctx.beginPath();
    ctx.moveTo(-6, 10 + legDroop);
    ctx.lineTo(0, 0);
    ctx.lineTo(6, 12 + legDroop);
    ctx.stroke();

    // X eyes when fully fallen
    if (fallProgress >= 1) {
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 1.5;
        // Left eye
        ctx.beginPath();
        ctx.moveTo(-3, -24);
        ctx.lineTo(-1, -22);
        ctx.moveTo(-1, -24);
        ctx.lineTo(-3, -22);
        ctx.stroke();
        // Right eye
        ctx.beginPath();
        ctx.moveTo(1, -24);
        ctx.lineTo(3, -22);
        ctx.moveTo(3, -24);
        ctx.lineTo(1, -22);
        ctx.stroke();
    }

    ctx.restore();
}

function drawWeaponHeld(ctx, handX, handY, facing, weapon) {
    ctx.save();
    ctx.strokeStyle = weapon.color;
    ctx.lineWidth = 2;
    if (weapon.type === 'melee') {
        const len = weapon.range > 50 ? 18 : 14;
        ctx.beginPath();
        ctx.moveTo(handX, handY);
        ctx.lineTo(handX + Math.cos(facing - 0.3) * len, handY + Math.sin(facing - 0.3) * len);
        ctx.stroke();
    } else {
        // Ranged - draw small bow/gun shape
        ctx.beginPath();
        ctx.moveTo(handX, handY);
        ctx.lineTo(handX + Math.cos(facing) * 12, handY + Math.sin(facing) * 12);
        ctx.stroke();
        ctx.strokeStyle = '#888';
        ctx.beginPath();
        ctx.arc(handX + Math.cos(facing) * 6, handY + Math.sin(facing) * 6, 4, facing - 1, facing + 1);
        ctx.stroke();
    }
    ctx.restore();
}

function drawWeaponSwing(ctx, x, armY, facing, swing, weapon) {
    ctx.save();
    ctx.strokeStyle = weapon.color;
    ctx.lineWidth = 2.5;
    if (weapon.type === 'melee') {
        const swingAngle = facing - 1.0 + swing * 2.5;
        const len = weapon.range > 50 ? 22 : 16;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(swingAngle) * 6, armY + Math.sin(swingAngle) * 6);
        ctx.lineTo(x + Math.cos(swingAngle) * (6 + len), armY + Math.sin(swingAngle) * (6 + len));
        ctx.stroke();
    }
    ctx.restore();
}

// Custom dance pose with bouncing hips, swaying body, and "Saturday Night Fever"
// alternating disco-point arms. Time-based, runs while the dance emote is active.
function drawDancingStickman(ctx, entity, x, y, color) {
    // Phase derived from emote elapsed time (smooth & deterministic)
    const elapsed = (EMOTE_DURATION || 2.4) - entity.emoteTimer;
    const t = elapsed * 6;          // beat speed
    const beat = Math.sin(t);
    const beat2 = Math.sin(t * 2);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 6;

    // Hip sway side to side, body bounce on each beat
    const sway = Math.sin(t * 0.5) * 4;        // left/right hip sway
    const bounce = -Math.abs(beat) * 4;        // up/down bounce

    const hipX = x + sway;
    const hipY = y + bounce;
    const shoulderX = hipX + sway * 0.4;       // shoulders sway opposite to hips a bit
    const shoulderY = hipY - 16;
    const headY = shoulderY - 8;

    // Head (with a slight tilt that follows the beat)
    const headTilt = Math.sin(t) * 0.2;
    ctx.beginPath();
    ctx.arc(hipX + sway * 0.4 + Math.sin(headTilt) * 2, headY, 6, 0, Math.PI * 2);
    ctx.stroke();
    if (entity.isPlayer) {
        ctx.fillStyle = color;
        ctx.fill();
    }

    // Torso
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(hipX, hipY);
    ctx.stroke();

    // ---- Arms: alternating disco point ----
    // Up-arm goes diagonally up, down-arm goes diagonally down hip-level.
    // They swap on each beat.
    const armUp = beat > 0;
    const upAngle = armUp ? -1.1 : -2.0;       // upper diagonal angle
    const downAngle = armUp ? 0.6 : 0.6;       // lower
    const upDx = Math.cos(upAngle) * 14;
    const upDy = Math.sin(upAngle) * 14;
    const downDx = Math.cos(downAngle) * 12;
    const downDy = Math.sin(downAngle) * 12;

    // Right arm (one of them up, the other down — switches with beat)
    const rightUp = armUp;
    const rightDx = rightUp ? upDx : -downDx;  // up arm reaches right; down arm hangs left
    const rightDy = rightUp ? upDy : downDy;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY + 2);
    // Elbow bend
    const rmidX = shoulderX + rightDx * 0.55;
    const rmidY = shoulderY + 2 + rightDy * 0.55;
    ctx.lineTo(rmidX, rmidY);
    ctx.lineTo(shoulderX + rightDx, shoulderY + 2 + rightDy);
    ctx.stroke();

    // Left arm (mirror)
    const leftDx = rightUp ? -downDx : upDx * -1;  // mirror behavior
    const leftDy = rightUp ? downDy : upDy;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY + 2);
    const lmidX = shoulderX + leftDx * 0.55;
    const lmidY = shoulderY + 2 + leftDy * 0.55;
    ctx.lineTo(lmidX, lmidY);
    ctx.lineTo(shoulderX + leftDx, shoulderY + 2 + leftDy);
    ctx.stroke();

    // ---- Legs: bouncy alternating step (one bent each beat) ----
    const legDrop = 14;
    const stepLeftRaised = beat2 > 0;
    // Left leg
    {
        const raised = stepLeftRaised;
        const footX = hipX - 5 + (raised ? 2 : 0);
        const footY = hipY + legDrop - (raised ? 5 : 0);
        const kneeX = hipX - 4 + (raised ? -1 : 0);
        const kneeY = hipY + 7 - (raised ? 3 : 0);
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
        ctx.stroke();
    }
    // Right leg
    {
        const raised = !stepLeftRaised;
        const footX = hipX + 5 + (raised ? -2 : 0);
        const footY = hipY + legDrop - (raised ? 5 : 0);
        const kneeX = hipX + 4 + (raised ? 1 : 0);
        const kneeY = hipY + 7 - (raised ? 3 : 0);
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
        ctx.stroke();
    }

    ctx.restore();

    // Floor sparkle ring on each beat (visual flair)
    const ringPulse = Math.max(0, beat);
    if (ringPulse > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(255, 102, 204, ${0.4 * ringPulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y + legDrop, 16 + ringPulse * 6, 5 + ringPulse * 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

function drawHealthBar(ctx, x, y, width, height, pct, color) {
    const hw = width / 2;
    ctx.fillStyle = '#333';
    ctx.fillRect(x - hw, y, width, height);
    ctx.fillStyle = pct > 0.5 ? '#44CC44' : pct > 0.25 ? '#CCCC44' : '#CC4444';
    ctx.fillRect(x - hw, y, width * pct, height);
}
