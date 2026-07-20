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
