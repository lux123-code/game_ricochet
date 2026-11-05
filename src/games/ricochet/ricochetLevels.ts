/**
 * 50 Progressive Levels for Ricochet: Orbit Breaker
 * Sector 1 is a direct faithful reconstruction of the iconic space station from image_99613b78.png.
 */

import { RicochetLevel, RicochetBrick, SpaceStationStructure, AsteroidDebris, PowerUpType } from './types';

export const RICOCHET_WIDTH = 750;
export const RICOCHET_HEIGHT = 700;

// Helper to generate asteroid polygon vertices
function createAsteroidPoints(radius: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const segments = 9;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const r = radius * (0.75 + Math.random() * 0.45);
    points.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    });
  }
  return points;
}

// Generate the 50 Ricochet Levels
export function generateRicochetLevels(): RicochetLevel[] {
  const levels: RicochetLevel[] = [];

  for (let lvl = 1; lvl <= 50; lvl++) {
    const bricks: RicochetBrick[] = [];
    const stationStructures: SpaceStationStructure[] = [];
    const asteroids: AsteroidDebris[] = [];

    const ballSpeed = Math.min(8.8, 5.2 + lvl * 0.07);
    const paddleWidth = Math.max(90, 130 - Math.floor(lvl / 6) * 4);

    if (lvl === 1) {
      // ===============================================================
      // SECTOR 1: EXACT RECREATION OF USER'S SCREENSHOT (image_99613b78.png)
      // ===============================================================
      const name = 'Orbital Ring Station Alpha';
      const subtitle = 'Signature Station: Ring Hull, Central Hub & Solar Arrays';

      // 1. Curved Outer Station Ring (arched over top behind bricks)
      stationStructures.push({
        id: 'station_ring_main',
        type: 'ring',
        x: 375,
        y: 360,
        width: 660,
        height: 380,
        radius: 310,
        startAngle: 1.12 * Math.PI,
        endAngle: 1.88 * Math.PI,
      });

      // 2. Central Hub Column (vertical elevator tube in background)
      stationStructures.push({
        id: 'central_hub_column',
        type: 'hub',
        x: 375,
        y: 330,
        width: 34,
        height: 250,
      });

      // 3. Solar Panel Arrays (horizontal wings in background)
      stationStructures.push({
        id: 'solar_panel_left',
        type: 'solar_panel',
        x: 300,
        y: 350,
        width: 85,
        height: 20,
      });
      stationStructures.push({
        id: 'solar_panel_right',
        type: 'solar_panel',
        x: 450,
        y: 350,
        width: 85,
        height: 20,
      });

      // (Bottom crossbar wall removed completely so ball flies unobstructed from paddle)

      // 5. Floating Asteroid on Right (as in screenshot)
      asteroids.push({
        id: 'asteroid_1',
        x: 585,
        y: 415,
        radius: 28,
        rotation: 0.4,
        rotationSpeed: 0.008,
        points: createAsteroidPoints(28),
      });

      // 6. Bricks Layout matching the screenshot:
      const brickW = 46;
      const brickH = 22;

      // Top cluster inside the ring (rows of metallic bricks with blue ion spheres & red hazard bricks)
      const topRows = [
        { y: 70, cols: [3, 4] },
        { y: 96, cols: [1, 2, 3, 4] },
        { y: 122, cols: [1, 2, 3, 4, 5] },
        { y: 148, cols: [2, 3, 4, 5] },
      ];

      topRows.forEach((row, rIdx) => {
        row.cols.forEach((colIdx) => {
          const bx = 220 + colIdx * (brickW + 4);
          const isIon = (rIdx === 1 && colIdx === 2) || (rIdx === 2 && colIdx === 3) || (rIdx === 3 && colIdx === 4);
          const isExp = (rIdx === 0 && colIdx === 3) || (rIdx === 2 && colIdx === 2);

          bricks.push({
            id: `b_top_${rIdx}_${colIdx}`,
            type: isExp ? 'explosive' : isIon ? 'ion_sphere' : 'metal',
            x: bx,
            y: row.y,
            width: brickW,
            height: brickH,
            hits: isIon ? 1 : 1,
            maxHits: 1,
            points: isExp ? 250 : isIon ? 200 : 100,
            powerup: isExp ? 'multiball' : isIon ? 'laser' : undefined,
          });
        });
      });

      // Top Red Hazard Brick in the very center top
      bricks.push({
        id: 'b_apex_red',
        type: 'explosive',
        x: 375,
        y: 42,
        width: brickW,
        height: brickH,
        hits: 1,
        maxHits: 1,
        points: 300,
        powerup: 'laser',
      });

      // Right cluster of metallic bricks (beside the central hub and above the asteroid)
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          const bx = 530 + c * (brickW + 4);
          const by = 230 + r * (brickH + 4);
          const isIon = r === 2 && c === 1;
          const isExp = r === 0 && c === 0;

          bricks.push({
            id: `b_right_${r}_${c}`,
            type: isExp ? 'explosive' : isIon ? 'ion_sphere' : 'metal',
            x: bx,
            y: by,
            width: brickW,
            height: brickH,
            hits: 1,
            maxHits: 1,
            points: isIon ? 200 : 100,
            powerup: r === 1 && c === 2 ? 'strikeball' : undefined,
          });
        }
      }

      // Left cluster of metallic bricks (stack along left wall and inner corridor)
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 2; c++) {
          const bx = 110 + c * (brickW + 4);
          const by = 270 + r * (brickH + 4);
          const isIon = r === 1 && c === 1;

          bricks.push({
            id: `b_left_${r}_${c}`,
            type: isIon ? 'ion_sphere' : 'metal',
            x: bx,
            y: by,
            width: brickW,
            height: brickH,
            hits: 1,
            maxHits: 1,
            points: isIon ? 200 : 100,
            powerup: r === 3 && c === 0 ? 'wide_shield' : undefined,
          });
        }
      }

      // Bricks under left curved ring
      for (let r = 0; r < 3; r++) {
        bricks.push({
          id: `b_under_ring_${r}`,
          type: r === 1 ? 'armored' : 'metal',
          x: 230,
          y: 350 + r * (brickH + 4),
          width: brickW,
          height: brickH,
          hits: r === 1 ? 2 : 1,
          maxHits: r === 1 ? 2 : 1,
          points: 150,
        });
      }

      // Small brick near asteroid
      bricks.push({
        id: 'b_near_asteroid',
        type: 'metal',
        x: 655,
        y: 415,
        width: brickW,
        height: brickH,
        hits: 1,
        maxHits: 1,
        points: 100,
      });

      levels.push({
        id: lvl,
        name,
        subtitle,
        ballSpeed,
        paddleWidth,
        bricks,
        stationStructures,
        asteroids,
      });
      continue;
    }

    // ===============================================================
    // SECTORS 2 TO 50: PROGRESSIVE RICOCHET SPACE ARCHITECTURES
    // ===============================================================
    const brickW = 46;
    const brickH = 22;

    const sectorNames = [
      'Ion Core Reactor', 'Quantum Lattice', 'Asteroid Foundry', 'Solar Dynamo',
      'Hyperion Gate', 'Prism Nexus', 'Pulsar Citadel', 'Dyson Ring',
      'Event Horizon', 'Nova Spire', 'Cosmic Vault', 'Titan Perimeter'
    ];

    const name = `Sector ${lvl}: ${sectorNames[(lvl - 2) % sectorNames.length]}`;
    const subtitle = `Orbital Defense Grid • Tier ${Math.ceil(lvl / 10)}`;

    // Add Station Structural Elements
    if (lvl % 2 === 0) {
      // Central beam / pillar
      stationStructures.push({
        id: `station_col_${lvl}`,
        type: 'hub',
        x: 375,
        y: 320,
        width: 32,
        height: 220,
      });
      stationStructures.push({
        id: `station_wing_${lvl}`,
        type: 'solar_panel',
        x: 375,
        y: 280,
        width: 200,
        height: 20,
      });
    }

    if (lvl % 3 === 0) {
      // Floating space asteroid
      asteroids.push({
        id: `ast_${lvl}`,
        x: lvl % 2 === 0 ? 600 : 150,
        y: 260 + (lvl % 4) * 40,
        radius: 30,
        rotation: 0.2,
        rotationSpeed: 0.01,
        points: createAsteroidPoints(30),
      });
    }

    // Layout patterns for the remaining sectors
    const rows = 4 + Math.min(5, Math.floor(lvl / 8));
    const cols = 9;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Skip some slots to create futuristic architectures (rings, diamonds, corridors)
        const midC = (cols - 1) / 2;
        const distFromMid = Math.abs(c - midC);

        if (lvl % 4 === 1 && distFromMid === 0 && r > 1) continue; // central corridor
        if (lvl % 4 === 2 && (r + c) % 2 === 1 && lvl > 10) continue; // checkerboard lattice
        if (lvl % 4 === 3 && distFromMid > 3 && r < 2) continue; // pyramid

        const bx = 110 + c * (brickW + 8);
        const by = 80 + r * (brickH + 7);

        // Brick type determination
        let type: RicochetBrick['type'] = 'metal';
        let hits = 1;
        let points = 100;
        let powerup: PowerUpType | undefined = undefined;

        if ((r === 1 || r === 2) && distFromMid <= 1) {
          type = 'ion_sphere';
          points = 200;
        } else if ((r + c + lvl) % 7 === 0) {
          type = 'explosive';
          points = 250;
          powerup = 'laser';
        } else if (lvl > 8 && r === 0) {
          type = 'armored';
          hits = Math.min(3, 2 + Math.floor(lvl / 20));
          points = 150 * hits;
        } else if ((r + c) % 5 === 0 && lvl > 5) {
          type = 'prism';
          points = 150;
        }

        // Random powerups
        if (!powerup && (r + c + lvl) % 11 === 0) {
          const ptypes: PowerUpType[] = ['multiball', 'laser', 'strikeball', 'wide_shield', 'catch', 'slowmo'];
          powerup = ptypes[(r * 3 + c) % ptypes.length];
        }

        bricks.push({
          id: `b_${lvl}_${r}_${c}`,
          type,
          x: bx,
          y: by,
          width: brickW,
          height: brickH,
          hits,
          maxHits: hits,
          points,
          powerup,
        });
      }
    }

    levels.push({
      id: lvl,
      name,
      subtitle,
      ballSpeed,
      paddleWidth,
      bricks,
      stationStructures,
      asteroids,
    });
  }

  return levels;
}
