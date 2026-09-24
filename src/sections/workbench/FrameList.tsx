/** The 24 FrameCards (P8-2 125:56 / P9 126:4103): header row, cards, drawn 96-bar histograms at x 452. Checkbox and frame number both toggle; the row opens the viewer. */
import { FRAMES, thumbSrc } from './data';
import { cx, Check, DrawnHistogram, T } from './ui';

export function FrameList({ selected, onToggle, current, onView }: {
  selected: string[]; onToggle: (id: string, on: boolean) => void; current: string; onView: (id: string) => void;
}) {
  const on = new Set(selected);
  return (
    <div className="flex w-[560px] flex-col gap-1">
      <div className={cx('relative h-11 w-[560px] border-b-2 border-border-strong text-text-secondary whitespace-nowrap', T.labelMd)}>
        <span className="absolute left-[42px] top-3">Frame</span>
        <span className="absolute left-[94px] top-3">Image</span>
        <span className="absolute left-[189px] top-3">FWHM</span>
        <span className="absolute left-[273px] top-3">Note</span>
        <span className="absolute left-[452px] top-3">Histogram</span>
      </div>
      {FRAMES.map((f) => {
        const ticked = on.has(f.id);
        const viewing = f.id === current;
        return (
          <div key={f.id} role="button" tabIndex={0} aria-label={`Look at frame ${f.number}${f.variantOf ? ` (${f.note})` : ''}`} aria-current={viewing ? 'true' : undefined}
            onClick={() => onView(f.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(f.id); } }}
            className={cx('relative box-border flex h-[72px] w-[560px] cursor-pointer items-center gap-3 px-3 py-2 focus-visible:outline-3 focus-visible:outline-border-strong focus-visible:-outline-offset-3',
              ticked ? 'bg-source-bias-soft border border-border-default' : 'bg-surface-card border border-border-default')}>
            <Check checked={ticked} onChange={(v) => onToggle(f.id, v)} label={`Include frame ${f.number}${f.variantOf ? ` (${f.note})` : ''} in the stack`} />
            {/* The frame number is a second way to tick the frame (owner request); the row itself still opens the viewer. */}
            <button type="button" aria-pressed={ticked} aria-label={`Frame ${f.number}${f.variantOf ? ` (${f.note})` : ''}: ${ticked ? 'remove from' : 'add to'} the stack`}
              onClick={(e) => { e.stopPropagation(); onToggle(f.id, !ticked); }} onKeyDown={(e) => e.stopPropagation()}
              className={cx('m-0 w-10 cursor-pointer border-0 bg-transparent p-0 text-left text-text-primary underline decoration-border-default underline-offset-2 hover:decoration-border-strong focus-visible:outline-3 focus-visible:outline-border-strong focus-visible:outline-offset-2', T.monoMd)}>
              {f.number}
            </button>
            <img src={thumbSrc(f.id)} alt="" className="h-14 w-[83px] object-cover" draggable={false} />
            <div className="flex flex-col text-[12px] leading-4">
              <span className={cx('w-[72px] text-text-secondary', T.labelSm)}>FWHM</span>
              <span className={cx('w-[72px] text-text-primary', T.monoSm)}>{f.fwhmShown}</span>
            </div>
            <span className={cx('min-w-px flex-1 text-source-external', T.labelSm)}>{f.note || '​'}</span>
            <DrawnHistogram bars={f.histogramBars} width={96} height={40} barWidth={1} className="absolute left-[452px] top-4" />
          </div>
        );
      })}
    </div>
  );
}
