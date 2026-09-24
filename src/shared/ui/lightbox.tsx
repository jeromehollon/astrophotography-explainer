/** Global lightbox: any <img> or <canvas> inside <main> opens enlarged in a modal. Owner: Foundation.
 *  Wired by LessonPage through event delegation, so section code needs nothing to opt in. Elements inside
 *  <button>, [role=button], <a> or [role=dialog] are skipped (they have their own behaviour, e.g. the Noise
 *  page's tour overlay), as are images under 48 px (icons, the logo). */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';

export type LightboxItem = { src: string; width: number; height: number; caption: string; pixelated: boolean; opener: HTMLElement };

const SKIP = 'button, [role="button"], a, [role="dialog"]';
const MIN_PX = 48;

function captionFor(el: HTMLImageElement | HTMLCanvasElement): string {
  const alt = el instanceof HTMLImageElement ? el.alt.trim() : '';
  if (alt) return alt;
  const aria = el.getAttribute('aria-label')?.trim();
  if (aria) return aria;
  const fig = el.closest('figure')?.querySelector('figcaption')?.textContent?.trim();
  if (fig) return fig;
  for (let node: HTMLElement | null = el; node && node.tagName !== 'MAIN'; node = node.parentElement) {
    const sib = node.parentElement?.querySelector<HTMLElement>(':scope > [data-caption]');
    if (sib) return (sib.getAttribute('data-caption') || sib.textContent || '').trim();
  }
  return '';
}

/** Builds the item for a click target, or null when the click should be left alone. */
export function lightboxItemFor(target: EventTarget | null): LightboxItem | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest('img, canvas');
  if (!(el instanceof HTMLImageElement || el instanceof HTMLCanvasElement)) return null;
  if (el.closest(SKIP)) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < MIN_PX || rect.height < MIN_PX) return null;
  let src: string; let width: number; let height: number;
  if (el instanceof HTMLImageElement) {
    if (!el.complete || el.naturalWidth === 0) return null;
    src = el.currentSrc || el.src; width = el.naturalWidth; height = el.naturalHeight;
  } else {
    if (el.width === 0 || el.height === 0) return null;
    try { src = el.toDataURL('image/png'); } catch { return null; }
    width = el.width; height = el.height;
  }
  const rendering = getComputedStyle(el).imageRendering;
  return { src, width, height, caption: captionFor(el), pixelated: rendering === 'pixelated' || rendering === 'crisp-edges', opener: el };
}

/** Attaches the delegated click handler to `root` and renders the overlay while an item is open. */
export function Lightbox({ root }: { root: RefObject<HTMLElement | null> }) {
  const [item, setItem] = useState<LightboxItem | null>(null);
  useEffect(() => {
    const main = root.current;
    if (!main) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const next = lightboxItemFor(e.target);
      if (!next) return;
      e.preventDefault();
      setItem(next);
    };
    main.addEventListener('click', onClick);
    return () => main.removeEventListener('click', onClick);
  }, [root]);
  if (!item) return null;
  return <LightboxOverlay item={item} onClose={() => setItem(null)} />;
}

const CAPTION_ROOM = 64; // caption line + gap under the image
const fit = (w: number, h: number) => {
  const scale = Math.min(2, (0.92 * window.innerWidth) / w, (0.92 * window.innerHeight - CAPTION_ROOM) / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
};

export function LightboxOverlay({ item, onClose }: { item: LightboxItem; onClose: () => void }) {
  const [size, setSize] = useState(() => fit(item.width, item.height));
  const closeRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    setSize(fit(item.width, item.height));
    const onResize = () => setSize(fit(item.width, item.height));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [item]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const { opener } = item;
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (!opener.hasAttribute('tabindex')) opener.setAttribute('tabindex', '-1');
      opener.focus({ preventScroll: true });
    };
  }, [item, onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={item.caption || 'Enlarged image'} data-lightbox onClick={onClose}
      className="fixed inset-0 z-50 flex cursor-zoom-out flex-col items-center justify-center gap-4 bg-[rgba(15,18,32,0.85)]">
      <button ref={closeRef} type="button" aria-label="Close" onClick={onClose}
        className="absolute right-6 top-6 flex size-11 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-text-on-stage hover:bg-space-700 focus-stage">
        <Icon name="close" size={24} />
      </button>
      <img src={item.src} alt={item.caption} width={size.width} height={size.height} draggable={false}
        style={{ width: size.width, height: size.height, imageRendering: item.pixelated ? 'pixelated' : 'auto' }} className="block select-none" />
      {item.caption && <p className="m-0 max-w-[92vw] text-center t-body-sm text-text-on-stage-muted">{item.caption}</p>}
    </div>,
    document.body,
  );
}
