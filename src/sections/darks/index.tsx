// P3 Darks. Figma frames "P3 · Darks — A · dark off" 78:2 and "B · dark on" 103:2179 (page 8:6).
// Prose is copied verbatim from Figma; the illustration is the exported component 35:81.
import { useEffect } from 'react';
import { LessonPage, Toggle } from '../../shared/ui';
import { useAppStore } from '../../shared/store';
import { ROITile, WhyCallout, Eyebrow } from './ui';
import illustration from './assets/illustration.svg?raw';
import roiRaw from './assets/roi_raw.png';
import roiDarkOff from './assets/roi_computed_dark-off.png';
import roiDarkOn from './assets/roi_computed_dark-on.png';
import darkPiece from './assets/dark_piece.png';
import ampglow from './assets/ampglow_full.png';
import stats from './assets/stats.json';

const WELL = 318; // ROITile wells overridden to 318 px square (design-notes §5 item 12)
const REGION = stats.region.w; // 64 native pixels shown at 5x
const HOT = stats.circled_hot_pixel;

/** Ochre ring (Figma 88:748) centred on the circled hot pixel; coordinates from stats.json. */
function HotPixelMarker() {
  const cx = ((HOT.x_in_region + 0.5) * WELL) / REGION;
  const cy = ((HOT.y_in_region + 0.5) * WELL) / REGION;
  return (
    <svg className="pointer-events-none absolute" style={{ left: cx - 20, top: cy - 20 }} width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="18.5" stroke="#E3A81E" strokeWidth="3" />
    </svg>
  );
}

const pixelated = { imageRendering: 'pixelated' as const };

export default function DarksPage() {
  const dark = useAppStore((s) => s.calibration.dark);
  const calibration = useAppStore((s) => s.calibration);
  const set = useAppStore((s) => s.set);
  const setDark = (v: boolean) => set({ calibration: { ...calibration, dark: v } });
  // The lesson opens in state A (dark off): "Turn Dark on, then off again."
  useEffect(() => {
    set({ calibration: { ...useAppStore.getState().calibration, dark: false } });
  }, [set]);

  return (
    <LessonPage>
      <div className="flex w-full flex-col items-start gap-[32px] px-[120px] py-[64px]">
        <div className="flex flex-col gap-[12px]">
          <Eyebrow>Chapter 4 · Calibration</Eyebrow>
          <h1 className="w-[900px] m-0 t-h1 tracking-[-0.5px] text-text-primary">What the camera records in the dark</h1>
          <div className="flex w-[900px] flex-col gap-[28px] t-body-lg text-text-secondary">
            <p>The electronic offset in a bias frame is only part of the camera’s contribution. While an exposure is running, the sensor also collects electrons that were not produced by incoming light. This is dark current, and some pixels accumulate much more of it than their neighbors. In a photograph, those hot pixels can look like tiny bright points that do not belong to the sky. The sensor’s temperature affects how quickly these unwanted electrons accumulate. Some cameras also record “amp glow” from nearby amplifier circuitry; a matching dark can measure this separate contribution.</p>
            <p>{'​'}</p>
            <p>Since this noise is time and temperature dependent, we take these photos with no light reaching the camera and we cool the camera to be the exact same temperature between the imaging session and the taking of calibration photos.</p>
          </div>
        </div>

        <section className="flex items-start gap-[24px]">
          <div className="flex w-[800px] flex-col gap-[16px] rounded-md border border-border-default bg-surface-card p-[24px]">
            <div className="h-[225.6px] w-[752px] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: illustration }} />
            <div className="flex flex-col gap-[24px] t-body-md text-text-primary">
              <p className="w-[752px]">
                Every pixel leaks a small trickle of charge while the shutter is open. The trickle is called dark current, and it grows with temperature and with exposure time. Most pixels leak very little. A few leak much more, and these hot pixels show up as bright single points in every exposure, always at the same places.
              </p>
              <p className="w-[752px]">
                The amplifier that reads the sensor also warms up while it works. On some cameras that warmth reaches the nearby pixels and adds a soft glow to one edge of the frame.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-[12px]">
            <img src={darkPiece} alt="A piece of the master dark at native resolution, stretched" width={376} height={252} className="block h-[252px] w-[376px] object-cover" />
            <p className="w-[376px] t-label-md text-text-primary">The dark recorded by the camera</p>
            <p className="w-[376px] t-body-sm text-text-secondary">
              The master’s contrast is enhanced to reveal its small brightness differences. The enlarged patch below shows individual sensor pixels.
            </p>
          </div>
        </section>

        <section className="flex items-start gap-[48px]">
          <div className="flex flex-col gap-[24px]">
            <img src={roiRaw} alt="A 64 by 64 pixel patch of one light frame, enlarged five times" width={320} height={320} className="block size-[320px]" style={pixelated} />
            <div className="flex flex-col gap-[24px] text-text-primary">
              <h2 className="w-[440px] m-0 t-h2">The problem you can see</h2>
              <p className="w-[440px] t-body-md">
                A 64 by 64 pixel patch of one light frame, enlarged so every pixel shows. The grain is random noise, which changes from exposure to exposure. The bright single points are hot pixels, and they sit in exactly the same places as in the dark.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-[12px]">
            <img src={ampglow} alt="A 600 second dark from an older camera showing amplifier glow" width={712} height={485} className="block h-[485px] w-[712px] object-cover" />
            <p className="w-[712px] t-label-md text-text-primary">Amplifier glow on an older camera</p>
            <p className="w-[712px] t-body-sm text-text-secondary">
              A 600 second dark from a ZWO ASI294MM Pro, a different and older camera than the one that took our light frames. The bright fan at the right edge is amplifier glow: the amplifier next to the sensor warms up during a long exposure, and the pixels closest to it leak more. It is a heat signal like any other, so a matching dark removes it too. Most current cameras switch the amplifier off while the sensor is collecting light and show little or none of it. Shown for the glow only; it is not used anywhere else in this lesson.
            </p>
          </div>
        </section>

        <section className="flex items-start gap-[48px]">
          <div className="flex flex-col gap-[24px] text-text-primary">
            <h2 className="w-[680px] m-0 t-h2">Matching the dark to the light</h2>
            <p className="w-[680px] t-body-md">
              Dark current builds up at a rate set by the temperature of the sensor, so a dark frame only matches a light frame when both were taken at the same temperature and for the same exposure time. Then the heat signal accumulates at the same rate in both, and subtracting one from the other takes it out. Darks need no sky, so they can be taken on any cloudy night, and averaging many of them into a master dark makes it smoother than any single one.
            </p>
          </div>
          <WhyCallout title="Why some grain remains">
            Dark current varies randomly as well as having a repeatable pattern. A master dark estimates that pattern by averaging across many dark images, but it cannot predict the random fluctuations in a particular sky exposure. The image still contains noise after calibration, with the repeatable contribution removed. It’s not perfect, but it’s a step towards less noise.
          </WhyCallout>
        </section>
      </div>

      <div className="h-[6px] w-[1440px] bg-ink-900" />

      <section className="flex w-full flex-col items-start gap-[40px] bg-surface-stage px-[120px] py-[48px]">
        <div className="flex flex-col gap-[12px]">
          <Eyebrow onStage>Try it</Eyebrow>
          <h2 className="w-[900px] m-0 t-h2 text-text-on-stage">Subtract the dark</h2>
          <p className="w-[680px] t-body-md text-text-on-stage-muted">
            The enlarged patch shows single pixels. Turn Dark on, then off again, and watch the bright single points. The grain stays, because random noise is different in every exposure and no dark can remove it.
          </p>
        </div>
        <div className="flex flex-col gap-[16px]">
          <div className="flex items-center gap-[24px]">
            <h3 className="m-0 t-h3 whitespace-nowrap text-text-on-stage">Subtracting the dark</h3>
            <Toggle label="Dark" checked={dark} onChange={setDark} onStage />
            <p className="w-[360px] t-body-sm text-text-on-stage-muted">
              Subtract the master dark from the light frame. The hot pixels lose most of their brightness. The random grain does not change.
            </p>
          </div>
          <div className="flex items-start gap-[24px]">
            <ROITile title="Raw" well={{ w: WELL, h: WELL }} caption="The light frame. The circled hot pixel reads 1,887; the background around it 607.">
              <img src={roiRaw} alt="" width={WELL} height={WELL} className="absolute inset-0 h-full w-full" style={pixelated} />
              <HotPixelMarker />
            </ROITile>
            <ROITile
              title="Computed"
              well={{ w: WELL, h: WELL }}
              caption={
                dark
                  ? 'Light frame minus the master dark. The circled hot pixel now reads 761 against a background of 607, and blends into the grain. The other hot pixels are dimmer but still there.'
                  : 'The light frame · Dark toggled off'
              }
            >
              <img src={dark ? roiDarkOn : roiDarkOff} alt="" width={WELL} height={WELL} className="absolute inset-0 h-full w-full" style={pixelated} />
              <HotPixelMarker />
            </ROITile>
          </div>
        </div>
      </section>

    </LessonPage>
  );
}
