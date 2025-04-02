# Gestor de Deudas Secuencial

Una aplicación web construida en React para ayudarte a planificar y optimizar el pago de múltiples deudas utilizando las estrategias "Avalancha" y "Bola de Nieve".

## Características

- **Múltiples Estrategias de Pago:**

  - Avalancha: Prioriza las deudas con mayor tasa de interés
  - Bola de Nieve: Prioriza las deudas de menor monto

- **Gestión de Deudas:**

  - Agregar deudas con nombre, monto, tasa de interés y plazos
  - Calcular automáticamente pagos mensuales
  - Eliminar deudas existentes
  - Persistencia de datos en localStorage

- **Aportaciones Extra:**

  - Definir una aportación extra mensual
  - Reinversión automática de pagos liberados
  - Seguimiento de aportaciones extra acumuladas

- **Análisis Detallado:**
  - Dashboard con resumen general
  - Plazo total proyectado
  - Intereses totales a pagar
  - Monto total a pagar
  - Tabla de amortización detallada

## Características de la Tabla de Amortización

- Seguimiento mensual de cada deuda
- Desglose de pagos mínimos y extras
- Cálculo de intereses pagados
- Saldos restantes actualizados
- Notificaciones de deudas liquidadas

## Tecnologías Utilizadas

- Node 20 (obligatorio)
- React
- Tailwind CSS
- JavaScript
- LocalStorage para persistencia de datos
