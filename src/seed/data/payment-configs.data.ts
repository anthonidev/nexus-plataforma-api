export const paymentConfigsData = [
  {
    code: 'MEMBERSHIP_PAYMENT',
    name: 'Pago de Membresía',
    description: 'Pago para la adquisición de una nueva membresía',
    requiresApproval: true,
    isActive: true,
    minimumAmount: 235.0, // El precio del plan más básico (Ejecutivo)
    maximumAmount: null, // Sin límite máximo para permitir futuros planes
  },
  {
    code: 'RECONSUMPTION',
    name: 'Reconsumo Mensual',
    description:
      'Pago mensual para mantener la membresía activa y acumular puntos binarios',
    requiresApproval: true,
    isActive: true,
    minimumAmount: 300.0, // Monto mínimo de reconsumo mencionado en la entidad Membership
    maximumAmount: null, // Sin límite máximo
  },
  {
    code: 'PLAN_UPGRADE',
    name: 'Actualización de Plan',
    description: 'Pago para actualizar a un plan de membresía superior',
    requiresApproval: true,
    isActive: true,
    minimumAmount: 564.0, // Diferencia entre VIP y Ejecutivo (799 - 235)
    maximumAmount: null, // Sin límite máximo para permitir futuras actualizaciones
  },
  {
    code: 'ORDER_PAYMENT',
    name: 'Pago de Orden',
    description: 'Pago para confirmar la orden de compra',
    requiresApproval: true,
    isActive: true,
    minimumAmount: 10.0, // Monto mínimo de la orden
    maximumAmount: null, // Sin límite máximo
  }
];
