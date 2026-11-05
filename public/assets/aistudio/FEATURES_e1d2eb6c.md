# FEATURES

## MVP scope (must have)

### F1. Plate control
As a player, I want the plate to follow my mouse, so that I can aim the ball.
Done when: the plate tracks the cursor horizontally and stays inside the play area.

### F2. Ball and bounce
As a player, I want the ball to bounce off the plate, walls and blocks, so that I can break blocks.
Done when: the ball reflects off the plate, walls and blocks, and the bounce angle changes depending on where it hits the plate.

### F3. Blocks of four shapes
As a player, I want blocks in squares, rectangles, circles and triangles, so that the levels look varied.
Done when: each shape collides correctly with the ball and disappears after its required hits.

### F4. Lives and game over
As a player, I want to lose a life when the ball falls, so that there is risk.
Done when: 3 lives are shown, the ball resets on the plate after a loss, and the game ends at 0 lives.

### F5. Score
As a player, I want points for each block, so that I can compare results.
Done when: score is shown on the HUD and updates when a block breaks.

### F6. 50 levels with rising difficulty
As a player, I want 50 levels that get harder, so that the game lasts.
Done when: level 1 is easy, level 50 is hard, and levels unlock in order.

### F7. Level progression and save
As a player, I want my progress saved, so that I can return later.
Done when: after reload, the highest unlocked level and best scores remain.

### F8. Space theme
As a player, I want a galaxy background and sci-fi look, so that the game feels futuristic.
Done when: a starfield and planet/nebula background appear behind the play area.

## Proposed additions (later, not in MVP)
These are the ideas from the brief. I suggest keeping them out of the first build, then adding them one at a time.
- A2. Multi-ball: hitting a specific shape spawns an extra ball.
- A3. Slow motion: a power-up slows the balls for a few seconds.
- A4. Mud/blur effect: a visual distortion for hard levels (purely cosmetic, or a slowed ball).
- A5. Plate weapons: guns and rockets fired from the plate that destroy blocks.

## Out of scope
Multiplayer, mobile and touch controls, sound design beyond a simple effect, accounts, leaderboards.

## Acceptance check for MVP
Play levels 1 to 50 from start to finish with the mouse, with no crashes and no stuck states.
