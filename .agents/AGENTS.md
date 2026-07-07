# Reglas del Proyecto - Control de Repartos y Ganancias

Este archivo contiene reglas, restricciones de diseño y pautas de comportamiento específicas del proyecto que todos los agentes de IA deben respetar al modificar el código.

## 1. Restricción de Visualización de Ganancias (Permisos)
* **Choferes/Repartidores**: No pueden visualizar el "Total Ganado (Día)" ni el desglose financiero detallado en el resumen de cierre de jornada. Esta información es estrictamente confidencial y exclusiva para Administradores y Super Administradores.
* **Administradores / Super Admins**: Tienen visibilidad completa de todas las ganancias acumuladas, cálculos de kilometraje y totales diarios en el resumen.

## 2. Filtros de Servicios en Reportes
* **Exclusiones por Defecto**: Los servicios marcados como "Fallidos" (failed) y los cobros manuales o en mano deben excluirse de los cálculos de reportes financieros estándar, a menos que se activen de forma explícita opciones de visualización alternativas.

## 3. Gestión de Rutas de Apoyo (Auxilio) y Reasignación Automática
* **Formato de Notas**: Los tickets de auxilio/apoyo deben comenzar siempre con la etiqueta `[Ruta Original: <Nombre de Ruta>]` al principio de las notas (ej. `[Ruta Original: Ruta 151] [Horario: Mañana] ...`).
* **Preservación Obligatoria**: Cualquier función que procese, parsee o actualice las notas de los tickets (como `parseTicketNotes`, `encodeTicketNotes` o `executeTicketStatusUpdate`) debe mantener y conservar esta etiqueta `[Ruta Original: ...]` en el primer lugar de la cadena.
* **Disparador de Reasignación**: La base de datos local y remota depende del prefijo exacto `[Ruta Original: ` para reasignar automáticamente el ticket al vehículo propietario original cuando el repartidor de apoyo finaliza la entrega (estado `success` o `failed`). Si el prefijo se pierde o se mueve de sitio, la reasignación fallará y las ganancias se calcularán incorrectamente.

## 4. Visualización de Jornadas y Cierres
* **Turno de Hoy**: Si un chofer cierra su turno, este debe aparecer de inmediato en la lista de turnos cerrados históricos del día (en lugar de filtrarse o quedar invisible hasta el día siguiente).

## 5. Tarifas Personalizadas de Catálogo
* **Cálculo de Precios**: Las tarifas que pertenecen al catálogo personalizado definido por el administrador deben evaluarse mediante la función `calculateTaskPrice` consultando el catálogo global de tarifas (`tariffs`), en lugar de ser tratadas como extras manuales y costar `0.00 €`.
* **Priorización de 'isCustom'**: Al agregar o actualizar un ticket, la verificación para determinar si una tarifa es verdaderamente personalizada (`isCustom`) debe consultar el catálogo global para no confundir tarifas catalogadas con extras introducidos manualmente al vuelo.

## 6. Preferencia de Navegador GPS
* **Flujo del Modal**: Al iniciar la navegación, se debe mostrar un modal interactivo premium para elegir entre Google Maps y Waze, ofreciendo la opción de recordar la decisión.
* **Persistencia**: La elección del navegador preferido se almacena localmente y se puede cambiar o restablecer desde la pestaña de Ajustes del usuario.
