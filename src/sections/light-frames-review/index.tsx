/** P8 Light frames 2: Review the exposures (Figma 121:2 / 133:7083). Calibration is fixed to the full set. */
import { countWord } from '../workbench/data';
import { LightFramesBlock } from '../workbench/LightFramesBlock';
import { useRegionStack } from '../workbench/live';
import { Render } from '../workbench/Render';
import { LessonPage, PageHead, Reading } from '../workbench/shell';
import { useAppStore, type CalibrationChoice } from '../workbench/store';
import { Chip, cx, T } from '../workbench/ui';

const FULL_CALIBRATION: CalibrationChoice = { bias: true, dark: true, darkFlat: true, flat: 50 };

export default function LightFramesReview() {
  const frames = useAppStore((s) => s.frames);
  const algorithm = useAppStore((s) => s.algorithm);
  const set = useAppStore((s) => s.set);
  const method: 'average' | 'median' = algorithm.name === 'average' ? 'average' : 'median';
  const { view, pending, empty } = useRegionStack('wide', { frames, calibration: FULL_CALIBRATION, algorithm: method });
  const label = method === 'average' ? 'Average' : 'Median';
  return (
    <LessonPage>
      <Reading>
        <PageHead eyebrow="Chapter 7 · Light frames" title="Review the exposures"
          lede="Move through the photographs, compare the fixed galaxy view, and choose what contributes to your stack." />

        <section className="flex flex-col gap-6">
          <h2 className={cx('m-0 w-[680px] text-text-primary', T.h2)}>Your selected stack</h2>
          <div className="flex items-center gap-6">
            <span className={cx('text-text-primary whitespace-nowrap', T.h3)}>Stack algorithm</span>
            <div role="radiogroup" aria-label="Stack algorithm" className="flex gap-2">
              <Chip selected={method === 'average'} onClick={() => set({ algorithm: { name: 'average', params: {} } })}>Average</Chip>
              <Chip selected={method === 'median'} onClick={() => set({ algorithm: { name: 'median', params: {} } })}>Median</Chip>
            </div>
          </div>
          <div className="flex w-[1200px] flex-col gap-3 bg-surface-stage p-6">
            <div className="relative h-[864px] w-[1152px] overflow-hidden bg-surface-stage-raised">
              <Render view={view} alt={`${label} of the ticked photographs, the galaxy and its surroundings`} className={cx('absolute inset-0 h-full w-full object-cover', pending && 'opacity-60')} />
              {empty && <span className={cx('absolute inset-0 flex items-center justify-center text-text-on-stage', T.labelMd)}>No frames selected</span>}
            </div>
            <p className={cx('m-0 w-[1152px] text-text-on-stage-muted', T.bodySm)}>
              {label} of the {countWord(frames.length)} ticked photograph{frames.length === 1 ? '' : 's'}: the galaxy, its faint outer disc, and the two small galaxies above it.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className={cx('m-0 w-[680px] text-text-primary', T.h2)}>Examine the images</h2>
          <p className={cx('m-0 w-[680px] text-text-primary', T.bodyMd)}>
            The shaded rows show which photographs contribute to the stack. Click a row to look more closely at that photograph, or use its checkbox to compare the result with and without it.
          </p>
          <LightFramesBlock />
        </section>

        <section className="flex w-[680px] flex-col gap-6">
          <h2 className={cx('m-0 text-text-primary', T.h2)}>Next: the workbench</h2>
          <p className={cx('m-0 text-text-primary', T.bodyMd)}>Try sigma clipping and the other methods alongside calibration in the workbench.</p>
        </section>
      </Reading>
    </LessonPage>
  );
}
