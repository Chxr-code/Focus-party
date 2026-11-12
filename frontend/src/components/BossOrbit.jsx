import { useEffect, useRef } from 'react';

// The pest crawls in an oval around the room tree. It goes behind the tree on the far side,
// faces the way it's moving, shakes when hit, and runs off when defeated.
const LAP_MS = 16000;
const CENTER = { x: 50, y: 44 }; // % of the scene — around the base of the tree
const RADIUS = { x: 26, y: 13 };

export default function BossOrbit({ src, alt, dead, hit, hpPercent }) {
  const el = useRef(null);
  const sprite = useRef(null);

  useEffect(() => {
    if (dead) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const a = reduce ? Math.PI / 4 : ((now - t0) / LAP_MS) * Math.PI * 2;
      const x = CENTER.x + Math.cos(a) * RADIUS.x;
      const y = CENTER.y + Math.sin(a) * RADIUS.y;
      const node = el.current;
      if (node) {
        node.style.left = `${x}%`;
        node.style.top = `${y}%`;
        // far side of the oval (top half) = behind the tree; near side = in front
        node.style.zIndex = Math.sin(a) < 0 ? 0 : 2;
        // moving left on the near side, right on the far side → flip to face the direction
        if (sprite.current) sprite.current.style.transform = `scaleX(${-Math.sin(a) < 0 ? -1 : 1})`;
      }
      if (!reduce) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dead]);

  return (
    <div ref={el} className={`boss-sprite ${hit ? 'hit' : ''} ${dead ? 'dead' : ''}`}>
      <img ref={sprite} src={src} alt={alt} className="pixelated" />
      {hit && <span key={hit.key} className="dmg pixel">-{hit.amount}</span>}
      <div className="boss-mini-hp" aria-hidden="true">
        <span style={{ width: `${hpPercent}%` }} />
      </div>
    </div>
  );
}
