// ============================================
// Touch Controls for Mobile
// ============================================

class TouchControls {
    constructor(canvas, input) {
        this.canvas = canvas;
        this.input = input;
        this.active = false;

        // Virtual joystick state
        this.joystick = {
            active: false,
            touchId: null,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            dx: 0,
            dy: 0
        };

        // Attack side touch
        this.attackTouch = {
            active: false,
            touchId: null,
            x: 0,
            y: 0
        };

        // Button zones (canvas coordinates)
        this.interactBtn = { x: CANVAS_WIDTH - 80, y: CANVAS_HEIGHT - 180, r: 32 };
        this.sprintBtn = { x: 200, y: CANVAS_HEIGHT - 300, r: 28 };

        // Track interact/sprint state
        this.interactPressed = false;
        this.sprintPressed = false;

        // Detect touch device
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (this.isTouchDevice) {
            this.active = true;
            this.bindEvents();
        }
    }

    bindEvents() {
        const c = this.canvas;
        c.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        c.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        c.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
        c.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });
    }

    // Convert a touch clientX/clientY to canvas-space coordinates
    toCanvas(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    isInCircle(cx, cy, r, px, py) {
        const dx = px - cx;
        const dy = py - cy;
        return dx * dx + dy * dy <= r * r;
    }

    // States where taps should act as clicks (not game controls)
    _isUIState() {
        const state = window.game && window.game.state;
        return state === 'MENU' || state === 'COSMETICS' || state === 'WEAPON_SELECT' ||
               state === 'WIN' || state === 'LOSE' ||
               state === 'MP_LOBBY' || state === 'MP_RESULT';
    }

    // Bounding box of the inventory bar (bottom-center of screen).
    // Must match hud.js drawInventoryBar dimensions.
    _getInventoryBox() {
        const slotSize = 48;
        const slotGap = 4;
        const pad = 6;
        const inv = window.game && window.game.player && window.game.player.inventory;
        const invLen = inv ? inv.length : 0;
        const maxSlots = Math.max(invLen, 8);
        const totalW = maxSlots * slotSize + (maxSlots - 1) * slotGap;
        const barX = (CANVAS_WIDTH - totalW) / 2;
        const barY = CANVAS_HEIGHT - 56;
        return {
            x: barX - pad - 4,              // a little extra touch slop
            y: barY - pad - 4,
            w: totalW + pad * 2 + 8,
            h: slotSize + pad * 2 + 8
        };
    }

    _inInventoryBox(px, py) {
        const b = this._getInventoryBox();
        return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
    }

    // Bounding box of the floating emote button. Match game.js _drawEmoteButton.
    _inEmoteButtonBox(px, py) {
        const bw = 44, bh = 44;
        const bx = CANVAS_WIDTH - bw - 12;
        const by = 200;
        const slop = 8;
        return px >= bx - slop && px <= bx + bw + slop &&
               py >= by - slop && py <= by + bh + slop;
    }

    _emoteWheelOpen() {
        return !!(window.game && window.game.emoteWheelOpen);
    }

    onTouchStart(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const pos = this.toCanvas(touch.clientX, touch.clientY);

            // On UI screens (menu, cosmetics, weapon select, win/lose), every tap is a click
            if (this._isUIState()) {
                this.input.mouseX = pos.x;
                this.input.mouseY = pos.y;
                this.input.mouseClicked = true;
                continue;
            }

            // Check interact button
            if (this.isInCircle(this.interactBtn.x, this.interactBtn.y, this.interactBtn.r + 10, pos.x, pos.y)) {
                this.interactPressed = true;
                this.input.keys['e'] = true;
                continue;
            }

            // Check sprint button
            if (this.isInCircle(this.sprintBtn.x, this.sprintBtn.y, this.sprintBtn.r + 10, pos.x, pos.y)) {
                this.sprintPressed = true;
                this.input.keys['r'] = true;
                continue;
            }

            // Check Flee button (boss fights only)
            const fleeBtn = this.getFleeBtn();
            if (fleeBtn && pos.x > fleeBtn.x && pos.x < fleeBtn.x + fleeBtn.w &&
                pos.y > fleeBtn.y && pos.y < fleeBtn.y + fleeBtn.h) {
                this.input.keys['escape'] = true;
                continue;
            }

            // Inventory bar: taps here act as clicks (not joystick / not attack).
            // Lets the player select any slot, including ones in the left-half joystick zone.
            if (this._inInventoryBox(pos.x, pos.y)) {
                this.input.mouseX = pos.x;
                this.input.mouseY = pos.y;
                this.input.mouseClicked = true;
                continue;
            }

            // Emote button: tap to open/close the wheel; never trigger joystick.
            if (this._inEmoteButtonBox(pos.x, pos.y)) {
                this.input.mouseX = pos.x;
                this.input.mouseY = pos.y;
                this.input.mouseClicked = true;
                continue;
            }

            // While the emote wheel is OPEN, every tap is a click — pick an emote
            // or tap outside to close. Don't spawn the joystick.
            if (this._emoteWheelOpen()) {
                this.input.mouseX = pos.x;
                this.input.mouseY = pos.y;
                this.input.mouseClicked = true;
                continue;
            }

            // Left half = joystick
            if (pos.x < CANVAS_WIDTH / 2 && !this.joystick.active) {
                this.joystick.active = true;
                this.joystick.touchId = touch.identifier;
                this.joystick.startX = pos.x;
                this.joystick.startY = pos.y;
                this.joystick.currentX = pos.x;
                this.joystick.currentY = pos.y;
                this.joystick.dx = 0;
                this.joystick.dy = 0;
            }
            // Right half = aim + attack
            else if (pos.x >= CANVAS_WIDTH / 2 && !this.attackTouch.active) {
                this.attackTouch.active = true;
                this.attackTouch.touchId = touch.identifier;
                this.attackTouch.x = pos.x;
                this.attackTouch.y = pos.y;

                // Set mouse position for aiming
                this.input.mouseX = pos.x;
                this.input.mouseY = pos.y;
                this.input.mouseDown = true;
                this.input.mouseClicked = true;
            }
        }
    }

    getFleeBtn() {
        const state = window.game && window.game.state;
        const inBossFight = state === 'BOSS_FIGHT' || state === 'GHOST_FIGHT' ||
                            state === 'CRAB_FIGHT' || state === 'POLAR_FIGHT' || state === 'LAVA_FIGHT' ||
                            state === 'LION_FIGHT' || state === 'CLOWN_FIGHT' || state === 'OCEAN';
        if (!inBossFight) return null;
        return { x: CANVAS_WIDTH - 110, y: 12, w: 94, h: 32 };
    }

    onTouchMove(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const pos = this.toCanvas(touch.clientX, touch.clientY);

            if (touch.identifier === this.joystick.touchId && this.joystick.active) {
                this.joystick.currentX = pos.x;
                this.joystick.currentY = pos.y;

                let dx = pos.x - this.joystick.startX;
                let dy = pos.y - this.joystick.startY;

                // Clamp to max radius
                const maxR = 60;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > maxR) {
                    dx = (dx / dist) * maxR;
                    dy = (dy / dist) * maxR;
                }

                this.joystick.dx = dx / maxR;
                this.joystick.dy = dy / maxR;

                // Map screen joystick to isometric WASD keys
                this.updateMovementKeys();
            }

            if (touch.identifier === this.attackTouch.touchId && this.attackTouch.active) {
                this.attackTouch.x = pos.x;
                this.attackTouch.y = pos.y;
                this.input.mouseX = pos.x;
                this.input.mouseY = pos.y;
            }
        }
    }

    onTouchEnd(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            if (touch.identifier === this.joystick.touchId) {
                this.joystick.active = false;
                this.joystick.touchId = null;
                this.joystick.dx = 0;
                this.joystick.dy = 0;
                // Release all movement keys
                this.input.keys['w'] = false;
                this.input.keys['a'] = false;
                this.input.keys['s'] = false;
                this.input.keys['d'] = false;
            }

            if (touch.identifier === this.attackTouch.touchId) {
                this.attackTouch.active = false;
                this.attackTouch.touchId = null;
                this.input.mouseDown = false;
            }
        }

        // Release interact/sprint if no touches remain
        if (e.touches.length === 0) {
            if (this.interactPressed) {
                this.interactPressed = false;
                this.input.keys['e'] = false;
            }
            if (this.sprintPressed) {
                this.sprintPressed = false;
                this.input.keys['r'] = false;
            }
        }
    }

    updateMovementKeys() {
        const dx = this.joystick.dx;
        const dy = this.joystick.dy;
        const deadzone = 0.25;

        // The game uses isometric WASD mapping:
        // W = up-left (-x, -y world), S = down-right (+x, +y world)
        // A = down-left (-x, +y world), D = up-right (+x, -y world)
        // On screen (isometric), up = -dy, right = +dx
        // Map screen directions to the WASD keys that produce the corresponding iso movement

        // Screen up/down/left/right to WASD:
        // Screen up (-dy) -> W (moves iso up-left)
        // Screen down (+dy) -> S (moves iso down-right)
        // Screen left (-dx) -> A (moves iso down-left... but visually left)
        // Screen right (+dx) -> D (moves iso up-right... but visually right)

        this.input.keys['w'] = dy < -deadzone;
        this.input.keys['s'] = dy > deadzone;
        this.input.keys['a'] = dx < -deadzone;
        this.input.keys['d'] = dx > deadzone;
    }

    draw(ctx) {
        if (!this.active) return;

        // Draw virtual joystick
        if (this.joystick.active) {
            // Outer ring
            ctx.beginPath();
            ctx.arc(this.joystick.startX, this.joystick.startY, 60, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fill();

            // Inner thumb
            const thumbX = this.joystick.startX + this.joystick.dx * 60;
            const thumbY = this.joystick.startY + this.joystick.dy * 60;
            ctx.beginPath();
            ctx.arc(thumbX, thumbY, 24, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fill();
        } else {
            // Show joystick hint area
            const hintX = 130, hintY = CANVAS_HEIGHT - 150;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.beginPath();
            ctx.arc(hintX, hintY, 65, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Crosshair lines inside the circle
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hintX, hintY - 25);
            ctx.lineTo(hintX, hintY + 25);
            ctx.moveTo(hintX - 25, hintY);
            ctx.lineTo(hintX + 25, hintY);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('MOVE', hintX, hintY + 4);
        }

        // Attack indicator on right side
        if (this.attackTouch.active) {
            ctx.beginPath();
            ctx.arc(this.attackTouch.x, this.attackTouch.y, 30, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 100, 100, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Interact button (E)
        this.drawButton(ctx, this.interactBtn.x, this.interactBtn.y, this.interactBtn.r,
            'E', this.interactPressed, '#FFD700');

        // Sprint button (R)
        this.drawButton(ctx, this.sprintBtn.x, this.sprintBtn.y, this.sprintBtn.r,
            'RUN', this.sprintPressed, '#44AAFF');
    }

    drawButton(ctx, x, y, r, label, pressed, color) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = pressed ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.35)';
        ctx.fill();
        ctx.strokeStyle = pressed ? color : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = pressed ? color : 'rgba(255,255,255,0.6)';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y);
        ctx.textBaseline = 'alphabetic';
    }
}
