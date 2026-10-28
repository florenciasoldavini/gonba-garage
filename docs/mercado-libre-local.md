# Catálogo local de Mercado Libre

La sesión de prueba existe únicamente en la memoria del servidor de desarrollo. No se escriben vehículos, tokens ni conexiones en Supabase. Reiniciar el servidor borra la sesión; al vencer el access token hay que autorizar otra vez.

1. Configurar en el entorno local del servidor `VEHICLE_DATA_SOURCE=mercado-libre`, `SITE_INDEXING_ENABLED=false`, `MERCADO_LIBRE_CLIENT_ID` y `MERCADO_LIBRE_CLIENT_SECRET`. Las credenciales nunca deben llevar el prefijo `NEXT_PUBLIC_` ni subirse a Git.
2. Iniciar el servidor con `npm run dev -- --webpack` (el worktree usa dependencias enlazadas, incompatibles con Turbopack).
3. Exponer ese servidor con un túnel HTTPS. Registrar en la aplicación de Mercado Libre la URL exacta `https://<tunel>/api/mercado-libre/callback` y usar ese mismo valor en `MERCADO_LIBRE_REDIRECT_URI`. Reiniciar el servidor si cambia el entorno.
4. Abrir `https://<tunel>/api/mercado-libre/connect` y autorizar con la cuenta de Gonba Garage. El callback redirige a `/vehiculos` después de guardar el access token únicamente en memoria.
5. Abrir el catálogo en `http://localhost:3000/vehiculos`. La ficha muestra todas las imágenes devueltas por `pictures` y todos los atributos devueltos por `attributes`; la descripción se solicita al abrir la ficha. Los links de imágenes permiten abrir el original.

El callback desplegado en Vercel no puede autorizar la memoria del servidor local. Se necesita un callback que llegue al mismo proceso local. Las credenciales configuradas como Secret en producción tampoco pueden recuperarse mediante un env pull.

Esta prueba no renueva tokens automáticamente ni publica un catálogo permanente. Los errores de conexión no se sustituyen por autos de demostración. Las alertas de precio se deshabilitan para fichas reales porque ese flujo todavía usa inventario de demostración.
