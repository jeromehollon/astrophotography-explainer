// Calibration > Flats, continued. Layout, sizes and every line of prose follow
// the Figma frames "P5 · Flats 2" A (66:2), B (112:2178), C (112:2357) and
// D (112:2536) on page 8:8.
import { useState } from 'react';
import { LessonPage } from '../../shared/ui';
import { useAppStore } from '../../shared/store';
import {
  Reading, PageHead, H2, P, Rule, Stage, StageHead, Experiment, Chip, ChipGroup, ROITile, Callout,
} from './ui';
import curve10 from './assets/curve-10.svg?raw';
import curve50 from './assets/curve-50.svg?raw';
import curve85 from './assets/curve-85.svg?raw';
import roiProblem85 from './assets/roi_problem_85.png';
import flatFull10 from './assets/flat_full_10.png';
import flatFull50 from './assets/flat_full_50.png';
import flatFull85 from './assets/flat_full_85.png';
import roiRaw from './assets/roi_raw.png';
import roiComputed10 from './assets/roi_computed_10.png';
import roiComputed50 from './assets/roi_computed_50.png';
import roiComputed85 from './assets/roi_computed_85.png';
import roiRemovedNone from './assets/roi_removed_none.png';
import roiRemoved10 from './assets/roi_removed_10.png';
import roiRemoved50 from './assets/roi_removed_50.png';
import roiRemoved85 from './assets/roi_removed_85.png';

import type { FlatLevel } from '../../shared/store';

const NBSP = ' ';

const levels: { level: FlatLevel; label: string; computed: string; removed: string; caption: string }[] = [
  { level: null, label: 'No flat', computed: roiRaw, removed: roiRemovedNone, caption: 'Without a flat - No flat selected' },
  { level: 10, label: `10${NBSP}% flat`, computed: roiComputed10, removed: roiRemoved10, caption: `Divided by the 10${NBSP}% flat - a trace of the shadow remains` },
  { level: 50, label: `50${NBSP}% flat`, computed: roiComputed50, removed: roiRemoved50, caption: `Divided by the 50${NBSP}% flat - the shadow is gone` },
  { level: 85, label: `85${NBSP}% flat`, computed: roiComputed85, removed: roiRemoved85, caption: `Divided by the 85${NBSP}% flat - nothing changes` },
];

/** The three raw flats' histograms, drawn exactly as the Figma chart (68:211). */
function HistogramChart() {
  const axisLabel = 'absolute font-body text-[12px] leading-[16px] font-medium tracking-[0.2px] whitespace-nowrap text-text-secondary';
  const seriesLabel = 'absolute -translate-x-1/2 text-center font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-primary';
  return (
    <div
      className="relative h-[320px] w-[1152px] overflow-hidden"
      role="img"
      aria-label="Histograms of the three raw flats on one linear brightness axis: the 10 % flat is a narrow spike at low brightness, the 50 % flat a low wide hill near the middle, and the 85 % flat a spike inside the grey band where pixels are full"
    >
      <div className="absolute top-[40px] left-[825px] h-[220px] w-[287px] bg-source-noise-soft" />
      <div className="absolute top-[117px] left-[40px] h-px w-[1072px] bg-border-default" />
      <div className="absolute top-[189px] left-[40px] h-px w-[1072px] bg-border-default" />
      <div className="absolute top-[260px] left-[40px] h-[2px] w-[1072px] bg-border-strong" />
      <div className="absolute top-[260px] left-[40px] h-[8px] w-[2px] bg-border-strong" />
      <div className="absolute top-[260px] left-[1110px] h-[8px] w-[2px] bg-border-strong" />
      <div className="absolute top-[66.2px] left-[125.8px] h-[194.8px] w-[50.35px] [&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: curve10 }} />
      <p className={`${seriesLabel} top-[38.4px] left-[142.6px]`}>10{NBSP}% flat · 0.11{NBSP}s</p>
      <div className="absolute top-[219px] left-[506.9px] h-[42px] w-[180.1px] [&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: curve50 }} />
      <p className={`${seriesLabel} top-[192px] left-[557.2px]`}>50{NBSP}% flat · 2.24{NBSP}s</p>
      <div className="absolute top-[145.06px] left-[824.2px] h-[115.94px] w-[109.82px] [&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: curve85 }} />
      <p className={`${seriesLabel} top-[118.9px] left-[879.6px]`}>85{NBSP}% flat · 10{NBSP}s</p>
      <p className={`${axisLabel} top-[274px] left-[40px]`}>Black · 0 pixels</p>
      <p className={`${axisLabel} top-[274px] left-[920px]`}>Brightest value a pixel can report</p>
      <p className={`${axisLabel} top-[274px] left-[523px]`}>Pixel brightness →</p>
      <p className={`${axisLabel} top-[2px] left-[40px]`}>Number of pixels at each brightness ↑</p>
      <div className="absolute top-[100px] left-[1104px] -translate-x-full text-right font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-primary">
        <p>Pixels are full:</p>
        <p>extra light spills over</p>
      </div>
      <div className="absolute top-[52px] left-[40px] h-[210px] w-[2px] bg-border-strong" />
      <p className={`${axisLabel} top-[171px] left-[46px]`}>2 million pixels</p>
      <p className={`${axisLabel} top-[99px] left-[46px]`}>4 million pixels</p>
    </div>
  );
}

export default function Flats2() {
  // Starts at frame A (No flat); each choice is written to the shared store's
  // calibration.flat without touching the other calibration fields (design-notes §3).
  const [level, setLevelState] = useState<FlatLevel>(null);
  const calibration = useAppStore((s) => s.calibration);
  const set = useAppStore((s) => s.set);
  const setLevel = (v: FlatLevel) => { setLevelState(v); set({ calibration: { ...calibration, flat: v } }); };
  const current = levels.find((l) => l.level === level) ?? levels[0];

  return (
    <LessonPage>
      <Reading>
        <PageHead
          eyebrow="Chapter 4 · Calibration"
          title="How bright should a flat be?"
          lede={`A flat only works if the camera records the panel faithfully. Too little light and the flat is mostly noise; too much and the pixels fill up and stop counting. This lesson compares three flats of the same telescope taken at 10${NBSP}%, 50${NBSP}% and 85${NBSP}%.`}
        />

        <div className="flex items-start">
          <div className="flex w-[1200px] flex-col items-start gap-[16px] rounded-[6px] border border-border-default bg-surface-card p-[24px]">
            <HistogramChart />
            <div className="flex w-full flex-col items-start gap-[24px]">
              <P className="w-[1152px]">
                A histogram is a chart of how many pixels ended up at each brightness. Brightness runs from black on the left to the brightest value a pixel can report on the right, and the height of the curve at any point is the number of pixels that landed there. Each curve here is one flat as the camera recorded it.{' '}
              </P>
              <P className="w-[1152px]">
                A camera sensor has something called a full well capacity, which measures how many photons the sensor can actually store while capturing an image. Once it’s reached that limit, additional photons are not accurately reported anywhere on the sensor. For the flat that is at the 85% histogram, we’ve reached that limit. We’d get very similar looking flats if we’d exposed for 10 seconds, 100 seconds or a million seconds. This is why over exposure of the flats poorly correct an image.
              </P>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-[48px]">
          <div className="flex flex-col items-start gap-[24px]">
            <H2>The problem you can see</H2>
            <P>
              This is the same dust shadow you removed on the previous page, after dividing the sky image by the 85{NBSP}% flat. Nothing has changed. A flat whose pixels were full has no shadow in it to divide out, so the shadow in the sky image stays exactly where it was. The flat looked fine on its histogram, and it was useless.
            </P>
            <Callout kind="note" title={`Why the 85${NBSP}% histogram looks good, but poorly corrects the dust mote`}>
              A histogram shows only where the recorded values landed; it cannot show light that was never counted. Two different limits are at work here. The brightest value a pixel can report is the end of the number scale, the right edge of this chart. The full well capacity is how much light the sensor’s pixels can hold before they fill, and on many sensors, including this one, it sits well before the end of the scale. So the 85{NBSP}% flat is full even though its peak is not at the right edge. Every full pixel reports nearly the same value, and the histogram draws a neat, narrow spike.
            </Callout>
          </div>
          <figure className="flex flex-col items-start gap-[12px] rounded-[6px]">
            <img src={roiProblem85} alt="Enlarged region of one exposure after the 85 % flat: the dust shadow is still there" width={440} height={330} className="block h-[330px] w-[440px] object-cover" />
            <figcaption className="contents">
              <p className="w-[440px] font-body text-[14px] leading-[20px] font-medium text-text-primary">The dust shadow after the 85{NBSP}% flat</p>
              <p className="w-[440px] font-body text-[14px] leading-[20px] text-text-secondary">
                An enlarged region of one 300{NBSP}s exposure, dark subtracted and divided by the 85{NBSP}% flat. The shadow is as dark as it was before any flat.
              </p>
            </figcaption>
          </figure>
        </div>

        <div className="flex flex-col items-start gap-[24px]">
          <H2>What changes when we give the flat more light?</H2>
          <P>
            These are the three master flats, whole field, shown on one shared brightness scale after their dark flats were subtracted. The 10{NBSP}% and 50{NBSP}% flats record the same dim corners and the same dust shadows. The 85{NBSP}% flat records almost nothing: its pixels were full everywhere, so the map is flat and there is nothing to correct with.
          </P>
          <div className="flex flex-col items-start rounded-[6px] bg-surface-stage p-[24px]">
            <div className="flex items-start gap-[24px]">
              {[
                { src: flatFull10, caption: `10${NBSP}% flat · 0.11${NBSP}s exposure`, alt: 'The 10 % master flat, whole field: dim, with corners and dust shadows visible' },
                { src: flatFull50, caption: `50${NBSP}% flat · 2.24${NBSP}s exposure`, alt: 'The 50 % master flat, whole field: bright centre, dim corners and dust shadows' },
                { src: flatFull85, caption: `85${NBSP}% flat · 10${NBSP}s exposure`, alt: 'The 85 % master flat, whole field: almost uniform because its pixels were full' },
              ].map((f) => (
                <figure key={f.caption} className="flex w-[368px] flex-col items-start gap-[12px]">
                  <img src={f.src} alt={f.alt} width={368} height={247} className="block h-[247px] w-[368px] object-cover" />
                  <figcaption className="w-[368px] font-body text-[14px] leading-[20px] text-text-on-stage-muted">{f.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-[24px]">
          <H2>So which flat should you take?</H2>
          <P>
            Aim for the middle. Around half of the brightest value a pixel can report, the flat is far from full, so every pixel is still counting, and it is bright enough that the random noise in each flat is small compared with the dim corners and dust shadows it needs to record. That is the 50{NBSP}% flat, and it is the one the rest of this explainer uses.
          </P>
          <P>
            A dimmer flat is not wrong, just weaker. In the experiment below the 10{NBSP}% flat removes the vignetting as well as the 50{NBSP}% one, but look closely at the dust shadow: a trace of it survives. Each 10{NBSP}% flat holds fewer photons, so noise makes up a larger share of its pixels. Brighter is better, right up until the pixels fill, but generally it’s just easier to target 50% since you don’t know when the sensor capacity will fill.
          </P>
        </div>
      </Reading>

      <Rule />

      <Stage>
        <StageHead
          eyebrow="Try it"
          title="Pick a flat and watch the dust shadow"
          instructions="The same enlarged region as on the previous page. Choose which flat is used to correct it. Compare the dust shadow with the surrounding background each time, and notice which flat leaves nothing behind."
        />
        <Experiment
          title="Correcting the light"
          help="Divide the sky image by the chosen flat. Every flat here was calibrated with its own dark flats first."
          controls={
            <ChipGroup label="Flat level">
              {levels.map((l) => (
                <Chip key={l.label} selected={l.level === level} onClick={() => setLevel(l.level)}>
                  {l.label}
                </Chip>
              ))}
            </ChipGroup>
          }
        >
          <ROITile title="Raw" caption="Without a flat" src={roiRaw} alt="Enlarged region of one exposure without a flat: a dark dust shadow" />
          <ROITile title="Computed" caption={current.caption} src={current.computed} alt={level === null ? 'The same region, still without a flat' : `The same region divided by the ${level} % flat`} />
          <ROITile
            title="What was removed"
            caption="Difference between the two images. Gray means nothing changed, darker color means removal, lighter color means addition"
            src={current.removed}
            alt={level === null ? 'Uniform mid grey: nothing was removed' : `Difference between the corrected and raw region for the ${level} % flat`}
          />
        </Experiment>
      </Stage>
    </LessonPage>
  );
}
