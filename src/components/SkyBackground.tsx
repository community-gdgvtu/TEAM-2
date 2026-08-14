/** Decorative floating clouds/stars, purely cosmetic. Sits behind page content. */
export default function SkyBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-b from-sky-300 via-sky-100 to-yellow-50">
      <div className="absolute left-[6%] top-[8%] animate-float-slow text-6xl opacity-90 sm:text-7xl">☁️</div>
      <div className="absolute right-[10%] top-[16%] animate-float-slower text-5xl opacity-80 sm:text-6xl">☁️</div>
      <div className="absolute left-[18%] top-[38%] animate-float-slower text-4xl opacity-70">⭐</div>
      <div className="absolute right-[16%] top-[52%] animate-float-slow text-3xl opacity-70">✨</div>
      <div className="absolute left-[8%] bottom-[14%] animate-float-slow text-5xl opacity-80">☁️</div>
      <div className="absolute right-[6%] bottom-[10%] animate-float-slower text-4xl opacity-70">⭐</div>
      <div className="absolute right-[30%] top-[6%] text-3xl opacity-60 animate-float-slow">✨</div>
    </div>
  );
}
