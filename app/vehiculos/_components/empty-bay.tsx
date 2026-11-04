/**
 * The empty bay at night, lit by a lamp post that flickers. The path data is precomputed: the bay is drawn
 * in one-point perspective and the 404 is the Geist 800 outline projected onto the ground plane, so it
 * lies in the bay. Elements with `missing-vehicle-flicker` dim together when the lamp flickers.
 */

/** Desktop: drawn into its own column, starting where the copy ends; may overflow left under the buttons. */
export function EmptyBayDesktop() {
  return (
    <svg className="missing-vehicle-scene-desktop" viewBox="0 0 700 700" preserveAspectRatio="xMinYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="missing-vehicle-d-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef7b8" stopOpacity=".17" />
          <stop offset="1" stopColor="#eef7b8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="missing-vehicle-d-pool">
          <stop offset="0" stopColor="#eef7b8" stopOpacity=".13" />
          <stop offset=".7" stopColor="#eef7b8" stopOpacity=".04" />
          <stop offset="1" stopColor="#eef7b8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="missing-vehicle-d-bulb">
          <stop offset="0" stopColor="#f3f8c8" stopOpacity=".7" />
          <stop offset="1" stopColor="#f3f8c8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="missing-vehicle-d-fade" gradientUnits="userSpaceOnUse" x1="0" y1="400" x2="0" y2="700">
          <stop offset=".7" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="missing-vehicle-d-m" maskUnits="userSpaceOnUse" x="-700" y="0" width="2100" height="700">
          <rect x="-700" width="2100" height="700" fill="url(#missing-vehicle-d-fade)" />
        </mask>
      </defs>
      <linearGradient id="missing-vehicle-d-cg" gradientUnits="userSpaceOnUse" x1="-260.0" y1="0" x2="690.0" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset=".35" stopColor="#fff" />
        <stop offset=".75" stopColor="#fff" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <mask id="missing-vehicle-d-cgm" maskUnits="userSpaceOnUse" x="-270.0" y="0" width="970.0" height="700">
        <rect x="-270.0" width="970.0" height="700" fill="url(#missing-vehicle-d-cg)" />
      </mask>
      <g mask="url(#missing-vehicle-d-cgm)">
        <path d="M-260.0 384.0L-235.0 384.0L-210.0 384.0L-185.0 384.0L-160.0 384.0L-135.0 384.0L-110.0 384.0L-85.0 384.0L-60.0 384.0L-35.0 384.0L-10.0 384.0L15.0 384.0L40.0 384.0L65.0 384.0L90.0 384.0L115.0 384.0L140.0 384.0L165.0 384.0L190.0 384.0L215.0 384.0L240.0 384.0L265.0 384.0L290.0 384.0L315.0 384.0L340.0 384.0L365.0 384.0L390.0 384.0L415.0 384.0L440.0 384.0L465.0 384.0L490.0 384.0L515.0 384.0L540.0 384.0L565.0 384.0L590.0 384.0L615.0 384.0L640.0 384.0L665.0 384.0L690.0 384.0L690.0 377.6L665.0 377.6L640.0 377.6L615.0 377.6L590.0 377.6L565.0 377.6L540.0 377.6L515.0 377.6L490.0 377.6L465.0 377.6L440.0 377.6L415.0 377.6L390.0 377.6L365.0 377.6L340.0 377.6L315.0 377.6L290.0 377.6L265.0 377.6L240.0 377.6L215.0 377.6L190.0 377.6L165.0 377.6L140.0 377.6L115.0 377.6L90.0 377.6L65.0 377.6L40.0 377.6L15.0 377.6L-10.0 377.6L-35.0 377.6L-60.0 377.6L-85.0 377.6L-110.0 377.6L-135.0 377.6L-160.0 377.6L-185.0 377.6L-210.0 377.6L-235.0 377.6L-260.0 377.6Z" fill="#1a1e1b" />
        <path d="M-260.0 400.0L-235.0 400.0L-210.0 400.0L-185.0 400.0L-160.0 400.0L-135.0 400.0L-110.0 400.0L-85.0 400.0L-60.0 400.0L-35.0 400.0L-10.0 400.0L15.0 400.0L40.0 400.0L65.0 400.0L90.0 400.0L115.0 400.0L140.0 400.0L165.0 400.0L190.0 400.0L215.0 400.0L240.0 400.0L265.0 400.0L290.0 400.0L315.0 400.0L340.0 400.0L365.0 400.0L390.0 400.0L415.0 400.0L440.0 400.0L465.0 400.0L490.0 400.0L515.0 400.0L540.0 400.0L565.0 400.0L590.0 400.0L615.0 400.0L640.0 400.0L665.0 400.0L690.0 400.0L690.0 384.0L665.0 384.0L640.0 384.0L615.0 384.0L590.0 384.0L565.0 384.0L540.0 384.0L515.0 384.0L490.0 384.0L465.0 384.0L440.0 384.0L415.0 384.0L390.0 384.0L365.0 384.0L340.0 384.0L315.0 384.0L290.0 384.0L265.0 384.0L240.0 384.0L215.0 384.0L190.0 384.0L165.0 384.0L140.0 384.0L115.0 384.0L90.0 384.0L65.0 384.0L40.0 384.0L15.0 384.0L-10.0 384.0L-35.0 384.0L-60.0 384.0L-85.0 384.0L-110.0 384.0L-135.0 384.0L-160.0 384.0L-185.0 384.0L-210.0 384.0L-235.0 384.0L-260.0 384.0Z" fill="#121513" />
      </g>
      <g mask="url(#missing-vehicle-d-m)">
        <path d="M536.5 400.0L543.5 400.0L1191.3 982.1L1169.3 982.1Z" fill="#fff" fillOpacity="0.07" />
        <path d="M136.5 400.0L143.5 400.0L-62.5 982.1L-84.4 982.1Z" fill="#fff" fillOpacity="0.26" />
        <path d="M336.5 400.0L343.5 400.0L564.4 982.1L542.5 982.1Z" fill="#fff" fillOpacity="0.26" />
        <path d="M268.3 435.5L267.3 438.0L264.2 440.3L258.8 442.5L251.6 444.3L242.8 445.7L232.9 446.6L222.4 446.9L212.0 446.6L202.2 445.7L193.6 444.3L186.5 442.5L181.4 440.3L178.5 438.0L177.8 435.5L179.4 433.1L183.2 430.8L188.8 428.8L196.1 427.2L204.6 426.0L213.9 425.2L223.6 424.9L233.3 425.2L242.6 426.0L250.9 427.2L258.0 428.8L263.4 430.8L266.9 433.1Z" fill="#050605" fillOpacity=".55" />
        <path d="M148.2 596.7L152.5 574.7L102.1 574.7L108.5 553.8L163.4 496.8L188.4 496.8L180.6 552.7L191.7 552.7L189.2 574.7L177.5 574.7L174.4 596.7ZM133.5 552.7L156.8 552.7L163.0 521.1ZM240.0 599.6L235.3 599.4L230.8 598.7L226.6 597.6L222.6 596.0L218.8 594.1L215.4 591.7L212.2 588.9L209.4 585.8L206.8 582.4L204.7 578.6L202.8 574.6L201.3 570.4L200.0 565.9L199.2 561.2L198.6 556.3L198.4 551.3L198.5 546.2L198.9 540.9L199.5 535.8L200.4 531.0L201.5 526.6L202.8 522.5L204.4 518.7L206.1 515.1L208.1 511.9L210.2 508.9L212.5 506.3L214.9 503.9L217.5 501.9L220.3 500.0L223.2 498.5L226.3 497.2L229.5 496.3L232.8 495.6L236.4 495.1L240.0 495.0L243.7 495.1L247.2 495.6L250.6 496.3L253.8 497.2L256.9 498.5L259.8 500.0L262.5 501.9L265.1 503.9L267.6 506.3L269.8 508.9L271.9 511.9L273.9 515.1L275.6 518.6L277.2 522.5L278.5 526.6L279.6 531.0L280.5 535.8L281.1 540.9L281.5 546.2L281.6 551.3L281.4 556.2L280.8 561.1L279.9 565.7L278.7 570.2L277.2 574.5L275.3 578.5L273.2 582.2L270.7 585.7L267.8 588.8L264.7 591.6L261.2 594.0L257.5 596.0L253.5 597.6L249.3 598.7L244.8 599.4L240.0 599.6ZM240.0 575.2L243.0 574.9L245.6 574.1L248.0 572.9L250.2 571.1L252.1 568.9L253.7 566.1L255.0 563.0L256.1 559.4L256.8 555.3L257.3 550.9L257.5 546.1L257.4 540.9L257.2 537.5L256.9 534.3L256.5 531.4L256.0 528.7L255.4 526.2L254.8 523.9L254.0 521.9L253.2 520.0L252.2 518.3L251.2 516.8L250.1 515.5L249.0 514.4L247.7 513.5L246.3 512.7L244.9 512.1L243.4 511.7L241.8 511.4L240.0 511.3L238.3 511.4L236.7 511.7L235.2 512.1L233.7 512.7L232.4 513.5L231.1 514.4L229.9 515.5L228.8 516.8L227.8 518.3L226.8 520.0L226.0 521.9L225.2 523.9L224.6 526.2L224.0 528.7L223.5 531.4L223.1 534.3L222.8 537.5L222.6 540.9L222.5 546.1L222.7 550.9L223.2 555.3L223.9 559.4L225.0 563.0L226.3 566.1L227.9 568.9L229.8 571.1L232.0 572.9L234.4 574.1L237.1 574.9L240.0 575.2ZM343.2 596.7L338.3 574.7L287.9 574.7L285.7 553.8L316.9 496.8L341.9 496.8L357.3 552.7L368.4 552.7L375.1 574.7L363.3 574.7L369.4 596.7ZM310.2 552.7L333.5 552.7L326.5 521.1Z" fill="#dcff00" fillOpacity=".06" fillRule="nonzero" stroke="#dcff00" strokeWidth="1.8" strokeLinejoin="round" />
        <g className="missing-vehicle-flicker">
          <path d="M466.0 525.0L478.8 557.9L480.2 594.7L467.0 633.5L436.5 671.2L388.1 703.4L324.2 725.5L251.1 733.3L177.8 725.5L113.1 703.4L63.5 671.2L31.6 633.5L16.9 594.7L17.0 557.9L28.5 525.0L48.7 496.7L74.8 473.4L105.2 454.8L138.2 440.8L173.1 430.9L209.0 425.2L245.4 423.3L281.9 425.2L318.0 430.9L353.2 440.8L386.8 454.8L417.9 473.4L444.9 496.7Z" fill="url(#missing-vehicle-d-pool)" />
          <path d="M316 130H344L566.3 565.0H-100.7Z" fill="url(#missing-vehicle-d-cone)" />
        </g>
      </g>
      <path d="M189.1 405.1L290.9 405.1L292.0 411.2L188.0 411.2Z" fill="#2a302c" />
      <path d="M500 628V146Q500 124 478 124H352" fill="none" stroke="#2b312d" strokeWidth="6" strokeLinecap="round" />
      <path d="M490.4 640H509.6V622H490.4Z" fill="#2b312d" />
      <path d="M306 120H354L348 130H312Z" fill="#1f2420" />
      <g className="missing-vehicle-flicker">
        <ellipse cx="330" cy="132" rx="34" ry="20" fill="url(#missing-vehicle-d-bulb)" />
        <rect x="314" y="129" width="32" height="4" rx="2" fill="#f3f8c8" />
      </g>
    </svg>
  );
}

/** Mobile: the scene sits at the top of the card, above the copy. */
export function EmptyBayMobile() {
  return (
    <svg className="missing-vehicle-scene-mobile" viewBox="0 0 400 800" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <defs>
        <linearGradient id="missing-vehicle-m-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef7b8" stopOpacity=".17" />
          <stop offset="1" stopColor="#eef7b8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="missing-vehicle-m-pool">
          <stop offset="0" stopColor="#eef7b8" stopOpacity=".13" />
          <stop offset=".7" stopColor="#eef7b8" stopOpacity=".04" />
          <stop offset="1" stopColor="#eef7b8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="missing-vehicle-m-bulb">
          <stop offset="0" stopColor="#f3f8c8" stopOpacity=".7" />
          <stop offset="1" stopColor="#f3f8c8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="missing-vehicle-m-fade" gradientUnits="userSpaceOnUse" x1="0" y1="150" x2="0" y2="300">
          <stop offset=".7" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="missing-vehicle-m-m" maskUnits="userSpaceOnUse" x="-400" y="0" width="1200" height="320">
          <rect x="-400" width="1200" height="320" fill="url(#missing-vehicle-m-fade)" />
        </mask>
      </defs>
      <linearGradient id="missing-vehicle-m-cg" gradientUnits="userSpaceOnUse" x1="-2.0" y1="0" x2="414.0" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset=".35" stopColor="#fff" />
        <stop offset=".75" stopColor="#fff" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <mask id="missing-vehicle-m-cgm" maskUnits="userSpaceOnUse" x="-12.0" y="0" width="436.0" height="320">
        <rect x="-12.0" width="436.0" height="320" fill="url(#missing-vehicle-m-cg)" />
      </mask>
      <g mask="url(#missing-vehicle-m-cgm)">
        <path d="M-2.0 140.0L14.0 140.0L30.0 140.0L46.0 140.0L62.0 140.0L78.0 140.0L94.0 140.0L110.0 140.0L126.0 140.0L142.0 140.0L158.0 140.0L174.0 140.0L190.0 140.0L206.0 140.0L222.0 140.0L238.0 140.0L254.0 140.0L270.0 140.0L286.0 140.0L302.0 140.0L318.0 140.0L334.0 140.0L350.0 140.0L366.0 140.0L382.0 140.0L398.0 140.0L414.0 140.0L414.0 136.0L398.0 136.0L382.0 136.0L366.0 136.0L350.0 136.0L334.0 136.0L318.0 136.0L302.0 136.0L286.0 136.0L270.0 136.0L254.0 136.0L238.0 136.0L222.0 136.0L206.0 136.0L190.0 136.0L174.0 136.0L158.0 136.0L142.0 136.0L126.0 136.0L110.0 136.0L94.0 136.0L78.0 136.0L62.0 136.0L46.0 136.0L30.0 136.0L14.0 136.0L-2.0 136.0Z" fill="#1a1e1b" />
        <path d="M-2.0 150.0L14.0 150.0L30.0 150.0L46.0 150.0L62.0 150.0L78.0 150.0L94.0 150.0L110.0 150.0L126.0 150.0L142.0 150.0L158.0 150.0L174.0 150.0L190.0 150.0L206.0 150.0L222.0 150.0L238.0 150.0L254.0 150.0L270.0 150.0L286.0 150.0L302.0 150.0L318.0 150.0L334.0 150.0L350.0 150.0L366.0 150.0L382.0 150.0L398.0 150.0L414.0 150.0L414.0 140.0L398.0 140.0L382.0 140.0L366.0 140.0L350.0 140.0L334.0 140.0L318.0 140.0L302.0 140.0L286.0 140.0L270.0 140.0L254.0 140.0L238.0 140.0L222.0 140.0L206.0 140.0L190.0 140.0L174.0 140.0L158.0 140.0L142.0 140.0L126.0 140.0L110.0 140.0L94.0 140.0L78.0 140.0L62.0 140.0L46.0 140.0L30.0 140.0L14.0 140.0L-2.0 140.0Z" fill="#121513" />
      </g>
      <g mask="url(#missing-vehicle-m-m)">
        <path d="M379.8 150.0L384.2 150.0L850.0 452.9L834.8 452.9Z" fill="#fff" fillOpacity="0.07" />
        <path d="M123.8 150.0L128.2 150.0L-19.9 452.9L-35.1 452.9Z" fill="#fff" fillOpacity="0.26" />
        <path d="M251.8 150.0L256.2 150.0L415.1 452.9L399.9 452.9Z" fill="#fff" fillOpacity="0.26" />
        <path d="M208.2 167.1L207.6 168.3L205.5 169.5L202.1 170.5L197.4 171.4L191.8 172.1L185.4 172.5L178.7 172.6L172.0 172.5L165.7 172.1L160.1 171.4L155.6 170.5L152.3 169.5L150.4 168.3L150.0 167.1L151.1 166.0L153.5 164.9L157.1 163.9L161.8 163.1L167.2 162.5L173.2 162.1L179.5 162.0L185.7 162.1L191.7 162.5L197.0 163.1L201.6 163.9L205.0 164.9L207.3 166.0Z" fill="#050605" fillOpacity=".55" />
        <path d="M129.6 247.0L132.6 235.9L99.6 235.9L104.1 225.4L140.3 197.1L156.5 197.1L151.2 224.8L158.5 224.8L156.7 235.9L149.0 235.9L146.9 247.0ZM120.4 224.8L135.6 224.8L139.9 209.1ZM190.0 248.4L186.9 248.3L184.0 248.0L181.2 247.4L178.5 246.6L176.1 245.6L173.8 244.4L171.7 243.0L169.9 241.4L168.3 239.7L166.8 237.8L165.6 235.8L164.6 233.7L163.8 231.4L163.3 229.1L163.0 226.6L162.8 224.1L162.9 221.6L163.2 218.9L163.6 216.4L164.2 214.0L164.9 211.8L165.8 209.8L166.8 207.9L168.0 206.1L169.3 204.5L170.6 203.1L172.1 201.8L173.7 200.6L175.4 199.6L177.2 198.7L179.1 197.9L181.1 197.3L183.2 196.8L185.4 196.5L187.6 196.3L190.0 196.2L192.4 196.3L194.7 196.5L196.9 196.8L198.9 197.3L200.9 197.9L202.8 198.7L204.6 199.6L206.3 200.6L207.9 201.8L209.4 203.1L210.7 204.5L212.0 206.1L213.2 207.9L214.2 209.8L215.1 211.8L215.8 214.0L216.4 216.4L216.8 218.9L217.1 221.5L217.2 224.1L217.0 226.6L216.7 229.0L216.1 231.3L215.4 233.6L214.4 235.8L213.2 237.8L211.8 239.7L210.1 241.4L208.3 243.0L206.2 244.4L204.0 245.6L201.5 246.6L198.9 247.4L196.1 248.0L193.1 248.3L190.0 248.4ZM190.0 236.1L191.9 236.0L193.7 235.6L195.3 234.9L196.7 234.0L197.9 232.9L199.0 231.6L199.8 230.0L200.5 228.1L201.0 226.1L201.3 223.9L201.4 221.5L201.3 218.9L201.2 217.2L201.0 215.7L200.7 214.2L200.4 212.8L200.0 211.6L199.6 210.5L199.1 209.5L198.6 208.5L198.0 207.7L197.3 207.0L196.6 206.3L195.8 205.8L195.0 205.3L194.1 204.9L193.2 204.6L192.2 204.4L191.1 204.3L190.0 204.2L188.9 204.3L187.9 204.4L186.9 204.6L185.9 204.9L185.0 205.3L184.2 205.8L183.4 206.3L182.7 207.0L182.1 207.7L181.4 208.5L180.9 209.5L180.4 210.5L180.0 211.6L179.6 212.8L179.3 214.2L179.0 215.7L178.8 217.2L178.7 218.9L178.6 221.5L178.7 223.9L179.0 226.1L179.5 228.1L180.2 230.0L181.0 231.6L182.1 232.9L183.3 234.0L184.8 234.9L186.3 235.6L188.1 236.0L190.0 236.1ZM257.8 247.0L254.4 235.9L221.4 235.9L219.9 225.4L239.9 197.1L256.0 197.1L266.6 224.8L273.9 224.8L278.5 235.9L270.8 235.9L275.1 247.0ZM235.9 224.8L251.1 224.8L246.3 209.1Z" fill="#dcff00" fillOpacity=".06" fillRule="nonzero" stroke="#dcff00" strokeWidth="1.8" strokeLinejoin="round" />
        <g className="missing-vehicle-flicker">
          <path d="M337.1 211.0L346.1 227.4L347.8 246.0L339.9 265.7L320.5 285.0L288.8 301.8L246.3 313.3L197.4 317.4L148.4 313.3L105.3 301.8L72.8 285.0L52.3 265.7L43.4 246.0L44.2 227.4L52.4 211.0L65.9 197.0L83.3 185.6L103.1 176.5L124.5 169.7L147.0 164.9L170.1 162.1L193.5 161.2L216.9 162.1L240.1 164.9L262.9 169.7L284.7 176.5L305.0 185.6L322.8 197.0Z" fill="url(#missing-vehicle-m-pool)" />
          <path d="M234 44H262L341 251H35.1Z" fill="url(#missing-vehicle-m-cone)" />
        </g>
      </g>
      <path d="M157.4 152.4L222.6 152.4L223.4 155.4L156.6 155.4Z" fill="#2a302c" />
      <path d="M352 272V60Q352 38 330 38H270" fill="none" stroke="#2b312d" strokeWidth="4" strokeLinecap="round" />
      <path d="M345.6 280H358.4V268H345.6Z" fill="#2b312d" />
      <path d="M224 34H272L266 44H230Z" fill="#1f2420" />
      <g className="missing-vehicle-flicker">
        <ellipse cx="248" cy="46" rx="24" ry="14" fill="url(#missing-vehicle-m-bulb)" />
        <rect x="232" y="43" width="32" height="4" rx="2" fill="#f3f8c8" />
      </g>
    </svg>
  );
}
