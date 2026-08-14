import Phaser from 'phaser';
import type { GameEvent, GameFeatures } from '../types';

export interface GameStats {
  score: number;
  events: GameEvent[];
  features: GameFeatures;
}

const COLORS = [0x6bcb77, 0x4d96ff, 0xff6b6b, 0xffd93d, 0xc77dff, 0xff8fab];
const BUBBLE_LABELS = ['⭐', '🌟', '💫', '🎈', '🫧', '✨'];

class BubbleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BubbleScene' });
  }

  private score = 0;
  private gameEvents: GameEvent[] = [];
  private reactionTimes: number[] = [];
  private misses = 0;
  private hits = 0;
  private hesitations = 0;
  private spawnTime = 0;
  private activeBubble: Phaser.GameObjects.Container | null = null;
  private sessionDuration = 60;
  private startTime = 0;
  private onComplete?: (stats: GameStats) => void;
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;

  init(data: { duration?: number; onComplete?: (stats: GameStats) => void }) {
    this.sessionDuration = data.duration ?? 60;
    this.onComplete = data.onComplete;
    this.score = 0;
    this.gameEvents = [];
    this.reactionTimes = [];
    this.misses = 0;
    this.hits = 0;
    this.hesitations = 0;
  }

  create() {
    this.startTime = Date.now();
    const { width, height } = this.scale;

    // Background gradient effect
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    this.scoreText = this.add
      .text(20, 16, 'Score: 0', { fontFamily: 'Nunito', fontSize: '22px', color: '#fff' })
      .setDepth(10);

    this.timerText = this.add
      .text(width - 20, 16, `${this.sessionDuration}s`, {
        fontFamily: 'Nunito',
        fontSize: '22px',
        color: '#ffd93d',
      })
      .setOrigin(1, 0)
      .setDepth(10);

    this.add
      .text(width / 2, height - 30, 'Pop the bubbles! 🫧', {
        fontFamily: 'Nunito',
        fontSize: '18px',
        color: '#aaa',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.spawnBubble();
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.tick,
    });
  }

  private tick = () => {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const remaining = Math.max(0, this.sessionDuration - elapsed);
    this.timerText.setText(`${Math.ceil(remaining)}s`);

    if (remaining <= 0) {
      this.endGame();
      return;
    }

    // Hesitation detection: bubble alive > 3s without click
    if (this.activeBubble && this.spawnTime && Date.now() - this.spawnTime > 3000) {
      this.hesitations++;
      this.gameEvents.push({ type: 'hesitation', timestamp: Date.now() });
      this.spawnTime = Date.now(); // reset to avoid double count
    }
  };

  private spawnBubble() {
    if ((Date.now() - this.startTime) / 1000 >= this.sessionDuration) return;

    const { width, height } = this.scale;
    const x = Phaser.Math.Between(80, width - 80);
    const y = Phaser.Math.Between(100, height - 80);
    const color = Phaser.Utils.Array.GetRandom(COLORS);
    const label = Phaser.Utils.Array.GetRandom(BUBBLE_LABELS);
    const size = Phaser.Math.Between(50, 75);

    const container = this.add.container(x, y);
    const circle = this.add.circle(0, 0, size / 2, color, 0.85);
    circle.setStrokeStyle(3, 0xffffff, 0.5);
    const emoji = this.add
      .text(0, 0, label, { fontSize: `${size * 0.5}px` })
      .setOrigin(0.5);
    container.add([circle, emoji]);
    container.setSize(size, size);
    container.setInteractive(new Phaser.Geom.Circle(0, 0, size / 2), Phaser.Geom.Circle.Contains);

    // Float animation
    this.tweens.add({
      targets: container,
      y: y + Phaser.Math.Between(-15, 15),
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.spawnTime = Date.now();
    this.activeBubble = container;

    circle.on('pointerdown', () => {
      const reactionMs = Date.now() - this.spawnTime;
      this.reactionTimes.push(reactionMs);
      this.hits++;
      this.score += Math.max(10, 100 - Math.floor(reactionMs / 20));
      this.scoreText.setText(`Score: ${this.score}`);
      this.gameEvents.push({ type: 'hit', reaction_ms: reactionMs, timestamp: Date.now() });

      this.tweens.add({
        targets: container,
        scaleX: 1.4,
        scaleY: 1.4,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          container.destroy();
          this.activeBubble = null;
          this.time.delayedCall(Phaser.Math.Between(400, 900), () => this.spawnBubble());
        },
      });
    });

    // Auto-miss after 4s
    this.time.delayedCall(4000, () => {
      if (container.active && this.activeBubble === container) {
        this.misses++;
        this.gameEvents.push({ type: 'miss', timestamp: Date.now() });
        container.destroy();
        this.activeBubble = null;
        this.spawnBubble();
      }
    });
  }

  private endGame() {
    this.input.enabled = false;
    if (this.activeBubble) this.activeBubble.destroy();

    const total = this.hits + this.misses || 1;
    const avgRt =
      this.reactionTimes.length > 0
        ? this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length
        : 0;
    const rtStd =
      this.reactionTimes.length > 1
        ? Math.sqrt(
            this.reactionTimes.reduce((s, v) => s + (v - avgRt) ** 2, 0) / this.reactionTimes.length
          )
        : 0;

    const stats: GameStats = {
      score: this.score,
      events: this.gameEvents,
      features: {
        avg_reaction_time_ms: Math.round(avgRt),
        reaction_time_std: Math.round(rtStd),
        error_rate: Math.round((this.misses / total) * 100) / 100,
        retry_rate: 0,
        hesitation_count: this.hesitations,
        total_events: total,
        score: this.score,
      },
    };

    this.add
      .text(this.scale.width / 2, this.scale.height / 2, '🎉 Great job!', {
        fontFamily: 'Nunito',
        fontSize: '36px',
        color: '#ffd93d',
      })
      .setOrigin(0.5);

    this.time.delayedCall(1500, () => {
      this.onComplete?.(stats);
      this.scene.stop();
    });
  }
}

export function createBubbleGame(
  parent: HTMLElement,
  duration: number,
  onComplete: (stats: GameStats) => void
): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth || 640,
    height: parent.clientHeight || 480,
    backgroundColor: '#1a1a2e',
    scene: BubbleScene,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  game.scene.start('BubbleScene', { duration, onComplete });
  return game;
}
