// P2 Bias. Figma frames "P2 · Bias — A · bias off" 60:1200 and "B · bias on" 99:260 (page 8:5).
// Prose is copied verbatim from Figma; the illustration is the exported component 35:41.
import { useEffect } from 'react';
import { TopBar, BottomNav, Toggle, ROITile, Eyebrow } from './chrome';
import { useAppStore } from './store';
import { barPx, restPx } from './bars';
import illustration from './assets/illustration.svg?raw';
import roiRaw from './assets/roi_raw.png';
import roiComputedBias from './assets/roi_computed_bias.png';
import biasFull from './assets/bias_full.png';
import stats from './assets/stats.json';

const RAW = Math.round(stats.experiment_1.roi_mean_raw_dn); // 1,233
const COMPUTED = Math.round(stats.experiment_1.roi_mean_computed_dn); // 1,073
const BIAS = Math.round(stats.experiment_1.roi_mean_bias_dn); // 161
const px = (v: number) => barPx(v, RAW);
const fmt = (v: number) => v.toLocaleString('en-US');

function Bar({ label, value, biasShare }: { label: string; value: number; biasShare: boolean }) {
  return (
    <div className="flex items-center gap-[16px]">
      <span className="w-[96px] font-body text-[14px] leading-[20px] font-medium text-text-on-stage">{label}</span>
      <div className="flex items-start">
        {biasShare && <div className="h-[24px] bg-cobalt-400" style={{ width: px(BIAS) }} />}
        <div className="h-[24px] bg-cream-300" style={{ width: restPx(BIAS, RAW) }} />
      </div>
      <span className="font-mono text-[22px] leading-[28px] font-medium whitespace-nowrap text-text-on-stage">{fmt(value)}</span>
    </div>
  );
}

export default function BiasPage() {
  const bias = useAppStore((s) => s.calibration.bias);
  const calibration = useAppStore((s) => s.calibration);
  const set = useAppStore((s) => s.set);
  const setBias = (v: boolean) => set({ calibration: { ...calibration, bias: v } });
  // The lesson opens in state A (bias off): "Turn Bias on, then off again."
  useEffect(() => {
    set({ calibration: { ...useAppStore.getState().calibration, bias: false } });
  }, [set]);

  return (
    <div className="flex w-[1440px] flex-col bg-surface-page">
      <TopBar chapter="Calibration" page="Bias" />
      <main className="flex w-full flex-col items-start gap-[32px] px-[120px] py-[64px]">
        <div className="flex flex-col gap-[12px]">
          <Eyebrow>Chapter 4 · Calibration</Eyebrow>
          <h1 className="w-[900px] font-heading text-[40px] leading-[46px] font-semibold tracking-[-0.5px] text-text-primary">Removing the bias from every pixel</h1>
          <p className="w-[680px] font-body text-[18px] leading-[28px] text-text-secondary">
            A light frame is one exposure of the sky. Before the camera records any light at all, its electronics add a small, fixed amount of brightness to every pixel. That amount is the bias. It is not part of the sky, so the first step in calibration is to measure it and take it away.
          </p>
        </div>

        <section className="flex w-[1200px] flex-col gap-[16px] rounded-md border border-border-default bg-surface-card p-[24px]">
          <div className="h-[345.6px] w-[1152px] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: illustration }} />
          <div className="flex w-[1152px] flex-col gap-[24px] font-body text-[16px] leading-[24px] text-text-primary">
            <p>
              Reading a camera sensor is not like a typical read operation in software. Reading a camera sensor produces some noise in the resulting image. This noise is usually very small and slight, but is always present. Since the signal to noise ratio in astrophotography is so tiny, every bit of noise we can remove is paramount. Alongside that random read noise, the camera adds a repeatable electronic offset called “bias”. The way we capture it is we take the shortest possible photos the camera can take with no light. Combining these short exposures lets us estimate the repeatable offset and subtract it later.
            </p>
            <p>
              A bias frame is the shortest exposure the camera can take, with no light reaching the sensor. It records only that starting value, plus small pixel-to-pixel differences in how the electronics behave. Many bias frames averaged together make a master bias, a low-noise map of the offset that can be subtracted from every light frame.
            </p>
          </div>
        </section>

        <section className="flex w-[1200px] flex-col gap-[24px]">
          <h2 className="w-[680px] font-heading text-[28px] leading-[34px] font-semibold text-black">What the master bias looks like</h2>
          <p className="w-[680px] font-body text-[16px] leading-[24px] text-black">
            This is the master bias below, it is artificially manipulated in a process called stretch to allow our human eyes to see the resulting signal. What we’re seeing is a fine grain from the readout electronics, and faint vertical bands that the camera stamps on every frame in the same place. This is our offset that allows us to remove the baseline noise from an image.
          </p>
          <div className="flex w-[1200px] flex-col rounded-md bg-surface-stage p-[24px]">
            <img src={biasFull} alt="The master bias, stretched" width={1152} height={771} className="block h-[771px] w-[1152px] object-cover" />
          </div>
        </section>

        <section className="flex w-[1168px] items-start gap-[48px] text-black">
          <div className="flex w-[680px] flex-col gap-[24px]">
            <h2 className="w-[680px] font-heading text-[28px] leading-[34px] font-semibold">Taking the bias away</h2>
            <p className="w-[680px] font-body text-[16px] leading-[24px]">
              Because the bias was added to every pixel, removing it is a subtraction: each pixel in the light frame, minus the same pixel in the master bias. This allows the signal from the galaxy and the stars as much as the sky to be truer to their real value. The picture does not look very different; but as we clean up more of the image, we can bring out more contrast in the final editing.
            </p>
          </div>
          <aside className="flex w-[440px] flex-col gap-[12px] rounded-md bg-surface-panel p-[24px]">
            <Eyebrow dark>Average pixel brightness, region below</Eyebrow>
            <p className="font-mono text-[22px] leading-[28px] font-medium whitespace-nowrap">{fmt(RAW)} − {fmt(BIAS)} = {fmt(COMPUTED)}</p>
            <p className="w-[392px] font-body text-[14px] leading-[20px]">
              A single number makes the change easy to follow. Averaging every pixel in a region gives its average pixel brightness: before the bias is removed, minus the bias measured in that same region, equals after.
            </p>
          </aside>
        </section>
      </main>

      <div className="h-[6px] w-[1440px] bg-ink-900" />

      <section className="flex w-full flex-col items-start gap-[40px] bg-surface-stage px-[120px] py-[48px]">
        <div className="flex flex-col gap-[12px]">
          <Eyebrow onStage>Try it</Eyebrow>
          <h2 className="w-[900px] font-heading text-[28px] leading-[34px] font-semibold text-text-on-stage">Remove the bias</h2>
          <p className="w-[680px] font-body text-[16px] leading-[24px] whitespace-pre-wrap text-text-on-stage-muted">{`The enlarged region shows the galaxy and the sky around it. Turn Bias on, then off again.  The bars underneath show the average pixel brightness in this region.`}</p>
        </div>
        <div className="flex flex-col gap-[16px]">
          <div className="flex items-center gap-[24px]">
            <h3 className="font-heading text-[22px] leading-[28px] font-medium whitespace-nowrap text-text-on-stage">Removing the bias</h3>
            <Toggle label="Bias" checked={bias} onChange={setBias} />
            <p className="w-[360px] font-body text-[14px] leading-[20px] text-text-on-stage-muted">
              Subtract the master bias from the light frame. Every pixel drops by the value recorded at that same pixel in the master bias.
            </p>
          </div>
          <div className="flex items-start gap-[24px]">
            <ROITile title="Raw" caption="Light frame as recorded">
              <img src={roiRaw} alt="" width={318} height={240} className="absolute inset-0 h-full w-full object-cover" />
            </ROITile>
            <ROITile title="Computed" caption={bias ? 'With the bias removed - Bias toggled on' : 'Without the bias removed - Bias toggled off'}>
              <img src={bias ? roiComputedBias : roiRaw} alt="" width={318} height={240} className="absolute inset-0 h-full w-full object-cover" />
            </ROITile>
          </div>
          <div className="flex w-[1008px] flex-col gap-[12px] pt-[24px]">
            <Eyebrow onStage>Average pixel brightness in this region</Eyebrow>
            <Bar label="Raw" value={RAW} biasShare />
            <Bar label="Computed" value={bias ? COMPUTED : RAW} biasShare={!bias} />
            <div className="flex items-center gap-[8px]">
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="5" fill="#4A78D6" /></svg>
              <span className="font-body text-[12px] leading-[16px] font-medium tracking-[0.2px] whitespace-nowrap text-text-on-stage-muted">Bias share: {fmt(BIAS)} in this region</span>
            </div>
          </div>
        </div>
      </section>

      <BottomNav prev={{ label: 'Noise & Defects', path: '/noise' }} next={{ label: 'Darks', path: '/calibration/darks' }} />
    </div>
  );
}
