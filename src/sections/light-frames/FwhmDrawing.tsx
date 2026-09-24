// The FWHM drawing (Figma 96:50): one image row through the same star in frame 11 and its tracking-error copy.
// Bars come from assets/light-frames/stats.json → fwhm_star.*.profile_dn (sky subtracted; 1000 DN = 200 px).
import star from './assets/fwhm_star.json';

const PX_PER_DN = 0.2;
const BASE_Y = 300; // x axis top
const BAR_W = 9;
const BAR_STEP = 11;
const BAR_X0 = 56;

type PanelProps = { left: number; title: string; profile: number[]; band: { left: number; width: number } };

function Panel({ left, title, profile, band }: PanelProps) {
  const peak = Math.max(...profile);
  const peakTop = BASE_Y - Math.round(peak * PX_PER_DN);
  const halfTop = BASE_Y - Math.round((peak * PX_PER_DN) / 2);
  return (
    <div className="absolute top-0 h-[360px] w-[580px]" style={{ left }}>
      <p className="absolute top-0 left-[56px] font-heading text-[22px] leading-[28px] font-medium whitespace-nowrap text-text-primary">{title}</p>
      <svg className="absolute top-0 left-0" width="580" height="360" viewBox="0 0 580 360" aria-hidden="true">
        <rect x={band.left} y="60" width={band.width} height="240" fill="#F7E6B5" />
        {profile.map((dn, i) => {
          const h = Math.max(2, Math.round(dn * PX_PER_DN));
          return <rect key={i} x={BAR_X0 + i * BAR_STEP} y={BASE_Y - h} width={BAR_W} height={h} fill="#1C1A17" />;
        })}
        <rect x="52" y="300" width="369" height="2" fill="#1C1A17" />
        <rect x="52" y="60" width="2" height="240" fill="#1C1A17" />
        <line x1="52" x2="421" y1={halfTop - 1} y2={halfTop - 1} stroke="#E3A81E" strokeWidth="2" strokeDasharray="6 4" />
        <line x1="52" x2="421" y1={peakTop - 0.5} y2={peakTop - 0.5} stroke="#1C1A17" strokeWidth="1" strokeDasharray="2 4" />
      </svg>
      <p className="absolute left-[429px] font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-primary" style={{ top: halfTop - 10 }}>Half of the peak</p>
      <p className="absolute left-[429px] font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-primary" style={{ top: peakTop - 10 }}>Peak</p>
      <p className="absolute top-[308px] w-[172px] -translate-x-1/2 text-center font-body text-[12px] leading-[16px] font-medium tracking-[0.2px] text-text-primary" style={{ left: band.left + band.width / 2 }}>Width at half the peak</p>
      <p className="absolute top-[330px] left-[56px] w-[361px] text-center font-body text-[14px] leading-[20px] font-medium text-text-primary">Pixels across the star</p>
      <div className="absolute top-[144.5px] left-[26px] flex h-[71px] w-[20px] items-center justify-center">
        <p className="-rotate-90 font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-primary">Brightness</p>
      </div>
    </div>
  );
}

export function FwhmDrawing() {
  return (
    <div className="relative h-[360px] w-[1200px]" role="img" aria-label="Two bar charts of pixel brightness along one row through the same star: a round star in frame 11 and the wider, dimmer trailed star in the tracking-error copy, each with its peak and half-peak marked.">
      <Panel left={0} title="Round star" profile={star.f11.profile_dn} band={{ left: 185, width: 92 }} />
      <Panel left={620} title="Trailed star" profile={star.f11_tracking.profile_dn} band={{ left: 174, width: 92 }} />
    </div>
  );
}
