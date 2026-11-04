/**
 * The empty bay seen from above, at night: the row of bays, the painted 404, the traces of the car that
 * is gone, and a lamp whose pool of light flickers. From above the bulb is hidden, so the light only shows
 * on the ground. Elements with `missing-vehicle-flicker` dim together.
 */

/** Desktop: covers the whole card behind the copy; the empty bay stays on the right. */
export function EmptyBayDesktop() {
  return (
    <svg
      className="missing-vehicle-scene-desktop"
      viewBox="280 20 1120 608"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="missing-vehicle-d-pool">
          <stop offset="0" stopColor="#eef7b8" stopOpacity=".22" />
          <stop offset=".55" stopColor="#eef7b8" stopOpacity=".08" />
          <stop offset="1" stopColor="#eef7b8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="missing-vehicle-d-left" gradientUnits="userSpaceOnUse" x1="120" y1="0" x2="840" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".15" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <mask id="missing-vehicle-d-lm" maskUnits="userSpaceOnUse" x="0" y="0" width="1400" height="760">
          <rect width="1400" height="760" fill="url(#missing-vehicle-d-left)" />
        </mask>
      </defs>
      <g mask="url(#missing-vehicle-d-lm)">
        <rect width="1400" height="70" fill="#0f1210" />
        <rect y="62" width="1400" height="8" fill="#1a1e1b" />
        <path
          d="M720 70V520M480 70V520M240 70V520M0 70V520M-240 70V520M1440 70V520"
          stroke="rgba(255,255,255,.1)"
          strokeWidth="5"
        />
        <path d="M0 610H1400" stroke="rgba(255,255,255,.12)" strokeWidth="4" strokeDasharray="36 28" />
        <rect y="682" width="1400" height="8" fill="#141816" />
        <path
          d="M960 690V760M720 690V760M480 690V760M240 690V760M0 690V760M-240 690V760M1200 690V760M1440 690V760"
          stroke="rgba(255,255,255,.08)"
          strokeWidth="5"
        />
      </g>
      <path d="M960 70V520M1200 70V520" stroke="rgba(255,255,255,.26)" strokeWidth="5" />
      <rect x="998.6" y="110" width="14" height="380" rx="7" fill="#050605" fillOpacity=".35" />
      <rect x="1147.4" y="110" width="14" height="380" rx="7" fill="#050605" fillOpacity=".35" />
      <ellipse cx="1065.6" cy="205.0" rx="40.800000000000004" ry="16.8" fill="#050605" fillOpacity=".6" />
      <circle className="missing-vehicle-flicker" cx="1080" cy="330" r="330" fill="url(#missing-vehicle-d-pool)" />
      <rect x="1020.0" y="86" width="120" height="12" rx="4" fill="#232825" />
      <path
        d="M1019.2 405.4L1019.2 392.5L984.2 392.5L984.2 379.1L1015.6 334.6L1036.6 334.6L1036.6 378.3L1044.7 378.3L1044.7 392.5L1036.6 392.5L1036.6 405.4ZM1002.2 378.3L1019.2 378.3L1019.2 355.1ZM1080.0 407.0L1076.9 406.9L1074.0 406.5L1071.1 405.9L1068.4 405.1L1065.9 404.0L1063.5 402.6L1061.3 401.0L1059.2 399.2L1057.4 397.2L1055.7 394.9L1054.2 392.5L1052.8 389.8L1051.7 387.0L1050.8 384.0L1050.0 380.8L1049.5 377.4L1049.2 373.8L1049.1 370.1L1049.2 366.4L1049.5 362.8L1050.0 359.4L1050.8 356.2L1051.7 353.2L1052.9 350.3L1054.2 347.6L1055.7 345.2L1057.4 342.9L1059.3 340.9L1061.3 339.1L1063.6 337.5L1065.9 336.1L1068.5 335.0L1071.1 334.1L1074.0 333.5L1076.9 333.1L1080.0 333.0L1083.1 333.1L1086.1 333.5L1088.9 334.1L1091.6 335.0L1094.1 336.1L1096.5 337.5L1098.7 339.1L1100.7 340.9L1102.6 342.9L1104.3 345.2L1105.8 347.6L1107.1 350.3L1108.3 353.2L1109.2 356.2L1110.0 359.4L1110.5 362.8L1110.8 366.4L1110.9 370.1L1110.8 373.8L1110.5 377.3L1110.0 380.7L1109.2 383.9L1108.3 386.9L1107.2 389.8L1105.8 392.4L1104.3 394.9L1102.7 397.1L1100.8 399.1L1098.7 400.9L1096.5 402.6L1094.1 403.9L1091.6 405.0L1088.9 405.9L1086.1 406.5L1083.1 406.9L1080.0 407.0ZM1080.0 392.8L1082.1 392.7L1083.9 392.2L1085.6 391.4L1087.1 390.3L1088.5 388.9L1089.7 387.2L1090.7 385.1L1091.6 382.8L1092.2 380.1L1092.7 377.1L1093.0 373.8L1093.1 370.1L1093.0 367.6L1092.9 365.3L1092.7 363.1L1092.4 361.0L1092.0 359.1L1091.6 357.3L1091.0 355.7L1090.4 354.2L1089.7 352.9L1089.0 351.7L1088.1 350.6L1087.2 349.7L1086.2 348.9L1085.1 348.3L1084.0 347.8L1082.7 347.5L1081.4 347.2L1080.0 347.2L1078.6 347.2L1077.3 347.5L1076.1 347.8L1074.9 348.3L1073.9 348.9L1072.9 349.7L1071.9 350.6L1071.1 351.7L1070.3 352.9L1069.6 354.2L1069.0 355.7L1068.4 357.3L1068.0 359.1L1067.6 361.0L1067.3 363.1L1067.1 365.3L1067.0 367.6L1066.9 370.1L1067.0 373.8L1067.3 377.1L1067.8 380.1L1068.4 382.8L1069.3 385.1L1070.3 387.2L1071.5 388.9L1072.9 390.3L1074.4 391.4L1076.1 392.2L1078.0 392.7L1080.0 392.8ZM1148.3 405.4L1148.3 392.5L1113.3 392.5L1113.3 379.1L1144.7 334.6L1165.7 334.6L1165.7 378.3L1173.8 378.3L1173.8 392.5L1165.7 392.5L1165.7 405.4ZM1131.3 378.3L1148.3 378.3L1148.3 355.1Z"
        fill="#dcff00"
        fillOpacity=".06"
        stroke="#dcff00"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M1248 245L1080 245" stroke="#2b312d" strokeWidth="6" strokeLinecap="round" />
      <circle cx="1248" cy="245" r="11" fill="#1c201d" stroke="#2b312d" strokeWidth="3" />
      <rect x="1044" y="231" width="72" height="28" rx="10" fill="#1f2420" stroke="#2b312d" strokeWidth="2" />
      <path d="M1058 245H1102" stroke="#2b312d" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Mobile: the bay sits at the top of the card, above the copy. */
export function EmptyBayMobile() {
  return (
    <svg
      className="missing-vehicle-scene-mobile"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="missing-vehicle-m-pool">
          <stop offset="0" stopColor="#eef7b8" stopOpacity=".22" />
          <stop offset=".55" stopColor="#eef7b8" stopOpacity=".08" />
          <stop offset="1" stopColor="#eef7b8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="missing-vehicle-m-down" gradientUnits="userSpaceOnUse" x1="0" y1="30" x2="0" y2="310">
          <stop offset=".7" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="missing-vehicle-m-dm" maskUnits="userSpaceOnUse" x="-400" y="0" width="1200" height="310">
          <rect x="-400" width="1200" height="310" fill="url(#missing-vehicle-m-down)" />
        </mask>
        <linearGradient id="missing-vehicle-m-side" gradientUnits="userSpaceOnUse" x1="-362.5" y1="0" x2="600.0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".35" stopColor="#fff" />
          <stop offset=".75" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="missing-vehicle-m-sm" maskUnits="userSpaceOnUse" x="-400" y="0" width="1200" height="310">
          <rect x="-400" width="1200" height="310" fill="url(#missing-vehicle-m-side)" />
        </mask>
      </defs>
      <g mask="url(#missing-vehicle-m-sm)">
        <rect x="-362.5" width="962.5" height="30" fill="#0f1210" />
        <rect x="-362.5" y="23.2" width="962.5" height="6.8" fill="#1a1e1b" />
        <g mask="url(#missing-vehicle-m-dm)">
          <path d="M-175 30V300M575 30V300" stroke="rgba(255,255,255,.09)" strokeWidth="4.25" />
          <path d="M75 30V300M325 30V300" stroke="rgba(255,255,255,.26)" strokeWidth="4.25" />
          <rect x="116.55" y="64.0" width="11.9" height="210.5" rx="5.95" fill="#050605" fillOpacity=".35" />
          <rect x="271.55" y="64.0" width="11.9" height="210.5" rx="5.95" fill="#050605" fillOpacity=".35" />
          <ellipse cx="185.0" cy="111.0" rx="42.5" ry="17.5" fill="#050605" fillOpacity=".6" />
          <path
            d="M-362.5 304.5H600.0"
            stroke="rgba(255,255,255,.12)"
            strokeWidth="3.4"
            strokeDasharray="30.599999999999998 23.8"
          />
          <circle className="missing-vehicle-flicker" cx="200" cy="190" r="200" fill="url(#missing-vehicle-m-pool)" />
        </g>
      </g>
      <rect x="137.5" y="43.6" width="125" height="10.2" rx="4" fill="#232825" />
      <path
        d="M139.2 240.4L139.2 227.5L104.2 227.5L104.2 214.1L135.6 169.6L156.6 169.6L156.6 213.3L164.7 213.3L164.7 227.5L156.6 227.5L156.6 240.4ZM122.2 213.3L139.2 213.3L139.2 190.1ZM200.0 242.0L196.9 241.9L194.0 241.5L191.1 240.9L188.4 240.1L185.9 239.0L183.5 237.6L181.3 236.0L179.2 234.2L177.4 232.2L175.7 229.9L174.2 227.5L172.8 224.8L171.7 222.0L170.8 219.0L170.0 215.8L169.5 212.4L169.2 208.8L169.1 205.1L169.2 201.4L169.5 197.8L170.0 194.4L170.8 191.2L171.7 188.2L172.9 185.3L174.2 182.6L175.7 180.2L177.4 177.9L179.3 175.9L181.3 174.1L183.6 172.5L185.9 171.1L188.5 170.0L191.1 169.1L194.0 168.5L196.9 168.1L200.0 168.0L203.1 168.1L206.1 168.5L208.9 169.1L211.6 170.0L214.1 171.1L216.5 172.5L218.7 174.1L220.7 175.9L222.6 177.9L224.3 180.2L225.8 182.6L227.1 185.3L228.3 188.2L229.2 191.2L230.0 194.4L230.5 197.8L230.8 201.4L230.9 205.1L230.8 208.8L230.5 212.3L230.0 215.7L229.2 218.9L228.3 221.9L227.2 224.8L225.8 227.4L224.3 229.9L222.7 232.1L220.8 234.1L218.7 235.9L216.5 237.6L214.1 238.9L211.6 240.0L208.9 240.9L206.1 241.5L203.1 241.9L200.0 242.0ZM200.0 227.8L202.1 227.7L203.9 227.2L205.6 226.4L207.1 225.3L208.5 223.9L209.7 222.2L210.7 220.1L211.6 217.8L212.2 215.1L212.7 212.1L213.0 208.8L213.1 205.1L213.0 202.6L212.9 200.3L212.7 198.1L212.4 196.0L212.0 194.1L211.6 192.3L211.0 190.7L210.4 189.2L209.7 187.9L209.0 186.7L208.1 185.6L207.2 184.7L206.2 183.9L205.1 183.3L204.0 182.8L202.7 182.5L201.4 182.2L200.0 182.2L198.6 182.2L197.3 182.5L196.1 182.8L194.9 183.3L193.9 183.9L192.9 184.7L191.9 185.6L191.1 186.7L190.3 187.9L189.6 189.2L189.0 190.7L188.4 192.3L188.0 194.1L187.6 196.0L187.3 198.1L187.1 200.3L187.0 202.6L186.9 205.1L187.0 208.8L187.3 212.1L187.8 215.1L188.4 217.8L189.3 220.1L190.3 222.2L191.5 223.9L192.9 225.3L194.4 226.4L196.1 227.2L198.0 227.7L200.0 227.8ZM268.3 240.4L268.3 227.5L233.3 227.5L233.3 214.1L264.7 169.6L285.7 169.6L285.7 213.3L293.8 213.3L293.8 227.5L285.7 227.5L285.7 240.4ZM251.3 213.3L268.3 213.3L268.3 190.1Z"
        fill="#dcff00"
        fillOpacity=".06"
        stroke="#dcff00"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M362 112L200 112" stroke="#2b312d" strokeWidth="5.1" strokeLinecap="round" />
      <circle cx="362" cy="112" r="9.35" fill="#1c201d" stroke="#2b312d" strokeWidth="3" />
      <rect
        x="169.4"
        y="100.1"
        width="61.199999999999996"
        height="23.8"
        rx="8.5"
        fill="#1f2420"
        stroke="#2b312d"
        strokeWidth="2"
      />
      <path d="M181.3 112H218.7" stroke="#2b312d" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
