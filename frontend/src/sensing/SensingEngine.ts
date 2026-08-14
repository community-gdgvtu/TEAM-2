import type { GazeFeatures, RGBSignal } from '../types';

const FOREHEAD_LANDMARKS = [10, 67, 69, 103, 108, 151, 337, 299, 297, 332];

export class SensingEngine {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private faceLandmarker: unknown = null;
  private running = false;
  private animationId = 0;

  // Gaze tracking state
  private blinkCount = 0;
  private lastEyeOpen = true;
  private gazePositions: Array<{ x: number; y: number }> = [];
  private headPositions: Array<{ x: number; y: number }> = [];
  private frameCount = 0;
  private startTime = 0;

  // rPPG RGB signal
  private rgbSignal: RGBSignal = {
    timestamps: [],
    red: [],
    green: [],
    blue: [],
    fps: 30,
  };

  onFrame?: (quality: number) => void;

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  async init(): Promise<void> {
    const vision = await import('@mediapipe/tasks-vision');
    const { FaceLandmarker, FilesetResolver } = vision;

    const fileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );

    const modelOptions = {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      },
      runningMode: 'VIDEO' as const,
      numFaces: 1,
    };

    try {
      this.faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        ...modelOptions,
        baseOptions: { ...modelOptions.baseOptions, delegate: 'GPU' },
      });
    } catch {
      // Fallback for machines without WebGL/GPU delegate
      this.faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        ...modelOptions,
        baseOptions: { ...modelOptions.baseOptions, delegate: 'CPU' },
      });
    }
  }

  start(): void {
    this.running = true;
    this.startTime = performance.now();
    this.blinkCount = 0;
    this.gazePositions = [];
    this.headPositions = [];
    this.rgbSignal = { timestamps: [], red: [], green: [], blue: [], fps: 30 };
    this.frameCount = 0;
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  private loop = (): void => {
    if (!this.running) return;
    this.processFrame();
    this.animationId = requestAnimationFrame(this.loop);
  };

  private processFrame(): void {
    if (this.video.readyState < 2) return;

    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    if (!w || !h) return;

    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.drawImage(this.video, 0, 0, w, h);

    const now = (performance.now() - this.startTime) / 1000;
    this.frameCount++;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const landmarker = this.faceLandmarker as any;
    if (!landmarker) return;

    try {
      const result = landmarker.detectForVideo(this.video, performance.now());
      if (result.faceLandmarks?.length > 0) {
        const landmarks = result.faceLandmarks[0];
        this.trackGaze(landmarks, now);
        this.extractRgbFromForehead(landmarks, w, h, now);

        // Draw subtle ROI indicator
        this.drawForeheadRoi(landmarks, w, h);
      }
    } catch {
      // Continue on detection errors
    }

    if (this.frameCount % 30 === 0 && this.onFrame) {
      const quality = Math.min(this.rgbSignal.green.length / 300, 1);
      this.onFrame(quality);
    }
  }

  private trackGaze(
    landmarks: Array<{ x: number; y: number; z?: number }>,
    _time: number
  ): void {
    const nose = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];

    this.headPositions.push({ x: nose.x, y: nose.y });
    if (this.headPositions.length > 120) this.headPositions.shift();

    const gazeX = (leftEye.x + rightEye.x) / 2;
    const gazeY = (leftEye.y + rightEye.y) / 2;
    this.gazePositions.push({ x: gazeX, y: gazeY });
    if (this.gazePositions.length > 120) this.gazePositions.shift();

    // Simple blink detection via eye aspect ratio proxy
    const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
    const eyeOpen = eyeDist > 0.02;
    if (this.lastEyeOpen && !eyeOpen) this.blinkCount++;
    this.lastEyeOpen = eyeOpen;
  }

  private extractRgbFromForehead(
    landmarks: Array<{ x: number; y: number }>,
    w: number,
    h: number,
    time: number
  ): void {
    const points = FOREHEAD_LANDMARKS.map((i) => landmarks[i]).filter(Boolean);
    if (points.length < 3) return;

    const xs = points.map((p) => p.x * w);
    const ys = points.map((p) => p.y * h);
    const minX = Math.max(0, Math.floor(Math.min(...xs)) - 5);
    const maxX = Math.min(w, Math.ceil(Math.max(...xs)) + 5);
    const minY = Math.max(0, Math.floor(Math.min(...ys)) - 5);
    const maxY = Math.min(h, Math.ceil(Math.max(...ys)) + 5);

    const roiW = maxX - minX;
    const roiH = maxY - minY;
    if (roiW < 5 || roiH < 5) return;

    const imageData = this.ctx.getImageData(minX, minY, roiW, roiH);
    const data = imageData.data;
    let r = 0,
      g = 0,
      b = 0;
    const pixels = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }

    this.rgbSignal.timestamps.push(time);
    this.rgbSignal.red.push(r / pixels);
    this.rgbSignal.green.push(g / pixels);
    this.rgbSignal.blue.push(b / pixels);
  }

  private drawForeheadRoi(
    landmarks: Array<{ x: number; y: number }>,
    w: number,
    h: number
  ): void {
    const points = FOREHEAD_LANDMARKS.map((i) => landmarks[i]).filter(Boolean);
    if (points.length < 3) return;
    const xs = points.map((p) => p.x * w);
    const ys = points.map((p) => p.y * h);
    this.ctx.strokeStyle = 'rgba(99, 179, 237, 0.5)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      Math.min(...xs) - 5,
      Math.min(...ys) - 5,
      Math.max(...xs) - Math.min(...xs) + 10,
      Math.max(...ys) - Math.min(...ys) + 10
    );
  }

  getGazeFeatures(): GazeFeatures {
    const durationMin = (performance.now() - this.startTime) / 60000 || 0.01;
    const blinkRate = this.blinkCount / durationMin;

    let gazeStability = 0.8;
    if (this.gazePositions.length > 10) {
      const xs = this.gazePositions.map((p) => p.x);
      const ys = this.gazePositions.map((p) => p.y);
      const xStd = std(xs);
      const yStd = std(ys);
      gazeStability = Math.max(0, 1 - (xStd + yStd) * 10);
    }

    let headMovement = 0;
    if (this.headPositions.length > 10) {
      let totalMove = 0;
      for (let i = 1; i < this.headPositions.length; i++) {
        totalMove += Math.hypot(
          this.headPositions[i].x - this.headPositions[i - 1].x,
          this.headPositions[i].y - this.headPositions[i - 1].y
        );
      }
      headMovement = totalMove / this.headPositions.length;
    }

    const attentionScore = Math.min(1, gazeStability * 0.6 + (1 - headMovement * 5) * 0.4);

    return {
      blink_rate: Math.round(blinkRate * 10) / 10,
      gaze_stability: Math.round(gazeStability * 100) / 100,
      head_movement: Math.round(headMovement * 1000) / 1000,
      attention_score: Math.round(Math.max(0, attentionScore) * 100) / 100,
    };
  }

  getRgbSignal(): RGBSignal {
    const duration = (performance.now() - this.startTime) / 1000;
    return {
      ...this.rgbSignal,
      fps: duration > 0 ? this.rgbSignal.green.length / duration : 30,
    };
  }

  getDurationSec(): number {
    return (performance.now() - this.startTime) / 1000;
  }
}

function std(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
}

export async function initCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}
