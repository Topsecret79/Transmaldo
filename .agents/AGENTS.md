# Reglas y Pautas del Proyecto (Transmaldo Delivery App)

Este archivo contiene reglas y directrices críticas de diseño y comportamiento técnico para los agentes que trabajen en este repositorio.

## 🛡️ Aislamiento de Datos Multi-Admin (Multi-Tenant)
* **Regla**: Todas las configuraciones generales guardadas en la tabla `delivery_settings` de Supabase que sean de configuración de administrador (por ejemplo: listas de empleados, vehículos, ayudantes o permisos globales como transferencias) deben estar asociadas obligatoriamente al ID del administrador.
* **Claves con Sufijo**: Usa siempre el patrón `[clave]_[adminId]` al guardar en Supabase y localmente en localStorage.
* **Compatibilidad**: Proporciona siempre una comprobación de fallback cargando el valor sin sufijo si el valor con el sufijo de administrador aún no existe.

## 🏷️ Sistema de Etiquetas de Servicios Combinados (Cuelgue/Puesta en Marcha)
* **Regla**: Las notas de los tickets pueden contener etiquetas estructuradas entre corchetes para indicar servicios especiales de Mañana o Tarde:
  * `[CUELGUE_MAÑANA]`, `[CUELGUE_TARDE]`, `[PUESTA_MARCHA_MAÑANA]`, `[PUESTA_MARCHA_TARDE]`.
* **Procesamiento**:
  * `parseTicketNotes` en `db.js` debe extraer estas etiquetas, limpiar el texto que ve el repartidor y retornar la franja horaria (`timeSlot` = 'morning' o 'afternoon') y tipo de servicio correspondientes.
  * Al guardar cambios de tickets en el formulario, estas etiquetas combinadas deben re-inyectarse en el texto de notas.

## 🗺️ Mapa de Control y Marcadores (Option 3)
* **Regla**: Los marcadores de parada del mapa deben indicar el horario mediante el color del borde del círculo:
  * **Mañana (☀️)**: Borde amarillo/ámbar (`#fbbf24`).
  * **Tarde (🌙)**: Borde azul eléctrico (`#2563eb`).
  * **Indiferente/Todo el día**: Borde blanco.
* **Popups**: Incluye siempre las insignias descriptivas de servicio y horario dentro de la burbuja informativa (Popup) y en el listado de paradas lateral.

## 📋 Cierre de Turnos y Permisos
* **Regla**: Los selectores de turno para el repartidor (Chofer, Matrícula, Ayudantes) y sus validaciones de obligatoriedad al cerrar turno solo se deben mostrar si el administrador gestor del chofer (identificado por `createdBy`) tiene activados los módulos de **Calendario (`shift_calendar`)** y **Personal (`staff`)**.

## 🚐 Control de Flota y Diario de Kilómetros por Choferes
* **Regla**: El módulo de Control de Flota (vehículos, repostajes, mantenimientos y diario de kilómetros) debe ser multi-tenant, guardándose con el sufijo del administrador activo (`_adminId`).
* **Acceso Condicional para Choferes**: Las opciones de diario de kilómetros (`driverKmStart`, `driverKmEnd`, `driverKmL`) y el registro de repostajes de combustible (`driverFuelLiters`, `driverFuelCost`, `driverFuelStation`) para el rol `repartidor` en el cierre de turno se deben habilitar **únicamente** si el administrador que gestiona al chofer (`createdBy`) tiene activo el permiso `fleet_control`.
* **Automatización**: Al confirmar el cierre del turno, si el chofer ingresa lecturas de kilómetros finales superiores a las configuradas actualmente para el vehículo, el kilometraje del vehículo debe actualizarse automáticamente tanto localmente como en la base de datos de Supabase.

## ⛽ Cálculo Dinámico de Coste de Combustible Diario
* **Regla**: El coste del diario de kilómetros de vehículos de la flota se calcula dinámicamente utilizando el precio del combustible del administrador (`fuelPrice`) y el promedio de eficiencia del trayecto registrado en `kmL`:
  * $\text{Coste (€)} = \left(\frac{\text{Km Recorridos}}{\text{Km/L Promedio}}\right) \times \text{Precio de Gasoil}$.
  * Si el valor `kmL` del día no está definido o es 0, no se debe computar un coste por defecto, sino que se muestra un guion (`-`) con un tooltip aclaratorio para incentivar al chofer a introducir este dato de rendimiento.

## 👑 Vista Jerárquica de Usuarios y Permisos
* **Regla**: Para evitar la saturación visual, la pestaña de *Usuarios y Permisos* debe seguir una estructura jerárquica clara:
  * **Mi Cuenta (Tú)**: Muestra únicamente los datos del administrador/coordinador autenticado en la parte superior.
  * **Coordinadores y sus Choferes**: Lista de manera independiente al resto de coordinadores de la organización, anidando e indentando directamente debajo de cada uno de ellos a los repartidores que crearon.
  * **Mis Choferes Directos**: Agrupa en una sección propia a los choferes que dependen y fueron creados directamente por el administrador autenticado.

## 🔄 Actualización Dinámica de Precio de Combustible (Gasoil)
* **Regla**: No se debe depender exclusivamente de la edición manual del precio del litro de gasoil en los ajustes.
  * **Acción**: Al registrar cualquier repostaje (desde el diario de chofer al cerrar turno o desde el panel de Flota por un administrador), se debe calcular automáticamente:
    $$\text{Precio por Litro} = \frac{\text{Total Dinero (€)}}{\text{Litros}}$$
  * **Actualización**: Si este cálculo da un valor válido (> 0), se debe invocar a `handleUpdateFuelPrice` para actualizar la configuración de combustible (`fuelPrice`) asignada al ID del administrador de la cuenta (o su creador, si lo hace un chofer).

## 📊 Filtrado de Gastos por Vehículo en Dashboard de Flota
* **Regla**: El panel principal del módulo de Flota (Dashboard) debe contener un selector desplegable que permita filtrar de forma reactiva los indicadores clave (KPIs) y las tablas de historial (kilómetros diarios, repostajes y mantenimientos).
  * **Comportamiento**: Al seleccionar un vehículo específico, los cálculos y listados deben actualizarse dinámicamente sumando solo sus datos. Al seleccionar "Todos los vehículos", se muestra el consolidado total de la flota.

## 🏬 Proveedores Separados (El Corte Inglés vs. Dormity) y Proveedor Efectivo
* **Regla**: Al renderizar formularios de creación de tickets o guardar datos en la base de datos, siempre se debe calcular `effectiveTicketProvider` basándose en `getUserAllowedProviders(user)`:
  * Si el usuario solo tiene permiso para `eci` (o solo para `dormity`), se debe forzar este proveedor como efectivo, anulando cualquier estado en localStorage o prioridades por defecto.
* **Separación de Tarifas y Servicios**:
  * **El Corte Inglés (`eci`)**: Incluye tipos de servicio `estandar`, `cuelgue`, `puesta_marcha`. Catálogo: Televisores, Paquetería, Gama Blanca, Muebles, Electrodomésticos Varios, Otros Accesorios.
  * **Dormity (`dormity`)**: Excluye Puestas en Marcha (PMs) y Cuelgues de los desgloses, reportes diarios y exportaciones de Excel. Tipos de servicio: `estandar`, `preferencial`, `vip`. Catálogo: Colchones, Canapés, Tapis, Somieres, Cabeceros y Retiradas.

## ⚡ Carga Rápida de Rutas por Lote de Direcciones
* **Regla**: El planificador de rutas incluye la carga masiva multilínea sin límite de paradas (5, 20, 50, 80 o más).
* **Geolocalización & Optimización**:
  * Se limpia automáticamente cualquier prefijo numérico o viñeta (`1. `, `• `, `- `).
  * Realiza geolocalización secuencial en lote mostrando barra de progreso reactiva.
  * Ejecuta la reordenación secuencial OSRM para minimizar distancia y tiempo de viaje.
* **Tarjetas Incompletas**: Las paradas provisionales creadas por lote llevan `customerName` con formato `Parada #1`, `Parada #2` y muestran el distintivo `⚠️ Faltan datos` y el botón `✏️ Completar`.

## ⛔ Condicional de Bloqueo al Cerrar Turno (Rutas Incompletas)
* **Regla Inflexible**: No se permite cerrar el turno de un chofer (tanto en `handleConfirmCloseShift` como en el planificador) si en la jornada de esa furgoneta existe alguna parada creada por lote que permanezca incompleta.
* **Criterios de Incompletitud**:
  * El cliente mantiene el nombre provisional (`Parada #...`).
  * La parada no tiene ningún servicio o mercancía asignada (0 tareas en `t.tasks`).
* **Acción**: Si hay paradas incompletas, la función `handleConfirmCloseShift` detiene la ejecución, emite una alerta roja indicando qué paradas faltan por completar y retorna `false` impidiendo la liquidación del vale.

---

## 📅 Historial de Cambios y Commits Recientes

### Sesión del 20 de Julio de 2026
* **Commit `2d244c1`**: `feat: show current logged admin separately at top and nest other admins with their drivers in hierarchical view`
* **Commit `587ad44`**: `feat: automatically update global fuel price configuration on each refueling event`
* **Commit `0c697fb`**: `style: replace hardcoded light text colors with dynamic CSS variables for theme accessibility`
* **Commit `46fbaf2`**: `feat: add individual vehicle selector and filtering for fleet statistics and logs`

### Sesión del 21 de Julio de 2026
* **Commit `a831a1a`**: `fix: compute activeTariffSubTab dynamically so single-provider users don't see a blank tariffs screen (SW v236)`
* **Commit `a662236`**: `fix: ensure user creation form and fleet tab are accessible to all admin roles (SW v237)`
* **Commit `fba70af`**: `fix: compute effectiveTicketProvider dynamically so ECI-only users see ECI form catalog and options correctly (SW v238)`
* **Commit `87517dc`**: `feat: add Fast Address Batch Route Builder with unlimited stops, sequential geocoding and OSRM optimization (SW v239)`
* **Commit `9e1227d`**: `feat: block shift closure if fast batch route stops have incomplete client/services data (SW v240)`

