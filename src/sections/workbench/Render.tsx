import type { View } from './live';

/** Draws one view inside a tile well or a box (an <img> for bundled assets, a canvas for live data). */
export function Render({ view, alt = '', className }: { view: View | null; alt?: string; className?: string }) {
  if (!view) return null;
  return <img src={view.src} alt={alt} className={className} style={view.rotate180 ? { transform: 'rotate(180deg)' } : undefined} draggable={false} />;
}
