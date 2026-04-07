export const CURRENT_DELIVERY_FEE = 20;
export const LEGACY_DELIVERY_FEE = 35;
export const PLATFORM_BASE_REVENUE = 10;
export const DRIVER_REVENUE = 10;
export const ORDER_ECONOMICS_VERSION = 2;

type OrderLike = {
  total_amount?: number | null;
  shipping_address?: Record<string, any> | null;
  order_items?: Array<{
    quantity?: number | null;
    price_at_purchase?: number | null;
  }> | null;
};

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export type OrderEconomics = {
  deliveryFee: number;
  subtotalAmount: number;
  grossCollected: number;
  platformBaseRevenue: number;
  driverRevenue: number;
  merchantDiscountAmount: number;
  platformRevenue: number;
  merchantSettlement: number;
};

export function buildOrderEconomicsFromSubtotal(
  subtotalAmount: number,
  _merchantDiscountAmount = 0,
  deliveryFee = CURRENT_DELIVERY_FEE
): OrderEconomics {
  const normalizedSubtotal = Math.max(0, safeNumber(subtotalAmount));
  const normalizedDeliveryFee = Math.max(0, safeNumber(deliveryFee, CURRENT_DELIVERY_FEE));

  return {
    deliveryFee: normalizedDeliveryFee,
    subtotalAmount: normalizedSubtotal,
    grossCollected: normalizedSubtotal + normalizedDeliveryFee,
    platformBaseRevenue: PLATFORM_BASE_REVENUE,
    driverRevenue: DRIVER_REVENUE,
    merchantDiscountAmount: 0,
    platformRevenue: PLATFORM_BASE_REVENUE,
    merchantSettlement: normalizedSubtotal,
  };
}

export function getOrderEconomics(order: OrderLike): OrderEconomics {
  const shipping = order?.shipping_address || {};
  const deliveryFee = safeNumber(
    shipping.delivery_fee,
    (() => {
      const orderItemsSubtotal = (order?.order_items || []).reduce((sum, item) => {
        const quantity = Math.max(0, safeNumber(item?.quantity, 0));
        const priceAtPurchase = Math.max(0, safeNumber(item?.price_at_purchase, 0));
        return sum + (quantity * priceAtPurchase);
      }, 0);

      if (orderItemsSubtotal > 0) {
        const inferredDeliveryFee = Math.max(0, safeNumber(order?.total_amount, 0) - orderItemsSubtotal);
        if (Number.isFinite(inferredDeliveryFee) && inferredDeliveryFee >= 0) {
          return inferredDeliveryFee;
        }
      }

      return shipping.economics_version === ORDER_ECONOMICS_VERSION ? CURRENT_DELIVERY_FEE : LEGACY_DELIVERY_FEE;
    })()
  );
  const grossCollected = Math.max(0, safeNumber(order?.total_amount, 0));
  const subtotalAmount = Math.max(
    0,
    safeNumber(
      shipping.subtotal_amount,
      (() => {
        const orderItemsSubtotal = (order?.order_items || []).reduce((sum, item) => {
          const quantity = Math.max(0, safeNumber(item?.quantity, 0));
          const priceAtPurchase = Math.max(0, safeNumber(item?.price_at_purchase, 0));
          return sum + (quantity * priceAtPurchase);
        }, 0);

        if (orderItemsSubtotal > 0) {
          return orderItemsSubtotal;
        }

        return grossCollected - deliveryFee;
      })()
    )
  );
  return {
    deliveryFee,
    subtotalAmount,
    grossCollected,
    platformBaseRevenue: PLATFORM_BASE_REVENUE,
    driverRevenue: DRIVER_REVENUE,
    merchantDiscountAmount: 0,
    platformRevenue: PLATFORM_BASE_REVENUE,
    merchantSettlement: subtotalAmount,
  };
}

export function attachOrderEconomics(
  shippingAddress: Record<string, any> | null | undefined,
  orderTotalAmount: number,
  _merchantDiscountAmount?: number
) {
  const base = {
    ...(shippingAddress || {}),
  };
  const current = getOrderEconomics({
    total_amount: orderTotalAmount,
    shipping_address: base,
  });

  const next = buildOrderEconomicsFromSubtotal(
    current.subtotalAmount,
    0,
    current.deliveryFee
  );

  return {
    ...base,
    delivery_fee: next.deliveryFee,
    subtotal_amount: next.subtotalAmount,
    gross_collected: next.grossCollected,
    platform_base_revenue: next.platformBaseRevenue,
    driver_revenue: next.driverRevenue,
    merchant_discount_amount: next.merchantDiscountAmount,
    platform_revenue: next.platformRevenue,
    merchant_settlement: next.merchantSettlement,
    economics_version: ORDER_ECONOMICS_VERSION,
  };
}
