import { isRestaurantProduct } from "@/lib/product-metadata";

type SupabaseLike = any;

type OrderInventoryProduct = {
  id: string;
  name?: string | null;
  stock_quantity?: number | null;
  specifications?: Record<string, any> | null;
};

type OrderInventoryItem = {
  id: string;
  product_id: string;
  quantity: number;
  product?: OrderInventoryProduct | null;
};

type OrderInventoryOrder = {
  id: string;
  shipping_address?: Record<string, any> | null;
  order_items?: OrderInventoryItem[] | null;
};

function getManagedItems(order: OrderInventoryOrder) {
  return (order.order_items || [])
    .map((item) => ({
      item,
      product: item.product || null,
    }))
    .filter(({ item, product }) => {
      if (!product?.id || !item.product_id) return false;
      if (isRestaurantProduct(product)) return false;
      return Number.isFinite(Number(product.stock_quantity));
    });
}

export async function fetchOrderInventorySnapshot(supabaseAdmin: SupabaseLike, orderId: string) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, shipping_address")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message || "Order not found");
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("order_items")
    .select("id, product_id, quantity")
    .eq("order_id", orderId);

  if (itemsError) {
    throw new Error(itemsError.message || "Failed to load order items");
  }

  const productIds = Array.from(
    new Set(
      (items || [])
        .map((item: any) => item.product_id)
        .filter((productId: string | null | undefined) => typeof productId === "string" && productId.trim() !== "")
    )
  );

  let productMap = new Map<string, OrderInventoryProduct>();

  if (productIds.length > 0) {
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, name, stock_quantity, specifications")
      .in("id", productIds);

    if (productsError) {
      throw new Error(productsError.message || "Failed to load products");
    }

    productMap = new Map(
      (products || []).map((product: OrderInventoryProduct) => [product.id, product])
    );
  }

  return {
    ...(order as OrderInventoryOrder),
    order_items: (items || []).map((item: any) => ({
      ...item,
      product: productMap.get(item.product_id) || null,
    })),
  } as OrderInventoryOrder;
}

export async function reserveOrderInventory(
  supabaseAdmin: SupabaseLike,
  orderId: string,
  reason: string = "order_created"
) {
  const order = await fetchOrderInventorySnapshot(supabaseAdmin, orderId);
  const shipping = order.shipping_address || {};

  if (shipping.inventory_reservation_state === "reserved") {
    return { success: true, state: "reserved", alreadyApplied: true };
  }

  const managedItems = getManagedItems(order);

  if (managedItems.length === 0) {
    await supabaseAdmin
      .from("orders")
      .update({
        shipping_address: {
          ...shipping,
          inventory_reservation_state: "not_required",
          inventory_reservation_reason: reason,
        },
      })
      .eq("id", orderId);

    return { success: true, state: "not_required" };
  }

  for (const { item, product } of managedItems) {
    if (!product) continue;
    const currentStock = Number(product?.stock_quantity || 0);
    const requestedQty = Math.max(0, Number(item.quantity || 0));
    if (requestedQty <= 0) continue;

    if (currentStock < requestedQty) {
      throw new Error(`الكمية المتاحة من "${product?.name || "المنتج"}" ما تكفيش الطلب الحالي`);
    }
  }

  for (const { item, product } of managedItems) {
    if (!product) continue;
    const currentStock = Number(product?.stock_quantity || 0);
    const requestedQty = Math.max(0, Number(item.quantity || 0));
    const nextStock = Math.max(0, currentStock - requestedQty);

    const { error } = await supabaseAdmin
      .from("products")
      .update({ stock_quantity: nextStock })
      .eq("id", product.id);

    if (error) {
      throw new Error(error.message || "Failed to reserve stock");
    }
  }

  const nowIso = new Date().toISOString();
  await supabaseAdmin
    .from("orders")
    .update({
      shipping_address: {
        ...shipping,
        inventory_reservation_state: "reserved",
        inventory_reserved_at: nowIso,
        inventory_restored_at: null,
        inventory_restore_reason: null,
        inventory_reservation_reason: reason,
      },
    })
    .eq("id", orderId);

  return { success: true, state: "reserved" };
}

export async function reserveInventoryForItems(
  supabaseAdmin: SupabaseLike,
  orderId: string,
  items: Array<{ product_id: string; quantity: number }>,
  shippingAddress?: Record<string, any> | null,
  reason: string = "order_created"
) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, shipping_address")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message || "Order not found");
  }

  const shipping = shippingAddress || order.shipping_address || {};

  if (shipping.inventory_reservation_state === "reserved") {
    return { success: true, state: "reserved", alreadyApplied: true };
  }

  const validItems = (items || [])
    .map((item) => ({
      product_id: String(item?.product_id || "").trim(),
      quantity: Math.max(0, Number(item?.quantity || 0)),
    }))
    .filter((item) => item.product_id && item.quantity > 0);

  if (validItems.length === 0) {
    await supabaseAdmin
      .from("orders")
      .update({
        shipping_address: {
          ...shipping,
          inventory_reservation_state: "not_required",
          inventory_reservation_reason: reason,
        },
      })
      .eq("id", orderId);

    return { success: true, state: "not_required" };
  }

  const productIds = Array.from(new Set(validItems.map((item) => item.product_id)));
  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select("id, name, stock_quantity, specifications")
    .in("id", productIds);

  if (productsError) {
    throw new Error(productsError.message || "Failed to load products");
  }

  const productMap = new Map<string, OrderInventoryProduct>(
    (products || []).map((product: OrderInventoryProduct) => [product.id, product])
  );

  const managedItems = validItems
    .map((item) => ({
      item,
      product: productMap.get(item.product_id) || null,
    }))
    .filter(({ product }) => {
      if (!product?.id) return false;
      if (isRestaurantProduct(product)) return false;
      return Number.isFinite(Number(product.stock_quantity));
    });

  if (managedItems.length === 0) {
    await supabaseAdmin
      .from("orders")
      .update({
        shipping_address: {
          ...shipping,
          inventory_reservation_state: "not_required",
          inventory_reservation_reason: reason,
        },
      })
      .eq("id", orderId);

    return { success: true, state: "not_required" };
  }

  for (const { item, product } of managedItems) {
    const currentStock = Number(product?.stock_quantity || 0);
    if (currentStock < item.quantity) {
      throw new Error(`الكمية المتاحة من "${product?.name || "المنتج"}" ما تكفيش الطلب الحالي`);
    }
  }

  for (const { item, product } of managedItems) {
    const currentStock = Number(product?.stock_quantity || 0);
    const nextStock = Math.max(0, currentStock - item.quantity);

    const { error } = await supabaseAdmin
      .from("products")
      .update({ stock_quantity: nextStock })
      .eq("id", product!.id);

    if (error) {
      throw new Error(error.message || "Failed to reserve stock");
    }
  }

  await supabaseAdmin
    .from("orders")
    .update({
      shipping_address: {
        ...shipping,
        inventory_reservation_state: "reserved",
        inventory_reserved_at: new Date().toISOString(),
        inventory_restored_at: null,
        inventory_restore_reason: null,
        inventory_reservation_reason: reason,
      },
    })
    .eq("id", orderId);

  return { success: true, state: "reserved" };
}

export async function restoreOrderInventory(
  supabaseAdmin: SupabaseLike,
  orderId: string,
  reason: string = "order_cancelled"
) {
  const order = await fetchOrderInventorySnapshot(supabaseAdmin, orderId);
  const shipping = order.shipping_address || {};

  if (shipping.inventory_reservation_state !== "reserved") {
    return { success: true, state: shipping.inventory_reservation_state || "not_required", alreadyApplied: true };
  }

  const managedItems = getManagedItems(order);

  for (const { item, product } of managedItems) {
    if (!product) continue;
    const currentStock = Number(product?.stock_quantity || 0);
    const returnedQty = Math.max(0, Number(item.quantity || 0));
    const nextStock = currentStock + returnedQty;

    const { error } = await supabaseAdmin
      .from("products")
      .update({ stock_quantity: nextStock })
      .eq("id", product.id);

    if (error) {
      throw new Error(error.message || "Failed to restore stock");
    }
  }

  await supabaseAdmin
    .from("orders")
    .update({
      shipping_address: {
        ...shipping,
        inventory_reservation_state: "released",
        inventory_restored_at: new Date().toISOString(),
        inventory_restore_reason: reason,
      },
    })
    .eq("id", orderId);

  return { success: true, state: "released" };
}
