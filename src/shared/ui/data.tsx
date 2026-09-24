import type { ReactNode } from 'react';
import { Icon } from './icons';
import { Checkbox } from './controls';

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

/* ---------- Callout (9:210): Note / Why / Caution ---------- */
export function Callout({ kind, title, children, className }: { kind: 'note' | 'why' | 'caution'; title: string; children: ReactNode; className?: string }) {
  const bar = { note: 'bg-accent-primary', why: 'bg-source-external', caution: 'bg-source-dark' }[kind];
  const icon = { note: 'info', why: 'star', caution: 'warning' } as const;
  return (
    <aside className={cx('flex w-full gap-0 bg-surface-card', className)}>
      <div className={cx('w-1.5 shrink-0', bar)} />
      <div className="flex flex-col gap-2 px-5 py-4">
        <div className="flex items-center gap-2 t-eyebrow text-text-primary"><Icon name={icon[kind]} size={16} />{title}</div>
        <div className="t-body-md text-text-primary">{children}</div>
      </div>
    </aside>
  );
}

/* ---------- Badge (9:189): Source and FrameType, colour + shape (design-notes §2) ---------- */
export type BadgeProps = ({ source: 'bias' | 'dark' | 'flat' | 'noise' | 'external'; frame?: undefined } | { frame: 'light' | 'bias' | 'dark' | 'flat' | 'darkflat'; source?: undefined }) & { className?: string };

const SOURCE_META = {
  bias: { label: 'Bias', color: 'var(--color-source-bias)', soft: 'var(--color-source-bias-soft)', shape: 'circle' },
  dark: { label: 'Dark signal', color: 'var(--color-source-dark)', soft: 'var(--color-source-dark-soft)', shape: 'square' },
  flat: { label: 'Flat-field', color: 'var(--color-source-flat)', soft: 'var(--color-source-flat-soft)', shape: 'triangle' },
  noise: { label: 'Random noise', color: 'var(--color-source-noise)', soft: 'var(--color-source-noise-soft)', shape: 'diamond' },
  external: { label: 'Outside the camera', color: 'var(--color-source-external)', soft: 'var(--color-source-external-soft)', shape: 'pentagon' },
} as const;
const FRAME_META = {
  light: { label: 'Light', color: 'var(--color-ink-900)', soft: 'var(--color-cream-200)', shape: 'star4' },
  bias: { label: 'Bias', color: 'var(--color-source-bias)', soft: 'var(--color-source-bias-soft)', shape: 'circle' },
  dark: { label: 'Dark', color: 'var(--color-source-dark)', soft: 'var(--color-source-dark-soft)', shape: 'square' },
  flat: { label: 'Flat', color: 'var(--color-source-flat)', soft: 'var(--color-source-flat-soft)', shape: 'triangle' },
  darkflat: { label: 'Dark flat', color: 'var(--color-source-dark)', soft: 'var(--color-source-flat-soft)', shape: 'triangle' },
} as const;

export function Glyph({ shape, color, size = 10 }: { shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'pentagon' | 'star4'; color: string; size?: number }) {
  const d = {
    circle: <circle cx="5" cy="5" r="5" />,
    square: <rect x="0" y="0" width="10" height="10" />,
    triangle: <path d="M5 0 10 10H0Z" />,
    diamond: <path d="M5 0 10 5 5 10 0 5Z" />,
    pentagon: <path d="M5 0 10 3.8 8.1 10H1.9L0 3.8Z" />,
    star4: <path d="M5 0 6.3 3.7 10 5 6.3 6.3 5 10 3.7 6.3 0 5l3.7-1.3Z" />,
  }[shape];
  return <svg width={size} height={size} viewBox="0 0 10 10" fill={color} aria-hidden="true">{d}</svg>;
}

export function Badge(props: BadgeProps) {
  const meta = props.source ? SOURCE_META[props.source] : FRAME_META[props.frame!];
  return (
    <span className={cx('inline-flex h-6 items-center gap-1.5 rounded-sm px-2 t-label-sm text-text-primary', props.className)} style={{ background: meta.soft }}>
      <Glyph shape={meta.shape} color={meta.color} />
      {meta.label}
    </span>
  );
}

/* ---------- Histograms (9:249, 16:431): bars 0..1, ink on cream ---------- */
export function HistogramBars({ bars, width, height, className, color = 'var(--color-ink-900)' }: { bars: number[]; width: number; height: number; className?: string; color?: string }) {
  const n = Math.max(1, bars.length);
  const bw = width / n;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      {bars.map((v, i) => {
        const h = Math.max(0, Math.min(1, v)) * height;
        return <rect key={i} x={i * bw} y={height - h} width={Math.max(bw - 0.5, 0.5)} height={h} fill={color} />;
      })}
    </svg>
  );
}

export function HistogramMini({ bars, className }: { bars: number[]; className?: string }) {
  return (
    <div className={cx('flex h-10 w-[120px] items-end border-b border-border-strong bg-surface-card', className)}>
      <HistogramBars bars={bars} width={120} height={40} />
    </div>
  );
}

/* ---------- ROITile (9:337) ---------- */
export function ROITile({ title, caption, state = 'default', width = 360, height = 240, children, className }: {
  title: string; caption?: string; state?: 'default' | 'pending' | 'processing' | 'empty'; width?: number; height?: number; children?: ReactNode; className?: string;
}) {
  const message = state === 'pending' ? 'Result pending' : state === 'processing' ? 'Processing…' : state === 'empty' ? 'No result' : null;
  return (
    <figure className={cx('m-0 flex flex-col gap-2', className)} style={{ width }}>
      <figcaption className="t-label-md text-text-on-stage">{title}</figcaption>
      <div className="relative overflow-hidden bg-surface-stage-raised" style={{ width, height }}>
        <div className={cx('h-full w-full [&>img]:block [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full', state !== 'default' && 'opacity-40')}>{children}</div>
        {message && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-sm bg-surface-stage px-3 py-1 t-label-md text-text-on-stage-muted">{message}</span>
          </div>
        )}
      </div>
      {caption && <div className="t-body-sm text-text-on-stage-muted">{caption}</div>}
    </figure>
  );
}

/* ---------- NoiseReadout (9:216) ---------- */
export function NoiseReadout({ value, ratio, label = 'Background noise', className }: { value: number; ratio?: number; label?: string; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <span className="t-eyebrow text-text-on-stage-muted">{label}</span>
      <div className="flex items-baseline gap-3">
        <span className="t-mono-lg text-text-on-stage">{value.toFixed(1)} <span className="t-mono-sm text-text-on-stage-muted">DN</span></span>
        {ratio !== undefined && <span className="t-mono-md text-text-on-stage-muted">×{ratio.toFixed(2)}</span>}
      </div>
    </div>
  );
}

/* ---------- FrameCard (9:382): checkbox · number · thumbnail · histogram · FWHM · note ---------- */
export function FrameCard({ number, label, thumbSrc, histogram, fwhm, note, selected, onSelectedChange, state = 'default', className }: {
  number: number | string; label: string; thumbSrc: string; histogram: number[]; fwhm: number; note: ReactNode; selected: boolean;
  onSelectedChange: (v: boolean) => void; state?: 'default' | 'selected' | 'reference'; className?: string;
}) {
  const tint = state === 'reference' ? 'bg-source-flat-soft' : selected || state === 'selected' ? 'bg-surface-panel' : 'bg-surface-card';
  return (
    <div className={cx('flex h-16 w-full items-center gap-4 px-3', tint, className)}>
      <Checkbox checked={selected} onChange={onSelectedChange} />
      <span className="w-8 t-mono-md text-text-primary">{String(number).padStart(2, '0')}</span>
      <img src={thumbSrc} alt={label} className="h-12 w-[72px] object-cover bg-surface-stage" />
      <HistogramMini bars={histogram} />
      <span className="w-[84px] t-mono-md text-text-primary">{fwhm.toFixed(2)} px</span>
      <span className="flex-1 t-body-sm text-text-secondary">{note}</span>
      {state === 'reference' && <span className="inline-flex items-center gap-1 t-label-sm text-text-primary"><Glyph shape="triangle" color="var(--color-source-flat)" />Reference</span>}
    </div>
  );
}
