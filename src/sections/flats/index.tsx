// Calibration > Flats. Layout, sizes and every line of prose follow the Figma
// frames "P4 · Flats 1" A (14:2), B (49:835) and C (49:1060) on page 8:7.
import { useEffect, useState } from 'react';
import { LessonPage } from '../../shared/ui';
import { useAppStore } from '../../shared/store';
import {
  Reading, PageHead, H2, P, Rule, Stage, StageHead, Experiment, Toggle, ROITile, Callout,
} from './ui';
import illustration from './assets/flats-illustration.svg?raw';
import flatFull from './assets/flat_full.png';
import frameBefore from './assets/frame_before.png';
import frameAfter from './assets/frame_after.png';
import roiRaw from './assets/roi_raw.png';
import roiComputedAsShot from './assets/roi_computed_flat-as-shot.png';
import roiComputedDarkflat from './assets/roi_computed_flat-darkflat.png';
import roiRemovedAsShot from './assets/roi_removed_flat-as-shot.png';
import roiExp2Removed from './assets/roi_exp2_removed.png';

const removedCaption =
  'Difference between the two images. Gray means nothing changed, darker color means removal, lighter color means addition';

export default function Flats() {
  // Local state starts where frame A does (both off); each change is written to
  // the shared store without touching the other calibration fields (design-notes §3).
  const [flat, setFlatState] = useState(false);
  const [darkFlat, setDarkFlatState] = useState(false);
  const calibration = useAppStore((s) => s.calibration);
  const set = useAppStore((s) => s.set);
  const setFlat = (v: boolean) => { setFlatState(v); set({ calibration: { ...calibration, flat: v ? 50 : null } }); };
  const setDarkFlat = (v: boolean) => { setDarkFlatState(v); set({ calibration: { ...calibration, darkFlat: v } }); };
  // On mount, put the store where frame A is so it never disagrees with the toggles.
  useEffect(() => {
    const s = useAppStore.getState();
    s.set({ calibration: { ...s.calibration, flat: null, darkFlat: false } });
  }, []);

  return (
    <LessonPage>
      <Reading>
        <PageHead
          eyebrow="Chapter 4 · Calibration"
          title="Following the light through your telescope"
          lede="Even when we photograph a uniformly lit surface, the resulting image is rarely uniform. The telescope may deliver less light toward the edges, and dust on a surface close to the camera sensor can cast soft shadows. Those patterns also appear in our photographs of the sky, where they can obscure faint detail."
        />

        <div className="flex items-start gap-[24px]">
          <div className="flex w-[800px] flex-col items-start gap-[16px] rounded-[6px] border border-border-default bg-surface-card p-[24px]">
            <div
              className="h-[225.6px] w-[752px] [&>svg]:block [&>svg]:h-[225.6px] [&>svg]:w-[752px]"
              dangerouslySetInnerHTML={{ __html: illustration }}
            />
            <div className="flex flex-col items-start gap-[24px]">
              <P className="w-[752px]">
                A dust mote blocks some light before it reaches the sensor. The flat records its shadow, along with other variations in illumination.
              </P>
              <P className="w-[752px]">
                A flat records the response of the whole system. Photograph an evenly illuminated panel through the telescope, keeping the optical arrangement, focus, and camera position unchanged. The flat needs to measure the same pattern that affected the images of the sky.
              </P>
            </div>
          </div>
          <figure className="flex flex-col items-start gap-[12px]">
            <img src={flatFull} alt="The master flat, whole field: bright in the centre, darker toward the corners, with soft dust shadows" width={376} height={252} className="block h-[252px] w-[376px] object-cover" />
            <figcaption className="contents">
              <p className="w-[376px] font-body text-[14px] leading-[20px] font-medium text-text-primary">The flat recorded by the camera</p>
              <div className="w-[376px] font-body text-[14px] leading-[20px] text-text-secondary">
                <p>The light began evenly. Dark corners and soft dust shadows show where the system recorded less of it.</p>
                <p>The donuts are dust on the camera or filters. The center bottom darkness is caused by an obstruction in the telescope.</p>
              </div>
            </figcaption>
          </figure>
        </div>

        <div className="flex items-start gap-[48px]">
          <div className="flex flex-col items-start gap-[24px]">
            <H2>Reading the flat as a correction map</H2>
            <P>
              We scale the flat into a map of relative response, then divide each location in the sky image by the corresponding value in that map. A darker part of the flat has a smaller value, so dividing by it brightens that part of the image more, a brighter part of the flat, like the center, is dimmed by the division. This compensates for the light lost along the way and evens the illumination across the whole image.
            </P>
            <Callout kind="why" title="Why can't the flat be drawn as another layer to peel away?">
              A flat scales each pixel rather than adding or removing a fixed amount, so how much it changes a pixel depends on how bright that pixel was to begin with. A dim corner is lifted a lot; a bright star in the same corner is lifted by the same factor, not the same amount.
            </Callout>
          </div>
          <div className="flex flex-col items-start gap-[12px] rounded-[6px] bg-surface-panel p-[24px]">
            <p className="font-heading text-[13px] leading-[16px] font-medium tracking-[1.5px] uppercase whitespace-nowrap text-text-link">One illustrative pixel</p>
            <p className="font-mono text-[22px] leading-[28px] font-medium whitespace-nowrap text-text-primary">600 ÷ 0.75 = 800</p>
            <p className="w-[392px] font-body text-[14px] leading-[20px] text-text-secondary">Pixel brightness ÷ relative response = corrected pixel brightness</p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-[24px]">
          <H2>What changes in the whole image</H2>
          <P>
            Compare the background across these two views, including the corners and the dust shadow on the left. Applying the flat makes the response more even, so those features compete less with the faint detail we want to see.
          </P>
          <div className="flex flex-col items-start rounded-[6px] bg-surface-stage p-[24px]">
            <div className="flex items-start gap-[24px]">
              <figure className="flex flex-col items-start gap-[12px]">
                <img src={frameBefore} alt="One exposure before the flat: darker corners and a dust shadow on the left" width={564} height={378} className="block h-[378px] w-[564px] object-cover" />
                <figcaption className="w-[564px] font-body text-[14px] leading-[20px] text-text-on-stage-muted">Before the flat</figcaption>
              </figure>
              <figure className="flex flex-col items-start gap-[12px]">
                <img src={frameAfter} alt="The same exposure after the flat: an even background" width={564} height={378} className="block h-[378px] w-[564px] object-cover" />
                <figcaption className="w-[564px] font-body text-[14px] leading-[20px] text-text-on-stage-muted">After the flat</figcaption>
              </figure>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-[24px]">
          <H2>Why the flat needs its own dark frames</H2>
          <P>
            A flat is a photograph like any other. Besides the light from the panel, it records the small amount of signal the camera produces on its own during the exposure, which sits underneath everything as a constant offset. Divide by a flat that still carries that offset and the map is wrong in a specific way: the offset props up the dark corners of the flat more, in proportion, than it props up the bright centre, so the flat under-reports how uneven the field really is and the correction falls short. The dust shadow fades but does not quite go.
          </P>
          <P>
            The fix is a set of dark flats: exposures of exactly the same length as the flats, with no light reaching the sensor, so they contain only what the camera adds by itself. Subtract each dark flat from its flat before the flats are combined into the master flat, and the map is honest again.
          </P>
        </div>
      </Reading>

      <Rule />

      <Stage>
        <StageHead
          eyebrow="Try it"
          title="Remove the dust mote"
          instructions="The enlarged region makes one dust shadow easier to inspect. Turn Flats on, then off again, and compare the patch with the surrounding background. The same part of the image stays in view, so you can follow what changes."
        />

        <Experiment
          title="Correcting the light"
          help="Apply the flat to correct uneven illumination and dust shadows. This comparison uses the flat without dark-flat correction, so the Dark-flats control below does not change it."
          controls={<Toggle label="Flat" checked={flat} onChange={setFlat} />}
        >
          <ROITile title="Raw" caption="Without a flat" src={roiRaw} alt="Enlarged region of one exposure without a flat: a dark dust shadow" />
          <ROITile
            title="Computed"
            caption={flat ? 'With a flat - Flat toggled on' : 'Without a flat - Flat toggled off'}
            src={flat ? roiComputedAsShot : roiRaw}
            alt={flat ? 'The same region divided by the flat: the dust shadow is gone' : 'The same region, still without a flat'}
          />
          <ROITile title="What was removed" caption={removedCaption} src={roiRemovedAsShot} alt="Difference between the corrected and raw region: a ring where the dust shadow was lifted" />
        </Experiment>

        <Experiment
          title="Calibrating the flat"
          help="Subtract a matching dark flat from each flat before building the master flat. The flat stays on for this experiment."
          controls={<Toggle label="Dark flats" checked={darkFlat} onChange={setDarkFlat} />}
        >
          <ROITile title="Raw" caption="Frame with a flat applied, but without dark calibration applied to the flat" src={roiComputedAsShot} alt="The region divided by the flat as shot" />
          <ROITile
            title="Computed"
            caption={darkFlat ? 'Dark Flats On' : 'Dark Flats Off'}
            src={darkFlat ? roiComputedDarkflat : roiComputedAsShot}
            alt={darkFlat ? 'The region divided by the dark-flat-calibrated flat' : 'The region divided by the flat as shot'}
          />
          <ROITile
            title="What was removed"
            caption={darkFlat ? 'This may appear identical to the earlier example but there are subtle differences' : removedCaption}
            src={roiExp2Removed}
            alt="Difference between the two corrections: a faint ring at the dust shadow"
          />
        </Experiment>
      </Stage>
    </LessonPage>
  );
}
