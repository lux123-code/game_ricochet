/**
 * Ricochet: Orbit Breaker
 * Faithful recreation of the classic Ricochet space brick-breaker game matching image_99613b78.png
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  RicochetLevel,
  RicochetBrick,
  RicochetBall,
  RicochetPaddle,
  RicochetPowerUp,
  LaserBolt,
  Shockwave,
  RicochetParticle,
  RicochetSaveProgress,
  PowerUpType,
} from './types';
import { generateRicochetLevels, RICOCHET_WIDTH, RICOCHET_HEIGHT } from './ricochetLevels';
import {
  checkPaddleCollision,
  checkBrickCollision,
  checkStationCollision,
  checkAsteroidCollision,
  reflectVector,
  triggerExplosion,
} from './ricochetPhysics';
import { sounds } from '../../audio/soundManager';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Grid,
  Shield,
  Zap,
  HelpCircle,
  Pause,
  ChevronRight,
  Sparkles,
  Crosshair,
  Maximize2,
} from 'lucide-react';

const STORAGE_KEY = 'ricochet_orbit_breaker_save_v1';

export const RicochetGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Flow State
  const [gameState, setGameState] = useState<'title' | 'levelSelect' | 'playing' | 'paused' | 'levelClear' | 'gameOver'>('title');
  const [currentLevelId, setCurrentLevelId] = useState<number>(1);
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [combo, setCombo] = useState<number>(1);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [remainingBodies, setRemainingBodies] = useState<number>(0);

  // Active Power-up Indicators in HUD
  const [activePowerups, setActivePowerups] = useState<{
    lasers: number;
    strikeball: number;
    wideShield: number;
    catch: number;
  }>({
    lasers: 0,
    strikeball: 0,
    wideShield: 0,
    catch: 0,
  });

  // Saved progress
  const [saveProgress, setSaveProgress] = useState<RicochetSaveProgress>(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return {
      highestSectorUnlocked: 1,
      highScores: {},
      totalScore: 0,
    };
  });

  const allLevelsRef = useRef<RicochetLevel[]>(generateRicochetLevels());

  // Mutable Game Simulation State
  const simRef = useRef<{
    paddle: RicochetPaddle;
    balls: RicochetBall[];
    bricks: RicochetBrick[];
    powerups: RicochetPowerUp[];
    lasers: LaserBolt[];
    shockwaves: Shockwave[];
    particles: RicochetParticle[];
    level: RicochetLevel | null;
    stars: { x: number; y: number; size: number; alpha: number; speed: number }[];
    nebulaGlowTime: number;
    screenShake: number;
    destructibleRemaining: number;
    mouseX: number;
    mouseInside: boolean;
    keys: Record<string, boolean>;
    laserCooldown: number;
  }>({
    paddle: {
      x: RICOCHET_WIDTH / 2,
      y: RICOCHET_HEIGHT - 38,
      width: 124,
      height: 18,
      baseWidth: 124,
      curvature: 1.0,
      hasLasers: false,
      laserTimer: 0,
      isSticky: false,
      catchTimer: 0,
      hasStrikeball: false,
      strikeballTimer: 0,
      expandTimer: 0,
      glowColor: '#ec4899', // signature pink cockpit glow from image_99613b78.png
    },
    balls: [],
    bricks: [],
    powerups: [],
    lasers: [],
    shockwaves: [],
    particles: [],
    level: null,
    stars: [],
    nebulaGlowTime: 0,
    screenShake: 0,
    destructibleRemaining: 0,
    mouseX: RICOCHET_WIDTH / 2,
    mouseInside: false,
    keys: {},
    laserCooldown: 0,
  });

  // Save progress helper
  const recordVictory = useCallback((sectorId: number, levelScore: number) => {
    setSaveProgress((prev) => {
      const best = Math.max(prev.highScores[sectorId] || 0, levelScore);
      const updated: RicochetSaveProgress = {
        ...prev,
        highestSectorUnlocked: Math.max(prev.highestSectorUnlocked, sectorId + 1),
        highScores: { ...prev.highScores, [sectorId]: best },
        totalScore: prev.totalScore + levelScore,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  // Spawn docked ball on paddle ship
  const spawnDockedBall = (paddle: RicochetPaddle): RicochetBall => {
    return {
      id: Math.random().toString(),
      x: paddle.x,
      y: paddle.y - paddle.height / 2 - 9,
      vx: 0,
      vy: 0,
      radius: 7.5,
      isStrikeball: false,
      isDocked: true,
      dockedOffset: 0,
      color: '#00f0ff',
      trail: [],
    };
  };

  // Launch docked balls
  const launchDockedBalls = useCallback(() => {
    const sim = simRef.current;
    let launched = false;

    sim.balls.forEach((ball) => {
      if (ball.isDocked) {
        const speed = sim.level?.ballSpeed || 5.6;
        // Launch upwards with slight angle based on offset from center
        const angle = (ball.dockedOffset / (sim.paddle.width / 2)) * 0.45;
        ball.vx = speed * Math.sin(angle);
        ball.vy = -speed * Math.cos(angle);
        ball.isDocked = false;
        launched = true;
      }
    });

    if (launched) {
      sounds.playRicochetPing(1);
      // Paddle launch thruster flare
      for (let i = 0; i < 16; i++) {
        sim.particles.push({
          x: sim.paddle.x + (Math.random() - 0.5) * 30,
          y: sim.paddle.y + 10,
          vx: (Math.random() - 0.5) * 40,
          vy: Math.random() * 80 + 40,
          life: 0.15 + Math.random() * 0.2,
          maxLife: 0.35,
          size: Math.random() * 3 + 2,
          color: '#f59e0b',
          shape: 'spark',
        });
      }
    }
  }, []);

  // Fire laser bolts from paddle ship wing mounts
  const fireLasers = useCallback(() => {
    const sim = simRef.current;
    if (sim.paddle.hasLasers && sim.laserCooldown <= 0) {
      const halfW = sim.paddle.width / 2;
      sim.lasers.push({
        id: Math.random().toString(),
        x: sim.paddle.x - halfW * 0.8,
        y: sim.paddle.y - 10,
        vy: -14,
        width: 4,
        height: 16,
        color: '#f43f5e',
      });
      sim.lasers.push({
        id: Math.random().toString(),
        x: sim.paddle.x + halfW * 0.8,
        y: sim.paddle.y - 10,
        vy: -14,
        width: 4,
        height: 16,
        color: '#f43f5e',
      });
      sim.laserCooldown = 0.14; // rapid fire rate
      sounds.playLaserShot();
    }
  }, []);

  // Initialize a level sector
  const startSector = useCallback((sectorId: number) => {
    const all = allLevelsRef.current;
    const def = all.find((l) => l.id === sectorId) || all[0];
    const sim = simRef.current;

    sim.level = def;
    sim.paddle.baseWidth = def.paddleWidth;
    sim.paddle.width = def.paddleWidth;
    sim.paddle.x = RICOCHET_WIDTH / 2;
    sim.paddle.hasLasers = false;
    sim.paddle.laserTimer = 0;
    sim.paddle.isSticky = false;
    sim.paddle.catchTimer = 0;
    sim.paddle.hasStrikeball = false;
    sim.paddle.strikeballTimer = 0;
    sim.paddle.expandTimer = 0;

    // Deep copy bricks so hits reset cleanly
    sim.bricks = def.bricks.map((b) => ({ ...b }));
    const destructibles = sim.bricks.filter((b) => !b.indestructible).length;
    sim.destructibleRemaining = destructibles;
    setRemainingBodies(destructibles);

    // Reset game entities
    sim.balls = [spawnDockedBall(sim.paddle)];
    sim.powerups = [];
    sim.lasers = [];
    sim.shockwaves = [];
    sim.particles = [];
    sim.screenShake = 0;

    setCurrentLevelId(sectorId);
    setGameState('playing');
    setCombo(1);
    setActivePowerups({ lasers: 0, strikeball: 0, wideShield: 0, catch: 0 });
  }, []);

  // Start campaign from sector 1
  const handleStartCampaign = () => {
    setScore(0);
    setLives(3);
    startSector(1);
  };

  const handleRetrySector = () => {
    setLives(3);
    startSector(currentLevelId);
  };

  // Starfield initialization
  useEffect(() => {
    const stars: { x: number; y: number; size: number; alpha: number; speed: number }[] = [];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * RICOCHET_WIDTH,
        y: Math.random() * RICOCHET_HEIGHT,
        size: Math.random() * 2 + 0.6,
        alpha: Math.random() * 0.75 + 0.25,
        speed: Math.random() * 0.35 + 0.1,
      });
    }
    simRef.current.stars = stars;
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      simRef.current.keys[e.code] = true;

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (gameState === 'playing') setGameState('paused');
        else if (gameState === 'paused') setGameState('playing');
      }

      if (e.code === 'Space') {
        if (gameState === 'playing') {
          launchDockedBalls();
          fireLasers();
        }
      }

      // Keyboard plate tracking
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        simRef.current.paddle.x = Math.max(
          simRef.current.paddle.width / 2,
          simRef.current.paddle.x - 30
        );
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        simRef.current.paddle.x = Math.min(
          RICOCHET_WIDTH - simRef.current.paddle.width / 2,
          simRef.current.paddle.x + 30
        );
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      simRef.current.keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, launchDockedBalls, fireLasers]);

  // Main Ricochet Physics & Render Loop (60 FPS)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.033);
      lastTime = time;

      const sim = simRef.current;
      const p = sim.paddle;

      // Mouse tracking
      if (sim.mouseInside) {
        const targetX = Math.max(
          p.width / 2,
          Math.min(RICOCHET_WIDTH - p.width / 2, sim.mouseX)
        );
        p.x += (targetX - p.x) * 0.32;
      }

      // Rotate asteroids
      if (sim.level?.asteroids) {
        sim.level.asteroids.forEach((ast) => {
          ast.rotation += ast.rotationSpeed;
        });
      }

      if (gameState === 'playing') {
        // Cooldowns & timers
        if (sim.laserCooldown > 0) sim.laserCooldown -= dt;
        if (sim.screenShake > 0) sim.screenShake = Math.max(0, sim.screenShake - dt * 25);

        // Power-up durations
        if (p.hasLasers) {
          p.laserTimer -= dt;
          if (p.laserTimer <= 0) p.hasLasers = false;
        }
        if (p.isSticky) {
          p.catchTimer -= dt;
          if (p.catchTimer <= 0) p.isSticky = false;
        }
        if (p.hasStrikeball) {
          p.strikeballTimer -= dt;
          if (p.strikeballTimer <= 0) {
            p.hasStrikeball = false;
            sim.balls.forEach((b) => (b.isStrikeball = false));
          }
        }
        if (p.expandTimer > 0) {
          p.expandTimer -= dt;
          if (p.expandTimer <= 0) p.width = p.baseWidth;
        }

        // Update active powerups state for HUD
        setActivePowerups({
          lasers: Math.max(0, p.laserTimer),
          strikeball: Math.max(0, p.strikeballTimer),
          wideShield: Math.max(0, p.expandTimer),
          catch: Math.max(0, p.catchTimer),
        });

        // Update Lasers
        for (let i = sim.lasers.length - 1; i >= 0; i--) {
          const lz = sim.lasers[i];
          lz.y += lz.vy;

          let hit = false;
          for (let bIdx = sim.bricks.length - 1; bIdx >= 0; bIdx--) {
            const b = sim.bricks[bIdx];
            if (
              Math.abs(lz.x - b.x) <= b.width / 2 &&
              Math.abs(lz.y - b.y) <= b.height / 2
            ) {
              hit = true;
              if (!b.indestructible) {
                b.hits -= 1;
                sounds.playRicochetPing(1);
                if (b.hits <= 0) {
                  setScore((s) => s + b.points);
                  sim.bricks.splice(bIdx, 1);
                  const rem = sim.bricks.filter((bk) => !bk.indestructible).length;
                  setRemainingBodies(rem);
                  if (rem === 0) {
                    sounds.playVictory();
                    recordVictory(currentLevelId, score + b.points);
                    setGameState('levelClear');
                  }
                }
              }
              break;
            }
          }

          if (hit || lz.y < -30) {
            sim.lasers.splice(i, 1);
          }
        }

        // Update Falling Power-Ups
        for (let i = sim.powerups.length - 1; i >= 0; i--) {
          const pu = sim.powerups[i];
          pu.y += pu.vy * dt;
          pu.rotation += 0.04;

          // Check paddle collision
          const pHalfW = p.width / 2;
          const pHalfH = p.height / 2;
          if (
            pu.x >= p.x - pHalfW &&
            pu.x <= p.x + pHalfW &&
            pu.y + pu.radius >= p.y - pHalfH &&
            pu.y - pu.radius <= p.y + pHalfH
          ) {
            // Power-up captured!
            sounds.playPowerUp();

            if (pu.type === 'laser') {
              p.hasLasers = true;
              p.laserTimer = 12;
            } else if (pu.type === 'strikeball') {
              p.hasStrikeball = true;
              p.strikeballTimer = 10;
              sim.balls.forEach((b) => (b.isStrikeball = true));
            } else if (pu.type === 'wide_shield') {
              p.expandTimer = 15;
              p.width = Math.min(200, p.baseWidth * 1.45);
            } else if (pu.type === 'catch') {
              p.isSticky = true;
              p.catchTimer = 15;
            } else if (pu.type === 'multiball') {
              // Split into 3 balls
              const base = sim.balls[0] || spawnDockedBall(p);
              const speed = Math.hypot(base.vx, base.vy) || 5.8;
              sim.balls.push({
                id: Math.random().toString(),
                x: base.x,
                y: base.y,
                vx: -speed * 0.75,
                vy: -speed * 0.7,
                radius: 7.5,
                isStrikeball: p.hasStrikeball,
                isDocked: false,
                dockedOffset: 0,
                color: '#38bdf8',
                trail: [],
              });
              sim.balls.push({
                id: Math.random().toString(),
                x: base.x,
                y: base.y,
                vx: speed * 0.75,
                vy: -speed * 0.7,
                radius: 7.5,
                isStrikeball: p.hasStrikeball,
                isDocked: false,
                dockedOffset: 0,
                color: '#38bdf8',
                trail: [],
              });
            } else if (pu.type === 'slowmo') {
              sim.balls.forEach((b) => {
                b.vx *= 0.65;
                b.vy *= 0.65;
              });
            } else if (pu.type === 'extra_life') {
              setLives((l) => Math.min(5, l + 1));
            }

            sim.powerups.splice(i, 1);
            continue;
          }

          if (pu.y > RICOCHET_HEIGHT + 30) {
            sim.powerups.splice(i, 1);
          }
        }

        // Sub-stepping for ultra-accurate Ricochet ball physics (4 sub-steps per frame)
        const subSteps = 4;
        const subDt = dt / subSteps;

        for (let step = 0; step < subSteps; step++) {
          for (let bIdx = sim.balls.length - 1; bIdx >= 0; bIdx--) {
            const ball = sim.balls[bIdx];

            if (ball.isDocked) {
              ball.x = p.x + ball.dockedOffset;
              ball.y = p.y - p.height / 2 - ball.radius - 1;
              continue;
            }

            // Move ball
            ball.x += ball.vx * subDt * 60;
            ball.y += ball.vy * subDt * 60;

            // Boundaries (Left, Right, Top)
            if (ball.x - ball.radius <= 0) {
              ball.x = ball.radius;
              ball.vx = Math.abs(ball.vx);
              sounds.playRicochetPing(1);
            } else if (ball.x + ball.radius >= RICOCHET_WIDTH) {
              ball.x = RICOCHET_WIDTH - ball.radius;
              ball.vx = -Math.abs(ball.vx);
              sounds.playRicochetPing(1);
            }

            if (ball.y - ball.radius <= 0) {
              ball.y = ball.radius;
              ball.vy = Math.abs(ball.vy);
              sounds.playRicochetPing(1);
            }

            // Curved Shield Paddle Collision
            if (checkPaddleCollision(ball, p)) {
              // Paddle spark burst
              for (let i = 0; i < 8; i++) {
                sim.particles.push({
                  x: ball.x,
                  y: ball.y,
                  vx: (Math.random() - 0.5) * 60,
                  vy: -(Math.random() * 50 + 20),
                  life: 0.15 + Math.random() * 0.15,
                  maxLife: 0.3,
                  size: 2.5,
                  color: '#00f0ff',
                  shape: 'spark',
                });
              }
            }

            // Station structures are scenic galactic backdrop (no blocking walls)

            // Asteroids Collision
            if (sim.level?.asteroids) {
              for (const ast of sim.level.asteroids) {
                const aHit = checkAsteroidCollision(ball, ast);
                if (aHit.hit) {
                  const refl = reflectVector(ball.vx, ball.vy, aHit.nx, aHit.ny);
                  ball.vx = refl.vx;
                  ball.vy = refl.vy;
                  sounds.playHeavyClang();
                  break;
                }
              }
            }

            // Bricks Collision
            for (let blkIdx = sim.bricks.length - 1; blkIdx >= 0; blkIdx--) {
              const brick = sim.bricks[blkIdx];
              const bHit = checkBrickCollision(ball, brick);

              if (bHit.hit) {
                // If ball is a Strikeball, it pulverizes standard bricks without bouncing!
                if (!ball.isStrikeball || brick.indestructible) {
                  const refl = reflectVector(ball.vx, ball.vy, bHit.nx, bHit.ny);
                  ball.vx = refl.vx;
                  ball.vy = refl.vy;
                }

                // Shrapnel sparks
                for (let i = 0; i < 10; i++) {
                  sim.particles.push({
                    x: ball.x,
                    y: ball.y,
                    vx: (Math.random() - 0.5) * 120,
                    vy: (Math.random() - 0.5) * 120,
                    life: 0.15 + Math.random() * 0.2,
                    maxLife: 0.35,
                    size: Math.random() * 3 + 1.5,
                    color: brick.type === 'explosive' ? '#f43f5e' : brick.type === 'ion_sphere' ? '#00f0ff' : '#94a3b8',
                    shape: 'shrapnel',
                  });
                }

                if (!brick.indestructible) {
                  brick.hits -= 1;

                  if (brick.type === 'ion_sphere') {
                    sounds.playIonBounce();
                  } else {
                    sounds.playRicochetPing(combo);
                  }

                  if (brick.hits <= 0) {
                    // Destroy brick!
                    const earned = brick.points * combo;
                    setScore((s) => s + earned);

                    // Drop Powerup Capsule
                    if (brick.powerup || Math.random() < 0.14) {
                      const pType: PowerUpType =
                        brick.powerup ||
                        (Math.random() < 0.25
                          ? 'laser'
                          : Math.random() < 0.5
                          ? 'multiball'
                          : Math.random() < 0.7
                          ? 'strikeball'
                          : 'wide_shield');

                      sim.powerups.push({
                        id: Math.random().toString(),
                        type: pType,
                        x: brick.x,
                        y: brick.y,
                        vy: 110,
                        radius: 12,
                        rotation: 0,
                        color:
                          pType === 'laser'
                            ? '#f43f5e'
                            : pType === 'strikeball'
                            ? '#f59e0b'
                            : pType === 'multiball'
                            ? '#38bdf8'
                            : '#a855f7',
                      });
                    }

                    // Remove current brick from active array
                    sim.bricks.splice(blkIdx, 1);

                    // Red Hazard Brick Detonation!
                    if (brick.type === 'explosive') {
                      sim.screenShake = 12; // explosive screen shake
                      const { totalPoints } = triggerExplosion(
                        brick.x,
                        brick.y,
                        85,
                        sim.bricks,
                        sim.shockwaves,
                        sim.particles,
                        brick.id
                      );
                      setScore((s) => s + totalPoints);
                    }

                    // Check exact remaining destructible bodies from live array
                    const remaining = sim.bricks.filter((b) => !b.indestructible).length;
                    setRemainingBodies(remaining);

                    // ONLY finish level when all destructible geometrical bodies are kicked/destroyed!
                    if (remaining === 0) {
                      sounds.playVictory();
                      recordVictory(currentLevelId, score + earned);
                      setGameState('levelClear');
                    }
                  }
                }

                break;
              }
            }

            // Ball lost past bottom
            if (ball.y - ball.radius > RICOCHET_HEIGHT) {
              sim.balls.splice(bIdx, 1);
            }
          }
        }

        // If all balls lost
        if (sim.balls.length === 0) {
          sounds.playLifeLost();
          setLives((l) => {
            const nextL = l - 1;
            if (nextL <= 0) {
              setGameState('gameOver');
            } else {
              sim.balls = [spawnDockedBall(p)];
            }
            return nextL;
          });
        }
      }

      // Update Shockwaves
      for (let i = sim.shockwaves.length - 1; i >= 0; i--) {
        const sw = sim.shockwaves[i];
        sw.life += dt;
        sw.radius += (sw.maxRadius - sw.radius) * 0.18;
        if (sw.life >= sw.maxLife) {
          sim.shockwaves.splice(i, 1);
        }
      }

      // Update Particles
      for (let i = sim.particles.length - 1; i >= 0; i--) {
        const pt = sim.particles[i];
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.life <= 0) {
          sim.particles.splice(i, 1);
        }
      }

      // Update Stars drift
      sim.stars.forEach((st) => {
        st.y += st.speed;
        if (st.y > RICOCHET_HEIGHT) {
          st.y = 0;
          st.x = Math.random() * RICOCHET_WIDTH;
        }
      });

      // ==========================================
      // CANVAS DRAWING (RICOCHET VISUAL AESTHETIC)
      // ==========================================
      ctx.save();
      // Apply screen shake
      if (sim.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * sim.screenShake;
        const shakeY = (Math.random() - 0.5) * sim.screenShake;
        ctx.translate(shakeX, shakeY);
      }

      ctx.clearRect(0, 0, RICOCHET_WIDTH, RICOCHET_HEIGHT);

      // Deep Purple / Cosmic Nebula Starfield (as in image_99613b78.png)
      const spaceGrad = ctx.createLinearGradient(0, 0, 0, RICOCHET_HEIGHT);
      spaceGrad.addColorStop(0, '#030510');
      spaceGrad.addColorStop(0.4, '#090924');
      spaceGrad.addColorStop(0.75, '#20083b');
      spaceGrad.addColorStop(1, '#3b0764');
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, RICOCHET_WIDTH, RICOCHET_HEIGHT);

      // Twinkling Starfield
      sim.stars.forEach((st) => {
        ctx.fillStyle = `rgba(220, 235, 255, ${st.alpha})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // ==========================================
      // DRAW SPACE STATION STRUCTURES
      // ==========================================
      if (sim.level?.stationStructures) {
        sim.level.stationStructures.forEach((struct) => {
          ctx.save();
          if (struct.type === 'ring' && struct.radius) {
            // Giant Tubular Curved Outer Ring
            const ringR = struct.radius;
            ctx.lineWidth = 18;
            ctx.strokeStyle = '#52525b';
            ctx.beginPath();
            ctx.arc(struct.x, struct.y, ringR, struct.startAngle || 0, struct.endAngle || Math.PI * 2);
            ctx.stroke();

            // Cylindrical metallic ring sheen & highlight
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#a1a1aa';
            ctx.stroke();

            // Segmented circular joint bands
            ctx.strokeStyle = '#71717a';
            ctx.lineWidth = 20;
            ctx.setLineDash([8, 32]);
            ctx.stroke();
            ctx.setLineDash([]);
          } else if (struct.type === 'hub') {
            // Central Elevator Column / Shaft
            const hw = struct.width / 2;
            const hh = struct.height / 2;
            const colGrad = ctx.createLinearGradient(struct.x - hw, struct.y, struct.x + hw, struct.y);
            colGrad.addColorStop(0, '#3f3f46');
            colGrad.addColorStop(0.45, '#d4d4d8');
            colGrad.addColorStop(0.55, '#f4f4f5');
            colGrad.addColorStop(1, '#27272a');
            ctx.fillStyle = colGrad;
            ctx.fillRect(struct.x - hw, struct.y - hh, struct.width, struct.height);

            // Ring collars
            ctx.strokeStyle = '#18181b';
            ctx.lineWidth = 2;
            for (let y = struct.y - hh; y < struct.y + hh; y += 30) {
              ctx.strokeRect(struct.x - hw - 2, y, struct.width + 4, 6);
            }
          } else if (struct.type === 'solar_panel') {
            // Photovoltaic Solar Panel Wings
            const hw = struct.width / 2;
            const hh = struct.height / 2;
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 1.5;
            ctx.fillRect(struct.x - hw, struct.y - hh, struct.width, struct.height);
            ctx.strokeRect(struct.x - hw, struct.y - hh, struct.width, struct.height);

            // Solar cell grid
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
            ctx.lineWidth = 1;
            for (let sx = struct.x - hw; sx < struct.x + hw; sx += 12) {
              ctx.beginPath();
              ctx.moveTo(sx, struct.y - hh);
              ctx.lineTo(sx, struct.y + hh);
              ctx.stroke();
            }
          } else if (struct.type === 'crossbar') {
            // Bottom horizontal station truss
            const hw = struct.width / 2;
            const hh = struct.height / 2;
            const cbGrad = ctx.createLinearGradient(struct.x, struct.y - hh, struct.x, struct.y + hh);
            cbGrad.addColorStop(0, '#71717a');
            cbGrad.addColorStop(0.3, '#d4d4d8');
            cbGrad.addColorStop(1, '#27272a');
            ctx.fillStyle = cbGrad;
            ctx.fillRect(struct.x - hw, struct.y - hh, struct.width, struct.height);

            // Segment bands
            ctx.strokeStyle = '#3f3f46';
            ctx.lineWidth = 2;
            for (let bx = struct.x - hw; bx < struct.x + hw; bx += 40) {
              ctx.strokeRect(bx, struct.y - hh, 10, struct.height);
            }
          }
          ctx.restore();
        });
      }

      // Draw Asteroids
      if (sim.level?.asteroids) {
        sim.level.asteroids.forEach((ast) => {
          ctx.save();
          ctx.translate(ast.x, ast.y);
          ctx.rotate(ast.rotation);

          // Rocky texture gradient
          const astGrad = ctx.createRadialGradient(
            -ast.radius * 0.3,
            -ast.radius * 0.3,
            2,
            0,
            0,
            ast.radius
          );
          astGrad.addColorStop(0, '#78716c');
          astGrad.addColorStop(0.6, '#44403c');
          astGrad.addColorStop(1, '#1c1917');
          ctx.fillStyle = astGrad;

          ctx.beginPath();
          ast.points.forEach((pt, i) => {
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#292524';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        });
      }

      // ==========================================
      // DRAW RICOCHET BRICKS
      // ==========================================
      sim.bricks.forEach((b) => {
        ctx.save();
        const hw = b.width / 2;
        const hh = b.height / 2;
        const bx = b.x - hw;
        const by = b.y - hh;

        if (b.type === 'ion_sphere') {
          // Blue Glowing Ion Sphere
          const r = b.width / 2;
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 12;

          const sGrad = ctx.createRadialGradient(
            b.x - r * 0.35,
            b.y - r * 0.35,
            1,
            b.x,
            b.y,
            r
          );
          sGrad.addColorStop(0, '#ffffff');
          sGrad.addColorStop(0.3, '#38bdf8');
          sGrad.addColorStop(0.8, '#0284c7');
          sGrad.addColorStop(1, '#0c4a6e');

          ctx.fillStyle = sGrad;
          ctx.beginPath();
          ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#e0f2fe';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Concentric ion ring
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(b.x, b.y, r * 0.5, 0, Math.PI * 2);
          ctx.stroke();
        } else if (b.type === 'explosive') {
          // Red Hazard Brick (with blinking hazard core)
          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = 10;

          const expGrad = ctx.createLinearGradient(bx, by, bx, by + b.height);
          expGrad.addColorStop(0, '#f43f5e');
          expGrad.addColorStop(0.5, '#991b1b');
          expGrad.addColorStop(1, '#450a0a');
          ctx.fillStyle = expGrad;
          ctx.fillRect(bx, by, b.width, b.height);

          ctx.strokeStyle = '#fecdd3';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx, by, b.width, b.height);

          // Center glowing danger core
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Standard Metallic Beveled Brick (iridescent chrome finish)
          const mGrad = ctx.createLinearGradient(bx, by, bx + b.width, by + b.height);
          if (b.type === 'armored') {
            mGrad.addColorStop(0, '#64748b');
            mGrad.addColorStop(0.4, '#cbd5e1');
            mGrad.addColorStop(1, '#334155');
          } else {
            // Chrome with subtle iridescent tint (as in screenshot)
            mGrad.addColorStop(0, '#ffffff');
            mGrad.addColorStop(0.2, '#e2e8f0');
            mGrad.addColorStop(0.5, '#93c5fd');
            mGrad.addColorStop(0.8, '#d8b4fe');
            mGrad.addColorStop(1, '#475569');
          }
          ctx.fillStyle = mGrad;
          ctx.fillRect(bx, by, b.width, b.height);

          // Beveled metallic border
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx, by, b.width, b.height);

          // Inner metallic rivet / screw detail in corner
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(bx + 3, by + 3, 2, 2);
          ctx.fillRect(bx + b.width - 5, by + 3, 2, 2);

          // Multi-hit indicator
          if (b.maxHits > 1) {
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 11px Rajdhani';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${b.hits}`, b.x, b.y);
          }
        }
        ctx.restore();
      });

      // Draw Shockwaves
      sim.shockwaves.forEach((sw) => {
        ctx.save();
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 3 * (1 - sw.life / sw.maxLife);
        ctx.globalAlpha = 1 - sw.life / sw.maxLife;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      // Draw Falling Power-Up Capsules
      sim.powerups.forEach((pu) => {
        ctx.save();
        ctx.translate(pu.x, pu.y);
        ctx.rotate(pu.rotation);
        ctx.shadowColor = pu.color;
        ctx.shadowBlur = 12;

        ctx.fillStyle = pu.color;
        ctx.beginPath();
        ctx.arc(0, 0, pu.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#060919';
        ctx.font = 'bold 11px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const glyph =
          pu.type === 'laser'
            ? 'L'
            : pu.type === 'strikeball'
            ? 'S'
            : pu.type === 'multiball'
            ? 'M'
            : pu.type === 'wide_shield'
            ? 'W'
            : pu.type === 'catch'
            ? 'C'
            : '♥';
        ctx.fillText(glyph, 0, 0);
        ctx.restore();
      });

      // Draw Lasers
      sim.lasers.forEach((lz) => {
        ctx.save();
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(lz.x - lz.width / 2, lz.y, lz.width, lz.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(lz.x - 1, lz.y + 2, 2, lz.height - 4);
        ctx.restore();
      });

      // ==========================================
      // DRAW CURVED SHIELD PADDLE SHIP (AUTHENTIC RICOCHET)
      // ==========================================
      const pHalfW = p.width / 2;
      const pHalfH = p.height / 2;
      ctx.save();

      // Thruster exhaust flame
      const thrusterY = p.y + pHalfH + 14;
      const flameGrad = ctx.createRadialGradient(p.x, thrusterY, 1, p.x, thrusterY, 16);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.3, '#f59e0b');
      flameGrad.addColorStop(0.7, '#ef4444');
      flameGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.arc(p.x, thrusterY, 14, 0, Math.PI * 2);
      ctx.fill();

      // Cockpit Pod Hull (pink/magenta/yellow glow matching screenshot)
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 14;
      const podGrad = ctx.createLinearGradient(p.x - 14, p.y + 2, p.x + 14, p.y + 24);
      podGrad.addColorStop(0, '#f43f5e');
      podGrad.addColorStop(0.4, '#e11d48');
      podGrad.addColorStop(1, '#facc15');
      ctx.fillStyle = podGrad;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 12, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pilot Cockpit Canopy
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(p.x, p.y + 10, 5, 0, Math.PI * 2);
      ctx.fill();

      // Twin Metallic Struts connecting pod to arched bumper
      ctx.strokeStyle = '#d4d4d8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - 10, p.y + 8);
      ctx.lineTo(p.x - pHalfW * 0.45, p.y);
      ctx.moveTo(p.x + 10, p.y + 8);
      ctx.lineTo(p.x + pHalfW * 0.45, p.y);
      ctx.stroke();

      // THE CURVED METALLIC BUMPER ARC
      ctx.shadowColor = p.hasLasers ? '#f43f5e' : '#00f0ff';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(p.x - pHalfW, p.y + 2);
      ctx.quadraticCurveTo(p.x, p.y - 12, p.x + pHalfW, p.y + 2);
      ctx.lineTo(p.x + pHalfW - 4, p.y + 8);
      ctx.quadraticCurveTo(p.x, p.y - 4, p.x - pHalfW + 4, p.y + 8);
      ctx.closePath();

      const bumperGrad = ctx.createLinearGradient(p.x - pHalfW, p.y, p.x + pHalfW, p.y);
      bumperGrad.addColorStop(0, '#94a3b8');
      bumperGrad.addColorStop(0.3, '#f8fafc');
      bumperGrad.addColorStop(0.5, '#ffffff');
      bumperGrad.addColorStop(0.7, '#f8fafc');
      bumperGrad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = bumperGrad;
      ctx.fill();
      ctx.strokeStyle = p.hasLasers ? '#f43f5e' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glowing segment beads along the curved bumper arc
      const beads = 7;
      for (let i = 0; i < beads; i++) {
        const t = (i / (beads - 1)) * 2 - 1; // -1 to 1
        const bx = p.x + t * (pHalfW - 8);
        const by = p.y - (1 - t * t) * 8;
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(bx, by, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dual Laser Blaster Cannons mounted on wingtips
      if (p.hasLasers) {
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(p.x - pHalfW - 4, p.y - 8, 6, 12);
        ctx.fillRect(p.x + pHalfW - 2, p.y - 8, 6, 12);
      }
      ctx.restore();

      // ==========================================
      // DRAW BALLS & TRAILS
      // ==========================================
      sim.balls.forEach((ball) => {
        if (!ball.isDocked) {
          ball.trail.unshift({ x: ball.x, y: ball.y, alpha: 0.8 });
          if (ball.trail.length > 9) ball.trail.pop();
        }

        // Trail
        ball.trail.forEach((t, tIdx) => {
          ctx.beginPath();
          ctx.arc(t.x, t.y, ball.radius * (1 - tIdx * 0.1), 0, Math.PI * 2);
          ctx.fillStyle = ball.isStrikeball
            ? `rgba(245, 158, 11, ${t.alpha * (1 - tIdx / ball.trail.length)})`
            : `rgba(0, 240, 255, ${t.alpha * (1 - tIdx / ball.trail.length)})`;
          ctx.fill();
        });

        // Ball Core
        ctx.save();
        ctx.shadowColor = ball.isStrikeball ? '#f59e0b' : '#00f0ff';
        ctx.shadowBlur = 14;

        const bGrad = ctx.createRadialGradient(
          ball.x - 2,
          ball.y - 2,
          1,
          ball.x,
          ball.y,
          ball.radius
        );
        if (ball.isStrikeball) {
          bGrad.addColorStop(0, '#ffffff');
          bGrad.addColorStop(0.3, '#f59e0b');
          bGrad.addColorStop(1, '#b45309');
        } else {
          bGrad.addColorStop(0, '#ffffff');
          bGrad.addColorStop(0.4, '#38bdf8');
          bGrad.addColorStop(1, '#0284c7');
        }

        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
      });

      // Draw Particles
      sim.particles.forEach((pt) => {
        ctx.save();
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Launch prompt when ball is docked
      const hasDocked = sim.balls.some((b) => b.isDocked);
      if (hasDocked && gameState === 'playing') {
        ctx.save();
        ctx.font = 'bold 15px Orbitron';
        ctx.fillStyle = '#00f0ff';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.fillText('CLICK OR PRESS SPACE TO LAUNCH BALL', RICOCHET_WIDTH / 2, RICOCHET_HEIGHT - 65);
        ctx.restore();
      }

      ctx.restore(); // restore screen shake

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, combo, currentLevelId, recordVictory, score]);

  // Mouse Movement
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = RICOCHET_WIDTH / rect.width;
    simRef.current.mouseX = (e.clientX - rect.left) * scaleX;
    simRef.current.mouseInside = true;
  };

  const handleMouseEnter = () => {
    simRef.current.mouseInside = true;
  };

  const handleMouseLeave = () => {
    simRef.current.mouseInside = false;
  };

  const handleCanvasClick = () => {
    if (gameState === 'playing') {
      launchDockedBalls();
      fireLasers();
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto p-2 sm:p-4 select-none">
      {/* Top Ricochet HUD Panel */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-3 mb-3 flex flex-wrap items-center justify-between gap-4 shadow-xl shadow-cyan-950/30">
        <div className="flex items-center gap-4">
          <div>
            <span className="font-orbitron text-[10px] text-cyan-400 font-bold uppercase tracking-widest block">
              SECTOR
            </span>
            <span className="font-orbitron text-xl font-black text-white px-2.5 py-0.5 bg-cyan-950/70 border border-cyan-500/40 rounded-lg">
              {currentLevelId} / 50
            </span>
          </div>

          {/* Targets Remaining Counter */}
          <div className="bg-amber-950/60 border border-amber-500/40 px-2.5 py-1 rounded-lg flex flex-col justify-center">
            <span className="text-[9px] font-orbitron text-amber-400 uppercase tracking-wider font-bold block">
              BODIES LEFT
            </span>
            <span className="font-orbitron text-base font-black text-amber-300 leading-tight">
              {remainingBodies}
            </span>
          </div>

          <div className="h-8 w-px bg-slate-700 hidden sm:block" />

          {/* Lives (Minature Ships matching the curved bumper) */}
          <div className="flex items-center gap-2">
            <span className="font-orbitron text-xs text-slate-400 mr-1 hidden sm:inline">RESERVES:</span>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-5 h-4 transition-all duration-300 ${
                  i < lives ? 'opacity-100 scale-100' : 'opacity-20 scale-90'
                }`}
                title={`Reserve Ship ${i + 1}`}
              >
                {/* Mini curved shield icon */}
                <svg viewBox="0 0 24 16" className="w-full h-full fill-rose-500 stroke-cyan-400 stroke-1">
                  <path d="M 2 12 Q 12 2 22 12 L 20 14 Q 12 6 4 14 Z" />
                </svg>
              </div>
            ))}
          </div>

          {/* Active Power-up Status Badges */}
          <div className="flex items-center gap-1.5">
            {activePowerups.lasers > 0 && (
              <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/50 text-rose-300 font-orbitron text-[10px] font-bold animate-pulse">
                LASER ({Math.ceil(activePowerups.lasers)}s)
              </span>
            )}
            {activePowerups.strikeball > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300 font-orbitron text-[10px] font-bold animate-pulse">
                STRIKEBALL
              </span>
            )}
            {activePowerups.wideShield > 0 && (
              <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/50 text-purple-300 font-orbitron text-[10px] font-bold">
                WIDE SHIELD
              </span>
            )}
            {activePowerups.catch > 0 && (
              <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-orbitron text-[10px] font-bold">
                CATCH
              </span>
            )}
          </div>
        </div>

        {/* Score and Controls */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] font-orbitron uppercase text-slate-400 block tracking-widest">
              Score
            </span>
            <span className="font-orbitron text-xl sm:text-2xl font-black text-cyan-300 tracking-wider">
              {score.toLocaleString()}
            </span>
          </div>

          <div className="h-8 w-px bg-slate-700" />

          <div className="flex items-center gap-1.5">
            {gameState === 'playing' && (
              <button
                onClick={() => setGameState('paused')}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                title="Pause (Esc / P)"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setGameState('levelSelect')}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-800/50 hover:border-cyan-400 transition"
              title="Sector Select (1-50)"
            >
              <Grid className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                const state = sounds.toggleMute();
                setSoundEnabled(state);
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            <button
              onClick={() => setShowHelp(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Ricochet Guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Container */}
      <div className="relative w-full aspect-[750/700] max-h-[75vh] bg-slate-950 rounded-2xl overflow-hidden border border-cyan-500/40 shadow-2xl shadow-indigo-950/40 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={RICOCHET_WIDTH}
          height={RICOCHET_HEIGHT}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleCanvasClick}
          className="w-full h-full object-contain cursor-crosshair"
        />

        {/* ================= TITLE OVERLAY ================= */}
        {gameState === 'title' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="relative mb-6">
              <div className="absolute -inset-6 bg-cyan-500/20 blur-2xl rounded-full" />
              <h1 className="relative font-orbitron text-4xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-100 to-indigo-300 tracking-wider">
                RICOCHET
              </h1>
              <p className="font-rajdhani text-xl text-rose-400 uppercase tracking-widest mt-1 font-bold">
                ORBIT BREAKER • SPACE ARCADE
              </p>
            </div>

            <p className="max-w-md text-sm text-slate-300 font-rajdhani mb-6">
              Classic futuristic space brick-breaker. Guide the curved shield bumper with your mouse, smash through space station hulls, detonate red danger cores, and harness high-velocity powerups!
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
              <button
                onClick={handleStartCampaign}
                className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-orbitron text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 shadow-lg shadow-cyan-500/30 transition transform hover:-translate-y-0.5"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>START CAMPAIGN</span>
              </button>

              <button
                onClick={() => setGameState('levelSelect')}
                className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-orbitron text-sm font-bold bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-cyan-500/40 hover:border-cyan-300 transition"
              >
                <Grid className="w-4 h-4" />
                <span>SECTORS (50)</span>
              </button>
            </div>

            <div className="mt-8 flex items-center gap-2 text-xs text-slate-400 font-rajdhani">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              <span>Direct reproduction of the original Reflexive Ricochet space station aesthetics</span>
            </div>
          </div>
        )}

        {/* ================= LEVEL SELECT (1 TO 50) OVERLAY ================= */}
        {gameState === 'levelSelect' && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col p-6 z-20 overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <h2 className="font-orbitron text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  <Grid className="w-6 h-6 text-cyan-400" />
                  <span>SECTOR SELECT (1 - 50)</span>
                </h2>
                <p className="text-xs text-slate-400 font-rajdhani">
                  Unlocked: {saveProgress.highestSectorUnlocked} of 50 orbital sectors
                </p>
              </div>

              <button
                onClick={() => setGameState('title')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-orbitron text-xs border border-slate-700 transition"
              >
                BACK TO TITLE
              </button>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5 my-auto pb-4">
              {allLevelsRef.current.map((lvl) => {
                const isUnlocked = lvl.id <= saveProgress.highestSectorUnlocked;
                const isCurrent = lvl.id === currentLevelId;
                const best = saveProgress.highScores[lvl.id];

                return (
                  <button
                    key={lvl.id}
                    disabled={!isUnlocked}
                    onClick={() => startSector(lvl.id)}
                    className={`relative flex flex-col items-center justify-center p-2.5 rounded-lg border transition duration-200 ${
                      !isUnlocked
                        ? 'bg-slate-950/40 border-slate-800/40 text-slate-600 cursor-not-allowed opacity-50'
                        : isCurrent
                        ? 'bg-cyan-950/70 border-cyan-400 text-cyan-200 ring-2 ring-cyan-500/30'
                        : 'bg-slate-900/80 border-slate-700 hover:border-cyan-400 text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-orbitron text-sm font-bold">{lvl.id}</span>
                    {best && (
                      <span className="text-[8px] font-rajdhani text-amber-400 mt-0.5 truncate max-w-full">
                        ★ {best > 9999 ? `${Math.floor(best / 1000)}k` : best}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= PAUSE OVERLAY ================= */}
        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <h2 className="font-orbitron text-3xl font-black text-cyan-400 mb-1 tracking-widest">
              PAUSED
            </h2>
            <p className="text-slate-400 font-rajdhani text-sm mb-6">
              Sector {currentLevelId}: {simRef.current.level?.name}
            </p>

            <div className="flex flex-col gap-3 w-64">
              <button
                onClick={() => setGameState('playing')}
                className="py-3 px-6 rounded-xl font-orbitron text-sm font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/30 transition"
              >
                RESUME
              </button>

              <button
                onClick={handleRetrySector}
                className="py-3 px-6 rounded-xl font-orbitron text-sm font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-cyan-400" />
                <span>RETRY SECTOR</span>
              </button>

              <button
                onClick={() => setGameState('levelSelect')}
                className="py-3 px-6 rounded-xl font-orbitron text-sm font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition"
              >
                SECTOR SELECT
              </button>
            </div>
          </div>
        )}

        {/* ================= LEVEL CLEAR OVERLAY ================= */}
        {gameState === 'levelClear' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-fade-in">
            <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-2 animate-bounce" />
            <h2 className="font-orbitron text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200 tracking-wider">
              SECTOR CLEARED!
            </h2>
            <p className="font-rajdhani text-cyan-300 uppercase tracking-widest text-sm font-semibold mt-1 mb-6">
              Orbital perimeter secured in Sector {currentLevelId}
            </p>

            <div className="bg-slate-900/80 border border-cyan-500/30 rounded-2xl p-4 w-72 mb-6 shadow-xl">
              <div className="flex justify-between items-center mb-1 text-sm font-rajdhani">
                <span className="text-slate-400">Total Score:</span>
                <span className="font-orbitron font-bold text-cyan-300">{score.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  if (currentLevelId < 50) startSector(currentLevelId + 1);
                  else setGameState('title');
                }}
                className="py-3.5 px-8 rounded-xl font-orbitron text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 shadow-lg shadow-cyan-500/30 transition flex items-center gap-2"
              >
                <span>{currentLevelId < 50 ? 'NEXT SECTOR' : 'CAMPAIGN COMPLETE'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setGameState('levelSelect')}
                className="py-3.5 px-6 rounded-xl font-orbitron text-sm font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition"
              >
                SECTORS
              </button>
            </div>
          </div>
        )}

        {/* ================= GAME OVER OVERLAY ================= */}
        {gameState === 'gameOver' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-fade-in">
            <h2 className="font-orbitron text-3xl sm:text-5xl font-black text-rose-500 tracking-wider mb-2">
              GAME OVER
            </h2>
            <p className="font-rajdhani text-slate-400 uppercase tracking-widest text-sm mb-6">
              Hull shattered in Sector {currentLevelId}
            </p>

            <div className="bg-slate-900/80 border border-rose-500/30 rounded-2xl p-4 w-72 mb-6">
              <div className="flex justify-between items-center text-sm font-rajdhani">
                <span className="text-slate-400">Final Score:</span>
                <span className="font-orbitron font-bold text-rose-400">{score.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleRetrySector}
                className="py-3.5 px-6 rounded-xl font-orbitron text-sm font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-lg shadow-rose-500/30 transition flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RETRY SECTOR</span>
              </button>

              <button
                onClick={() => setGameState('levelSelect')}
                className="py-3.5 px-6 rounded-xl font-orbitron text-sm font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition"
              >
                SECTORS
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls Quick Reference */}
      <div className="w-full mt-3 flex flex-wrap items-center justify-between text-xs text-slate-400 px-2 font-rajdhani">
        <div className="flex items-center gap-4">
          <span><strong className="text-cyan-400">Mouse:</strong> Move Shield Bumper</span>
          <span><strong className="text-cyan-400">Click / Space:</strong> Launch Ball &amp; Fire Lasers</span>
          <span><strong className="text-cyan-400">P / Esc:</strong> Pause</span>
        </div>
        <div className="text-slate-500">
          Curved Bumper Physics • Ion Spheres • Explosive Hazard Blocks
        </div>
      </div>

      {/* Guide Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-orbitron text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-cyan-400" />
                <span>RICOCHET FIELD GUIDE</span>
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm text-slate-300 font-rajdhani">
              <div>
                <h4 className="font-orbitron text-xs text-cyan-400 font-bold uppercase mb-1">
                  1. The Curved Shield Bumper
                </h4>
                <p>
                  The curved shield bumper uses realistic arc deflection: hitting the edges sends the ball shooting horizontally into side channels, while hitting the apex fires it straight up!
                </p>
              </div>

              <div>
                <h4 className="font-orbitron text-xs text-cyan-400 font-bold uppercase mb-1">
                  2. Blue Ion Spheres &amp; Red Hazard Bricks
                </h4>
                <p>
                  • <strong>Ion Spheres:</strong> Blue energy spheres that deflect the ball along continuous normals.<br />
                  • <strong>Red Explosive Bricks:</strong> Detonate with an 85px shockwave, destroying surrounding bricks in chain reactions!
                </p>
              </div>

              <div>
                <h4 className="font-orbitron text-xs text-cyan-400 font-bold uppercase mb-1">
                  3. Station Structures &amp; Asteroids
                </h4>
                <p>
                  Indestructible tubular station rings, central elevator columns, solar panel arrays, and rotating asteroids ricochet your ball back into play.
                </p>
              </div>

              <div>
                <h4 className="font-orbitron text-xs text-cyan-400 font-bold uppercase mb-1">
                  4. Power-Up Capsules
                </h4>
                <p>
                  • <strong>[L] Laser Blasters:</strong> Dual wing cannons fired with Space or Mouse Click.<br />
                  • <strong>[S] Strikeball:</strong> Supercharges the ball so it smashes straight through bricks!<br />
                  • <strong>[M] Multi-Ball:</strong> Splits into 3 balls.<br />
                  • <strong>[W] Wide Shield:</strong> Stretches the bumper arc.<br />
                  • <strong>[C] Catch:</strong> Sticky paddle that holds the ball until you aim and fire.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full py-2.5 rounded-xl font-orbitron text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition"
            >
              GOT IT, RETURN TO GAME
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
