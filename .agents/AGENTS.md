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

---

## 📅 Historial de Cambios y Commits Recientes

### Sesión del 20 de Julio de 2026
* **Commit `2d244c1`**: `feat: show current logged admin separately at top and nest other admins with their drivers in hierarchical view`
  * Aísla el perfil del administrador autenticado e implementa la vista jerárquica en árbol de coordinadores y repartidores.
* **Commit `587ad44`**: `feat: automatically update global fuel price configuration on each refueling event`
  * Introduce el cálculo dinámico y la auto-actualización del precio del gasoil global compartido en base a los repostajes reales ingresados en el sistema.
* **Commit `0c697fb`**: `style: replace hardcoded light text colors with dynamic CSS variables for theme accessibility`
  * Sustituye colores claros estáticos por variables dinámicas de CSS (`var(--danger)`, `var(--success)`, `var(--warning)`, `var(--primary)`) para garantizar una legibilidad excelente sobre fondos claros.
* **Commit `46fbaf2`**: `feat: add individual vehicle selector and filtering for fleet statistics and logs`
  * Implementa la selección interactiva y filtrado individual por vehículo de kilómetros, repostajes y mantenimientos en el panel de control de flota.

