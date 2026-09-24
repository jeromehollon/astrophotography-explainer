/**
 * Page-local primitives drawn exactly as the Figma frames (P8-2 121:2, P9 126:4081) show them.
 * They mirror the library components' props so they can be swapped for src/shared/ui later.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button, Chip as SharedChip, ProgressBar, ROITile } from '../../shared/ui';

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

/* Button (9:86) from the shared library; hover handlers wrap it for the scenario description swap. */
export function Btn({ variant = 'primary', disabled, onClick, children, className, onMouseEnter, onMouseLeave, ariaPressed }: {
  variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; onClick?: () => void; children: ReactNode; className?: string;
  onMouseEnter?: () => void; onMouseLeave?: () => void; ariaPressed?: boolean;
}) {
  const button = <Button variant={variant} disabled={disabled} onClick={onClick} className={className}>{children}</Button>;
  if (!onMouseEnter && !onMouseLeave) return button;
  return <span className="inline-flex" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} data-pressed={ariaPressed ? 'true' : undefined}>{button}</span>;
}

/* Chip (9:130) from the shared library, cream variant */
export function Chip({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return <SharedChip selected={selected} onClick={onClick} disabled={disabled} onStage={false}>{children}</SharedChip>;
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

/* ROITile (9:337) from the shared library; height is the whole tile (head 40 + well + 2 px border) as in the frames */
export function Tile({ title, state = 'default', progress, width, height, children }: {
  title: string; state?: 'default' | 'pending' | 'processing' | 'empty'; progress?: number; width: number; height: number; children?: ReactNode;
}) {
  return <ROITile title={title} state={state} percent={progress} width={width} height={height - 42}>{children}</ROITile>;
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

/* ProgressBar (9:157) from the shared library */
export function Progress({ label, value, percent, onCancel }: { label: string; value: string; percent: number; onCancel: () => void }) {
  return <ProgressBar label={label} value={value} percent={percent} onCancel={onCancel} />;
}
