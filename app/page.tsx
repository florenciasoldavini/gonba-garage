const vehicle = {
  eyebrow: 'Selección actual',
  name: 'Vehículos con historia.\nElegidos con criterio.',
  description:
    'Una experiencia digital para descubrir, comparar y consultar autos usados seleccionados.',
};

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Gonba Garage, inicio">
          GONBA<span>®</span>
        </a>
        <p className="header-note">Compra · Venta · Selección</p>
        <a className="menu-link" href="#contacto">
          Contacto <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">{vehicle.eyebrow}</p>
          <h1 id="hero-title">
            {vehicle.name.split('\n').map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
          <p className="hero-description">{vehicle.description}</p>
        </div>

        <div className="vehicle-stage" aria-label="Vista conceptual de un vehículo seleccionado">
          <div className="stage-index" aria-hidden="true">
            01<span>/04</span>
          </div>
          <div className="car-form" aria-hidden="true">
            <span className="car-roof" />
            <span className="car-body" />
            <span className="wheel wheel-left" />
            <span className="wheel wheel-right" />
          </div>
          <p className="stage-caption">Imagen del vehículo</p>
        </div>

        <div className="hero-meta">
          <p>
            <span>Inventario</span>
            Sincronizado con Mercado Libre
          </p>
          <a className="primary-link" href="#vehiculos">
            Explorar vehículos <span aria-hidden="true">→</span>
          </a>
        </div>

        <p className="scroll-cue" aria-hidden="true">
          Scroll para descubrir
        </p>
      </section>

      <section className="foundation-note" id="vehiculos" aria-labelledby="foundation-title">
        <p>Dirección visual provisional</p>
        <h2 id="foundation-title">La performance es parte del diseño.</h2>
        <p>
          El contenido esencial se entrega primero. El movimiento y el 3D se suman de manera
          progresiva, sin bloquear la navegación, la indexación ni la conversión.
        </p>
      </section>

      <footer id="contacto">
        <p>Gonba Garage</p>
        <p>Buenos Aires · Argentina</p>
      </footer>
    </main>
  );
}
