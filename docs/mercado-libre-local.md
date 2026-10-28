# Catálogo local con Vercel Blob privado

## Activación después de revisar el PR

1. En Vercel, crear un Blob store **Private** y conectarlo al proyecto backend Gonba Garage, solo al entorno de producción. Usar las credenciales OIDC y `BLOB_STORE_ID` que configura Vercel; el SDK también admite `BLOB_READ_WRITE_TOKEN` privado si la conexión usa ese mecanismo. No crear un store público ni conectar previews al store de producción.
2. Configurar como secretos del backend `MERCADO_LIBRE_CLIENT_ID`, `MERCADO_LIBRE_CLIENT_SECRET`, `MERCADO_LIBRE_CATALOG_API_KEY` (al menos 32 bytes aleatorios) y `MERCADO_LIBRE_TOKEN_ENCRYPTION_KEY` (otros 32 bytes aleatorios, codificados en base64). La clave de cifrado debe estar respaldada fuera de Blob. El backend no necesita ninguna variable de Supabase para esta integración.
3. Configurar `MERCADO_LIBRE_SELLER_ID=322618227` y `MERCADO_LIBRE_REDIRECT_URI=https://gonba-garage.vercel.app/api/mercado-libre/callback`. Mantener `VEHICLE_DATA_SOURCE=demo` en Vercel durante la prueba local para evitar que el frontend se consulte a sí mismo. Mantener la indexación desactivada. Redeployar para recibir la configuración.
4. Abrir `https://gonba-garage.vercel.app/api/mercado-libre/connect`. El navegador pide usuario y contraseña: usar `admin` y la clave privada `MERCADO_LIBRE_CATALOG_API_KEY`. Autorizar Gonba Garage. El callback valida state/PKCE y seller; guarda el refresh token cifrado en `mercado-libre/322618227/refresh-token.json`, siempre privado. Nunca devuelve el token ni la URL del blob al cliente.
5. En `.env.local` del servidor local configurar:

```dotenv
VEHICLE_DATA_SOURCE=mercado-libre
SITE_INDEXING_ENABLED=false
MERCADO_LIBRE_BACKEND_URL=https://gonba-garage.vercel.app
MERCADO_LIBRE_CATALOG_API_KEY=<misma clave privada que Vercel>
```

6. Reiniciar `npm run dev` y abrir `http://localhost:3000/vehiculos`. No hacen falta túneles, variables de Supabase, credenciales de Blob ni tokens de Mercado Libre en localhost.

## Almacenamiento y concurrencia

El SDK lee el blob privado con `useCache: false`, directamente desde origen. El JSON contiene solo la versión, el refresh token cifrado y un marcador técnico de renovación. El cifrado AES-256-GCM usa un IV aleatorio y vincula el secreto al seller. La clave queda fuera del store. El access token vive únicamente en memoria; no se almacena inventario.

Antes de consumir el refresh token, el backend escribe el marcador de renovación con `ifMatch: etag`. Solo una instancia puede obtenerlo. El token nuevo se guarda mediante otro `ifMatch` sobre la versión bloqueada, antes de usar el access token. Una escritura obsoleta falla y no sobrescribe una conexión nueva. La creación inicial usa `allowOverwrite: false` para resolver también las carreras al autorizar por primera vez.

Si hay timeout o caída durante la renovación, el marcador permanece bloqueado: no se reutiliza automáticamente un refresh token que Mercado Libre puede haber consumido. La API devuelve 503. Para recuperar, esperar dos minutos y autorizar nuevamente desde `/connect`. Una reautorización también usa ETag y no puede pisar una renovación reciente. No quitar manualmente el bloqueo para reintentar el token anterior. Una caída entre Mercado Libre y Blob puede exigir esta recuperación porque ambos servicios no comparten una transacción.

No cambiar la clave de cifrado sin migrar el ciphertext o reautorizar. No exponer URLs privadas mediante presigned URLs ni agregar rutas de descarga para este blob. No registrar cuerpos de respuestas OAuth, ciphertext ni claves en logs. Las otras funciones del proyecto que ya usan Supabase quedan fuera de esta integración.

## Endpoint y verificación

`GET /api/mercado-libre/catalog` requiere `Authorization: Bearer <clave>`, enviado desde el servidor local. `?item=MLA...` solo entrega fichas activas del seller esperado. Devuelve datos de presentación, fotos, descripción y atributos, con `private, no-store` y `noindex`; no devuelve la respuesta privada completa del vendedor. No habilita CORS.

Pruebas locales: `node scripts/check-refresh-token-store.mjs`, typecheck, lint, build y `test:metadata` en modo demo y producción. El test de almacenamiento simula escrituras condicionales e incluye dos renovaciones concurrentes, rotación, timeout ambiguo, recuperación y rechazo de escrituras obsoletas. La prueba real del store privado y de la cuenta requiere crearlo, configurar secretos, desplegar y autorizar después de revisar el PR. Probar también acceso denegado al blob sin credenciales, acceso desde localhost tras reiniciarlo y recuperación tras una revocación.

No hay migraciones de Supabase que aplicar para Mercado Libre.

## Diagnóstico de todos los estados

`GET /api/mercado-libre/diagnostics` usa la misma clave Bearer privada que el catálogo. Consulta únicamente el seller configurado, recorre el buscador con `search_type=scan` sin filtro de estado y lee lotes de hasta 20 publicaciones. Devuelve `totalReported`, `totalFound`, `totalRead`, `countsByStatus`, `items` (ID, título, estado y subestados) y `failures` para publicaciones fallidas u omitidas por el proveedor. Los estados desconocidos se conservan; `closed` no se interpreta como venta.

Una respuesta completa devuelve 200 y `complete: true`. Una lectura parcial devuelve 206 y `complete: false`; no usar ese conteo como definitivo. Un error de proveedor o timeout devuelve 503. Es una lectura actual, no un snapshot transaccional: el inventario puede cambiar durante la consulta. El límite defensivo es 100 páginas de 100 IDs y el presupuesto de lectura es de 50 segundos; alcanzar un límite no se informa como resultado completo. La respuesta usa `private, no-store` y `noindex`, no expone tokens ni datos de contacto del vendedor y no se consume desde el catálogo público. Las publicaciones visibles del sitio siguen siendo solo las activas.
