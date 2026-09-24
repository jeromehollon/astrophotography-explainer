// Figma-exact versions of three library components as they appear on the
// Algorithms page: Chip (9:130, 39 px tall, 1.5 px border, cream when
// unselected), ROITile (9:337 with the header bar and caption strip) and
// Callout Kind=Why (9:210, cream card with a 1 px ink border and a cobalt
// "Why?" eyebrow). The stubs in src/shared/ui differ from these in size and
// style; see TODO.md. Swap back to the shared ones once they match.
import type { ReactNode } from 'react';

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex items-center justify-center rounded-[999px] border-[1.5px] px-[16px] py-[8px] font-body text-[14px] font-medium leading-[20px] whitespace-nowrap ${
        selected ? 'border-accent-primary bg-accent-primary text-text-on-accent' : 'border-border-strong bg-surface-card text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return (
    <div role="radiogroup" className="flex items-start gap-[8px]">
      {children}
    </div>
  );
}

export function ROITile({ title, caption, width, height, children }: { title: string; caption?: string; width: number; height: number; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start border border-border-on-stage bg-surface-stage-raised" style={{ width, height }}>
      <div className="flex w-full items-center px-[12px] py-[10px]">
        <p className="whitespace-nowrap font-body text-[14px] font-medium leading-[20px] text-text-on-stage">{title}</p>
      </div>
      <div className="relative min-h-px w-full flex-1 overflow-hidden">{children}</div>
      {caption && (
        <div className="flex w-full flex-col items-start px-[12px] py-[10px]">
          <p className="w-full font-body text-[14px] leading-[20px] text-text-on-stage-muted">{caption}</p>
        </div>
      )}
    </div>
  );
}

export function Callout({ kind, title, children }: { kind: 'note' | 'why' | 'caution'; title: string; children: ReactNode }) {
  const word = kind === 'why' ? 'Why?' : kind === 'caution' ? 'Careful' : 'Note';
  return (
    <aside className="flex w-[680px] flex-col items-start gap-[8px] border border-border-strong bg-surface-card px-[24px] py-[16px]">
      <p className="font-heading text-[13px] font-medium uppercase leading-[16px] tracking-[1.5px] text-text-link">{word}</p>
      <p className="w-full font-body text-[14px] font-medium leading-[20px] text-text-primary">{title}</p>
      <div className="w-full font-body text-[14px] leading-[20px] text-text-primary">{children}</div>
    </aside>
  );
}
