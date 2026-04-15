// ============================================
// Input Handler
// ============================================

class InputHandler {
    constructor(canvas) {
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;
        this.mouseClicked = false;
        this.canvas = canvas;

        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.keys[e.code] = false;
        });
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            this.mouseX = (e.clientX - rect.left) * scaleX;
            this.mouseY = (e.clientY - rect.top) * scaleY;
        });
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.mouseDown = true;
                this.mouseClicked = true;
            }
        });
        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseDown = false;
        });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Scroll wheel for inventory
        this.scrollDelta = 0;
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.scrollDelta += (e.deltaY > 0) ? 1 : -1;
        }, { passive: false });
    }

    isKeyDown(key) {
        return !!this.keys[key];
    }

    consumeClick() {
        if (this.mouseClicked) {
            this.mouseClicked = false;
            return true;
        }
        return false;
    }

    getWorldMouse(camera) {
        return camera.screenToWorld(this.mouseX, this.mouseY);
    }

    consumeScroll() {
        const d = this.scrollDelta;
        this.scrollDelta = 0;
        return d;
    }

    endFrame() {
        this.mouseClicked = false;
    }
}
