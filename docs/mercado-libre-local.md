# Catálogo local con Vercel Blob privado

## Activación después de revisar el PR

1. En Vercel, crear un Blob store **Private** y conectarlo al proyecto backend Gonba Garage, solo al entorno de producción. Usar las credenciales OIDC y `BLOB_STORE_ID` que configura Vercel; el SDK también admite `BLOB_READ_WRITE_TOKEN` privado si la conexión usa ese mecanismo. No crear un store público ni conectar previews al store de producción.
2. Configurar como secretos del backend `MERCADO_LIBRE_CLIENT_ID`, `MERCADO_LIBRE_CLIENT_SECRET`, `MERCADO_LIBRE_CATALOG_API_KEY` (al menos 32 bytes aleatorios) y `MERCADO_LIBRE_TOKEN_ENCRYPTION_KEY` (otros 32 bytes aleatorios, codificados en base64). La clave de cifrado debe estar respaldada fuera de Blob. El backend no necesita ninguna variable de Supabase para esta integración.
3. Configurar `MERCADO_LIBRE_SELLER_ID=322618227` y `MERCADO_LIBRE_REDIRECT_URI=https://gonba-garage.vercel.app/api/mercado-libre/callback`. Mantener `VEHICLE_DATA_SOURCE=demo` en Vercel hasta completar la primera sincronización (pasos 7 a 9). Mantener la indexación desactivada. Redeployar para recibir la configuración.
4. Abrir `https://gonba-garage.vercel.app/api/mercado-libre/connect`. El navegador pide usuario y contraseña: usar `admin` y la clave privada `MERCADO_LIBRE_CATALOG_API_KEY`. Autorizar Gonba Garage. El callback valida state/PKCE y seller; guarda el refresh token cifrado en `mercado-libre/322618227/refresh-token.json`, siempre privado. Nunca devuelve el token ni la URL del blob al cliente.
5. En `.env.local` del servidor local configurar:

```dotenv
VEHICLE_DATA_SOURCE=mercado-libre
SITE_INDEXING_ENABLED=false
MERCADO_LIBRE_BACKEND_URL=https://gonba-garage.vercel.app
MERCADO_LIBRE_CATALOG_API_KEY=<misma clave privada que Vercel>
```

6. Reiniciar `npm run dev` y abrir `http://localhost:3000/vehiculos`. No hacen falta túneles, variables de Supabase, credenciales de Blob ni tokens de Mercado Libre en localhost.
7. Antes de desplegar este cambio, con el `DATABASE_URL` de producción, ejecutar `npm run db:migrate` (crea las tablas `catalog_*`). Sin ellas el webhook responde 503 y Mercado Libre reintenta. Repetir con el branch de desarrollo. Configurar en Vercel `CRON_SECRET` (al menos 32 caracteres aleatorios) si todavía no existe.
8. En la aplicación de Mercado Libre, configurar la URL de notificaciones `https://gonba-garage.vercel.app/api/mercado-libre/webhook` con los tópicos `items` e `items_prices`.
9. Hacer la primera sincronización sin esperar al cron: `curl -H "Authorization: Bearer $CRON_SECRET" https://gonba-garage.vercel.app/api/mercado-libre/sync`. Revisar `GET /api/mercado-libre/diagnostics?sync=1` (clave Bearer del catálogo): `jobs.pending` en 0 y `publications.active` igual a las publicaciones activas.
10. Para publicar el catálogo real en Vercel, cambiar a `VEHICLE_DATA_SOURCE=mercado-libre` sin `MERCADO_LIBRE_BACKEND_URL` y redeployar: el sitio lee su propia copia en Neon.

## Almacenamiento y concurrencia

El SDK lee el blob privado con `useCache: false`, directamente desde origen. El JSON contiene solo la versión, el refresh token cifrado, el access token vigente cifrado con su vencimiento y un marcador técnico de renovación. El cifrado AES-256-GCM usa un IV aleatorio y vincula cada secreto al seller. La clave queda fuera del store. El inventario no se persiste en Blob: su copia vive en Neon (ver «Copia sincronizada y endpoint»).

Cada instancia reutiliza el access token guardado mientras no venza (con un minuto de margen) y lo conserva además en memoria. Así el refresh token de un solo uso se renueva aproximadamente una vez por vida del access token (unas 6 horas) en total, no una vez por instancia nueva. Una reautorización descarta el access token guardado.

Antes de consumir el refresh token, el backend escribe el marcador de renovación con `ifMatch: etag`. Solo una instancia puede obtenerlo. El refresh token nuevo y su access token se guardan juntos mediante otro `ifMatch` sobre la versión bloqueada, antes de usar el access token. Una escritura obsoleta falla y no sobrescribe una conexión nueva. La creación inicial usa `allowOverwrite: false` para resolver también las carreras al autorizar por primera vez.

Si otra instancia encuentra una renovación de menos de dos minutos, consulta el registro cada segundo durante hasta 25 segundos y usa el access token nuevo en cuanto se guarda; no consume el refresh token. Si la renovación registra un fallo, el marcador supera los dos minutos o se agota la espera, devuelve el error de bloqueo sin reintentar.

Si hay timeout o caída durante la renovación, el marcador permanece bloqueado: no se reutiliza automáticamente un refresh token que Mercado Libre puede haber consumido. La API devuelve 503. Para recuperar, esperar dos minutos y autorizar nuevamente desde `/connect`. Una reautorización también usa ETag y no puede pisar una renovación reciente. No quitar manualmente el bloqueo para reintentar el token anterior. Una caída entre Mercado Libre y Blob puede exigir esta recuperación porque ambos servicios no comparten una transacción.

No cambiar la clave de cifrado sin migrar el ciphertext o reautorizar. No exponer URLs privadas mediante presigned URLs ni agregar rutas de descarga para este blob. No registrar cuerpos de respuestas OAuth, ciphertext ni claves en logs. Las otras funciones del proyecto que ya usan Supabase quedan fuera de esta integración.

## Copia sincronizada y endpoint

Las páginas nunca consultan Mercado Libre. Leen la copia en Neon (`catalog_publications`), que mantienen el webhook y el cron de reconciliación; el diseño completo está en `docs/architecture.md` («Mercado Libre sync»). Un cambio en Mercado Libre aparece en el sitio en segundos cuando llega la notificación. Si una notificación se pierde, la reconciliación diaria la repara (cada 15 minutos con un plan Pro de Vercel, cambiando `vercel.json`). La copia guarda solo datos públicos de presentación, nunca el payload privado del vendedor.

`GET /api/mercado-libre/catalog` requiere `Authorization: Bearer <clave>`, enviado desde el servidor local, y lee la misma copia. Sin `item` devuelve las publicaciones activas. `?item=MLA...` entrega la ficha sincronizada en cualquier estado (activa, pausada o cerrada), para que su página conserve la URL. Devuelve datos de presentación, fotos, descripción y atributos, con `private, no-store` y `noindex`. No habilita CORS. Verificación: `node scripts/check-inventory-sync.mjs`.

Las alertas de precio no usan la copia: leen Mercado Libre directamente antes de enviar, para tener el precio vigente.

Pruebas locales: `node scripts/check-refresh-token-store.mjs`, typecheck, lint, build y `test:metadata` en modo demo y producción. El test de almacenamiento simula escrituras condicionales e incluye dos renovaciones concurrentes, reutilización del access token guardado, espera durante una renovación en curso, rotación, timeout ambiguo, bloqueos interrumpidos que nunca se reclaman, recuperación y rechazo de escrituras obsoletas. La prueba real del store privado y de la cuenta requiere crearlo, configurar secretos, desplegar y autorizar después de revisar el PR. Probar también acceso denegado al blob sin credenciales, acceso desde localhost tras reiniciarlo y recuperación tras una revocación.

No hay migraciones de Supabase que aplicar para Mercado Libre. La copia del catálogo usa la migración de Neon `20261031_catalog_sync.sql` (`npm run db:migrate`).

## Diagnóstico de estados y atributos de todas las publicaciones

`GET /api/mercado-libre/diagnostics` usa la misma clave Bearer privada que el catálogo. Consulta únicamente el seller configurado, recorre el buscador con `search_type=scan` sin filtro de estado y lee lotes de hasta 20 publicaciones. Devuelve `totalReported`, `totalFound`, `totalRead`, `countsByStatus`, `items` (ID, título, estado, subestados y `attributes`) y `failures` para publicaciones fallidas u omitidas por el proveedor. Los estados desconocidos se conservan; `closed` no se interpreta como venta.

Cada `items[].attributes` conserva los objetos completos recibidos de Mercado Libre, también para publicaciones cerradas, pausadas o en revisión. Incluye IDs desconocidos, nombres, valores «No», arrays de valores, unidades y campos futuros, sin aplicar el filtro de la ficha pública. Esto permite comparar los atributos de las publicaciones activas y no activas sin cambiar el catálogo ni guardar publicaciones. No se solicita el resto del payload privado de la cuenta.

Si el proveedor omite los atributos o devuelve un valor que no es un array, el ítem conserva su estado pero devuelve `attributes: null`, se agrega su ID a `missingAttributes` y el resultado queda incompleto (206). Un array vacío explícito `[]` sí se considera válido. Revisar tanto `failures` como `missingAttributes` antes de dar por terminada la comparación. Para verificar la lógica: `node scripts/check-publication-diagnostics.mjs`.

Una respuesta completa devuelve 200 y `complete: true`. Una lectura parcial devuelve 206 y `complete: false`; no usar ese conteo como definitivo. Un error de proveedor o timeout devuelve 503. Es una lectura actual, no un snapshot transaccional: el inventario puede cambiar durante la consulta. El límite defensivo es 100 páginas de 100 IDs y el presupuesto de lectura es de 50 segundos; alcanzar un límite no se informa como resultado completo. La respuesta usa `private, no-store` y `noindex`, no expone tokens ni datos de contacto del vendedor y no se consume desde el catálogo público. Las publicaciones visibles del sitio siguen siendo solo las activas.
