# Catálogo local con backend fijo en Vercel

## Activación después de revisar y mergear el PR

1. Aplicar `supabase/migrations/20261028173210_mercado_libre_refresh_token.sql` al proyecto correcto. Probar permisos con `supabase/tests/mercado_libre_credentials.sql`. La tabla tiene RLS y no concede acceso a usuarios ni al navegador; solo el backend con `service_role` puede leer o modificar el token cifrado.
2. Configurar en Vercel las variables privadas `MERCADO_LIBRE_CLIENT_ID`, `MERCADO_LIBRE_CLIENT_SECRET`, `MERCADO_LIBRE_SELLER_ID=322618227`, `MERCADO_LIBRE_REDIRECT_URI=https://gonba-garage.vercel.app/api/mercado-libre/callback`, `SUPABASE_SECRET_KEY` y `NEXT_PUBLIC_SUPABASE_URL`.
3. Generar dos secretos independientes con un gestor de contraseñas: `MERCADO_LIBRE_TOKEN_ENCRYPTION_KEY` (32 bytes aleatorios codificados en base64) y `MERCADO_LIBRE_CATALOG_API_KEY` (al menos 32 bytes aleatorios). Guardarlos como Secret en Vercel. Nunca publicarlos ni usar prefijo NEXT_PUBLIC_. Conservar una copia segura de la clave de cifrado fuera de la base: perderla obliga a reconectar la cuenta.
4. En Vercel conservar `VEHICLE_DATA_SOURCE=demo` durante esta prueba para evitar que el sitio se consulte a sí mismo. La ruta API funciona independientemente de esa variable. Redeployar para recibir las variables nuevas.
5. Abrir `https://gonba-garage.vercel.app/api/mercado-libre/connect`. El navegador pide usuario y contraseña: usar `admin` y la clave privada `MERCADO_LIBRE_CATALOG_API_KEY`. Autorizar la cuenta Gonba Garage. El callback valida state/PKCE y el seller esperado y guarda solo el refresh token cifrado. No devuelve tokens. La URI fija ya debe estar registrada en Mercado Libre.
6. En `.env.local` del servidor local configurar únicamente:

```dotenv
VEHICLE_DATA_SOURCE=mercado-libre
SITE_INDEXING_ENABLED=false
MERCADO_LIBRE_BACKEND_URL=https://gonba-garage.vercel.app
MERCADO_LIBRE_CATALOG_API_KEY=<misma clave privada que Vercel>
```

7. Reiniciar `npm run dev -- --webpack` y abrir `http://localhost:3000/vehiculos`. No hacen falta client secret, refresh token ni claves de Supabase en localhost para este flujo. No hace falta túnel ni cambiar la URI entre pruebas.

## Seguridad y operación

- `GET /api/mercado-libre/catalog` requiere `Authorization: Bearer <clave>`, enviado desde el servidor local. `?item=MLA...` consulta una ficha de la cuenta esperada. No habilita CORS y las respuestas son `private, no-store` y `noindex`. Nunca poner la clave en una URL.
- La API devuelve campos de presentación, fotos, descripción y atributos. No devuelve la respuesta privada completa del vendedor ni credenciales. Los autos no se escriben en la base.
- AES-256-GCM autentica el ciphertext y vincula el secreto al seller esperado. La versión, IV aleatorio y tag forman parte del ciphertext. Acceso al servidor y a la clave de Supabase debe estar restringido.
- El access token existe solo en memoria de la instancia durante su vigencia; solicitudes de la misma instancia comparten la renovación. Otras instancias coordinan con una lease de 120 segundos en la base. Una colisión devuelve 503; repetir luego. El intercambio de refresh tiene timeout de 20 segundos y no se reintenta automáticamente porque el token es de un solo uso.
- Cada refresh guarda el token nuevo antes de usar el access token. Una caída entre la respuesta de Mercado Libre y la escritura puede requerir reautorizar: no existe transacción atómica entre ambos servicios. Los errores devuelven mensajes genéricos, sin tokens ni ciphertext.
- Para recuperar una conexión revocada, autorizar de nuevo desde `/connect`. No cambiar la clave de cifrado sin migrar el ciphertext o retirar la fila anterior mediante un administrador antes de reconectar. La lease evita que una reautorización pise una renovación en curso.
- Si Vercel Deployment Protection bloquea el backend, usar la URL de producción configurada; no quitar protección para exponer secretos.

## Comprobaciones pendientes de despliegue

Sin clave: el endpoint debe devolver 401. Con clave y conexión configurada: catálogo 200; detalle 200 solo para publicaciones activas de Gonba Garage. Reiniciar localhost debe conservar acceso a través de Vercel. Revocar la conexión debe impedir lectura y permitir reconectarla. Estas pruebas reales requieren migración, secretos, despliegue y autorización posteriores a la revisión del PR.
