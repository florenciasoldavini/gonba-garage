import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/layout/legal-page';
import { WHATSAPP_DISPLAY_NUMBER, WHATSAPP_GENERAL_MESSAGE } from '@/constants/contact';
import { BUSINESS_HOURS, BUSINESS_LOCATION, LEGAL_OWNER_CUIT, LEGAL_OWNER_NAME, LEGAL_PAGES } from '@/constants/legal';
import { getWhatsAppUrl } from '@/lib/contact';
import { createPageMetadata } from '@/lib/metadata';

const { path, updatedAt } = LEGAL_PAGES.terms;

export const metadata: Metadata = createPageMetadata({
  title: "Términos y condiciones | Gonba's Garage",
  description:
    "Condiciones de uso del sitio de Gonba's Garage: alcance de la información publicada, precios, disponibilidad, visitas y alertas.",
  path,
});

export default function TermsPage() {
  const whatsapp = (
    <a href={getWhatsAppUrl(WHATSAPP_GENERAL_MESSAGE)} target="_blank" rel="noreferrer">
      WhatsApp al {WHATSAPP_DISPLAY_NUMBER}
    </a>
  );

  return (
    <LegalPage
      id="terms-top"
      title="Términos y condiciones"
      intro="Las reglas para usar este sitio y cómo leer la información de los vehículos que publicamos."
      updatedAt={updatedAt}
    >
      <section id="alcance">
        <h2>Quiénes somos</h2>
        <p>
          Este sitio pertenece a Gonba&apos;s Garage, de {LEGAL_OWNER_NAME} (<span className="legal-nowrap">CUIT {LEGAL_OWNER_CUIT}</span>), con domicilio en
          {' '}{BUSINESS_LOCATION}. Al usarlo aceptás estos términos; si no estás de acuerdo, te pedimos que no lo uses.
        </p>
      </section>

      <section id="informacion">
        <h2>La información es orientativa</h2>
        <p>
          Las fichas de los vehículos, con sus fotos, especificaciones, kilometraje y descripciones, se publican con fines
          informativos. Provienen de nuestras publicaciones en Mercado Libre y pueden tener errores u omisiones, o no reflejar
          cambios recientes. Antes de decidir, confirmá con nosotros los datos que sean importantes para vos.
        </p>
      </section>

      <section id="precios">
        <h2>Precios</h2>
        <p>
          Los precios publicados son de referencia y pueden cambiar sin aviso previo. El precio final y las condiciones de la
          operación, como la forma de pago y los gastos de transferencia, se confirman únicamente en persona, antes de reservar
          o firmar.
        </p>
        <p>
          Cuando el catálogo convierte precios entre pesos y dólares, usa la cotización del dólar MEP solo como referencia para
          filtrar y ordenar. La cotización para el pago se acuerda con nosotros.
        </p>
      </section>

      <section id="disponibilidad">
        <h2>Disponibilidad</h2>
        <p>
          Que un vehículo esté publicado no garantiza que esté disponible: puede venderse o reservarse antes de que el sitio se
          actualice. Las etiquetas «Reservado» y «Vendido» siguen el estado de la publicación y también pueden demorarse.
          Confirmá la disponibilidad antes de visitarnos. Las reservas no se hacen a través del sitio: se acuerdan en persona.
        </p>
      </section>

      <section id="visitas">
        <h2>Visitas</h2>
        <p>
          Atendemos solo con turno previo, {BUSINESS_HOURS}, en {BUSINESS_LOCATION}. Coordinamos el turno por {whatsapp}. Te
          recomendamos revisar el vehículo y su documentación en persona antes de cerrar la operación.
        </p>
      </section>

      <section id="tasacion">
        <h2>Tasación de tu auto</h2>
        <p>
          La estimación que te damos a partir del formulario «Vendé tu auto» es preliminar y no obliga a ninguna de las partes.
          Se basa en los datos que nos compartís y solo se confirma después de ver el auto en persona.
        </p>
      </section>

      <section id="alertas">
        <h2>Alertas por email</h2>
        <p>
          Las alertas de precio y de búsqueda son gratuitas e informativas. Un aviso puede llegar con demora respecto del
          cambio de precio o del ingreso de una unidad, y no garantiza que el vehículo siga disponible. Podés cancelarlas cuando
          quieras, como se explica en la <Link href={`${LEGAL_PAGES.privacy.path}#baja`}>política de privacidad</Link>.
        </p>
      </section>

      <section id="uso">
        <h2>Uso del sitio</h2>
        <p>
          No uses el sitio para cargar datos de otras personas sin su permiso, automatizar solicitudes o afectar su
          funcionamiento. Podemos bloquear las solicitudes abusivas.
        </p>
        <p>
          Los textos, el diseño, la marca Gonba&apos;s Garage y las fotos del sitio no pueden copiarse ni usarse con fines
          comerciales sin nuestra autorización. Las marcas de los vehículos pertenecen a sus respectivos titulares.
        </p>
      </section>

      <section id="terceros">
        <h2>Otros servicios</h2>
        <p>
          Los enlaces a WhatsApp, Instagram y Mercado Libre llevan a servicios de terceros, que se rigen por sus propios
          términos y políticas. No somos responsables de su contenido ni de su funcionamiento.
        </p>
      </section>

      <section id="responsabilidad">
        <h2>Responsabilidad</h2>
        <p>
          Hacemos lo posible para que el sitio funcione y su información esté al día, pero puede haber interrupciones o
          errores. Nada en estos términos limita los derechos que te reconoce la Ley 24.240 de Defensa del Consumidor.
        </p>
      </section>

      <section id="privacidad">
        <h2>Privacidad</h2>
        <p>
          Cómo tratamos tus datos personales se explica en la{' '}
          <Link href={LEGAL_PAGES.privacy.path}>política de privacidad</Link>.
        </p>
      </section>

      <section id="cambios">
        <h2>Cambios y ley aplicable</h2>
        <p>
          Podemos actualizar estos términos. La versión vigente es la publicada en esta página, con su fecha. Se rigen por las
          leyes de la República Argentina. Por cualquier consulta, escribinos por {whatsapp}.
        </p>
      </section>
    </LegalPage>
  );
}
