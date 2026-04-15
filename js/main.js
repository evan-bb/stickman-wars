// ============================================
// Main - Bootstrap
// ============================================

window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Fit canvas to screen while maintaining aspect ratio
    function resizeCanvas() {
        const aspect = CANVAS_WIDTH / CANVAS_HEIGHT;
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const winAspect = winW / winH;

        if (winAspect > aspect) {
            // Window is wider than canvas — fit to height
            canvas.style.height = winH + 'px';
            canvas.style.width = (winH * aspect) + 'px';
        } else {
            // Window is taller than canvas — fit to width
            canvas.style.width = winW + 'px';
            canvas.style.height = (winW / aspect) + 'px';
        }
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    screen.orientation && screen.orientation.addEventListener('change', () => {
        setTimeout(resizeCanvas, 100);
    });

    // Prevent default on keys that might scroll
    window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
    });

    window.game = new Game(canvas);
    window.game.start();
});
