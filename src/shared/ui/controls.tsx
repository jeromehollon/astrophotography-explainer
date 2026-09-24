import type { ReactNode } from 'react';

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

/* ---------- Button (9:86): Primary / Secondary / Ghost × Default / Hover / Focus / Disabled ---------- */
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
  // Figma: px 24, py 12, gap 8, radius/md 6, label/md. Focus = 3 px ink outline outside (ochre on the stage).
  const base = 'inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 t-label-md whitespace-nowrap select-none border-2 border-solid';
  const focus = onStage ? 'focus-stage' : 'focus-cream';
  const look = {
    primary: disabled
      ? 'bg-surface-panel border-surface-panel text-text-disabled'
      : 'bg-accent-primary border-accent-primary text-text-on-accent hover:bg-accent-primary-hover hover:border-accent-primary-hover',
    secondary: disabled
      ? 'bg-surface-card border-border-default text-text-disabled'
      : 'bg-surface-card border-border-strong text-text-primary hover:bg-surface-panel',
    ghost: disabled
      ? 'bg-transparent border-transparent text-text-disabled'
      : 'bg-transparent border-transparent text-text-link hover:bg-surface-panel',
  }[variant];
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cx(base, focus, look, disabled ? 'cursor-default' : 'cursor-pointer', className)} {...rest}>
      {children}
    </button>
  );
}

/* ---------- Toggle (9:117): 44×24 track, 2 px ink stroke, 14 px knob; on = cobalt fill + cream knob ---------- */
export function Toggle({ label, checked, onChange, onStage, disabled, className }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; onStage?: boolean; disabled?: boolean; className?: string;
}) {
  return (
    <label className={cx('inline-flex items-center gap-3 select-none', disabled ? 'opacity-55 cursor-default' : 'cursor-pointer', className)}>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-11 shrink-0 rounded-full border-2 border-solid border-border-strong p-0 transition-colors cursor-[inherit]',
          onStage ? 'focus-stage' : 'focus-cream', checked ? 'bg-accent-primary' : 'bg-surface-card')}>
        <span className={cx('absolute top-[3px] h-3.5 w-3.5 rounded-full transition-[left]', checked ? 'left-[23px] bg-surface-card' : 'left-[3px] bg-border-strong')} />
      </button>
      <span className={cx('t-label-md', disabled ? 'text-text-disabled' : onStage ? 'text-text-on-stage' : 'text-text-primary')}>{label}</span>
    </label>
  );
}

/* ---------- Chip (9:130): one option in a single-choice group; the group is one tab stop with arrow keys ---------- */
export function Chip({ selected, onClick, children, disabled, onStage, className }: {
  selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; onStage?: boolean; className?: string;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={onClick} tabIndex={selected ? 0 : -1}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const group = e.currentTarget.parentElement;
        if (!group) return;
        const chips = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)')];
        const i = chips.indexOf(e.currentTarget);
        const next = chips[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : chips.length - 1)) % chips.length];
        next?.focus();
        next?.click();
      }}
      className={cx('inline-flex items-center justify-center rounded-full border-[1.5px] border-solid px-4 py-2 t-label-md whitespace-nowrap',
        onStage ? 'focus-stage' : 'focus-cream',
        disabled ? 'bg-surface-card border-border-default text-text-disabled cursor-default'
          : selected ? 'bg-accent-primary border-accent-primary text-text-on-accent cursor-pointer'
            : 'bg-surface-card border-border-strong text-text-primary cursor-pointer',
        className)}>
      {children}
    </button>
  );
}

export function ChipGroup({ label, children, onStage, className }: { label?: string; children: ReactNode; onStage?: boolean; className?: string }) {
  return (
    <div className={cx('flex items-center gap-3', className)}>
      {label && <span className={cx('t-label-md', onStage ? 'text-text-on-stage' : 'text-text-primary')}>{label}</span>}
      <div role="radiogroup" aria-label={label} className="flex items-center gap-2">{children}</div>
    </div>
  );
}

/* ---------- Checkbox (FrameCard 9:382 checkbox): 18 px, 2 px ink border, radius 2, cobalt fill + white check ---------- */
export function CheckMark({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className={className}>
      <path d="M3.6 9.45L7.2 13.05L14.4 4.95" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Checkbox({ checked, onChange, label, className, disabled, onStage }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string; className?: string; disabled?: boolean; onStage?: boolean;
}) {
  return (
    <label className={cx('inline-flex items-center gap-2 select-none', disabled ? 'cursor-default opacity-55' : 'cursor-pointer', className)}>
      <span className="relative inline-flex h-[18px] w-[18px] shrink-0">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer absolute inset-0 m-0 h-full w-full cursor-[inherit] opacity-0" />
        <span className={cx('pointer-events-none box-border flex h-[18px] w-[18px] items-center justify-center rounded-sm border-2 border-solid border-border-strong',
          'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2', onStage ? 'peer-focus-visible:outline-accent-focus-on-stage' : 'peer-focus-visible:outline-border-strong',
          checked ? 'bg-accent-primary' : 'bg-surface-card')}>
          {checked && <CheckMark className="-m-[2px]" />}
        </span>
      </span>
      {label && <span className={cx('t-label-md', onStage ? 'text-text-on-stage' : 'text-text-primary')}>{label}</span>}
    </label>
  );
}

/* ---------- Slider (9:149): 280 wide; label/sm + mono/sm head, 4 px rail, 18 px knob ---------- */
export function Slider({ label, min, max, step, value, onChange, onStage, className, format }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; onStage?: boolean; className?: string; format?: (v: number) => string;
}) {
  const id = `slider-${label.replace(/\W+/g, '-').toLowerCase()}`;
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className={cx('flex w-[280px] flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between whitespace-nowrap">
        <label htmlFor={id} className={cx('t-label-sm', onStage ? 'text-text-on-stage-muted' : 'text-text-secondary')}>{label}</label>
        <span className={cx('t-mono-sm', onStage ? 'text-text-on-stage' : 'text-text-primary')}>{format ? format(value) : value}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => {
          // Page Up/Down step by ten increments (Figma description); arrows are native single steps.
          if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
          e.preventDefault();
          const v = value + (e.key === 'PageUp' ? 10 : -10) * step;
          onChange(Math.min(max, Math.max(min, Number(v.toFixed(6)))));
        }}
        style={{ ['--fill' as string]: `${pct}%` }}
        className={cx('astro-slider w-full cursor-pointer', onStage && 'astro-slider-stage')} />
    </div>
  );
}

/* ---------- ProgressBar (9:157): stage-coloured panel, label/md + mono/sm head, 8 px rail with ochre fill, Cancel link ---------- */
export function ProgressBar({ percent, label, value, onCancel, className }: {
  percent: number; label: string; value?: string; onCancel?: () => void; className?: string;
}) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className={cx('flex w-[360px] flex-col items-start gap-2 bg-surface-stage p-3', className)}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} aria-label={label}>
      <div className="flex w-full items-center justify-between whitespace-nowrap">
        <span className="t-label-md text-text-on-stage">{label}</span>
        <span className="t-mono-sm text-text-on-stage-muted">{value ?? `${Math.round(p)}%`}</span>
      </div>
      <div className="h-2 w-full overflow-hidden bg-text-on-stage-muted">
        <div className="h-2 bg-accent-focus-on-stage" style={{ width: `${p}%` }} />
      </div>
      {onCancel && (
        <button type="button" onClick={onCancel} className="focus-stage cursor-pointer border-0 bg-transparent p-0 t-label-sm text-text-on-stage underline">Cancel</button>
      )}
    </div>
  );
}
