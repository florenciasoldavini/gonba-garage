import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/layout/legal-page';
import { WHATSAPP_DISPLAY_NUMBER, WHATSAPP_PRIVACY_MESSAGE } from '@/constants/contact';
import { BUSINESS_LOCATION, LEGAL_OWNER_CUIT, LEGAL_OWNER_NAME, LEGAL_PAGES } from '@/constants/legal';
import { getWhatsAppUrl } from '@/lib/contact';
import { createPageMetadata } from '@/lib/metadata';

const { path, updatedAt } = LEGAL_PAGES.privacy;

export const metadata: Metadata = createPageMetadata({
  title: "Política de privacidad | Gonba's Garage",
  description:
    "Qué datos personales recopila Gonba's Garage, para qué los usa, con quién los comparte y cómo ejercer tus derechos según la Ley 25.326.",
  path,
});

// Every statement here must match the code: lib/alerts, app/vender and the PostHog setup.
export default function PrivacyPage() {
  const whatsapp = (
    <a href={getWhatsAppUrl(WHATSAPP_PRIVACY_MESSAGE)} target="_blank" rel="noreferrer">
      WhatsApp al {WHATSAPP_DISPLAY_NUMBER}
    </a>
  );

  return (
    <LegalPage
      id="privacy-top"
      title="Política de privacidad"
      intro="Qué datos recopila este sitio, para qué los usamos y cómo podés acceder a ellos, corregirlos o pedir que los borremos."
      updatedAt={updatedAt}
    >
      <section id="responsable">
        <h2>Quién es responsable</h2>
        <p>
          El responsable de los datos personales que se recopilan en este sitio es {LEGAL_OWNER_NAME} (<span className="legal-nowrap">CUIT {LEGAL_OWNER_CUIT}</span>),
          titular de Gonba&apos;s Garage, con domicilio en {BUSINESS_LOCATION}. Tratamos tus datos según la Ley 25.326 de
          Protección de los Datos Personales y sus normas complementarias.
        </p>
      </section>

      <section id="datos">
        <h2>Qué datos recopilamos y para qué</h2>
        <h3>Alertas por email</h3>
        <p>
          Si creás una alerta de precio o de búsqueda, guardamos tu email, el vehículo o los criterios que elegiste (texto
          buscado, marca, transmisión, carrocería, combustible y rangos de precio y kilometraje), el estado de la alerta y las
          fechas en que la creaste y la confirmaste. También registramos los emails que te enviamos y, en las alertas de
          búsqueda, qué autos te avisamos, para no avisarte dos veces del mismo. Usamos estos datos solo para confirmar la
          alerta y avisarte: no te mandamos publicidad ni otros mensajes. Darnos tu email es optativo, pero sin él no podemos
          enviarte alertas.
        </p>
        <p>
          La alerta se activa recién cuando la confirmás desde el enlace que te enviamos por email. Hasta entonces no recibís
          avisos.
        </p>
        <h3>Prevención de abuso</h3>
        <p>
          Para limitar los envíos repetidos del formulario de alertas, guardamos una versión irreversible (hash) de tu
          dirección IP y de tu email, nunca la IP ni el email en sí. Ese registro solo se usa durante un máximo de 24 horas y
          después se borra periódicamente.
        </p>
        <h3>Formulario «Vendé tu auto»</h3>
        <p>
          Lo que completás en este formulario no se envía a nuestros servidores ni se guarda en el sitio. Al enviarlo se abre
          WhatsApp con un mensaje que incluye tu nombre, tu teléfono y los datos del auto, y vos decidís si lo mandás. Las
          fotos que agregás solo se muestran como vista previa en tu dispositivo: no se suben ni se incluyen en el mensaje.
        </p>
        <p>
          En las estadísticas de uso solo registramos que enviaste el formulario, si agregaste fotos, el año del auto y su
          marca y modelo cuando los elegís de la lista. Nunca tu nombre, tu teléfono ni lo que escribís a mano.
        </p>
        <h3>Consultas por WhatsApp</h3>
        <p>
          Si nos escribís por WhatsApp, recibimos tu número y lo que nos envíes, y lo usamos para responderte, evaluar tu auto
          o coordinar una visita. WhatsApp es un servicio de Meta y se rige por sus propias condiciones.
        </p>
        <h3>Estadísticas de uso</h3>
        <p>
          Usamos PostHog para entender cómo se usa el sitio: páginas visitadas, clics, filtros del catálogo (sin el texto que
          escribís en la búsqueda), vehículos vistos, dispositivo y navegador, sitio de procedencia y la ubicación aproximada
          que se deduce de tu IP. Para reconocer visitas repetidas, PostHog guarda un identificador anónimo en una cookie y
          en el almacenamiento local de tu navegador. No vinculamos estas estadísticas con tu nombre, tu email ni tu teléfono.
        </p>
        <p>
          Podemos activar grabaciones de sesión para detectar problemas de uso. En ese caso, lo que escribís en los campos se
          oculta y los formularios de alertas y de tasación quedan excluidos de la grabación. Podés borrar o bloquear las
          cookies y el almacenamiento local desde la configuración de tu navegador.
        </p>
      </section>

      <section id="proveedores">
        <h2>Con quién compartimos tus datos</h2>
        <p>No vendemos ni cedemos tus datos. Para operar el sitio usamos estos proveedores, que los tratan por nuestra cuenta:</p>
        <ul>
          <li><strong>Vercel</strong>: aloja el sitio y procesa cada visita, con registros técnicos como la IP y el navegador.</li>
          <li><strong>Neon</strong>: base de datos donde guardamos las alertas.</li>
          <li><strong>Resend</strong>: envía los emails de confirmación y de alertas.</li>
          <li><strong>PostHog</strong>: estadísticas de uso.</li>
        </ul>
        <p>
          Estos proveedores pueden almacenar o procesar datos fuera de Argentina, por ejemplo en Estados Unidos. Al usar el
          sitio y crear una alerta, prestás tu consentimiento para esa transferencia.
        </p>
        <p>
          El inventario se obtiene de nuestras publicaciones en Mercado Libre. No compartimos datos de visitantes con Mercado
          Libre; si abrís una publicación en su sitio, se aplican sus propias políticas. Solo revelaremos datos a una
          autoridad cuando la ley nos obligue.
        </p>
      </section>

      <section id="conservacion">
        <h2>Cuánto tiempo los conservamos</h2>
        <ul>
          <li>
            <strong>Alertas</strong>: mientras estén activas. Si cancelás una alerta o no la confirmás, dejamos de escribirte y
            conservamos su registro como constancia hasta que nos pidas eliminarlo.
          </li>
          <li><strong>Prevención de abuso</strong>: se usa hasta 24 horas y se borra periódicamente.</li>
          <li><strong>Estadísticas de uso</strong>: durante el plazo de retención de PostHog; después se eliminan automáticamente.</li>
          <li><strong>Registros técnicos de Vercel</strong>: períodos breves, para operar y proteger el sitio.</li>
        </ul>
      </section>

      <section id="derechos">
        <h2>Tus derechos</h2>
        <p>
          Podés pedirnos en cualquier momento acceder a tus datos, rectificarlos, actualizarlos o eliminarlos. Escribinos por
          {' '}{whatsapp} contándonos qué necesitás y el email que usaste. Para proteger tus datos, podemos pedirte que
          acredites que ese email es tuyo.
        </p>
        <p>
          Respondemos los pedidos de acceso dentro de los 10 días corridos, y los de rectificación, actualización o supresión
          dentro de los 5 días hábiles, como establece la ley.
        </p>
        <p>
          El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a
          intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en
          el artículo 14, inciso 3 de la Ley 25.326.
        </p>
      </section>

      <section id="baja">
        <h2>Cómo dejar de recibir alertas</h2>
        <ul>
          <li>
            Cada aviso por email, tanto de baja de precio como de autos que coinciden con tu búsqueda, incluye un enlace
            «Cancelar alerta» que cancela esa alerta. Tu programa de correo también puede ofrecerte la opción de cancelar la
            suscripción.
          </li>
          <li>Si no confirmaste una alerta, no tenés que hacer nada: sin confirmación no te enviamos avisos.</li>
          <li>
            Para cancelar una alerta que todavía no te mandó ningún aviso, o todas tus alertas a la vez, escribinos por
            {' '}{whatsapp}. Si además querés que borremos tu email, pedilo en el mismo mensaje.
          </li>
        </ul>
      </section>

      <section id="seguridad">
        <h2>Seguridad</h2>
        <p>
          Guardamos las alertas en una base de datos de acceso restringido, con conexiones cifradas. Los enlaces de los emails
          están firmados y no incluyen tu dirección de correo.
        </p>
      </section>

      <section id="autoridad">
        <h2>Autoridad de control</h2>
        <p>
          La{' '}
          <a href="https://www.argentina.gob.ar/aaip" target="_blank" rel="noreferrer">Agencia de Acceso a la Información Pública</a>,
          en su carácter de Órgano de Control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que
          interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de
          protección de datos personales.
        </p>
      </section>

      <section id="cambios">
        <h2>Cambios en esta política</h2>
        <p>
          Si cambiamos qué datos recopilamos o cómo los usamos, vamos a actualizar esta página y su fecha. Las condiciones de
          uso del sitio están en los <Link href={LEGAL_PAGES.terms.path}>términos y condiciones</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
