# Reglas del Proyecto - Control de Repartos y Ganancias

Este archivo contiene reglas y pautas de comportamiento específicas del proyecto que todos los agentes de IA deben respetar al modificar el código.

## 1. Gestión de Rutas de Apoyo y Reasignación Automática
* **Formato de Notas**: Los tickets de auxilio/apoyo deben comenzar siempre con la etiqueta `[Ruta Original: <Nombre de Ruta>]` al principio de las notas (ej. `[Ruta Original: Ruta 151] [Horario: Mañana] ...`).
* **Preservación Obligatoria**: Cualquier función que procese, parsee o actualice las notas de los tickets (como `parseTicketNotes`, `encodeTicketNotes` o `executeTicketStatusUpdate`) **debe mantener y conservar** esta etiqueta `[Ruta Original: ...]` en el primer lugar de la cadena.
* **Disparador de Reasignación**: La base de datos local y remota depende del prefijo exacto `[Ruta Original: ` para reasignar automáticamente el ticket al vehículo propietario original cuando el repartidor de apoyo finaliza la entrega (estado `success` o `failed`). Si el prefijo se pierde o se mueve de sitio, la reasignación fallará y las ganancias se calcularán incorrectamente.
