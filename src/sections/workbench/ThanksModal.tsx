/**
 * Thank-you modal shown once per visit after the learner's first PNG download (owner request). Styled like the
 * shared lightbox (src/shared/ui/lightbox.tsx): dimmed stage backdrop, close button top right, Escape or a
 * backdrop click closes, focus is trapped inside and returned to the opener. The three photographs are
 * assets/thanks/observatory_*.jpg (tools/assets/thanks_photos.py).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../shared/ui';
import dome from '../../../assets/thanks/observatory_3.jpg';
import inside from '../../../assets/thanks/observatory_1.jpg';
import slit from '../../../assets/thanks/observatory_2.jpg';
import { cx, T } from './ui';

export const THANKS_KEY = 'thanksShown';

/** True the first time in this tab session; later calls return false. Storage failures count as "show it". */
export function claimThanks(): boolean {
  try {
    if (sessionStorage.getItem(THANKS_KEY)) return false;
    sessionStorage.setItem(THANKS_KEY, '1');
  } catch { /* private mode or blocked storage: show it */ }
  return true;
}

// Pixel sizes of the bundled JPEGs (fitted inside 1600 px by tools/assets/thanks_photos.py).
const LEAD = { src: dome, w: 1068, h: 1073, alt: 'The observatory dome at dusk' };
const SIDE = [
  { src: inside, w: 1600, h: 1200, alt: 'Inside the dome, the telescope on its mount' },
  { src: slit, w: 1200, h: 1600, alt: 'The telescope under the open slit at night' },
];
const GAP = 16;
const PAD = 32;
const TEXT_ROOM = 132; // heading, two lines of body and the gaps above the photographs

/**
 * Lead photograph at height H on the left; the two others stacked in one column on the right, sharing a width
 * such that their heights plus the gap equal H. H is the largest value that keeps the panel inside 92 % of the
 * viewport in both directions.
 */
function layout(vw: number, vh: number) {
  const leadAspect = LEAD.w / LEAD.h;
  const colPerWidth = SIDE.reduce((s, p) => s + p.h / p.w, 0); // column height per unit of column width
  const maxW = 0.92 * vw - 2 * PAD;
  const maxH = 0.92 * vh - 2 * PAD - TEXT_ROOM;
  // width(H) = H·leadAspect + GAP + (H − GAP)/colPerWidth ≤ maxW
  const hFromWidth = (maxW - GAP + GAP / colPerWidth) / (leadAspect + 1 / colPerWidth);
  const H = Math.max(240, Math.floor(Math.min(maxH, hFromWidth)));
  const colW = Math.floor((H - GAP) / colPerWidth);
  return { H, leadW: Math.round(H * leadAspect), colW };
}

export function ThanksModal({ onClose, returnFocusTo }: { onClose: () => void; returnFocusTo: () => HTMLElement | null }) {
  const [size, setSize] = useState(() => layout(window.innerWidth, window.innerHeight));
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const onResize = () => setSize(layout(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key === 'Tab') {
        // focus trap: cycle through the dialog's own focusable elements
        const items = [...(panelRef.current?.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])') ?? [])];
        if (items.length === 0) return;
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i < 0 || i === items.length - 1 ? 0 : i + 1);
        e.preventDefault();
        items[next].focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      returnFocusTo()?.focus({ preventScroll: true });
    };
  }, [onClose, returnFocusTo]);
  return createPortal(
    <div role="presentation" data-thanks-modal onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,18,32,0.85)]">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="thanks-heading" onClick={(e) => e.stopPropagation()}
        className="relative box-border flex flex-col gap-4 border border-border-on-stage bg-surface-stage-raised text-text-on-stage" style={{ padding: PAD }}>
        <button ref={closeRef} type="button" aria-label="Close" onClick={onClose}
          className="absolute right-3 top-3 flex size-11 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-text-on-stage hover:bg-space-700 focus-stage">
          <Icon name="close" size={24} />
        </button>
        <div className="flex flex-col gap-2 pr-12">
          <h2 id="thanks-heading" className={cx('m-0', T.h2)}>Thank you for working through the lesson</h2>
          <p className={cx('m-0 max-w-[720px] text-text-on-stage-muted', T.bodyMd)}>
            These are photographs of Stella Venator Observatory in Lexington, Kentucky, where every exposure in this lesson was taken.
            I hope it has sparked a passion for astrophotography in you.
          </p>
        </div>
        <div className="flex items-start" style={{ gap: GAP }}>
          <img src={LEAD.src} alt={LEAD.alt} width={size.leadW} height={size.H} draggable={false} className="block select-none object-cover" style={{ width: size.leadW, height: size.H }} />
          <div className="flex flex-col" style={{ gap: GAP, width: size.colW }}>
            {SIDE.map((p) => (
              <img key={p.src} src={p.src} alt={p.alt} width={size.colW} height={Math.round((size.colW * p.h) / p.w)} draggable={false} className="block select-none"
                style={{ width: size.colW, height: Math.round((size.colW * p.h) / p.w) }} />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
