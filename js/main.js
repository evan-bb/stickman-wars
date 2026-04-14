// ============================================
// Main - Bootstrap
// ============================================

window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Prevent default on keys that might scroll
    window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
    });

    window.game = new Game(canvas);
    window.game.start();
});
