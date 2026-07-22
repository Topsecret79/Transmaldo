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

## 🛌 Modalidades de Servicio de Ruta Dormity (Madrid, Express, Toledo)
* **Regla**: Las rutas de Dormity admiten distintas modalidades a nivel de jornada/turno (`shiftDormityServiceType`):
  * **Ruta Madrid**: Tarifa base de **700,00 €** (paradas 1 a 8 fijas). A partir de la 9ª parada, se añade automáticamente un extra de **+70,00 € por cada parada adicional** (`DORMITY_MADRID_EXTRA`).
  * **Ruta Toledo**: Tarifa plana fija única por servicio de ruta (**700,00 €**), independiente del número de paradas.
  * **Ruta Express / Servicios Día**: Tarifas por tramos de distancia (Cercanía, Media, Lejanía) y opción **Tienda** (antigua *Tienda Express*). Se han eliminado de forma permanente las opciones de Gran Lejanía.
* **Persistencia**: La modalidad de servicio se selecciona en la cabecera de la ruta activa y se sincroniza reactivamente para todas las entregas del turno.

## 🛍️ Catálogo Desacoplado de Mercancías de Dormity y Privacidad de Precios
* **Regla**: El catálogo del Paso 2 del formulario para Dormity (Colchones, Canapés, Tapis, Somieres, Cabeceros, Patas, Recogidas y Retiradas) está totalmente desacoplado del motor de precios de ruta.
* **Privacidad para Choferes**: Los usuarios con rol `repartidor` **NUNCA** ven importes monetarios ni precios unitarios en la interfaz del catálogo de mercancías ni en los desgloses de entregas. Únicamente los administradores tienen visibilidad de precios.
* **Artículos Personalizados**: Se permite la inclusión de artículos fuera de catálogo en el Paso 2 con nombre y cantidad libre (`customItemName`, `customItemQty`).

## 🔒 Heredabilidad y Restricción Estricta de Proveedores Permitidos (`allowedProviders`)
* **Regla**: `allowedProviders` se almacena como array (`['eci']`, `['dormity']` o ambos) en Supabase dentro de `delivery_settings_[adminId]`.
* **Heredabilidad de Creador**: Al crear un nuevo usuario o repartidor, este **hereda estrictamente los proveedores permitidos de su administrador creador**. Un chofer creado por un admin de solo Dormity jamás podrá acceder a El Corte Inglés.
* **Ocultamiento de Selector**: Si un usuario tiene un único proveedor en `allowedProviders`, los botones manuales para alternar proveedor en el formulario se **ocultan automáticamente** para prevenir errores.

## 🚫 Prohibición Cruzada de Tipos de Servicio entre ECI y Dormity
* **Regla**:
  * **Dormity**: Únicamente admite `estandar`, `preferencial` y `vip`. Las Puestas en Marcha (PMs) y Cuelgues de TV en Pared están totalmente **PROHIBIDOS y DESHABILITADOS** en los dropdowns de Dormity.
  * **El Corte Inglés**: Únicamente admite `estandar`, `cuelgue` (TV pared) y `puesta_marcha` (PM). Los servicios `preferencial` y `vip` están totalmente **PROHIBIDOS y DESHABILITADOS** para El Corte Inglés.

## 📊 Exclusión Total de Puestas en Marcha (PMs) en Reportes Dormity
* **Regla**: En los reportes diarios de facturación, desglose por furgonetas, tablas de drilldown y exportación de archivos Excel, las Puestas en Marcha (PMs) se **filtran y omiten al 100% cuando el ticket pertenezca a Dormity**, conservándose únicamente para tickets de El Corte Inglés.

## ⚙️ Gestión Dinámica de Tarifas de Dormity en Panel Admin
* **Regla**: Si el administrador autenticado solo tiene acceso a Dormity, la sub-pestaña del tarifario se establece por defecto en `'dormity'` (`activeTariffSubTab = 'dormity'`) y la pestaña de El Corte Inglés se oculta, evitando vistas en blanco.
* **Edición Inline Completa**: Todas las tarifas de Dormity permiten editar Nombre, Bloque, Tipo (`fixed`/`percentage`), Precio (€) y Eliminación directa en caliente con recalculo en tiempo real.

## 💵 Control de Reembolsos / Cobros en Efectivo (COD)
* **Regla**: El Paso 1 del ticket incluye un conmutador interactivo para activar cobros/reembolsos en efectivo. Al activarse, habilita el campo de importe `codAmount` (€), sumándose automáticamente al resumen de caja del turno y en la facturación en Excel.

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

## 🚗 Kilometraje de Odómetro (Telemetría Flota) vs. Kilómetros Facturables (Tareas Manuales Ticket)
* **Odómetro de Vehículo (Telemetría de Flota)**: Los kilómetros diarios de odómetro registrados por el chofer al iniciar y cerrar turno (`driverKmStart`, `driverKmEnd`, `getRouteKms()`) corresponden al control de telemetría y mantenimiento de la flota. **NUNCA** se multiplican por la tarifa de kilometraje (`kmPrice`) ni se añaden a los totales de salario, facturación de furgonetas, resúmenes diarios o cortes de facturación. En informes y Dashboard se presentan estrictamente a **0.00 €** como `Odómetro Flota (X km - Control de Flota)`.
* **Kilómetros Facturables (Tareas Manuales de Ticket)**: Los únicos kilómetros que generan importe de facturación (€) en los resúmenes diarios son aquellos que el chofer o administrador **introduce manualmente dentro de un ticket/albarán** (por ejemplo: seleccionando la tarifa *Kilometraje Ruta Larga / Extra* o especificando una distancia $X$ facturable para un servicio especial).


## ⚙️ Desglose Obligatorio de Puestas en Marcha (PM Básica vs PM Compleja) para Todos los Administradores
* **Regla Inflexible**: Para **todos los administradores, coordinadores y repartidores** del sistema, todas las pantallas de resumen (Dashboard, Desglose Diario, Informe Diario y Exportaciones Excel) deben mostrar siempre el **desglose explícito entre Puestas en Marcha Básicas (`PM_BAS_` @ 11.43 €) y Puestas en Marcha Complejas (`PM_COMP_` @ 19.05 €)**.
* **Formato**: En tarjetas de contadores y cabeceras de informes se muestra el total y el sub-desglose: `X PMs (Y Básicas / Z Complejas)`. Ambas tarifas se contabilizan y suman íntegramente en la facturación neta de los tickets.

## 🔄 Sincronización Obligatoria de Valores entre Resumen Diario e Informe del Día
* **Regla Inflexible**: Para garantizar que los valores coincidan al 100% entre pantallas, la columna y tarjeta principal en **Resumen Diario (Dashboard y Modal de Desglose)** debe mostrar siempre la **Base Imponible directa (€)** de la facturación de servicios, coincidiendo con la **Base Imponible del Informe del Día**. El cálculo de Neto con IVA/Retención se presenta como información secundaria aclaratoria.

## 🔄 Asignación de Albaranes con Auxilio entre Rutas (Criterio de Origen por Defecto)
* **Regla Inflexible**: Los albaranes etiquetados como auxilios realizados por otra furgoneta (ej. `(Auxilio realizado por Ruta X)`) pertenecen por defecto en el informe diario a su **Ruta de Origen** (donde fueron planificados originalmente), a menos que la administración transfiera explícitamente el ticket a la furgoneta ejecutora.

## ⚙️ Desglose Dinámico de Puestas en Marcha en Turnos Históricos Cerrados
* **Regla**: Si un turno se cerró en el pasado y carece de desglose de `pmsBasic` y `pmsComplex` en su instantánea guardada, la interfaz debe calcularlo y completarlo dinámicamente y de manera retroactiva al renderizarlo en la tabla de turnos y en la ventana modal de resumen.

## 🔄 Sincronización Total de Ganancias de Entregas (Exclusión de Fallidos y Tasa de Intento)
* **Regla**: El valor de ganancias de entregas que se muestra en el cierre de turno y vale de liquidación de la ruta (esté abierto o cerrado) debe calcularse usando `getBillableTasks` en cada ticket del día. Debe coincidir al 100% con la lógica del informe diario: excluyendo albaranes fallidos sin cargo (sumando 0.00 €) e incluyendo albaranes fallidos con cobro sumando únicamente el importe de su tasa por intento de entrega, en lugar de sumar el importe de tarifa original.

## 💬 Reglas de Comunicación con el Usuario
* **Regla Inflexible**: Responder **únicamente** y de manera concisa sobre la pregunta o instrucción formulada por el usuario. Evitar dar explicaciones no solicitadas, detalles extras o resúmenes innecesarios.
* **Certeza Absoluta**: Toda respuesta debe basarse en la verificación directa de la base de datos o el código fuente antes de contestar, respondiendo con total precisión y seguridad.

---

## 📅 Historial de Cambios y Commits Recientes

### Sesión del 20 de Julio de 2026
* **Commit `2d244c1`**: `feat: show current logged admin separately at top and nest other admins with their drivers in hierarchical view`
* **Commit `587ad44`**: `feat: automatically update global fuel price configuration on each refueling event`
* **Commit `0c697fb`**: `style: replace hardcoded light text colors with dynamic CSS variables for theme accessibility`
* **Commit `46fbaf2`**: `feat: add individual vehicle selector and filtering for fleet statistics and logs`

### Sesión del 21 de Julio de 2026
* **Commit `594e12a`**: `feat: implement Dormity route modes (Madrid, Express, Toledo) with automatic 70EUR 9th stop extra pricing`
* **Commit `12d2d7f`**: `fix(dormity): decouple Step 2 merchandise catalog from route pricing tariffs`
* **Commit `d2c01cd`**: `fix: inherit and restrict allowed providers strictly based on logged-in creator permissions`
* **Commit `95e2692`**: `fix: separate service type options for El Corte Ingles (cuelgue, puesta_marcha) and Dormity (estandar, preferencial, vip)`
* **Commit `7506e73`**: `Fix Dormity daily reports to exclude Puestas en Marcha (SW v234)`
* **Commit `a831a1a`**: `fix: compute activeTariffSubTab dynamically so single-provider users don't see a blank tariffs screen (SW v236)`
* **Commit `a662236`**: `fix: ensure user creation form and fleet tab are accessible to all admin roles (SW v237)`
* **Commit `fba70af`**: `fix: compute effectiveTicketProvider dynamically so ECI-only users see ECI form catalog and options correctly (SW v238)`
* **Commit `87517dc`**: `feat: add Fast Address Batch Route Builder with unlimited stops, sequential geocoding and OSRM optimization (SW v239)`
* **Commit `9e1227d`**: `feat: block shift closure if fast batch route stops have incomplete client/services data (SW v240)`
* **Commit `f656eaf`**: `docs: update AGENTS.md rules with multi-provider, batch route builder, and shift closure block guidelines`
* **Commit `7910f58`**: `renombrar Tienda Express a Tienda (SW v244)`
* **Commit `c471ad6`**: `fix: set Ruta Toledo as flat rate (700€) and retain +70€ extra from 9th stop for Ruta Madrid (SW v245)`
* **Commit `9f2c2df`**: `fix: remove superadmin raw-return bypass in getDormityTariffs to unify tariff sanitization (SW v246)`
* **Commit `79b2555`**: `fix: set exact default nomenclature labels for Ruta Madrid, Cliente Adicional Madrid and Ruta Toledo (SW v247)`
* **Commit `0a91f54`**: `fix: string match in initDB auto-seed for DORMITY_MADRID (SW v248)`
* **Commit `2b73c41`**: `fix: exclude shift odometer telemetry kms from earnings calculation (SW v250)`

### Sesión del 22 de Julio de 2026
* **Commit `945dae7`**: `feat: add detailed breakdown for PM Basica vs PM Compleja in Dashboard and Drilldown tables (SW v251)`
* **Commit `a401662`**: `feat: ensure PM Basica vs PM Compleja breakdown rule is applied for all admins and saved in AGENTS.md (SW v251)`
### Sesión del 23 de Julio de 2026
* **Commit `0f7a71a`**: `feat: add dynamic PM breakdown calculation for historical closed shifts (SW v255)`
* **Commit `b35da1f`**: `fix: align shift total delivery earnings with daily report logic (SW v256)`
* **Commit `a90ade6`**: `fix: ensure fleet driver mileage pay shows 0.00 EUR (Control) and restore database for 01/07/2026 (SW v257)`
