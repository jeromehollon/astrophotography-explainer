// P1 Noise & Defects (Figma frame 61:1149). Reading-only introduction: illustration, problem pair, tour table, calibration prose.
import { useEffect, useState } from 'react';
import { LessonPage, Reading, PageHead, Prose, Callout, Badge } from '../lessons-a-shim/ui';
import '../lessons-a-shim/prose.css';
import { LightPath } from './LightPath';
import problemGalaxy from './assets/problem_galaxy.png';
import problemMaster from './assets/problem_master.png';
import tourNoise from './assets/tour_noise.png';
import tourBias from './assets/tour_bias.png';
import tourDark from './assets/tour_dark.png';
import tourFlat from './assets/tour_flat.png';
import tourMisaligned from './assets/tour_misaligned.png';
import tourSatellite from './assets/tour_satellite.png';
import tourCloud from './assets/tour_cloud.png';
import tourTracking from './assets/tour_tracking.png';

type Row = { thumb: string; source: 'noise' | 'bias' | 'dark' | 'flat' | 'external'; cause: string; see: string; fix: string };

const ROWS: Row[] = [
  { thumb: tourNoise, source: 'noise', cause: 'Photons and sensor readout', see: 'Grain that is different in every frame.', fix: 'Stacking: combining many frames.' },
  { thumb: tourBias, source: 'bias', cause: 'Readout offset', see: 'A fixed amount added to every pixel, with faint stripes.', fix: 'Bias frames.' },
  { thumb: tourDark, source: 'dark', cause: 'Dark signal and hot pixels', see: 'Bright dots in the same places in every frame.', fix: 'Dark frames of the same exposure and temperature.' },
  { thumb: tourFlat, source: 'flat', cause: 'Uneven response', see: 'Dim corners and soft dust shadows.', fix: 'Flat frames, corrected with dark flats.' },
  { thumb: tourMisaligned, source: 'external', cause: 'Frames that do not line up', see: 'Every star doubled when frames are combined as shot.', fix: 'Alignment to a reference frame.' },
  { thumb: tourSatellite, source: 'external', cause: 'Satellites and aircraft', see: 'A straight streak in one frame only.', fix: 'Rejection while stacking.' },
  { thumb: tourCloud, source: 'external', cause: 'Clouds', see: 'Patches of sky brighter or dimmer than the rest.', fix: 'Choosing which frames to keep.' },
  { thumb: tourTracking, source: 'external', cause: 'Tracking errors', see: 'Stars stretched into short dashes.', fix: 'Choosing which frames to keep.' },
];

/** Plain overlay showing the full crop; closes on click or Escape (design-notes §3). */
function Enlarged({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-label={alt} onClick={onClose} className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-space-900/80">
      <img src={src} alt={alt} className="block max-h-[90vh] max-w-[90vw]" />
    </div>
  );
}

function Rule() {
  return <div className="h-px w-[1152px] bg-border-default" />;
}

export default function Noise() {
  const [open, setOpen] = useState<Row | null>(null);
  return (
    <LessonPage>
      <Reading>
        <PageHead
          eyebrow="Chapter 2 · Noise & Defects"
          title="What a single photo of the sky contains"
          lede="A light frame is one exposure of your target. In this set we are working with five-minute exposures on the galaxy NGC 7331. Each frame holds the faint light you want, and mixed in with it a set of unwanted additions from the camera, the telescope and the sky. We’ll learn about the source of each type of predictable error and the tool that deals with it."
        />

        <LightPath />

        <div className="flex items-start gap-[48px]">
          <div className="flex flex-col items-start gap-[32px]">
            <Prose>
              <h2>The problem you can see</h2>
              <p>When you open a single exposure of a faint galaxy, the image can look surprisingly rough. The galaxy is already there, but its light shares the picture with fluctuations in the measurement, patterns introduced by the camera, and things that happened while the shutter was open. Learning to recognise those different contributions helps us decide what to do next.</p>
              <p>Some of the grain changes from exposure to exposure. Light arrives in individual packets called photons, and the number collected by a pixel varies even when the average brightness stays steady. Reading the sensor adds another small, unpredictable variation. We call these random fluctuations noise.</p>
              <p>Other features have a cause we can measure more directly: a repeatable camera offset, a dust shadow, a shift in the position of the stars. These need different corrections. We will follow each cause through the next lessons and check what changes in the image.</p>
            </Prose>
            <Prose>
              <h2>Why we stack</h2>
              <p>Stacking means combining many exposures of the same target into one image. Each frame is lined up with the others, and then, pixel by pixel, the values are combined using an algorithm we’ll cover later. The galaxy and the sky are the same in every frame, so combining strengthens the faint signals from the galaxy’s arms, combining also helps us remove random noise that will also strengthen the signal.</p>
              <p>Combining does nothing for a pattern that repeats in every frame. Those patterns need calibration frames: extra photographs that record each cause on its own, so that it can be measured and removed.</p>
            </Prose>
          </div>
          <div className="flex w-[440px] flex-col items-start gap-[12px]">
            <img src={problemGalaxy} alt="The region around NGC 7331 in one light frame" className="block h-[330px] w-[440px] object-cover" />
            <p className="w-[440px] font-body text-[14px] leading-[20px] font-medium text-text-primary">One five-minute exposure</p>
            <p className="w-[440px] font-body text-[14px] leading-[20px] text-text-secondary">The region around NGC 7331 in one light frame, before any calibration or stacking. Faint outer parts of the galaxy are lost in the grain.</p>
            <div className="h-[12px] w-[440px]" />
            <img src={problemMaster} alt="The same region in the finished stack" className="block h-[330px] w-[440px] object-cover" />
            <p className="w-[440px] font-body text-[14px] leading-[20px] font-medium text-text-primary">The same region in the finished stack</p>
            <p className="w-[440px] font-body text-[14px] leading-[20px] text-text-secondary">Twenty calibrated exposures, aligned and combined. The grain is much lower, so the spiral arms and the halo around the galaxy become visible.</p>
          </div>
        </div>

        <section className="flex flex-col items-start gap-[32px]">
          <h2 className="w-[900px] font-heading text-[28px] leading-[34px] font-semibold text-text-primary">Where each error comes from</h2>
          <p className="w-[680px] font-body text-[16px] leading-[24px] text-text-primary">Each cause below leaves its own mark in a frame, and each has a tool that deals with it. The lessons take them in this order.</p>
          <div className="flex flex-col items-start">
            <div className="flex items-start gap-[24px] pb-[8px] font-body text-[12px] leading-[16px] font-medium tracking-[0.2px] text-text-secondary">
              <p className="w-[120px]">Example</p>
              <p className="w-[260px]">Cause</p>
              <p className="w-[380px]">What you see</p>
              <p className="w-[320px]">What deals with it</p>
            </div>
            <Rule />
            {ROWS.map((r) => (
              <div key={r.cause} className="contents">
                <div className="flex items-center gap-[24px] py-[12px]">
                  <button type="button" onClick={() => setOpen(r)} className="block h-[80px] w-[120px] cursor-pointer p-0" aria-label={`Enlarge: ${r.cause}`}>
                    <img src={r.thumb} alt="" className="block h-[80px] w-[120px] object-cover" />
                  </button>
                  <div className="flex w-[260px] flex-col items-start gap-[6px]">
                    <Badge source={r.source} />
                    <p className="w-[260px] font-body text-[14px] leading-[20px] font-medium text-text-primary">{r.cause}</p>
                  </div>
                  <p className="w-[380px] font-body text-[16px] leading-[24px] text-text-primary">{r.see}</p>
                  <p className="w-[320px] font-body text-[16px] leading-[24px] text-text-primary">{r.fix}</p>
                </div>
                <Rule />
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-start gap-[48px]">
          <Prose>
            <h2>What calibration measures</h2>
            <p>A calibration frame is a measurement of the camera or optical system under controlled conditions. By combining several of these measurements, we make a cleaner estimate of a repeatable pattern. We can then correct that pattern in a photograph of the sky.</p>
            <p>That does not give us a record of the exact random fluctuation in each pixel of that photograph. Subtracting a different noisy measurement cannot cancel an unknown fluctuation, and calibration frames carry uncertainty of their own. This is why a calibrated exposure can still look grainy.</p>
            <p>We will begin with bias, darks and flats, then align the exposures so that each location refers to the same part of the sky. After that, we can compare ways to combine them and inspect which light frames deserve a place in the stack. Each lesson adds a tool for a particular cause, and the workbench brings those decisions together.</p>
          </Prose>
          <Callout kind="note" title="Calibration frames are stacked too" className="w-[440px] shrink-0">
            A single bias, dark or flat carries noise like any exposure, so many are taken and combined with the same averaging, median and clipping methods used for lights. The combined result is called a master.
          </Callout>
        </div>
      </Reading>
      {open && <Enlarged src={open.thumb} alt={open.cause} onClose={() => setOpen(null)} />}
    </LessonPage>
  );
}
