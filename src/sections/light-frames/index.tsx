// P8 Light frames, "Image Worthiness" (Figma frame 94:46). Reading-only; the Try-it lives on the review page.
import { LessonPage, Reading, PageHead, Prose } from '../lessons-a-shim/ui';
import '../lessons-a-shim/prose.css';
import { FwhmDrawing } from './FwhmDrawing';
import cloudF14 from './assets/cloud_f14.png';
import cloudF15 from './assets/cloud_f15.png';
import cloudF16 from './assets/cloud_f16.png';
import trackingF11 from './assets/tracking_f11.png';
import trackingF11Tracking from './assets/tracking_f11_tracking.png';
import starF11 from './assets/star_f11.png';
import starF11Tracking from './assets/star_f11_tracking.png';

function Tile({ src, alt, w, h, caption }: { src: string; alt: string; w: number; h: number; caption: string }) {
  return (
    <figure className="flex flex-col items-start gap-[12px]">
      <img src={src} alt={alt} className="block object-cover" style={{ width: w, height: h }} />
      <figcaption className="cap-on-stage" style={{ width: w }}>{caption}</figcaption>
    </figure>
  );
}

export default function LightFrames() {
  return (
    <LessonPage>
      <Reading>
        <PageHead
          eyebrow="Chapter 7 · Light frames"
          title="Choosing the photographs worth combining"
          lede="We now know how to line up our photographs and how a stacking method treats an unusual pixel. The next decision is which photographs deserve a place in the stack. A longer total exposure helps only when those extra measurements tell us something useful about the sky."
        />

        <div className="flex flex-col items-start gap-[24px]">
          <Prose>
            <h2>Look for changes across the whole field</h2>
            <p>Comparing one exposure with the next makes a change easier to notice than inspecting each photograph on its own. Compare the faint background, the visibility of the galaxy and the shapes of the stars. In the three cloud examples below, broad patches cover different parts of the image. We would leave these out: an outlier-rejection method cannot recover light that the clouds prevented us from recording.</p>
          </Prose>
          <div className="flex items-start gap-[24px] bg-surface-stage p-[24px]">
            <Tile src={cloudF14} alt="Frame 14, cloud copy, whole field" w={368} h={246} caption="Frame 14, cloud copy" />
            <Tile src={cloudF15} alt="Frame 15, cloud copy, whole field" w={368} h={246} caption="Frame 15, cloud copy" />
            <Tile src={cloudF16} alt="Frame 16, cloud copy, whole field" w={368} h={246} caption="Frame 16, cloud copy" />
          </div>
          <p className="w-[680px] font-body text-[16px] leading-[24px] text-text-primary">These cloud examples are deliberately altered copies of Frames 14–16. Their unchanged originals are available in the review, too. A copy and its original still represent the same captured exposure.</p>
        </div>

        <div className="flex flex-col items-start gap-[24px]">
          <Prose>
            <h2>Distinguish a passing satellite from blurred stars</h2>
            <p>A satellite adds a bright line to one exposure while leaving most of the astronomical image intact. If enough other exposures give us clean measurements at those positions, a suitable combination method can suppress the line. Keep Frame 3 available and check the result; the number of photographs alone is not a guarantee.</p>
            <p>Tracking error is different. When the telescope moves during an exposure, it spreads the light from stars—and in a real tracking failure, the galaxy—across the detector. Alignment can move that blurred image into place, but it cannot make the lost detail sharp again. These are photographs we would exclude, rather than asking the stacking method to repair their star shapes.</p>
          </Prose>
          <div className="flex items-start gap-[24px] bg-surface-stage p-[24px]">
            <Tile src={trackingF11} alt="Frame 11, galaxy crop" w={564} h={376} caption="Frame 11" />
            <Tile src={trackingF11Tracking} alt="Frame 11 tracking-error copy, galaxy crop" w={564} h={376} caption="Frame 11, tracking-error copy" />
          </div>
          <p className="w-[680px] font-body text-[16px] leading-[24px] text-text-primary">This supplied tracking example alters the stars to demonstrate the loss of shape; the galaxy is less affected by the error, but fine details will be lost. Compare several stars around it.</p>
        </div>

        <div className="flex flex-col items-start gap-[24px]">
          <Prose>
            <h2>Measuring the width of a star</h2>
            <p>Software can measure star shape for us. A star in a photograph is not a single point: its light spreads over a small patch of pixels, brightest at the centre and fading outwards. If we plot the pixel brightness along a line through that centre, we get a hill. The full width at half maximum, or FWHM, is the width of that hill measured at half its peak height. It is quoted in pixels, and a smaller number means a tighter, sharper star.</p>
            <p>The number is useful, but it has limits. Every exposure in this set has a typical FWHM between 8 and 10 pixels, and the tracking-error copy of Frame 11 reads 8.6 pixels against 8.2 for the original, a difference too small to notice. What changed is the count: the star-finding software found 179 stars in the original and only 74 in the copy, because a trailed star no longer looks like a star to it. The drawing below plots one row of pixels through the same star in both exposures. It is one of the stars the software lost.</p>
          </Prose>
          <FwhmDrawing />
          <div className="flex items-start gap-[24px] bg-surface-stage p-[24px]">
            <Tile src={starF11} alt="One star from frame 11, enlarged 8 times" w={288} h={288} caption="Frame 11: the star, 48 pixels across, enlarged 8 times. FWHM 8.1 pixels." />
            <Tile src={starF11Tracking} alt="The same star in the tracking-error copy, enlarged 8 times" w={288} h={288} caption="This is the image with the tracking error. Here you can see a wider star that is measured at a FWHM 11.7 pixels: 17.0 along the trail, 8.1 across it." />
          </div>
        </div>

        <Prose>
          <h2>Next: try keeping and excluding an exposure</h2>
          <p>On the next page you can move through the exposures one at a time with Previous frame and Next frame. The enlarged galaxy view stays in the same place, so you can compare shapes without chasing the object around the screen. Include or exclude the current photograph, then compare Average with Median. The result beside it shows what your selected photographs contribute together.</p>
        </Prose>
      </Reading>
    </LessonPage>
  );
}
