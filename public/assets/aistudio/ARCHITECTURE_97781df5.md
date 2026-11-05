# ARCHITECTURE

## Stack (proposed, to confirm)
- HTML5 Canvas for drawing, plain JavaScript (ES modules), no frameworks.
- Why: fast to load, no build step, easy to read and change with Claude Code.
- Alternative if you prefer: Phaser (a game library). It adds structure and features but also a dependency to learn.

## Data model
- Level: id (1 to 50), plate width, ball speed, list of blocks, list of special rules.
- Block: type (square, rectangle, circle, triangle), position, size, hits to destroy, points.
- Player progress: highest unlocked level, best score per level. Saved in browser localStorage.
- No server and no database in the MVP.

## Files
- index.html: page, canvas, menus.
- js/main.js: game loop, state changes (menu, playing, paused, level clear, game over).
- js/physics.js: ball movement, collisions with plate, walls and blocks.
- js/render.js: drawing space background, blocks, plate, ball, HUD.
- js/levels.js: definitions of all 50 levels (generated from difficulty rules, with hand-tuned overrides).
- js/input.js: mouse position mapped to plate position.
- css/style.css: layout and HUD styling.

## Local folder to GitHub to deployment
1. Create a project folder with the four documents.
2. Build with Claude Code on Day 5 in that folder.
3. Push to a private GitHub repo.
4. Deploy as a static site on Cloudflare Pages, Vercel or Firebase Hosting. All three are free for a project this size.

## Constraints
- Desktop browsers only, mouse control.
- Works offline once loaded (no network calls during play).
