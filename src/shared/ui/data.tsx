import type { ReactNode } from 'react';
import { CheckMark } from './controls';

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

/* ---------- Callout (9:210): Note / Why? / Careful. Never a disclosure. ---------- */
export function Callout({ kind, title, children, className }: { kind: 'note' | 'why' | 'caution'; title: string; children: ReactNode; className?: string }) {
  const box = {
    note: 'bg-surface-panel border-l-4 border-accent-primary',
    why: 'bg-surface-card border border-border-strong',
    caution: 'bg-source-flat-soft border-l-4 border-source-flat',
  }[kind];
  const word = { note: 'Note', why: 'Why?', caution: 'Careful' }[kind];
  return (
    <aside className={cx('flex w-full flex-col items-start gap-2 border-solid px-6 py-4', box, className)}>
      <div className={cx('t-eyebrow', kind === 'why' ? 'text-text-link' : 'text-text-secondary')}>{word}</div>
      <div className="w-full t-label-md text-text-primary">{title}</div>
      <div className="w-full t-body-sm text-text-primary">{children}</div>
    </aside>
  );
}

/* ---------- Badge (9:189): colour + shape + fixed label per kind (design-notes §2) ---------- */
type Kind = 'light' | 'bias' | 'dark' | 'flat' | 'darkflat' | 'noise' | 'external';
export type BadgeProps = ({ source: 'bias' | 'dark' | 'flat' | 'noise' | 'external'; frame?: undefined } | { frame: 'light' | 'bias' | 'dark' | 'flat' | 'darkflat'; source?: undefined }) & { label?: string; className?: string };

const KIND = {
  light: { label: 'Light frame', box: 'bg-surface-card border-border-strong' },
  bias: { label: 'Bias', box: 'bg-source-bias-soft border-source-bias' },
  dark: { label: 'Dark', box: 'bg-source-dark-soft border-source-dark' },
  flat: { label: 'Flat', box: 'bg-source-flat-soft border-source-flat' },
  darkflat: { label: 'Dark flat', box: 'bg-source-dark-soft border-source-dark' },
  noise: { label: 'Random noise', box: 'bg-source-noise-soft border-source-noise' },
  external: { label: 'Outside the camera', box: 'bg-source-external-soft border-source-external' },
} as const satisfies Record<Kind, { label: string; box: string }>;

/** Glyphs traced from the Badge component: 12 px box (14 px for the light star). */
export function Glyph({ kind, className }: { kind: Kind; className?: string }) {
  switch (kind) {
    case 'light': return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className={className}><path d="M7 0L8.73241 5.26759L14 7L8.73241 8.73241L7 14L5.26759 8.73241L0 7L5.26759 5.26759L7 0Z" fill="#1C1A17" /></svg>;
    case 'bias': return <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={className}><circle cx="6" cy="6" r="6" fill="#1F4AA8" /></svg>;
    case 'dark': return <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={className}><rect width="12" height="12" fill="#C8321F" /></svg>;
    case 'flat': return <svg width="13" height="12" viewBox="0 0 13 12" aria-hidden="true" className={className}><path d="M6.5 0L12.13 9H0.87L6.5 0Z" fill="#E3A81E" /></svg>;
    case 'darkflat': return <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={className}><rect width="12" height="12" fill="#C8321F" /><path d="M6 2.5L9.4641 7.75H2.5359L6 2.5Z" fill="#E3A81E" /></svg>;
    case 'noise': return <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={className}><path d="M6 0L12 6L6 12L0 6L6 0Z" fill="#8B8B8B" /></svg>;
    case 'external': return <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={className}><path d="M6 0.3L11.7 4.45L9.53 11.15H2.47L0.3 4.45L6 0.3Z" fill="#6B3FA0" /></svg>;
  }
}

export function Badge(props: BadgeProps) {
  const kind: Kind = props.source ?? props.frame!;
  const meta = KIND[kind];
  return (
    <span className={cx('inline-flex items-center gap-2 rounded-sm border border-solid px-2 py-1 t-label-sm text-text-primary whitespace-nowrap', meta.box, props.className)}>
      <Glyph kind={kind} />
      {props.label ?? meta.label}
    </span>
  );
}

/* ---------- Histograms (9:249, 16:431): cream bars on the stage colour, no axes or text ---------- */
export function HistogramBars({ bars, width, height, className, color = 'var(--color-cream-50)', gap = 1 }: {
  bars: number[]; width: number; height: number; className?: string; color?: string; gap?: number;
}) {
  const n = Math.max(1, bars.length);
  const pitch = width / n;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cx('block', className)} aria-hidden="true">
      {bars.map((v, i) => {
        const h = Math.max(1, Math.max(0, Math.min(1, v)) * height);
        return <rect key={i} x={i * pitch} y={height - h} width={Math.max(pitch - gap, 1)} height={h} fill={color} />;
      })}
    </svg>
  );
}

/** Histogram/Mini (16:431): 96×40, 24 bars, stage background. */
export function HistogramMini({ bars, className }: { bars: number[]; className?: string }) {
  return (
    <div className={cx('h-10 w-24 shrink-0 overflow-hidden bg-surface-stage', className)}>
      <HistogramBars bars={bars} width={96} height={40} />
    </div>
  );
}

/** Histogram (9:249): 280×109 panel with a 1 px muted axis; use HistogramBars for other sizes. */
export function Histogram({ bars, width = 280, height = 109, className }: { bars: number[]; width?: number; height?: number; className?: string }) {
  return (
    <div className={cx('relative box-border overflow-hidden border border-solid border-border-on-stage bg-surface-stage-raised', className)} style={{ width, height }}>
      <div className="absolute inset-x-0 bottom-0" style={{ height: height - 3 }}><HistogramBars bars={bars} width={width - 2} height={height - 4} /></div>
      <div className="absolute inset-x-0 h-px bg-text-on-stage-muted" style={{ bottom: 1 }} />
    </div>
  );
}

/* ---------- ROITile (9:337): title, 320×240 well, optional caption; Default / Pending / Processing / Empty ---------- */
export function ROITile({ title, caption, state = 'default', width = 320, height = 240, percent, children, className }: {
  title: string; caption?: ReactNode; state?: 'default' | 'pending' | 'processing' | 'empty'; width?: number; height?: number; percent?: number; children?: ReactNode; className?: string;
}) {
  return (
    <figure className={cx('m-0 box-border flex flex-col items-start border border-solid border-border-on-stage bg-surface-stage-raised', className)} style={{ width }}>
      <figcaption className="flex w-full items-center px-3 py-2.5 t-label-md text-text-on-stage whitespace-nowrap">{title}</figcaption>
      <div className="relative w-full overflow-hidden bg-surface-stage" style={{ height }}>
        <div className="h-full w-full [&>img]:block [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full">{state === 'empty' ? null : children}</div>
        {(state === 'pending' || state === 'processing') && <div className="absolute inset-0 bg-surface-stage" />}
        {state === 'pending' && <p className="absolute left-0 right-0 top-[110px] m-0 text-center t-label-md text-text-on-stage">Result pending — press Stack</p>}
        {state === 'processing' && (
          <>
            <p className="absolute left-0 right-0 top-[110px] m-0 text-center t-label-md text-text-on-stage">Stacking…{percent !== undefined ? ` ${Math.round(percent)}%` : ''}</p>
            <div className="absolute bottom-0 left-0 h-1 bg-accent-focus-on-stage" style={{ width: `${Math.max(0, Math.min(100, percent ?? 0))}%` }} />
          </>
        )}
        {state === 'empty' && (
          <>
            <p className="absolute left-0 right-0 top-[100px] m-0 text-center t-label-md text-text-on-stage">No frames selected</p>
            <p className="absolute left-0 right-0 top-[124px] m-0 text-center t-body-sm text-text-on-stage-muted">Pick at least one light frame to see this region.</p>
          </>
        )}
      </div>
      {caption && <div className="w-full px-3 py-2.5 t-body-sm text-text-on-stage-muted">{caption}</div>}
    </figure>
  );
}

/* ---------- NoiseReadout (9:216): label/sm muted, mono/lg value, mono/sm compare line. Stage only. ---------- */
export function NoiseReadout({ value, ratio, label = 'Background noise', compare, className }: {
  value: number | null; ratio?: number; label?: string; compare?: string; className?: string;
}) {
  const line = compare ?? (ratio !== undefined && value !== null ? `${ratio.toFixed(1)}× less than one frame` : undefined);
  return (
    <div className={cx('flex flex-col items-start gap-0.5 whitespace-nowrap', className)}>
      <span className="t-label-sm text-text-on-stage-muted">{label}</span>
      <span className="t-mono-lg text-text-on-stage">{value === null ? '—' : value.toFixed(1)}</span>
      {line && <span className="t-mono-sm text-text-on-stage-muted">{line}</span>}
    </div>
  );
}

/* ---------- FrameCard (9:382): 760-wide row: checkbox · number · 83×56 thumbnail · Histogram/Mini · FWHM · notes ---------- */
export function FrameCard({ number, label, thumbSrc, histogram, fwhm, note, selected, onSelectedChange, state, className }: {
  number: number | string; label: string; thumbSrc: string; histogram: number[]; fwhm: number; note: ReactNode; selected: boolean;
  onSelectedChange: (v: boolean) => void; state?: 'default' | 'selected' | 'reference'; className?: string;
}) {
  const s = state ?? (selected ? 'selected' : 'default');
  const box = s === 'reference' ? 'bg-source-bias-soft border-2 border-accent-primary'
    : s === 'selected' ? 'bg-source-bias-soft border border-border-default'
      : 'bg-surface-card border border-border-default';
  const checked = s === 'reference' ? true : selected;
  return (
    <div className={cx('box-border flex w-[760px] items-center gap-3 border-solid px-3 py-2', box, className)}>
      <label className="relative inline-flex h-[18px] w-[18px] shrink-0 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onSelectedChange(e.target.checked)} aria-label={`Select ${label}`}
          className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0" />
        <span className={cx('pointer-events-none box-border flex h-[18px] w-[18px] items-center justify-center rounded-sm border-2 border-solid border-border-strong',
          'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-border-strong', checked ? 'bg-accent-primary' : 'bg-transparent')}>
          {checked && <CheckMark className="-m-[2px]" />}
        </span>
      </label>
      <span className="w-10 t-mono-md text-text-primary">{typeof number === 'number' ? String(number).padStart(2, '0') : number}</span>
      {thumbSrc
        ? <img src={thumbSrc} alt={label} className="block h-14 w-[83px] shrink-0 bg-surface-stage object-cover" />
        : <span className="block h-14 w-[83px] shrink-0 bg-surface-stage" aria-hidden="true" />}
      <HistogramMini bars={histogram} />
      <div className="flex w-[72px] shrink-0 flex-col items-start">
        <span className="t-label-sm text-text-secondary">FWHM</span>
        <span className="t-mono-sm text-text-primary">{fwhm.toFixed(1)} px</span>
      </div>
      <span className="w-[200px] t-label-sm text-source-external">{note}</span>
    </div>
  );
}
