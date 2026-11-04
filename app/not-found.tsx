import { ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import './not-found.css';

// Next.js keeps the 404 status and injects noindex; the page claims no canonical URL. Robots is set here
// too, so production mode doesn't also inherit the layout's "index, follow".
export const metadata: Metadata = {
  title: "Página no encontrada | Gonba's Garage",
  robots: { index: false, follow: true },
};

const DESKTOP_STREETS =
  'M118 300V700M0 420H380M0 250H1400M1040 250V150M700 0V700M1250 0V700M0 610H1400M700 120H1400M200 0V250';
const DESKTOP_AVENUES = 'M380 0V700M0 500H1400';
const MOBILE_STREETS = 'M50 640V800M0 680H120M0 160H400M300 160V95M260 160V800M0 420H120M340 0V160';
const MOBILE_AVENUES = 'M120 0V800M0 745H400';

function Roads({ streets, avenues }: { streets: string; avenues: string }) {
  return (
    <>
      <path className="route-missing-street" d={streets} />
      <path className="route-missing-avenue-edge" d={avenues} />
      <path className="route-missing-avenue" d={avenues} />
    </>
  );
}

/** The route as a navigation app draws it: a soft glow, a dark casing and the lime line. */
function Route({ d, mask }: { d: string; mask?: string }) {
  return (
    <g mask={mask}>
      <path className="route-missing-route route-missing-route-glow" pathLength={1} d={d} />
      <path className="route-missing-route route-missing-route-casing" pathLength={1} d={d} />
      <path className="route-missing-route route-missing-route-line" pathLength={1} d={d} />
    </g>
  );
}

/** The "you are here" marker: a pulse, a light ring and a lime dot with a heading arrow. */
function Position({ x, y }: { x: number; y: number }) {
  return (
    <>
      <circle className="route-missing-pulse" cx={x} cy={y} r="18" />
      <circle cx={x} cy={y} r="12.5" fill="#e9ebe4" />
      <circle cx={x} cy={y} r="10" fill="var(--accent)" />
      <path d={`M${x} ${y - 5.5}L${x + 4.4} ${y + 4.4}L${x} ${y + 1.65}L${x - 4.4} ${y + 4.4}Z`} fill="#0b0d0c" />
    </>
  );
}

/** The cul-de-sac, its road sign and a map tag. `tagX` is the tag's left edge. */
function DeadEnd({ x, y, tagX }: { x: number; y: number; tagX: number }) {
  return (
    <>
      <circle className="route-missing-cul-de-sac" cx={x} cy={y} r="11.7" />
      <g className="route-missing-late">
        <rect x={x - 11} y={y - 11} width="22" height="22" rx="4" fill="#d7dad2" />
        <path
          d={`M${x} ${y + 6.6}V${y - 2.2}M${x - 6} ${y - 4.95}H${x + 6}`}
          stroke="#0b0d0c"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <rect x={tagX} y={y - 11} width="122" height="22" rx="11" fill="#0f1210" stroke="rgba(255,255,255,.1)" />
        <text className="route-missing-tag" x={tagX + 61} y={y + 4} textAnchor="middle">
          <tspan fill="#8a8f86">404 · </tspan>
          <tspan fill="var(--accent)">Sin salida</tspan>
        </text>
      </g>
    </>
  );
}

/**
 * A navigation map where the route ends in a dead end. The two streets that do lead somewhere carry
 * the names of the buttons. On mobile the route passes behind the copy the same way it does on desktop.
 */
function StreetMap() {
  return (
    <>
      <svg
        className="route-missing-map-desktop"
        viewBox="0 0 1400 700"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <Roads streets={DESKTOP_STREETS} avenues={DESKTOP_AVENUES} />
        <text className="route-missing-road-name" x="396" y="660" transform="rotate(-90 396 660)">
          Av. Vehículos
        </text>
        <text className="route-missing-road-name" x="1300" y="486" textAnchor="end">
          Calle Inicio
        </text>
        <Route d="M118 575V420H380V250H1040V150" />
        <DeadEnd x={1040} y={150} tagX={1064} />
        <Position x={118} y={575} />
      </svg>
      <svg
        className="route-missing-map-mobile"
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          {/* Fades the route out behind the copy: below the eyebrow and above the buttons on common phones */}
          <linearGradient id="route-missing-fade-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="800">
            <stop offset="0.21" stopColor="#fff" />
            <stop offset="0.256" stopColor="#000" />
            <stop offset="0.765" stopColor="#000" />
            <stop offset="0.845" stopColor="#fff" />
          </linearGradient>
          <mask id="route-missing-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="800">
            <rect width="400" height="800" fill="url(#route-missing-fade-gradient)" />
          </mask>
        </defs>
        <Roads streets={MOBILE_STREETS} avenues={MOBILE_AVENUES} />
        <text className="route-missing-road-name" x="136" y="790" transform="rotate(-90 136 790)">
          Av. Vehículos
        </text>
        <text className="route-missing-road-name" x="388" y="731" textAnchor="end">
          Calle Inicio
        </text>
        <Route d="M50 712V680H120V160H300V95" mask="url(#route-missing-fade)" />
        <DeadEnd x={300} y={95} tagX={160} />
        <Position x={50} y={712} />
      </svg>
    </>
  );
}

/** Rendered for every unmatched URL and for notFound() calls without a closer not-found file. */
export default function NotFound() {
  return (
    <main className="route-missing-page" id="route-missing-top">
      <div className="route-missing-screen">
        <SiteHeader />
        <section className="section-shell route-missing" aria-labelledby="route-missing-title">
          <StreetMap />
          <div className="route-missing-copy">
            <Eyebrow>Error 404 · Página no encontrada</Eyebrow>
            <h1 id="route-missing-title">Ruta no encontrada.</h1>
            <p>La página que buscás no existe o cambió de lugar. Te dejamos dos caminos que sí llegan.</p>
            <div className="status-actions">
              <ButtonLink href="/vehiculos">
                Ver vehículos <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
              </ButtonLink>
              <ButtonLink href="/" variant="glass">
                Ir al inicio
              </ButtonLink>
            </div>
          </div>
        </section>
      </div>
      <SiteFooter topHref="#route-missing-top" />
    </main>
  );
}
