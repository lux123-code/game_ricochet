/**
 * Ricochet: Orbit Breaker Data Types & Interfaces
 * Faithfully matches Ricochet's mechanics, space-station layouts, and powerups.
 */

export type RicochetBrickType =
  | 'metal'           // Standard iridescent beveled metallic brick
  | 'armored'         // Multi-hit reinforced titanium brick
  | 'ion_sphere'      // Blue glowing ion sphere
  | 'explosive'       // Red explosive hazard brick with chain reactions
  | 'prism'           // 45-degree angled wedge deflector
  | 'station_hull'    // Indestructible space station truss/hull
  | 'solar_panel'     // Photovoltaic station wing
  | 'asteroid';       // Space rock debris

export type PrismDirection = 'up-left' | 'up-right' | 'down-left' | 'down-right';

export type PowerUpType =
  | 'laser'
  | 'multiball'
  | 'strikeball'
  | 'wide_shield'
  | 'catch'
  | 'slowmo'
  | 'extra_life';

export interface RicochetBrick {
  id: string;
  type: RicochetBrickType;
  x: number;
  y: number;
  width: number;
  height: number;
  hits: number;
  maxHits: number;
  points: number;
  color?: string;
  prismDir?: PrismDirection;
  indestructible?: boolean;
  powerup?: PowerUpType;
  hitFlash?: number; // visual white flash on hit
}

export interface SpaceStationStructure {
  id: string;
  type: 'ring' | 'hub' | 'solar_panel' | 'crossbar';
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number; // for curved ring arc
  startAngle?: number;
  endAngle?: number;
}

export interface AsteroidDebris {
  id: string;
  x: number;
  y: number;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  points: { x: number; y: number }[];
}

export interface RicochetBall {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isStrikeball: boolean; // plows through bricks
  isDocked: boolean;
  dockedOffset: number;
  color: string;
  trail: { x: number; y: number; alpha: number }[];
}

export interface RicochetPaddle {
  x: number;
  y: number;
  width: number;
  height: number;
  baseWidth: number;
  curvature: number; // arc curvature factor
  hasLasers: boolean;
  laserTimer: number;
  isSticky: boolean;
  catchTimer: number;
  hasStrikeball: boolean;
  strikeballTimer: number;
  expandTimer: number;
  glowColor: string;
}

export interface RicochetPowerUp {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  vy: number;
  radius: number;
  rotation: number;
  color: string;
}

export interface LaserBolt {
  id: string;
  x: number;
  y: number;
  vy: number;
  width: number;
  height: number;
  color: string;
}

export interface Shockwave {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface RicochetParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: 'spark' | 'shrapnel' | 'smoke';
}

export interface RicochetLevel {
  id: number;
  name: string;
  subtitle: string;
  ballSpeed: number;
  paddleWidth: number;
  bricks: RicochetBrick[];
  stationStructures: SpaceStationStructure[];
  asteroids: AsteroidDebris[];
}

export interface RicochetSaveProgress {
  highestSectorUnlocked: number;
  highScores: Record<number, number>;
  totalScore: number;
}
