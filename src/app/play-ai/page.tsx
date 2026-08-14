"use client";

import PlaySession from "@/components/PlaySession";
import { useOnnxRppg } from "@/hooks/useOnnxRppg";

export default function PlayAiPage() {
  return (
    <PlaySession
      useEngine={useOnnxRppg}
      engineBadge="AI Model (ONNX)"
      engineNote="Uses a PhysNet 3D-CNN (converted from Hugging Face) running fully on-device via ONNX Runtime Web — heavier: expect a new reading roughly every 10 seconds, and it may be slow on older devices."
    />
  );
}
