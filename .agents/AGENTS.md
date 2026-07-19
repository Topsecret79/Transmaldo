# Transmaldo Delivery App - Reglas de Desarrollo y Buenas Prácticas

Estas reglas definen el comportamiento esperado y las restricciones de diseño para este proyecto:

## 🗺️ Cartografía y Mapas
* **Motor de Mapas**: Se utiliza Mapbox GL JS (`mapbox-gl`) como motor de mapas vectorial nativo y de alto rendimiento. No utilizar Leaflet ni complementos de Leaflet en nuevas implementaciones.
* **Estilo Base**: El estilo oficial por defecto es la capa vectorial de Mapbox Calles (`mapbox://styles/mapbox/streets-v12`).
* **Token de Mapbox**: Utilizar siempre el token oficial configurado mediante variables de entorno en el archivo `.env` (`VITE_MAPBOX_ACCESS_TOKEN`).
* **Ciclo de Vida de Marcadores y Capas**:
  * La instancia del mapa se guarda en `mapInstanceRef`.
  * Los marcadores se deben registrar en `mapMarkersRef.current` y `mapDriverMarkersRef.current` para garantizar su correcta eliminación (`marker.remove()`) antes de cada renderizado o al desmontar el componente, evitando fugas de memoria y marcadores duplicados.
  * Para agregar fuentes o capas GeoJSON (como el trazado de rutas de reparto), comprobar siempre si el mapa ha terminado de cargar su estilo (`map.isStyleLoaded()`). En caso contrario, registrar un evento de escucha `style.load` de una sola vez (`map.once('style.load', ...)`).
* **Rutas por Carretera (OSRM)**:
  * El cálculo de rutas OSRM se realiza a través de la función `fetchRoadRoute`.
  * Se utiliza un caché en memoria (`roadRouteCache`) indexado por las coordenadas redondeadas a 5 decimales. No omitir este caché para evitar re-peticiones innecesarias a la API de OSRM durante re-renders.

## 🛰️ Geocodificación y Direcciones (España)
* **Buscador Principal**: Priorizar siempre la API de `CartoCiudad` para búsquedas y autocompletados en territorio español. Usar Nominatim (OpenStreetMap) únicamente como fallback en caso de error o dirección internacional.
* **Formateo de Direcciones**: Incorporar siempre el municipio/pueblo (`item.muni`) en las sugerencias estructuradas devueltas por CartoCiudad.
* **Resolución de Código Postal**: Para paradas antiguas, manuales o importadas que carezcan del texto de la población, utilizar el helper `getTownAndProvinceFromPostcode` en el frontend para mostrar dinámicamente el pueblo asociado al código postal al lado de la dirección.

## 🔄 Sincronización en Segundo Plano y Estados
* **No Interrupción**: Las consultas recurrentes de sincronización (como `loadData()` cada 15 segundos) nunca deben limpiar, restaurar o sobrescribir los valores activos que el usuario esté escribiendo en formularios, campos de origen de ruta (`routeStartAddr`) o destino (`routeEndAddr`).
* **Control de Concurrencia**: Utilizar variables de cerrojo como `isSaving` para evitar interrupciones o sobredepósitos de datos locales mientras se están guardando cambios en la base de datos remota de Supabase.

## 🎨 Interfaz y Accesibilidad (Tema Claro/Oscuro)
* **Altos Contrastes**: Evitar el uso de textos de color blanco (`#ffffff`) sobre fondos claros o grises en calendarios y listados.
* **Variables CSS del Tema**: Utilizar siempre variables de CSS como `var(--text-main)`, `var(--text-muted)`, `var(--input-bg)` y `var(--panel-border)` en lugar de estilos inline con colores fijos en modales, formularios, tablas de nóminas y tarjetas del calendario.
* **Legibilidad de Empleados**: Los nombres de los choferes y ayudantes en las celdas y resúmenes del calendario de turnos deben mantener un contraste nítido y legible en cualquier tema.

## 🔒 Autenticación y Seguridad
* **Inicio de Sesión Mixto**: Los repartidores (choferes) se autentican mediante su nombre de usuario y PIN hash local/remoto clásica. Los administradores y coordinadores se autentican mediante su correo electrónico personal a través de Supabase Auth.
* **Vinculación en Caliente**: Los administradores existentes sin correo asociado deben ser redirigidos en su primer inicio de sesión clásico a un diálogo para vincular su correo personal de forma no destructiva, conservando su histórico de tarifas y repartos.
* **Tolerancia a Cambios de Esquema**: Si la base de datos remota carece de las columnas de seguridad (`email`, `auth_uid`, `permissions`), la aplicación debe capturar el error `42703`/`PGRST204` de forma silenciosa, realizar el upsert omitiendo dichas columnas, persistirlas localmente y mostrar una recomendación de migración SQL en el panel del Superadmin.
* **Detección Dinámica de Columnas**: Al guardar o hacer upsert de usuarios, la aplicación debe consultar primero la estructura de la tabla (usando una consulta de límite 1) para construir dinámicamente el objeto de fila. Esto evita fallos causados por columnas incompatibles o inexistentes en la base de datos remota de Supabase sin descartar información crítica como el `email` y `auth_uid`.

## 📅 Gestión de Turnos y Nóminas
* **Soporte para Múltiples Ayudantes**: El sistema de turnos soporta la asignación de hasta dos ayudantes (`helper` y `helper2`) por cada ruta/furgoneta. Toda interfaz que muestre, planifique o edite los detalles de los turnos en el calendario (vista mensual, semanal, diaria y modal) debe incluir soporte para ambos ayudantes de manera explícita.
* **Cálculo de Nóminas Consolidado**: Al calcular los días y tarifas devengados por los empleados en las nóminas del período, el sistema debe auditar y contar tanto los turnos realizados como chofer, como aquellos realizados en el rol de primer ayudante (`helper`) o de segundo ayudante (`helper2`).
* **Configuración del Turno por el Repartidor**:
  * Los conductores pueden auto-asignar su Chofer, Matrícula y Ayudantes desde su pestaña de historial diario (`activeTab === 'history'`).
  * Validación de Cierre: Al pulsar "Finalizar Turno" se valida obligatoriamente que se hayan configurado el Chofer y la Matrícula del vehículo, previniendo cierres con información faltante.
