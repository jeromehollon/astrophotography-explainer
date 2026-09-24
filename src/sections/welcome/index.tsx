// P0 Welcome (Figma frame 57:619). Reading-only: no Try-it stage, no ink rule.
import { LessonPage, Reading, PageHead, Prose } from '../lessons-a-shim/ui';
import '../lessons-a-shim/prose.css';
import subFull from './assets/sub_full.png';
import masterFull from './assets/master_full.png';
import colourFull from './assets/colour_full.png';

function Step({ src, caption }: { src: string; caption: string }) {
  return (
    <figure className="flex w-[368px] flex-col items-start gap-[12px]">
      <img src={src} alt="" className="block h-[247px] w-[368px] object-cover" />
      <figcaption className="cap-on-stage w-[368px]">{caption}</figcaption>
    </figure>
  );
}

export default function Welcome() {
  return (
    <LessonPage>
      <Reading>
        <PageHead
          eyebrow="Welcome"
          title="Astrophotography Calibration and Stacking, Explained."
          subtitle="Why every deep-sky photo starts with pictures of nothing."
          lede="If you are new to astrophotography, the choices between calibration frames, exposures, and stacking methods can feel disconnected from the picture you are trying to make. We’ll work through them together, using changes in an image to understand what each choice does. No background in statistics or stacking software is needed."
        />

        <div className="flex flex-col items-start rounded-[6px] bg-surface-stage p-[24px]">
          <div className="flex items-start gap-[24px]">
            <Step src={subFull} caption="One exposure, 300 seconds" />
            <Step src={masterFull} caption="Stack of twenty exposures" />
            <Step src={colourFull} caption="Color photograph" />
          </div>
        </div>

        <div className="flex items-start gap-[48px] text-text-primary">
          <Prose>
            <h2>An image you can experiment with, from my observatory</h2>
            <p>The lesson uses real photographs from Jerome Hollon’s backyard observatory, Stella Venator Observatory in Lexington, Kentucky, alongside clearly labeled synthetic problems. You can change a choice, inspect the same region, and reverse it as often as you like. We’ll begin with noise and other defects, then work through calibration, alignment, combination methods, and frame selection.</p>
            <p>By the end, you should be able to explain your choices and recognize what each improvement leaves behind. After the lesson, you’ll be dropped into a workbench to continue experimenting and prepare a stack to export.</p>
          </Prose>
          <aside className="flex w-[440px] flex-col items-start gap-[12px] bg-surface-card p-[24px]">
            <h3 className="w-full font-heading text-[22px] leading-[28px] font-medium">From a monochrome stack to a finished photograph</h3>
            <p className="w-full font-body text-[16px] leading-[24px]">The finished color photograph below shows where that first stack can lead. The final image is more advanced than we’ll cover here, but this lesson will give you the knowledge to start the process on your own.</p>
          </aside>
        </div>

        <div className="flex items-start gap-[48px]">
          <Prose className="!w-[472px]">
            <h2>A field of distant galaxies</h2>
            <p>The large spiral is NGC 7331, about 45 million light-years away in Pegasus. Its tilted disk lets us see bright spiral arms crossed by dark lanes of dust.</p>
            <p>At least eight galaxies are visible in this field. Several of the small, elongated smudges are galaxies too. Many of the sharp points of light between them are stars much closer to home.</p>
            <p>The galaxy in the center and the four above it is called the Deer Lick Group. These smaller galaxies are mostly gravitationally locked to the bigger galaxy and in 1-3 billion years, they will have merged with the bigger galaxy.</p>
            <p>As we work toward the monochrome stack, watch for those faint shapes becoming easier to recognize. The detail is already present in the exposures; calibration and stacking help us separate it from the camera’s patterns and the random variation around it.</p>
          </Prose>
          <figure className="flex w-[680px] flex-col items-start gap-[12px]">
            <img src={colourFull} alt="NGC 7331 and its neighbours, colour composite" className="block h-[457px] w-[680px] object-cover" />
            <figcaption className="w-[680px] font-body text-[14px] leading-[20px] text-text-secondary">NGC 7331 and its neighbors</figcaption>
          </figure>
        </div>

        <p className="w-[1200px] font-body text-[14px] leading-[20px] text-text-secondary">Photographs by Jerome Hollon · Stella Venator Observatory</p>
      </Reading>
    </LessonPage>
  );
}
