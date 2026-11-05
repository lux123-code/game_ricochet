/**
 * High-precision Ricochet 2D Physics Engine
 * Handles curved shield bumper deflections, ion sphere collisions,
 * explosive chain reactions, and continuous sub-stepping.
 */

import {
  RicochetBall,
  RicochetBrick,
  RicochetPaddle,
  SpaceStationStructure,
  AsteroidDebris,
  Shockwave,
  RicochetParticle,
} from './types';
import { sounds } from '../../audio/soundManager';

export interface CollisionEvent {
  hit: boolean;
  brickIndex?: number;
  isStation?: boolean;
  isPaddle?: boolean;
}

// Distance from point to line segment
function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { dist: number; nx: number; ny: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const d = Math.hypot(px - x1, py - y1);
    return { dist: d, nx: (px - x1) / (d || 1), ny: (py - y1) / (d || 1) };
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  const dist = Math.hypot(px - cx, py - cy);
  return { dist, nx: (px - cx) / (dist || 1), ny: (py - cy) / (dist || 1) };
}

// Check collision with Curved Shield Paddle
export function checkPaddleCollision(
  ball: RicochetBall,
  paddle: RicochetPaddle
): boolean {
  if (ball.isDocked) return false;
  if (ball.vy <= 0) return false; // only collide while moving downward

  const halfW = paddle.width / 2;
  const paddleTop = paddle.y - paddle.height / 2;
  const paddleBottom = paddle.y + paddle.height / 2;

  // Check if ball is in the bumper zone
  if (
    ball.x + ball.radius >= paddle.x - halfW &&
    ball.x - ball.radius <= paddle.x + halfW &&
    ball.y + ball.radius >= paddleTop &&
    ball.y - ball.radius <= paddleBottom
  ) {
    // If sticky paddle active, dock the ball
    if (paddle.isSticky) {
      ball.isDocked = true;
      ball.dockedOffset = ball.x - paddle.x;
      ball.vx = 0;
      ball.vy = 0;
      sounds.playRicochetPing(1);
      return true;
    }

    // Normalized hit position across the curved bumper arc: -1 (left tip) to +1 (right tip)
    const offset = Math.max(-1, Math.min(1, (ball.x - paddle.x) / halfW));

    // Ricochet curved arc angle: up to 64 degrees deflection
    const maxDeflectionAngle = (64 * Math.PI) / 180;
    const bounceAngle = offset * maxDeflectionAngle;

    const currentSpeed = Math.hypot(ball.vx, ball.vy);
    const targetSpeed = Math.max(currentSpeed, 5.8);

    ball.vx = targetSpeed * Math.sin(bounceAngle);
    ball.vy = -Math.abs(targetSpeed * Math.cos(bounceAngle));

    // Push above paddle to prevent multi-trigger
    ball.y = paddleTop - ball.radius - 1;
    sounds.playRicochetPing(1);
    return true;
  }

  return false;
}

// Check collision with Brick
export function checkBrickCollision(
  ball: RicochetBall,
  brick: RicochetBrick
): { hit: boolean; nx: number; ny: number } {
  if (brick.type === 'ion_sphere') {
    // Circle vs Circle
    const radius = brick.width / 2;
    const dx = ball.x - brick.x;
    const dy = ball.y - brick.y;
    const distSq = dx * dx + dy * dy;
    const minDist = ball.radius + radius;

    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq);
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      return { hit: true, nx, ny };
    }
    return { hit: false, nx: 0, ny: 0 };
  }

  // AABB collision for standard and explosive bricks
  const halfW = brick.width / 2;
  const halfH = brick.height / 2;

  const closestX = Math.max(brick.x - halfW, Math.min(ball.x, brick.x + halfW));
  const closestY = Math.max(brick.y - halfH, Math.min(ball.y, brick.y + halfH));

  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq < ball.radius * ball.radius) {
    const dist = Math.sqrt(distSq);
    let nx = 0;
    let ny = 0;

    if (dist > 0.0001) {
      nx = dx / dist;
      ny = dy / dist;
    } else {
      // Inside center
      const edgeL = Math.abs(ball.x - (brick.x - halfW));
      const edgeR = Math.abs(ball.x - (brick.x + halfW));
      const edgeT = Math.abs(ball.y - (brick.y - halfH));
      const edgeB = Math.abs(ball.y - (brick.y + halfH));
      const minE = Math.min(edgeL, edgeR, edgeT, edgeB);

      if (minE === edgeT) ny = -1;
      else if (minE === edgeB) ny = 1;
      else if (minE === edgeL) nx = -1;
      else nx = 1;
    }

    return { hit: true, nx, ny };
  }

  return { hit: false, nx: 0, ny: 0 };
}

// Check collision with Space Station Structures (curved ring, hub column, solar panels)
export function checkStationCollision(
  ball: RicochetBall,
  structure: SpaceStationStructure
): { hit: boolean; nx: number; ny: number } {
  if (structure.type === 'ring' && structure.radius) {
    // Curved ring segment collision
    const dx = ball.x - structure.x;
    const dy = ball.y - structure.y;
    const dist = Math.hypot(dx, dy);
    const ringRadius = structure.radius;
    const ringThickness = 18;

    if (Math.abs(dist - ringRadius) < ball.radius + ringThickness / 2) {
      // Check angle sector
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += Math.PI * 2;

      const sAngle = structure.startAngle || 0;
      const eAngle = structure.endAngle || Math.PI * 2;

      if (angle >= sAngle && angle <= eAngle) {
        // Normal points inward or outward depending on which side was hit
        const factor = dist > ringRadius ? 1 : -1;
        return {
          hit: true,
          nx: (dx / dist) * factor,
          ny: (dy / dist) * factor,
        };
      }
    }
    return { hit: false, nx: 0, ny: 0 };
  }

  // Box collision for column and solar panel arrays
  const halfW = structure.width / 2;
  const halfH = structure.height / 2;
  const closestX = Math.max(structure.x - halfW, Math.min(ball.x, structure.x + halfW));
  const closestY = Math.max(structure.y - halfH, Math.min(ball.y, structure.y + halfH));

  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq < ball.radius * ball.radius) {
    const dist = Math.sqrt(distSq);
    let nx = dx / (dist || 1);
    let ny = dy / (dist || 1);
    if (dist === 0) {
      nx = 0;
      ny = -1;
    }
    return { hit: true, nx, ny };
  }

  return { hit: false, nx: 0, ny: 0 };
}

// Check collision with Asteroids
export function checkAsteroidCollision(
  ball: RicochetBall,
  ast: AsteroidDebris
): { hit: boolean; nx: number; ny: number } {
  const dx = ball.x - ast.x;
  const dy = ball.y - ast.y;
  const distSq = dx * dx + dy * dy;
  const minDist = ball.radius + ast.radius;

  if (distSq < minDist * minDist) {
    const dist = Math.sqrt(distSq);
    return {
      hit: true,
      nx: dx / (dist || 1),
      ny: dy / (dist || 1),
    };
  }

  return { hit: false, nx: 0, ny: 0 };
}

// Reflect velocity vector along normal
export function reflectVector(
  vx: number,
  vy: number,
  nx: number,
  ny: number
): { vx: number; vy: number } {
  const dot = vx * nx + vy * ny;
  if (dot > 0) return { vx, vy }; // moving away
  return {
    vx: vx - 2 * dot * nx,
    vy: vy - 2 * dot * ny,
  };
}

// Trigger explosive chain reaction
export function triggerExplosion(
  originX: number,
  originY: number,
  blastRadius: number,
  bricks: RicochetBrick[],
  shockwaves: Shockwave[],
  particles: RicochetParticle[],
  ignoreBrickId?: string
): { destroyedBricks: RicochetBrick[]; totalPoints: number } {
  sounds.playExplosion();

  // Add shockwave ring
  shockwaves.push({
    id: Math.random().toString(),
    x: originX,
    y: originY,
    radius: 10,
    maxRadius: blastRadius,
    life: 0,
    maxLife: 0.35,
    color: '#f43f5e',
  });

  // Spawn fire & shrapnel particles
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 220 + 60;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.2 + Math.random() * 0.35,
      maxLife: 0.55,
      size: Math.random() * 4 + 2,
      color: Math.random() < 0.5 ? '#f43f5e' : Math.random() < 0.8 ? '#fb923c' : '#facc15',
      shape: 'shrapnel',
    });
  }

  const destroyedBricks: RicochetBrick[] = [];
  let totalPoints = 0;

  // Search adjacent bricks inside blast radius (skipping initiating brick and indestructible)
  for (let i = bricks.length - 1; i >= 0; i--) {
    const b = bricks[i];
    if (b.indestructible || (ignoreBrickId && b.id === ignoreBrickId)) continue;

    const dist = Math.hypot(b.x - originX, b.y - originY);
    if (dist <= blastRadius) {
      b.hits -= 1;
      if (b.hits <= 0) {
        destroyedBricks.push(b);
        totalPoints += b.points * 1.5;
        bricks.splice(i, 1);
      }
    }
  }

  return { destroyedBricks, totalPoints };
}
