import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpRight, Plus } from 'lucide-react';

import { ButtonAnchor, ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';

const vehicles = [
  {
    name: 'BMW 330i M Sport',
    year: '2021',
    detail: 'Automático · Nafta · 48.000 km',
    slug: 'bmw-330i-m-sport-2021',
    image: '/showroom-car.jpg',
    alt: 'Auto deportivo negro exhibido en un showroom',
  },
  {
    name: 'Mercedes-Benz 190 SL',
    year: '1962',
    detail: 'Restaurado · Colección · Consultar',
    slug: 'mercedes-benz-190sl-1962',
    image: '/featured-classic.jpg',
    alt: 'Auto clásico rojo en un garage',
  },
  {
    name: 'Porsche 356 B',
    year: '1961',
    detail: 'Revisado · Documentación verificada',
    slug: 'porsche-356-b-1961',
    image: '/garage-classic.jpg',
    alt: 'Auto clásico junto a un garage',
  },
];

const Arrow = () => <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />;

export default function Home() {
  return (
    <main id="inicio">
      <header className="site-header">
        <a className="wordmark" href="#inicio" aria-label="Gonba Garage, inicio">
          GONBA <span>GARAGE</span>
        </a>
        <nav className="main-nav" aria-label="Navegación principal">
          <Link href="/vehiculos">Vehículos</Link>
          <Link href="/vender">Vendé tu auto</Link>
          <a href="#servicios">Servicios</a>
          <a href="#nosotros">Nosotros</a>
          <a href="#preguntas">Preguntas</a>
        </nav>
        <a className="header-cta" href="#contacto">Contactar <Arrow /></a>
      </header>

      <section className="hero section-shell" aria-labelledby="hero-title">
        <div className="hero-media" aria-hidden="true">
          <Image src="/showroom-car.jpg" alt="" fill loading="eager" sizes="100vw" className="cover-image" />
        </div>
        <div className="hero-overlay" />
        <div className="hero-content">
          <Eyebrow>Autos usados seleccionados</Eyebrow>
          <h1 id="hero-title">Encontrá un auto que valga la pena manejar.</h1>
          <p className="hero-intro">
            Seleccionamos, revisamos y presentamos cada vehículo con la información que necesitás
            para elegir con confianza.
          </p>
          <div className="hero-actions">
            <ButtonAnchor href="#vehiculos">Ver vehículos <Arrow /></ButtonAnchor>
            <ButtonLink href="/vender" variant="glass">Quiero vender mi auto</ButtonLink>
          </div>
        </div>
        <aside className="hero-facts glass-panel" aria-label="Información destacada">
          <div><strong>01</strong><span>Selección cuidadosa</span></div>
          <div><strong>02</strong><span>Información transparente</span></div>
          <div><strong>03</strong><span>Atención directa</span></div>
        </aside>
        <a className="scroll-cue" href="#vehiculos">Explorar <ArrowDown aria-hidden="true" size={16} strokeWidth={1.8} /></a>
      </section>

      <section className="section-shell inventory-section" id="vehiculos" aria-labelledby="inventory-title">
        <div className="section-heading">
          <div>
            <Eyebrow>Inventario</Eyebrow>
            <h2 id="inventory-title">Elegidos por una razón.</h2>
          </div>
          <div className="section-heading-copy">
            <p>Una selección corta y cuidada. Menos tiempo buscando, más claridad para decidir.</p>
            <Link className="text-link" href="/vehiculos">Ver inventario completo <Arrow /></Link>
          </div>
        </div>
        <div className="vehicle-grid">
          {vehicles.map((vehicle, index) => (
            <Link className="vehicle-card-link" href={`/vehiculos/${vehicle.slug}`} key={vehicle.name}>
              <article className="vehicle-card glass-panel">
                <div className="vehicle-image">
                  <Image src={vehicle.image} alt={vehicle.alt} fill sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" className="cover-image" />
                  <span className="vehicle-index">0{index + 1}</span>
                  {index === 0 && <span className="vehicle-status">Disponible</span>}
                </div>
                <div className="vehicle-copy">
                  <div><p>{vehicle.year}</p><h3>{vehicle.name}</h3></div>
                  <span className="vehicle-arrow"><Arrow /></span>
                </div>
                <p className="vehicle-detail">{vehicle.detail}</p>
              </article>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-shell sell-section" id="vender" aria-labelledby="sell-title">
        <div className="sell-media">
          <Image src="/garage-classic.jpg" alt="Auto estacionado frente a un garage" fill sizes="(max-width: 900px) 100vw, 50vw" className="cover-image" />
        </div>
        <div className="sell-content glass-panel">
          <Eyebrow>Vendé tu auto</Eyebrow>
          <h2 id="sell-title">Una operación simple, clara y sin vueltas.</h2>
          <p>Contanos qué auto tenés. Lo evaluamos, coordinamos una revisión y te presentamos una propuesta transparente.</p>
          <ol className="process-list">
            <li><span>01</span> Compartís los datos del vehículo</li>
            <li><span>02</span> Coordinamos la evaluación</li>
            <li><span>03</span> Recibís una propuesta</li>
          </ol>
          <ButtonLink href="/vender">Solicitar una tasación <Arrow /></ButtonLink>
        </div>
      </section>

      <section className="section-shell services-section" id="servicios" aria-labelledby="services-title">
        <div className="section-heading compact-heading">
          <div><Eyebrow>Otros servicios</Eyebrow><h2 id="services-title">Todo lo importante, en un solo lugar.</h2></div>
        </div>
        <div className="services-grid">
          <article className="service-card glass-panel"><span className="service-number">01</span><div><h3>Financiación</h3><p>Alternativas para que la operación se adapte a tus posibilidades.</p></div><Arrow /></article>
          <article className="service-card glass-panel"><span className="service-number">02</span><div><h3>Permutas</h3><p>Evaluamos tu vehículo como parte de pago de forma directa y transparente.</p></div><Arrow /></article>
          <article className="service-card glass-panel"><span className="service-number">03</span><div><h3>Gestoría</h3><p>Acompañamiento documental para una transferencia clara y ordenada.</p></div><Arrow /></article>
        </div>
      </section>

      <section className="section-shell trust-section" id="nosotros" aria-labelledby="trust-title">
        <div className="trust-copy">
          <Eyebrow>La diferencia Gonba</Eyebrow>
          <h2 id="trust-title">No se trata de vender cualquier auto.</h2>
          <p>Se trata de conocerlo, presentarlo con honestidad y acompañarte hasta que estés seguro de tu decisión.</p>
        </div>
        <div className="trust-metrics glass-panel">
          <div><strong>100%</strong><span>Atención personalizada</span></div>
          <div><strong>01 a 01</strong><span>Trato directo</span></div>
          <div><strong>24 h</strong><span>Respuesta estimada</span></div>
        </div>
      </section>

      <section className="section-shell faq-section" id="preguntas" aria-labelledby="faq-title">
        <div className="faq-intro">
          <Eyebrow>Preguntas frecuentes</Eyebrow>
          <h2 id="faq-title">Lo que conviene saber antes de empezar.</h2>
          <p>Si tu pregunta no está acá, escribinos y la resolvemos juntos.</p>
        </div>
        <div className="faq-list">
          <details className="glass-panel" open><summary>¿Los vehículos están revisados?<Plus aria-hidden="true" size={20} strokeWidth={1.8} /></summary><p>Cada unidad se presenta con la información disponible sobre su estado, historial y documentación.</p></details>
          <details className="glass-panel"><summary>¿Puedo entregar mi auto como parte de pago?<Plus aria-hidden="true" size={20} strokeWidth={1.8} /></summary><p>Sí. Primero coordinamos una evaluación para determinar su estado y valor de mercado.</p></details>
          <details className="glass-panel"><summary>¿Trabajan con financiación?<Plus aria-hidden="true" size={20} strokeWidth={1.8} /></summary><p>Podemos analizar distintas alternativas según el vehículo y las condiciones de la operación.</p></details>
          <details className="glass-panel"><summary>¿Cómo coordino una visita?<Plus aria-hidden="true" size={20} strokeWidth={1.8} /></summary><p>Contactanos por WhatsApp para confirmar disponibilidad y reservar un horario de atención.</p></details>
        </div>
      </section>

      <section className="section-shell contact-section glass-panel" id="contacto" aria-labelledby="contact-title">
        <div className="contact-glow" aria-hidden="true" />
        <div className="contact-copy"><Eyebrow>Hablemos</Eyebrow><h2 id="contact-title">El próximo paso puede empezar con un mensaje.</h2></div>
        <div className="contact-actions">
          <ButtonAnchor href="#inicio">Escribir por WhatsApp <Arrow /></ButtonAnchor>
          <p>Datos de contacto provisionales para esta demostración.</p>
        </div>
      </section>

      <footer className="site-footer section-shell">
        <a className="wordmark footer-wordmark" href="#inicio">GONBA <span>GARAGE</span></a>
        <p>Autos usados seleccionados · Buenos Aires, Argentina</p>
        <nav aria-label="Navegación del pie de página">
          <a href="#vehiculos">Vehículos</a><a href="#servicios">Servicios</a><a href="#preguntas">FAQ</a><a href="#inicio">Volver arriba <ArrowUp aria-hidden="true" size={13} /></a>
        </nav>
        <small>Demo visual · Contenido e información comercial a confirmar</small>
      </footer>
    </main>
  );
}
