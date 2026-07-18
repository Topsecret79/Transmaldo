# Transmaldo Delivery App - Reglas de Desarrollo y Buenas Prácticas

Estas reglas definen el comportamiento esperado y las restricciones de diseño para este proyecto:

## 🗺️ Cartografía y Mapas
* **Motor de Mapas**: Se utiliza Leaflet (`react` y `leaflet`) como motor de mapas ligero y gratuito.
* **Capas base**: Las capas oficiales por defecto son las teselas raster de Google Maps:
  * Google Calles (`https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=es`)
  * Google Satélite Híbrido (`https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=es`)
  * Google Tráfico en Vivo (`https://mt1.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}&hl=es`)
* **Rotación de Mapa**: Habilitada la rotación interactiva mediante `leaflet-rotate`.
* **Legibilidad de Marcadores**: Al girar el mapa, los marcadores, números de parada e información flotante deben contra-rotarse automáticamente (`transform: rotate(${-mapRotationState}deg)`) para permanecer legibles verticalmente de izquierda a derecha.
* **Trazado de Rutas**: Utilizar siempre `preferCanvas: true` en la inicialización del mapa para que las líneas de la trayectoria se dibujen directamente en el lienzo Canvas, previniendo lag o desfase visual al rotar/arrastrar.

## 🛰️ Geocodificación y Direcciones (España)
* **Buscador Principal**: Priorizar siempre la API premium gratuita de `CartoCiudad` para búsquedas y autocompletados en territorio español. Usar Nominatim (OpenStreetMap) únicamente como fallback en caso de error o dirección internacional.
* **Formateo de Direcciones**: Incorporar siempre el municipio/pueblo (`item.muni`) en las sugerencias estructuradas devueltas por CartoCiudad.
* **Resolución de Código Postal**: Para paradas antiguas, manuales o importadas que carezcan del texto de la población, utilizar el helper `getTownAndProvinceFromPostcode` en el frontend para mostrar dinámicamente el pueblo asociado al código postal al lado de la dirección.

## 🔄 Sincronización en Segundo Plano y Estados
* **No Interrupción**: Las consultas recurrentes de sincronización (como `loadData()` cada 15 segundos) nunca deben limpiar, restaurar o sobrescribir los valores activos que el usuario esté escribiendo en formularios, campos de origen de ruta (`routeStartAddr`) o destino (`routeEndAddr`).
* **Control de Concurrencia**: Utilizar variables de cerrojo como `isSaving` para evitar interrupciones o sobredepósitos de datos locales mientras se están guardando cambios en la base de datos remota de Supabase.

## 🎨 Interfaz y Accesibilidad
* **Tema Oscuro**: Mantener un diseño premium con altos contrastes. Los botones críticos de acción (como `➕ Nueva Ruta / Fecha`) deben usar un fondo blanco sólido y texto en negro negrita para destacar claramente sobre el fondo oscuro.

## 🔒 Autenticación y Seguridad
* **Inicio de Sesión Mixto**: Los repartidores (choferes) se autentican mediante su nombre de usuario y PIN hash local/remoto clásica. Los administradores y coordinadores se autentican mediante su correo electrónico personal a través de Supabase Auth.
* **Vinculación en Caliente**: Los administradores existentes sin correo asociado deben ser redirigidos en su primer inicio de sesión clásico a un diálogo para vincular su correo personal de forma no destructiva, conservando su histórico de tarifas y repartos.
* **Tolerancia a Cambios de Esquema**: Si la base de datos remota carece de las columnas de seguridad (`email`, `auth_uid`, `permissions`), la aplicación debe capturar el error `42703`/`PGRST204` de forma silenciosa, realizar el upsert omitiendo dichas columnas, persistirlas localmente y mostrar una recomendación de migración SQL en el panel del Superadmin.

