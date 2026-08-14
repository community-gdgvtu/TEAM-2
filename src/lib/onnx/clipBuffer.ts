import { CLIP_FRAMES, CROP_SIZE } from "./model";

/** Rolling buffer of CLIP_FRAMES sampled face crops, used to build the model's input tensor. */
export class ClipBuffer {
  private frames: Float32Array[] = []; // each HWC, length CROP_SIZE*CROP_SIZE*3, values in [0,1]
  private timestamps: number[] = [];

  push(frameHWC: Float32Array, t: number) {
    this.frames.push(frameHWC);
    this.timestamps.push(t);
    if (this.frames.length > CLIP_FRAMES) {
      this.frames.shift();
      this.timestamps.shift();
    }
  }

  isFull(): boolean {
    return this.frames.length >= CLIP_FRAMES;
  }

  getTimestamps(): number[] {
    return this.timestamps.slice();
  }

  /** Builds the (1,3,T,H,W) NCDHW float32 tensor the model expects. Buffer must be full. */
  buildTensor(): Float32Array {
    const planeSize = CROP_SIZE * CROP_SIZE;
    const out = new Float32Array(3 * CLIP_FRAMES * planeSize);
    for (let t = 0; t < CLIP_FRAMES; t++) {
      const frame = this.frames[t];
      const tOffset = t * planeSize;
      for (let p = 0; p < planeSize; p++) {
        out[tOffset + p] = frame[p * 3]; // R plane
        out[CLIP_FRAMES * planeSize + tOffset + p] = frame[p * 3 + 1]; // G plane
        out[2 * CLIP_FRAMES * planeSize + tOffset + p] = frame[p * 3 + 2]; // B plane
      }
    }
    return out;
  }
}
