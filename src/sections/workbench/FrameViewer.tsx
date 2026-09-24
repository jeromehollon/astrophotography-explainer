/** Previous / Next, the whole frame at bin 4, and the four ROIs at bin 2 (P8-2 125:937). */
import { FRAMES, FRAME_BY_ID, ROIS, ROI_KEYS } from './data';
import { useFrameView } from './live';
import { Render } from './Render';
import type { CalibrationChoice } from './store';
import { Btn, cx, T, Tile } from './ui';

function caption(id: string): string {
  const f = FRAME_BY_ID[id];
  const base = `Frame ${f.number}, the whole photograph.`;
  if (f.defect === 'satellite') return `${base} The satellite trail crosses the upper left.`;
  if (f.defect === 'tracking') return `${base} A copy of frame ${f.number} with a tracking error: the stars are trailed.`;
  if (f.defect === 'cloud') return `${base} A copy of frame ${f.number} with patchy cloud.`;
  return base;
}

export function FrameViewer({ current, onChange, calibration }: { current: string; onChange: (id: string) => void; calibration: CalibrationChoice }) {
  const idx = FRAMES.findIndex((f) => f.id === current);
  const prev = FRAMES[(idx - 1 + FRAMES.length) % FRAMES.length];
  const next = FRAMES[(idx + 1) % FRAMES.length];
  const { full, rois, pending } = useFrameView(current, calibration);
  const f = FRAME_BY_ID[current];
  return (
    <div className="flex w-[616px] flex-col gap-4">
      <div className="flex w-[616px] items-center justify-between">
        <Btn variant="ghost" onClick={() => onChange(prev.id)}>← Previous frame</Btn>
        <span className={cx('text-text-primary whitespace-nowrap', T.h3)}>Frame {f.number}</span>
        <Btn variant="ghost" onClick={() => onChange(next.id)}>Next frame →</Btn>
      </div>
      <div className="flex w-[616px] flex-col gap-4 bg-surface-stage p-4">
        <div className="relative h-[391px] w-[584px] overflow-hidden bg-surface-stage-raised">
          <Render view={full} alt={`Frame ${f.number}, whole photograph`} className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <p className={cx('m-0 w-[584px] text-text-on-stage-muted', T.bodySm)}>{caption(current)}</p>
      </div>
      <div className="grid w-[616px] grid-cols-2 gap-4">
        {ROI_KEYS.map((k) => (
          <Tile key={k} title={ROIS[k].title} width={300} height={241} state={pending ? 'pending' : 'default'}>
            <Render view={rois[k]} alt={`${ROIS[k].title}, frame ${f.number}`} />
          </Tile>
        ))}
      </div>
    </div>
  );
}
