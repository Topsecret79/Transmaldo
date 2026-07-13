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

## 7. Restricción de Visualización de Actualizaciones (Changelog)
* **Acceso Restringido**: El portal o pestaña "Actualizaciones" (Changelog) es información de uso técnico y administrativo interno.
* **Choferes/Repartidores**: Tienen prohibido visualizar la pestaña "Actualizaciones" en su portal. Debe removerse de sus menús de navegación.
* **Administradores / Super Admins**: Son los únicos que pueden acceder a la pestaña "Actualizaciones" para revisar el historial de cambios del sistema.

## 8. Preservación de Ordenamiento Manual y Optimización con Fin de Ruta
* **Preservación del Orden Manual**: Cuando un conductor o administrador realiza un reordenamiento manual de paradas (cambio de secuencia de ruta), se debe marcar la ruta como "manual" para esa furgoneta y día. En este estado, el sistema tiene prohibido auto-optimizar o reordenar los tickets pendientes al completar paradas.
* **Restablecimiento por Optimización**: Si se presiona el botón "Optimizar Ruta", la ruta pierde el estado "manual" y se re-calcula de forma óptima.
* **Optimización con Punto de Llegada (Fin)**: El algoritmo de optimización automática del sistema debe contemplar el punto de partida (inicio) y el punto de llegada (fin/retorno). Debe buscar la ruta más corta desde el inicio, pasando por los diferentes bloques horarios, y finalizando lo más cerca posible del punto de llegada establecido en los ajustes.

## 9. Cálculo de Hora de Llegada Estimada (ETA) y Retorno a Origen
* **Cálculo de Llegada**: La hora estimada de llegada de cada parada se calcula secuencialmente sumando el tiempo de tránsito desde la parada anterior (estimado a 35 km/h) y el tiempo de servicio/duración configurado para cada cliente.
* **Inclusión del Retorno**: La ruta de reparto no finaliza al atender al último cliente; se debe sumar el tramo final desde la última parada hasta el **Punto de Llegada (Retorno/Fin)**.
* **Métricas Totales**: La hora de fin de jornada y la distancia total del día mostradas al conductor y administrador deben incluir obligatoriamente este trayecto de retorno para reflejar fielmente la jornada real y el combustible/distancia consumidos.

## 10. Fecha de Trabajo por Defecto al Cargar o Actualizar
* **Comportamiento General**: Al abrir, actualizar o recargar la aplicación, todos los filtros y vistas de fechas (incluyendo el portal del repartidor y el del administrador) se deben inicializar por defecto con la fecha del día en curso (hoy).
* **Búsqueda Manual**: Se prohíbe dejar las vistas de fecha vacías o cargar por defecto todo el histórico acumulado. Si el usuario o administrador desea consultar otra jornada de trabajo anterior o futura, deberá hacerlo seleccionando manualmente la fecha mediante los filtros de búsqueda correspondientes.

## 11. Cambio de Contraseña Obligatorio para Nuevos Usuarios
* **Creación de Usuario**: Cuando el Super Administrador crea un nuevo usuario (sea administrador o repartidor), se establece la propiedad `mustChangePassword` como `true` por defecto.
* **Flujo del Primer Inicio de Sesión**: Al iniciar sesión por primera vez con sus credenciales temporales, el sistema debe interceptar el acceso y redirigir obligatoriamente al usuario a una pantalla de "Cambio de Contraseña".
* **Establecimiento de Contraseña Privada**: El usuario debe introducir y confirmar su nueva contraseña privada. Una vez guardada con éxito, se actualiza en la base de datos, se desactiva el flag (`mustChangePassword: false`) y se inicia su sesión automáticamente. Esto asegura que solo el propio usuario conozca su contraseña de acceso.

## 12. Filtro de Furgoneta/Repartidor en Corte de Facturación (Periodo)
* **Filtrado General**: El dashboard del administrador y la herramienta de corte de facturación por rango de fechas (Corte de Periodo) deben permitir filtrar la información por una furgoneta/repartidor específica además de por fechas.
* **Cálculo de Totales**: Al seleccionar una furgoneta del filtro de facturación, todos los resúmenes acumulados (Total del Periodo, Entregas con éxito, Puestas en Marcha, kilometraje y distancia acumulada) y los desgloses en las tablas de facturación y gráficos deben corresponder exclusivamente a la furgoneta seleccionada.
* **Exportación de Datos**: La descarga del informe detallado a Excel (.xlsx) debe respetar obligatoriamente este filtro, exportando únicamente los repartos y el kilometraje acumulado de la furgoneta seleccionada cuando no esté en opción "Todas las furgonetas".

## 13. Cuadro de Detalle Flotante Arrastrable (Draggable) en el Mapa
* **Interactividad y Arrastre**: El cuadro de detalles de parada rápida (`.map-floating-details`) situado sobre el mapa debe ser arrastrable (soporte para mouse/touch dragging). El usuario puede arrastrarlo libremente a cualquier zona del mapa para evitar que obstruya su visualización.
* **Preservación del Diseño**: El arrastre debe implementarse mediante propiedades CSS `transform` dinámicas, asegurando que se conserve el centrado de pantalla responsivo en móviles al cargar por primera vez y sin alterar la lógica interna de sus botones, enlaces, selectores y cambios de estado.

## 14. Detalle Diario por Furgoneta (Drill-Down)
* **Interactividad del Dashboard**: Al hacer clic en las columnas del gráfico de barras o en las filas de la tabla de facturación del Dashboard, se debe abrir un modal de desglose diario (`renderDrilldownModal`).
* **Visualización de Datos**: El modal debe compilar y ordenar cronológicamente todos los días de actividad del repartidor en el periodo, mostrando el neto diario, kilometraje, éxitos y detalles de entregas.
* **Exportación Individual**: Debe incluir un botón para exportar a Excel (`exportSingleFurgoDailyReport`) con el desglose diario exclusivo del conductor seleccionado.
* **Ámbito del Renderizado**: Las funciones de compilación y renderizado del modal y su Excel deben declararse dentro del ámbito de la función `renderAdminPortal` para tener acceso por clausura a las variables de filtrado (`filteredAdminTickets`, `shifts`, etc.) y evitar errores de referencia en Android/iOS.
* **Scroll Nativo en Móviles**: Para garantizar la compatibilidad con Android Chrome, el modal emergente debe tener su scroll vertical en el elemento contenedor de fondo (`.drilldown-overlay` con `overflow-y: auto`), permitiendo que el contenido interior crezca de forma natural y evitando así bloqueos por desbordamientos verticales anidados.

## 15. Traslado de Ruta Completa de Fecha (Bulk Date Transfer)
* **Botón de Acción**: En la pestaña de Repartos del Periodo (`tickets`), al filtrar por una furgoneta y fecha específicas, debe habilitarse el botón "📅 Cambiar Fecha de esta Ruta".
* **Traslado de Datos en Lote**: Esta acción abre un modal (`renderMoveRouteModal`) que traslada en un solo paso la fecha de todos los tickets y del turno de kilometraje (`shift`) asociado a esa fecha y conductor a una nueva fecha seleccionada.
* **Consistencia e Historial**: Los cambios deben aplicarse localmente y sincronizarse en Supabase de forma atómica para no dejar datos huérfanos o incongruencias en facturaciones.
* **Redirección de la Vista**: Al finalizar con éxito, el sistema debe cambiar el filtro de fecha activo a la nueva fecha de destino para que el usuario sea redirigido y verifique el traslado de inmediato.

## 16. Separación de Tarifas y Precios para Superadministrador (Filtro por Propietario)
* **Evitar Duplicados**: El catálogo de tarifas para el Super Administrador debe presentarse de forma organizada y separada para evitar duplicar artículos base con copias de administradores.
* **Filtro Desplegable (`selectedTariffOwner`)**: Se debe mostrar un selector desplegable en la parte superior para elegir entre "Tarifas Base (Originales)" y las tarifas personalizadas de cada administrador (`users.filter(u => u.role === 'admin')`).
* **Visualización de Tarifas Base**: Al seleccionar "Tarifas Base", se deben ocultar todas las tarifas que tengan sufijos de administrador o estén creadas por otros administradores, mostrando una lista limpia con las tarifas estándar iniciales.
* **Visualización de Tarifas Customizadas**: Al seleccionar un administrador específico, la vista debe actualizarse para mostrar únicamente las tarifas y precios de ese administrador (las cuales se inicializan en `0 €`), permitiendo editarlas de forma aislada.

## 17. Edición y Eliminación Detallada de Tarifas en Catálogo
* **Edición Detallada en Línea**: En lugar de solo editar el valor numérico, el sistema debe permitir editar el Nombre, Bloque/Categoría, Tipo (Fijo o Módulos) y Valor de cualquier tarifa mediante un modo de edición en línea (`editingTariffId` y `handleUpdateTariffDetails`).
* **Permiso de Eliminación**: Se debe permitir eliminar tarifas usando la función `handleDeleteTariff`.
  - **Administradores comunes**: Solo pueden eliminar tarifas personalizadas creadas manualmente (`t.id.startsWith('CUSTOM_')`).
  - **Super Administrador**: Tiene control total y puede eliminar cualquier tarifa (incluyendo predefined y copias) de la categoría activa seleccionada.

## 18. Bloques de Tarifas Colapsables (Accordion)
* **Organización Visual**: Para mejorar la navegación y evitar el desorden visual, cada bloque de tarifas (Paquetería, Televisores, Instalaciones, Gama Blanca, Muebles, Otros) debe presentarse como una sección colapsable (tipo acordeón).
* **Interacción del Acordeón**:
  - Al pulsar sobre la cabecera del bloque (`collapsible-block-header`), se expande o colapsa el contenido.
  - La cabecera debe mostrar el nombre del bloque, un icono alusivo (ej: 📦, 📺, 🔧), la cantidad de artículos y un indicador visual (`▲` / `▼`).
  - Por defecto, únicamente el bloque principal de "Paquetería" debe estar abierto al cargar.



