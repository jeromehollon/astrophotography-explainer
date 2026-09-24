// Section-local primitives measured from the Figma library components (Toggle
// 9:117, Chip 9:130, ROITile 9:337, Callout 9:210) and the P4/P5 frames. The
// shared src/shared/ui versions render these differently from the Figma frames
// (see TODO.md), so the page keeps its own until they converge; the prop names
// follow docs/contracts.md so the swap is an import change. The page chrome
// (TopBar, BottomNav) comes from the shared LessonPage.
import type { ReactNode } from 'react';

export function Reading({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col items-start gap-[32px] px-[120px] py-[64px]">{children}</div>;
}

export function PageHead({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string }) {
  return (
    <div className="flex flex-col items-start gap-[12px]">
      <p className="font-heading text-[13px] leading-[16px] font-medium tracking-[1.5px] uppercase whitespace-nowrap text-text-link">{eyebrow}</p>
      <h1 className="w-[900px] font-heading text-[40px] leading-[46px] font-semibold tracking-[-0.5px] text-text-primary">{title}</h1>
      <p className="w-[680px] font-body text-[18px] leading-[28px] text-text-secondary">{lede}</p>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="w-[680px] font-heading text-[28px] leading-[34px] font-semibold text-text-primary">{children}</h2>;
}

export function P({ children, className = 'w-[680px]' }: { children: ReactNode; className?: string }) {
  return <p className={`font-body text-[16px] leading-[24px] text-text-primary ${className}`}>{children}</p>;
}

export function Rule() {
  return <div className="h-[6px] w-[1440px] bg-ink-900" />;
}

export function Stage({ children }: { children: ReactNode }) {
  return <section className="flex w-full flex-col items-start gap-[40px] bg-surface-stage px-[120px] py-[48px]">{children}</section>;
}

export function StageHead({ eyebrow, title, instructions }: { eyebrow: string; title: string; instructions: string }) {
  return (
    <div className="flex flex-col items-start gap-[12px]">
      <p className="font-heading text-[13px] leading-[16px] font-medium tracking-[1.5px] uppercase whitespace-nowrap text-text-on-stage-muted">{eyebrow}</p>
      <h2 className="w-[900px] font-heading text-[28px] leading-[34px] font-semibold text-text-on-stage">{title}</h2>
      <p className="w-[680px] font-body text-[16px] leading-[24px] text-text-on-stage-muted">{instructions}</p>
    </div>
  );
}

export function Experiment({ title, help, controls, children }: { title: string; help: string; controls: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-[16px]">
      <div className="flex items-center gap-[24px]">
        <h3 className="font-heading text-[22px] leading-[28px] font-medium whitespace-nowrap text-text-on-stage">{title}</h3>
        {controls}
        <p className="w-[360px] font-body text-[14px] leading-[20px] text-text-on-stage-muted">{help}</p>
      </div>
      <div className="flex items-start gap-[24px]">{children}</div>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-[12px] focus-visible:outline-3 focus-visible:outline-accent-focus-on-stage"
    >
      <svg width="44" height="24" viewBox="0 0 44 24" fill="none" aria-hidden="true" className="block shrink-0">
        <rect x="1" y="1" width="42" height="22" rx="11" fill={checked ? '#1F4AA8' : '#F7F2EA'} stroke="#1C1A17" strokeWidth="2" />
        <circle cx={checked ? 32 : 12} cy="12" r="7" fill={checked ? '#F7F2EA' : '#1C1A17'} />
      </svg>
      <span className="font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-on-stage">{label}</span>
    </button>
  );
}

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex items-center justify-center rounded-[999px] border-[1.5px] px-[16px] py-[8px] font-body text-[14px] leading-[20px] font-medium whitespace-nowrap focus-visible:outline-3 focus-visible:outline-accent-focus-on-stage ${
        selected ? 'border-accent-primary bg-accent-primary text-text-on-accent' : 'border-border-strong bg-surface-card text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

export function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-start gap-[8px]">
      {children}
    </div>
  );
}

export function ROITile({ title, caption, src, alt }: { title: string; caption: string; src: string; alt: string }) {
  return (
    <figure className="flex w-[320px] flex-col items-start border border-border-on-stage bg-surface-stage-raised">
      <div className="flex w-full items-center px-[12px] py-[10px]">
        <p className="font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-on-stage">{title}</p>
      </div>
      <div className="h-[240px] w-full overflow-hidden">
        <img src={src} alt={alt} width={320} height={240} className="block h-full w-full object-cover" />
      </div>
      <figcaption className="flex w-full flex-col items-start px-[12px] py-[10px]">
        <p className="w-full font-body text-[14px] leading-[20px] text-text-on-stage-muted">{caption}</p>
      </figcaption>
    </figure>
  );
}

export function Callout({ kind, title, children }: { kind: 'note' | 'why'; title: string; children: ReactNode }) {
  const why = kind === 'why';
  return (
    <aside
      className={`flex w-[680px] flex-col items-start gap-[8px] px-[24px] py-[16px] ${
        why ? 'border border-border-strong bg-surface-card' : 'border-l-4 border-accent-primary bg-surface-panel'
      }`}
    >
      <p className={`font-heading text-[13px] leading-[16px] font-medium tracking-[1.5px] uppercase whitespace-nowrap ${why ? 'text-text-link' : 'text-text-secondary'}`}>
        {why ? 'Why?' : 'Note'}
      </p>
      <p className="w-full font-body text-[14px] leading-[20px] font-medium text-text-primary">{title}</p>
      <p className="w-full font-body text-[14px] leading-[20px] text-text-primary">{children}</p>
    </aside>
  );
}
