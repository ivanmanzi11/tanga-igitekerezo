import { useMemo } from "react";

/** General3 GEN_08: a handful of slow-rising dots behind the hero — cheap
 * CSS-only motion, no canvas/WebGL, disabled under prefers-reduced-motion. */
export default function ParticleField({ count = 16 }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        delay: `${(i % 8) * 0.9}s`,
        duration: `${9 + (i % 5) * 2}s`,
        size: 3 + (i % 3) * 2,
      })),
    [count]
  );

  return (
    <div className="particle-field" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          style={{
            left: p.left,
            width: p.size, height: p.size,
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
