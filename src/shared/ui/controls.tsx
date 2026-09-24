import type { ReactNode } from 'react';
import { Icon } from './icons';

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

export type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost';
  onStage?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  type?: 'button' | 'submit';
  'aria-label'?: string;
};

export function Button({ variant = 'primary', onStage, disabled, onClick, children, className, type = 'button', ...rest }: ButtonProps) {
  const base = 'inline-flex h-10 items-center justify-center gap-2 rounded-sm px-4 t-label-md whitespace-nowrap select-none transition-colors';
  const focus = onStage ? 'focus-stage' : 'focus-cream';
  const look = {
    primary: 'bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover disabled:bg-text-disabled disabled:text-white',
    secondary: onStage
      ? 'border border-text-on-stage-muted text-text-on-stage hover:bg-surface-stage-raised disabled:border-border-on-stage disabled:text-border-on-stage'
      : 'border border-border-strong text-text-primary hover:bg-surface-panel disabled:border-text-disabled disabled:text-text-disabled',
    ghost: onStage
      ? 'text-text-on-stage hover:bg-surface-stage-raised disabled:text-border-on-stage'
      : 'text-text-primary hover:bg-surface-panel disabled:text-text-disabled',
  }[variant];
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cx(base, focus, look, disabled ? 'cursor-not-allowed' : 'cursor-pointer', className)} {...rest}>
      {children}
    </button>
  );
}

export function Toggle({ label, checked, onChange, onStage, disabled, className }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; onStage?: boolean; disabled?: boolean; className?: string;
}) {
  return (
    <label className={cx('inline-flex items-center gap-3 t-label-md select-none', onStage ? 'text-text-on-stage' : 'text-text-primary', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer', className)}>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-11 shrink-0 rounded-full border transition-colors', onStage ? 'focus-stage' : 'focus-cream',
          checked ? 'bg-accent-primary border-accent-primary' : onStage ? 'bg-surface-stage-raised border-text-on-stage-muted' : 'bg-surface-card border-border-strong')}>
        <span className={cx('absolute top-[3px] h-4 w-4 rounded-full transition-[left]', checked ? 'left-[25px] bg-white' : onStage ? 'left-[3px] bg-text-on-stage-muted' : 'left-[3px] bg-border-strong')} />
      </button>
      <span>{label}</span>
    </label>
  );
}

export function Chip({ selected, onClick, children, disabled, onStage = true, className }: {
  selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; onStage?: boolean; className?: string;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={onClick}
      className={cx('inline-flex h-8 items-center rounded-full border px-3 t-label-md transition-colors', onStage ? 'focus-stage' : 'focus-cream',
        selected ? 'bg-accent-primary border-accent-primary text-text-on-accent'
          : onStage ? 'border-text-on-stage-muted text-text-on-stage hover:bg-surface-stage-raised' : 'border-border-strong text-text-primary hover:bg-surface-panel',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer', className)}>
      {children}
    </button>
  );
}

export function ChipGroup({ label, children, onStage = true, className }: { label?: string; children: ReactNode; onStage?: boolean; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('flex items-center gap-3', className)}>
      {label && <span className={cx('t-label-md', onStage ? 'text-text-on-stage-muted' : 'text-text-secondary')}>{label}</span>}
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function Checkbox({ checked, onChange, label, className, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; className?: string; disabled?: boolean }) {
  return (
    <label className={cx('inline-flex items-center gap-2 t-label-md text-text-primary select-none', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer', className)}>
      <span className="relative inline-flex h-[18px] w-[18px]">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer absolute inset-0 m-0 cursor-pointer opacity-0" />
        <span className={cx('pointer-events-none flex h-[18px] w-[18px] items-center justify-center rounded-sm border peer-focus-visible:outline-3 peer-focus-visible:outline-border-strong peer-focus-visible:outline-offset-2',
          checked ? 'bg-accent-primary border-accent-primary text-white' : 'bg-surface-card border-border-strong')}>
          {checked && <Icon name="check" size={14} strokeWidth={2} />}
        </span>
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}

export function Slider({ label, min, max, step, value, onChange, onStage = true, className, format }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; onStage?: boolean; className?: string; format?: (v: number) => string;
}) {
  const id = `slider-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className={cx('flex w-[260px] flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className={cx('t-label-md', onStage ? 'text-text-on-stage' : 'text-text-primary')}>{label}</label>
        <span className={cx('t-mono-md', onStage ? 'text-text-on-stage' : 'text-text-primary')}>{format ? format(value) : value}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className={cx('astro-slider h-6 w-full cursor-pointer', onStage ? 'focus-stage astro-slider-stage' : 'focus-cream')} />
    </div>
  );
}

export function ProgressBar({ percent, label, onStage = true, className }: { percent: number; label: string; onStage?: boolean; className?: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className={cx('flex w-[360px] flex-col gap-2', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} aria-label={label}>
      <div className="flex items-baseline justify-between">
        <span className={cx('t-label-md', onStage ? 'text-text-on-stage' : 'text-text-primary')}>{label}</span>
        <span className={cx('t-mono-md', onStage ? 'text-text-on-stage' : 'text-text-primary')}>{Math.round(p)}%</span>
      </div>
      <div className={cx('h-2 w-full overflow-hidden rounded-full', onStage ? 'bg-surface-stage-raised' : 'bg-surface-panel')}>
        <div className="h-full bg-accent-primary" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
