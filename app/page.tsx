import Image from 'next/image';

const vehicles = [
  {
    name: 'BMW 330i M Sport',
    year: '2021',
    detail: 'Automático · Nafta · 48.000 km',
    image: '/showroom-car.jpg',
    alt: 'Auto deportivo negro exhibido en un showroom',
  },
  {
    name: 'Mercedes-Benz clásico',
    year: '1962',
    detail: 'Restaurado · Colección · Consultar',
    image: '/featured-classic.jpg',
    alt: 'Auto clásico rojo en un garage',
  },
  {
    name: 'Selección Gonba',
    year: 'Nuevo ingreso',
    detail: 'Revisado · Documentación verificada',
    image: '/garage-classic.jpg',
    alt: 'Auto clásico junto a un garage',
  },
];

const Arrow = () => <span aria-hidden="true">↗</span>;

export default function Home() {
  return (
    <main id="inicio">
      <header className="site-header">
        <a className="wordmark" href="#inicio" aria-label="Gonba Garage, inicio">
          GONBA <span>GARAGE</span>
        </a>
        <nav className="main-nav" aria-label="Navegación principal">
          <a href="#vehiculos">Vehículos</a>
          <a href="#servicios">Servicios</a>
          <a href="#nosotros">Nosotros</a>
          <a href="#preguntas">Preguntas</a>
        </nav>
        <a className="header-cta" href="#contacto">Contactar <Arrow /></a>
      </header>

      <section className="hero section-shell" aria-labelledby="hero-title">
        <div className="hero-media" aria-hidden="true">
          <Image src="/showroom-car.jpg" alt="" fill priority sizes="100vw" className="cover-image" />
        </div>
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="eyebrow"><span /> Autos usados seleccionados</p>
          <h1 id="hero-title">Encontrá un auto que valga la pena manejar.</h1>
          <p className="hero-intro">
            Seleccionamos, revisamos y presentamos cada vehículo con la información que necesitás
            para elegir con confianza.
          </p>
          <div className="hero-actions">
            <a className="button button-accent" href="#vehiculos">Ver vehículos <Arrow /></a>
            <a className="button button-glass" href="#vender">Quiero vender mi auto</a>
          </div>
        </div>
        <aside className="hero-facts glass-panel" aria-label="Información destacada">
          <div><strong>01</strong><span>Selección cuidadosa</span></div>
          <div><strong>02</strong><span>Información transparente</span></div>
          <div><strong>03</strong><span>Atención directa</span></div>
        </aside>
        <a className="scroll-cue" href="#vehiculos">Explorar <span aria-hidden="true">↓</span></a>
      </section>

      <section className="section-shell inventory-section" id="vehiculos" aria-labelledby="inventory-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span /> Inventario</p>
            <h2 id="inventory-title">Elegidos por una razón.</h2>
          </div>
          <div className="section-heading-copy">
            <p>Una selección corta y cuidada. Menos tiempo buscando, más claridad para decidir.</p>
            <a className="text-link" href="#contacto">Consultar inventario completo <Arrow /></a>
          </div>
        </div>
        <div className="vehicle-grid">
          {vehicles.map((vehicle, index) => (
            <article className="vehicle-card glass-panel" key={vehicle.name}>
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
          ))}
        </div>
      </section>

      <section className="section-shell sell-section" id="vender" aria-labelledby="sell-title">
        <div className="sell-media">
          <Image src="/garage-classic.jpg" alt="Auto estacionado frente a un garage" fill sizes="(max-width: 900px) 100vw, 50vw" className="cover-image" />
        </div>
        <div className="sell-content glass-panel">
          <p className="eyebrow"><span /> Vendé tu auto</p>
          <h2 id="sell-title">Una operación simple, clara y sin vueltas.</h2>
          <p>Contanos qué auto tenés. Lo evaluamos, coordinamos una revisión y te presentamos una propuesta transparente.</p>
          <ol className="process-list">
            <li><span>01</span> Compartís los datos del vehículo</li>
            <li><span>02</span> Coordinamos la evaluación</li>
            <li><span>03</span> Recibís una propuesta</li>
          </ol>
          <a className="button button-accent" href="#contacto">Solicitar una tasación <Arrow /></a>
        </div>
      </section>

      <section className="section-shell services-section" id="servicios" aria-labelledby="services-title">
        <div className="section-heading compact-heading">
          <div><p className="eyebrow"><span /> Otros servicios</p><h2 id="services-title">Todo lo importante, en un solo lugar.</h2></div>
        </div>
        <div className="services-grid">
          <article className="service-card glass-panel"><span className="service-number">01</span><div><h3>Financiación</h3><p>Alternativas para que la operación se adapte a tus posibilidades.</p></div><Arrow /></article>
          <article className="service-card glass-panel"><span className="service-number">02</span><div><h3>Permutas</h3><p>Evaluamos tu vehículo como parte de pago de forma directa y transparente.</p></div><Arrow /></article>
          <article className="service-card glass-panel"><span className="service-number">03</span><div><h3>Gestoría</h3><p>Acompañamiento documental para una transferencia clara y ordenada.</p></div><Arrow /></article>
        </div>
      </section>

      <section className="section-shell trust-section" id="nosotros" aria-labelledby="trust-title">
        <div className="trust-copy">
          <p className="eyebrow"><span /> La diferencia Gonba</p>
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
          <p className="eyebrow"><span /> Preguntas frecuentes</p>
          <h2 id="faq-title">Lo que conviene saber antes de empezar.</h2>
          <p>Si tu pregunta no está acá, escribinos y la resolvemos juntos.</p>
        </div>
        <div className="faq-list">
          <details className="glass-panel" open><summary>¿Los vehículos están revisados?<span>+</span></summary><p>Cada unidad se presenta con la información disponible sobre su estado, historial y documentación.</p></details>
          <details className="glass-panel"><summary>¿Puedo entregar mi auto como parte de pago?<span>+</span></summary><p>Sí. Primero coordinamos una evaluación para determinar su estado y valor de mercado.</p></details>
          <details className="glass-panel"><summary>¿Trabajan con financiación?<span>+</span></summary><p>Podemos analizar distintas alternativas según el vehículo y las condiciones de la operación.</p></details>
          <details className="glass-panel"><summary>¿Cómo coordino una visita?<span>+</span></summary><p>Contactanos por WhatsApp para confirmar disponibilidad y reservar un horario de atención.</p></details>
        </div>
      </section>

      <section className="section-shell contact-section" id="contacto" aria-labelledby="contact-title">
        <div className="contact-glow" aria-hidden="true" />
        <div className="contact-copy"><p className="eyebrow"><span /> Hablemos</p><h2 id="contact-title">El próximo paso puede empezar con un mensaje.</h2></div>
        <div className="contact-actions">
          <a className="button button-dark" href="#inicio">Escribir por WhatsApp <Arrow /></a>
          <p>Datos de contacto provisionales para esta demostración.</p>
        </div>
      </section>

      <footer className="site-footer section-shell">
        <a className="wordmark footer-wordmark" href="#inicio">GONBA <span>GARAGE</span></a>
        <p>Autos usados seleccionados · Buenos Aires, Argentina</p>
        <nav aria-label="Navegación del pie de página">
          <a href="#vehiculos">Vehículos</a><a href="#servicios">Servicios</a><a href="#preguntas">FAQ</a><a href="#inicio">Volver arriba ↑</a>
        </nav>
        <small>Demo visual · Contenido e información comercial a confirmar</small>
      </footer>
    </main>
  );
}
