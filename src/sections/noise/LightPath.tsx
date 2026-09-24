// The "Noise & Defects / Light path" illustration (Figma component 35:2), 1200×360, as inline vectors.
// Shapes are in one SVG; labels are HTML so their type matches the rest of the page exactly.

const INK = '#1C1A17';
const MUTED = '#6B655C';
const LINE = '#A39C90';

function Label({ x, y, children, secondary = false }: { x: number; y: number; children: string; secondary?: boolean }) {
  return (
    <p className={`absolute font-body text-[14px] leading-[20px] whitespace-nowrap ${secondary ? 'text-text-secondary' : 'font-medium text-text-primary'}`} style={{ left: x, top: y }}>{children}</p>
  );
}

export function LightPath() {
  return (
    <div className="relative h-[360px] w-[1200px]" role="img" aria-label="Light from a star passes through the telescope and focuser into the camera, through a filter, onto a layered sensor: pixel grid, amplifier, ADC.">
      <svg className="absolute top-0 left-0" width="1200" height="360" viewBox="0 0 1200 360" aria-hidden="true">
        {/* light rays */}
        <g stroke={MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M136 130H266" />
          <path d="M266 130L740 170" />
          <path d="M136 170H266" />
          <path d="M266 170H740" />
          <path d="M136 210H266" />
          <path d="M266 210L740 170" />
        </g>
        {/* star */}
        <path transform="translate(86 156)" d="M14 0C14 9.33333 18.6667 14 28 14C18.6667 14 14 18.6667 14 28C14 18.6667 9.33333 14 0 14C9.33333 14 14 9.33333 14 0Z" fill={INK} />
        {/* telescope tube */}
        <rect x="221.5" y="101.5" width="417" height="137" fill="#F7F2EA" stroke={INK} strokeWidth="3" />
        <g stroke={LINE} strokeWidth="2" strokeLinecap="round">
          <path d="M232 104V236" />
          <path d="M242 104V236" />
          <path d="M592 104V236" />
          <path d="M604 104V236" />
        </g>
        {/* lens */}
        <path transform="translate(253 112)" d="M13 1C13.5743 1 14.2206 1.25544 14.9453 1.91699C15.6756 2.58375 16.4287 3.61477 17.1768 5.02637C18.6718 7.84766 20.049 11.9958 21.2168 17.2061C23.549 27.6111 25 42.0347 25 58C25 73.9653 23.549 88.3889 21.2168 98.7939C20.049 104.004 18.6718 108.152 17.1768 110.974C16.4287 112.385 15.6756 113.416 14.9453 114.083C14.2206 114.745 13.5743 115 13 115C12.4257 115 11.7794 114.745 11.0547 114.083C10.3244 113.416 9.57128 112.385 8.82324 110.974C7.32822 108.152 5.95105 104.004 4.7832 98.7939C2.45104 88.3889 1 73.9653 1 58C1 42.0347 2.45104 27.6111 4.7832 17.2061C5.95105 11.9958 7.32822 7.84766 8.82324 5.02637C9.57128 3.61477 10.3244 2.58375 11.0547 1.91699C11.7794 1.25544 12.4257 1 13 1Z" fill="white" stroke={INK} strokeWidth="2" />
        {/* mount and pier */}
        <rect x="381" y="241" width="118" height="24" fill="#D5C6AE" stroke={INK} strokeWidth="2" />
        <rect x="416" y="267" width="48" height="22" fill="#D5C6AE" stroke={INK} strokeWidth="2" />
        {/* focuser */}
        <g transform="translate(640 134)">
          <rect x="1" y="1" width="58" height="70" fill="#E7DCCB" stroke={INK} strokeWidth="2" />
          <g stroke={LINE} strokeWidth="2" strokeLinecap="round">
            <path d="M15 2V70" />
            <path d="M30 2V70" />
            <path d="M45 2V70" />
          </g>
        </g>
        {/* camera body */}
        <rect x="701" y="117" width="268" height="106" fill="#E7DCCB" stroke={INK} strokeWidth="2" />
        {/* filter plate */}
        <rect x="719.75" y="134.75" width="3.5" height="70.5" fill="#D5C6AE" stroke={INK} strokeWidth="1.5" />
        {/* sensor chip */}
        <rect x="731" y="131" width="214" height="78" rx="3" fill="#F7F2EA" stroke={INK} strokeWidth="2" />
        <rect x="740.75" y="140.75" width="42.5" height="58.5" fill="#3E3A34" stroke={INK} strokeWidth="1.5" />
        <rect x="816.75" y="140.75" width="42.5" height="58.5" fill="#D5C6AE" stroke={INK} strokeWidth="1.5" />
        <rect x="892.75" y="140.75" width="42.5" height="58.5" fill="#D5C6AE" stroke={INK} strokeWidth="1.5" />
        {/* arrows between layers */}
        <g stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M784 170H816" />
          <path d="M812 166L816 170L812 174" />
          <path d="M860 170H892" />
          <path d="M888 166L892 170L888 174" />
        </g>
        {/* leader lines to labels */}
        <g stroke={MUTED} strokeWidth="1.5" strokeLinecap="round">
          <path d="M762 200V240" />
          <path d="M838 200V240" />
          <path d="M914 200V240" />
        </g>
        {/* bracket under the sensor */}
        <g stroke={INK} strokeWidth="1.5" strokeLinecap="round">
          <path d="M740 270H936" />
          <path d="M740 264V270" />
          <path d="M936 264V270" />
        </g>
      </svg>
      <Label x={103} y={104}>Light from a star</Label>
      <Label x={220} y={250}>Telescope</Label>
      <Label x={919} y={92}>Camera</Label>
      <Label x={730} y={244}>Pixel Grid</Label>
      <Label x={807} y={244}>Amplifier</Label>
      <Label x={899} y={244}>ADC</Label>
      <Label x={760} y={276} secondary>Layered Camera Sensor</Label>
    </div>
  );
}
