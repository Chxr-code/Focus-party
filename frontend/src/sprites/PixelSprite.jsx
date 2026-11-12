import { useMemo } from 'react';

// Draws a sprite written as rows of letters, e.g.
//   grid = ["..GG..", ".GGGG."], palette = { G: '#4caf50' }
// '.' (or any letter missing from the palette) is transparent.
// Size it with CSS (width) — it stays sharp at any size.
export default function PixelSprite({ grid, palette, className, style, title }) {
  const rects = useMemo(() => {
    const out = [];
    grid.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        if (!palette[ch]) { x++; continue; }
        let run = 1;
        while (row[x + run] === ch) run++; // merge same-colour pixels in a row
        out.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} fill={palette[ch]} />);
        x += run;
      }
    });
    return out;
  }, [grid, palette]);

  const w = grid[0].length;
  const h = grid.length;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects}
    </svg>
  );
}
