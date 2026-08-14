"use client";

import PlaySession from "@/components/PlaySession";
import { useRppg } from "@/hooks/useRppg";

export default function PlayPage() {
  return (
    <PlaySession
      useEngine={useRppg}
      engineBadge="Classic"
      engineNote="Uses the classical POS signal-processing algorithm — fast and works on any device."
    />
  );
}
