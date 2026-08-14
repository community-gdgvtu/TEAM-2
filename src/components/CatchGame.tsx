"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PETS = ["🐶", "🐱", "🐰", "🦊", "🐼", "🐥"];
const MAX_LIVES = 3;
const BASKET_WIDTH = 90;
const BASKET_HEIGHT = 56;
const CATCH_LINE_OFFSET = 40; // how far above the basket top counts as a catch

interface FallingPet {
  id: number;
  emoji: string;
  x: number;
  y: number;
  speed: number;
}

export interface CatchGameHandle {
  score: number;
  lives: number;
}

interface CatchGameProps {
  running: boolean;
  onScoreChange?: (score: number) => void;
  onGameOver?: (finalScore: number) => void;
}

export default function CatchGame({ running, onScoreChange, onGameOver }: CatchGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const petsRef = useRef<FallingPet[]>([]);
  const basketXRef = useRef(200);
  const lastSpawnRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const nextIdRef = useRef(0);
  const startTimeRef = useRef(0);
  const gameOverRef = useRef(false);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [size, setSize] = useState({ w: 640, h: 480 });

  useEffect(() => {
    function resize() {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = Math.min(560, Math.max(360, w * 0.75));
      setSize({ w, h });
      basketXRef.current = w / 2;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const handlePointer = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    basketXRef.current = Math.max(BASKET_WIDTH / 2, Math.min(size.w - BASKET_WIDTH / 2, x));
  }, [size.w]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      handlePointer(e.clientX);
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches[0]) handlePointer(e.touches[0].clientX);
    }
    function onKeyDown(e: KeyboardEvent) {
      const step = 28;
      if (e.key === "ArrowLeft") basketXRef.current = Math.max(BASKET_WIDTH / 2, basketXRef.current - step);
      if (e.key === "ArrowRight") basketXRef.current = Math.min(size.w - BASKET_WIDTH / 2, basketXRef.current + step);
    }
    const canvas = canvasRef.current;
    canvas?.addEventListener("mousemove", onMouseMove);
    canvas?.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      canvas?.removeEventListener("mousemove", onMouseMove);
      canvas?.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handlePointer, size.w]);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const context = ctx;

    let localScore = 0;
    let localLives = MAX_LIVES;

    function spawnPet(elapsedSec: number) {
      const speed = 90 + Math.min(140, elapsedSec * 3); // ramps up over time
      petsRef.current.push({
        id: nextIdRef.current++,
        emoji: PETS[Math.floor(Math.random() * PETS.length)],
        x: 30 + Math.random() * (size.w - 60),
        y: -30,
        speed,
      });
    }

    function frame(now: number) {
      const elapsedSec = (now - startTimeRef.current) / 1000;
      const spawnInterval = Math.max(500, 1400 - elapsedSec * 20); // spawns faster over time

      if (now - lastSpawnRef.current > spawnInterval && !gameOverRef.current) {
        spawnPet(elapsedSec);
        lastSpawnRef.current = now;
      }

      context.clearRect(0, 0, size.w, size.h);

      // rainbow-sky background
      const grad = context.createLinearGradient(0, 0, 0, size.h);
      grad.addColorStop(0, "#ffd6f5");
      grad.addColorStop(0.4, "#bfe9ff");
      grad.addColorStop(1, "#eafff1");
      context.fillStyle = grad;
      context.fillRect(0, 0, size.w, size.h);

      // sun
      context.fillStyle = "#ffe066";
      context.beginPath();
      context.arc(size.w - 56, 54, 30, 0, Math.PI * 2);
      context.fill();

      // drifting clouds
      context.fillStyle = "rgba(255,255,255,0.85)";
      const cloudDrift = (now / 1000) % (size.w + 160);
      [0, 1, 2].forEach((i) => {
        const cx = ((cloudDrift + i * 260) % (size.w + 160)) - 80;
        const cy = 40 + i * 46;
        [0, 1, 2].forEach((j) => {
          context.beginPath();
          context.arc(cx + j * 18, cy + (j === 1 ? -8 : 0), 16, 0, Math.PI * 2);
          context.fill();
        });
      });

      // grassy ground strip with little flowers
      context.fillStyle = "#bdf0b0";
      context.fillRect(0, size.h - 18, size.w, 18);
      context.fillStyle = "#ff9ecf";
      for (let fx = 20; fx < size.w; fx += 60) {
        context.beginPath();
        context.arc(fx, size.h - 9, 3, 0, Math.PI * 2);
        context.fill();
      }

      const basketTop = size.h - BASKET_HEIGHT - 10;
      const dt = 1 / 60;

      petsRef.current = petsRef.current.filter((pet) => {
        pet.y += pet.speed * dt;

        const caughtY = pet.y >= basketTop - CATCH_LINE_OFFSET && pet.y <= basketTop + BASKET_HEIGHT / 2;
        const caughtX = Math.abs(pet.x - basketXRef.current) < BASKET_WIDTH / 2 + 10;

        if (caughtY && caughtX) {
          localScore += 1;
          setScore(localScore);
          onScoreChange?.(localScore);
          return false;
        }

        if (pet.y > size.h + 20) {
          localLives -= 1;
          setLives(localLives);
          if (localLives <= 0 && !gameOverRef.current) {
            gameOverRef.current = true;
            onGameOver?.(localScore);
          }
          return false;
        }
        return true;
      });

      // draw pets
      context.font = "34px serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      for (const pet of petsRef.current) {
        context.fillText(pet.emoji, pet.x, pet.y);
      }

      // draw basket, with a gentle bob for charm
      const basketBob = Math.sin(now / 260) * 3;
      context.font = "48px serif";
      context.fillText("🧺", basketXRef.current, basketTop + BASKET_HEIGHT / 2 + basketBob);

      if (!gameOverRef.current) {
        rafRef.current = requestAnimationFrame(frame);
      }
    }

    startTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, size.w, size.h]);

  return (
    <div ref={containerRef} className="w-full">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="font-display rounded-full bg-orange-100 px-4 py-1 text-lg font-semibold text-orange-600 shadow-sm">
          ⭐ {score}
        </div>
        <div className="text-xl" aria-label={`${lives} lives left`}>
          {"❤️".repeat(Math.max(0, lives))}
          {"🤍".repeat(Math.max(0, MAX_LIVES - lives))}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        className="w-full touch-none rounded-[2rem] border-8 border-white shadow-[0_0_0_4px_rgb(253,224,71)]"
      />
      <p className="mt-2 text-center text-sm font-medium text-slate-500">
        Move your mouse, finger, or arrow keys to catch the pets in the basket!
      </p>
    </div>
  );
}
