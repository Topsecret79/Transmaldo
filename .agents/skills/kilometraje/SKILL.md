---
name: kilometraje-rules
description: Reglas y lógica de cálculo para kilómetros de flota y kilómetros facturables
---

# Reglas de Kilometraje (Transmaldo Delivery App)

Este documento define la lógica de negocio, comportamiento de la interfaz y reglas de persistencia para el kilometraje de los vehículos y los repartidores.

## 1. Kilometraje de Odómetro (Telemetría de Flota)
* **Definición**: Corresponde a los kilómetros iniciales y finales que registra un chofer al abrir y cerrar su jornada (`driverKmStart`, `driverKmEnd`, `getRouteKms()`).
* **Lógica Financiera (Salarios y Facturación)**:
  * Para los conductores de flota (como `ruta 151` y `ruta 168`), estos kilómetros de odómetro tienen un impacto monetario de **0.00 €**.
  * **NUNCA** deben multiplicarse por la tarifa de precio por kilómetro (`kmPrice`) para sumarse a los salarios, facturación base de furgonetas, resúmenes diarios de corte, ni vales de cierre de turno.
* **Interfaz de Usuario**:
  * En el vale de cierre de turno del chofer, al lado del input de kilómetros recorridos, el importe debe figurar permanentemente como `0.00 € (Control)`.
  * En la tarjeta y resumen de ganancias del turno diario, se mostrará como `Odómetro Flota (X km): 0.00 € (Control)`.

## 2. Kilómetros Facturables (Servicios)
* **Definición**: Corresponde a los kilómetros especiales introducidos manualmente como parte de las tareas de un ticket/albarán de entrega (por ejemplo, tarifas de ruta larga o kilometraje especial de reparto).
* **Lógica Financiera**:
  * Estos kilómetros se multiplican por el precio unitario de su respectiva tarifa y **sí** generan facturación en el total base de servicios.

## 3. Precio del Kilómetro (`kmPrice`)
* Cada administrador/coordinador tiene una clave en `delivery_settings` (`kmPrice_[adminId]`) para definir la tarifa por km (por defecto `0.43 €/km`).
* Esta tarifa se utiliza exclusivamente para previsualizar/evaluar costos internos o calcular kilómetros facturables de servicios, pero no se aplica a los odómetros de vehículos de flota.
