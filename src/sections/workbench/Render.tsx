import { useLayoutEffect, useRef, useState } from 'react';
import { RoiCanvas } from '../../shared/pipeline';
import type { View } from './live';

/**
 * Draws one view so that it covers its box (like object-fit: cover): an <img> for bundled assets, a
 * RoiCanvas for live Float32 data through that image's own STF (live.ts ownStf). The wrapper is always rendered so its
 * size is known by the time live data arrives.
 */
export function Render({ view, alt = '', className }: { view: View | null; alt?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  let canvas: React.ReactNode = null;
  if (view?.kind === 'raw' && box && view.w > 0 && view.h > 0) {
    const scale = Math.max(box.w / view.w, box.h / view.h);
    const width = Math.round(view.w * scale);
    const height = Math.round(view.h * scale);
    const left = Math.round((box.w - width) / 2);
    const top = Math.round((box.h - height) / 2);
    canvas = <RoiCanvas data={view.data} w={view.w} h={view.h} stf={view.stf} rotate180={view.rotate180} width={width} height={height} style={{ position: 'absolute', left, top }} />;
  }
  return (
    <div ref={ref} role="img" aria-label={alt} className={`absolute inset-0 overflow-hidden ${className ?? ''}`}>
      {view?.kind === 'img' && (
        <img src={view.src} alt="" className="absolute inset-0 h-full w-full object-cover" style={view.rotate180 ? { transform: 'rotate(180deg)' } : undefined} draggable={false} />
      )}
      {canvas}
    </div>
  );
}
