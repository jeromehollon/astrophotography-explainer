/**
 * Page-local primitives drawn exactly as the Figma frames (P8-2 121:2, P9 126:4081) show them.
 * They mirror the library components' props so they can be swapped for src/shared/ui later.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

/* Typography (library text styles) */
export const T = {
  eyebrow: 'font-heading font-medium text-[13px] leading-4 tracking-[1.5px] uppercase',
  h1: 'font-heading font-semibold text-[40px] leading-[46px] tracking-[-0.5px]',
  h2: 'font-heading font-semibold text-[28px] leading-[34px]',
  h3: 'font-heading font-medium text-[22px] leading-7',
  bodyLg: 'font-body font-normal text-[18px] leading-7',
  bodyMd: 'font-body font-normal text-[16px] leading-6',
  bodySm: 'font-body font-normal text-[14px] leading-5',
  labelMd: 'font-body font-medium text-[14px] leading-5',
  labelSm: 'font-body font-medium text-[12px] leading-4 tracking-[0.2px]',
  monoMd: 'font-mono font-normal text-[14px] leading-5',
  monoSm: 'font-mono font-normal text-[12px] leading-4',
};

/* Button (9:86): Primary / Secondary / Ghost; Disabled = panel fill with disabled text */
export function Btn({ variant = 'primary', disabled, onClick, children, className, onMouseEnter, onMouseLeave, ariaPressed }: {
  variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; onClick?: () => void; children: ReactNode; className?: string;
  onMouseEnter?: () => void; onMouseLeave?: () => void; ariaPressed?: boolean;
}) {
  const look = disabled
    ? 'bg-surface-panel text-text-disabled cursor-not-allowed'
    : variant === 'primary'
      ? 'bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover'
      : variant === 'secondary'
        ? 'bg-surface-card border-2 border-border-strong text-text-primary hover:bg-surface-panel'
        : 'text-text-link hover:bg-surface-panel';
  return (
    <button type="button" disabled={disabled} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} aria-pressed={ariaPressed}
      className={cx('inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 whitespace-nowrap cursor-pointer focus-visible:outline-3 focus-visible:outline-border-strong focus-visible:outline-offset-2', T.labelMd, look, className)}>
      {children}
    </button>
  );
}

/* Chip (9:130) */
export function Chip({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={onClick}
      className={cx('inline-flex items-center justify-center rounded-full border-[1.5px] px-4 py-2 whitespace-nowrap cursor-pointer focus-visible:outline-3 focus-visible:outline-border-strong focus-visible:outline-offset-2', T.labelMd,
        selected ? 'bg-accent-primary border-accent-primary text-text-on-accent' : 'bg-surface-card border-border-strong text-text-primary hover:bg-surface-panel')}>
      {children}
    </button>
  );
}

/* FrameCard checkbox (17:876 / 17:843): 18 px, 2 px ink border, cobalt fill with a check when on */
export function Check({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className="relative inline-flex h-[18px] w-[18px] shrink-0">
      <input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} onClick={(e) => e.stopPropagation()}
        className="peer absolute inset-0 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed" />
      <span className={cx('pointer-events-none flex h-[18px] w-[18px] items-center justify-center rounded-sm border-2 border-border-strong peer-focus-visible:outline-3 peer-focus-visible:outline-border-strong peer-focus-visible:outline-offset-2', checked ? 'bg-accent-primary' : 'bg-transparent')}>
        {checked && (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className="-m-[2px]">
            <path d="M4 9.5l3 3 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </span>
  );
}

/* Section header: h2 left, "Lesson: … →" links right (baseline aligned) */
export function SectionHeader({ title, links, wide }: { title: string; links?: Array<{ label: string; to: string }>; wide?: boolean }) {
  return (
    <div className="flex w-[1200px] items-baseline justify-between">
      <h2 className={cx('m-0 text-text-primary', T.h2, wide ? 'w-[680px]' : 'whitespace-nowrap')}>{title}</h2>
      {links && links.length > 0 && (
        <div className="flex items-start gap-6">
          {links.map((l) => <LessonLink key={l.label} to={l.to}>{l.label}</LessonLink>)}
        </div>
      )}
    </div>
  );
}

export function LessonLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return <Link to={to} className={cx('text-text-link underline whitespace-nowrap', T.labelMd, className)}>{children}</Link>;
}

/* ROITile (9:337): dark raised box, 1 px on-stage border, head bar (12/10 padding), image well below */
export function Tile({ title, state = 'default', progress, width, height, children }: {
  title: string; state?: 'default' | 'pending' | 'processing' | 'empty'; progress?: number; width: number; height: number; children?: ReactNode;
}) {
  const wellH = height - 2 - 40;
  return (
    <div className="flex flex-col overflow-hidden border border-border-on-stage bg-surface-stage-raised" style={{ width, height }}>
      <div className="flex items-center px-3 py-[10px]">
        <span className={cx('text-text-on-stage whitespace-nowrap', T.labelMd)}>{title}</span>
      </div>
      <div className="relative w-full overflow-hidden" style={{ height: wellH }}>
        <div className="absolute inset-0 [&>img]:block [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full">{children}</div>
        {state !== 'default' && (
          <div className={cx('absolute inset-0', state === 'processing' ? 'bg-surface-stage' : 'bg-surface-stage/70')}>
            <span className={cx('absolute left-0 right-0 text-center text-text-on-stage', T.labelMd)} style={{ top: Math.round(wellH / 2) - 10 }}>
              {state === 'processing' ? `Stacking…${progress !== undefined ? ` ${Math.round(progress)}%` : ''}` : state === 'pending' ? 'Result pending' : 'No frames selected'}
            </span>
            {state === 'processing' && <div className="absolute bottom-0 left-0 h-1 bg-accent-focus-on-stage" style={{ width: `${Math.max(0, Math.min(100, progress ?? 0))}%` }} />}
          </div>
        )}
      </div>
    </div>
  );
}

/* Drawn full-range histogram (owner direction, design-notes item 37): ink bars over a 1 px axis. */
export function DrawnHistogram({ bars, width, height, barWidth, className }: { bars: number[]; width: number; height: number; barWidth: number; className?: string }) {
  const step = width / bars.length;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cx('block shrink-0', className)} aria-hidden>
      {bars.map((h, i) => (h > 0 ? <rect key={i} x={i * step} y={height - 1 - h} width={barWidth} height={h} fill="var(--color-ink-900)" /> : null))}
      <rect x={0} y={height - 1} width={width} height={1} fill="var(--color-border-strong)" />
    </svg>
  );
}

/* ProgressBar (9:157): stage box, label + mono value, 8 px rail, ochre fill, Cancel link */
export function Progress({ label, value, percent, onCancel }: { label: string; value: string; percent: number; onCancel: () => void }) {
  return (
    <div className="flex w-[360px] flex-col gap-2 bg-surface-stage p-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-label={label}>
      <div className="flex items-center justify-between whitespace-nowrap">
        <span className={cx('text-text-on-stage', T.labelMd)}>{label}</span>
        <span className={cx('text-text-on-stage-muted', T.monoSm)}>{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden bg-text-on-stage-muted">
        <div className="h-2 bg-accent-focus-on-stage" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
      <button type="button" onClick={onCancel} className={cx('cursor-pointer self-start bg-transparent p-0 text-text-on-stage underline focus-visible:outline-3 focus-visible:outline-accent-focus-on-stage focus-visible:outline-offset-2', T.labelSm)}>Cancel</button>
    </div>
  );
}
