import { supabase } from '@/lib/supabase';
import { optimizeImageForUpload } from '@/lib/image-upload';
import type { Product } from './productsService';
import { getProductCatalogMetadata, normalizeStringArray } from '@/lib/product-metadata';
import { createProduct, saveProductSpecifications, updateProduct, uploadProductImage } from './adminService';

export type Restaurant = {
  id: string;
  name: string;
  short_description: string | null;
  description: string | null;
  cuisine: string | null;
  image_url: string | null;
  phone: string | null;
  manager_name: string | null;
  manager_email: string | null;
  menu_sections?: string[] | null;
  category_id: string | null;
  is_active: boolean;
  is_available: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  categories?: { name: string } | null;
};

type RestaurantPayload = {
  name: string;
  short_description?: string | null;
  description?: string | null;
  cuisine?: string | null;
  image_url?: string | null;
  phone?: string | null;
  manager_name?: string | null;
  manager_email?: string | null;
  menu_sections?: string[] | null;
  category_id?: string | null;
  is_active?: boolean;
  is_available?: boolean;
  sort_order?: number | null;
};

const OPTIONAL_RESTAURANT_COLUMNS = ['cuisine', 'menu_sections'] as const;

function normalizeRestaurantRecord(restaurant: Restaurant | null) {
  if (!restaurant) return null;
  return {
    ...restaurant,
    menu_sections: normalizeStringArray(restaurant.menu_sections),
  } as Restaurant;
}

function isRestaurantColumnError(message: string) {
  return message.includes("Could not find the '") || message.includes('schema cache') || message.includes('column');
}

function stripUnsupportedRestaurantColumns(payload: RestaurantPayload) {
  const safePayload = { ...payload } as Record<string, unknown>;
  for (const column of OPTIONAL_RESTAURANT_COLUMNS) {
    delete safePayload[column];
  }
  return safePayload as RestaurantPayload;
}

function sortRestaurants(list: Restaurant[]) {
  return [...list].sort((left, right) => {
    const leftOrder = typeof left.sort_order === 'number' ? left.sort_order : 9999;
    const rightOrder = typeof right.sort_order === 'number' ? right.sort_order : 9999;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.name.localeCompare(right.name, 'ar');
  });
}

export async function fetchRestaurants(options?: {
  categoryId?: string | null;
  activeOnly?: boolean;
  availableOnly?: boolean;
}): Promise<Restaurant[]> {
  let query = supabase
    .from('restaurants')
    .select('*, categories(name)')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (options?.categoryId) {
    query = query.eq('category_id', options.categoryId);
  }

  if (options?.activeOnly) {
    query = query.eq('is_active', true);
  }

  if (options?.availableOnly) {
    query = query.eq('is_available', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('fetchRestaurants error:', error.message);
    return [];
  }

  return sortRestaurants(((data || []) as Restaurant[]).map((item) => normalizeRestaurantRecord(item)!));
}

export async function fetchRestaurantById(restaurantId: string): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*, categories(name)')
    .eq('id', restaurantId)
    .single();

  if (error) {
    console.error('fetchRestaurantById error:', error.message);
    return null;
  }

  return normalizeRestaurantRecord(data as Restaurant);
}

export async function fetchRestaurantProducts(restaurantId: string): Promise<Product[]> {
  const foodCategoryId = (await getFoodCategoryId()) || '';
  const baseSelect = `
      id, name, description, price, category_id, specifications, created_at, updated_at,
      image_url, discount_percentage, stock_quantity, is_best_seller, show_in_offers,
      categories ( name ),
      product_specifications ( id, label, description )
    `;

  let result = await supabase
    .from('products')
    .select(baseSelect)
    .eq('category_id', foodCategoryId)
    .contains('specifications', { restaurant_id: restaurantId, restaurant_item: true })
    .order('created_at', { ascending: false });

  if (result.error) {
    result = await supabase
      .from('products')
      .select(baseSelect)
      .eq('category_id', foodCategoryId)
      .order('created_at', { ascending: false });
  }

  const { data, error } = result;

  if (error) {
    console.error('fetchRestaurantProducts error:', error.message);
    return [];
  }

  return (data || [])
    .map((item) => item as unknown as Product)
    .filter((product) => {
      const metadata = getProductCatalogMetadata(product.specifications);
      return metadata.restaurantId === restaurantId && metadata.restaurantItem;
    });
}

export async function fetchAdminRestaurantProducts(restaurantId: string): Promise<Product[]> {
  return fetchRestaurantProducts(restaurantId);
}

export async function fetchAdminRestaurants() {
  return fetchRestaurants();
}

export async function createRestaurant(payload: RestaurantPayload) {
  let result = await supabase
    .from('restaurants')
    .insert([
      {
        ...payload,
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (result.error && isRestaurantColumnError(result.error.message || '')) {
    result = await supabase
      .from('restaurants')
      .insert([
        {
          ...stripUnsupportedRestaurantColumns(payload),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();
  }

  if (result.error) {
    console.error('createRestaurant error:', result.error.message);
  }

  return { data: normalizeRestaurantRecord(result.data as Restaurant | null), error: result.error };
}

export async function updateRestaurant(id: string, payload: RestaurantPayload) {
  let result = await supabase
    .from('restaurants')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (result.error && isRestaurantColumnError(result.error.message || '')) {
    result = await supabase
      .from('restaurants')
      .update({
        ...stripUnsupportedRestaurantColumns(payload),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
  }

  if (result.error) {
    console.error('updateRestaurant error:', result.error.message);
  }

  return { data: normalizeRestaurantRecord(result.data as Restaurant | null), error: result.error };
}

export async function deleteRestaurant(id: string) {
  const { error } = await supabase.from('restaurants').delete().eq('id', id);
  if (error) {
    console.error('deleteRestaurant error:', error.message);
  }
  return { error };
}

export async function uploadRestaurantImage(file: File): Promise<string | null> {
  const optimizedFile = await optimizeImageForUpload(file);
  const ext = optimizedFile.name.split('.').pop() || 'webp';
  const path = `restaurants/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage.from('product-images').upload(path, optimizedFile, {
    upsert: true,
    contentType: optimizedFile.type || 'image/webp',
  });

  if (error) {
    console.error('uploadRestaurantImage error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function getFoodCategoryId() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .eq('name', 'طعام')
    .maybeSingle();

  if (error) {
    console.error('getFoodCategoryId error:', error.message);
    return null;
  }

  return data?.id || null;
}

type SaveRestaurantMenuProductPayload = {
  restaurant: Restaurant;
  productId?: string | null;
  name: string;
  shortDescription?: string;
  description?: string;
  price: number;
  oldPrice?: number | null;
  discountPercentage?: number;
  imageUrl?: string | null;
  imageFile?: File | null;
  available?: boolean;
  menuSection?: string | null;
  relatedProductIds?: string[];
  sizeOptions?: { id?: string; label: string; price: number }[];
  specs?: { id?: string; label: string; description: string }[];
};

export async function saveRestaurantMenuProduct(payload: SaveRestaurantMenuProductPayload) {
  const foodCategoryId = await getFoodCategoryId();
  if (!foodCategoryId) {
    throw new Error('قسم طعام غير موجود، ضيفه الأول من الأقسام');
  }

  let finalImageUrl = payload.imageUrl || null;
  if (payload.imageFile) {
    finalImageUrl = await uploadProductImage(payload.imageFile);
  }

  const menuSection = payload.menuSection?.trim() || '';
  const menuSectionTag = menuSection ? [menuSection] : [];
  const normalizedSizeOptions = (payload.sizeOptions || [])
    .map((option, index) => {
      const label = String(option.label || '').trim();
      const price = Number(option.price || 0);
      if (!label || !Number.isFinite(price) || price <= 0) return null;
      return {
        id: String(option.id || '').trim() || `size-${index + 1}`,
        label,
        price,
      };
    })
    .filter((option): option is { id: string; label: string; price: number } => Boolean(option));
  const effectivePrice = normalizedSizeOptions[0]?.price || payload.price;
  const productPayload: Record<string, unknown> = {
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    price: effectivePrice,
    stock_quantity: payload.available === false ? 0 : 1,
    discount_percentage: payload.discountPercentage || 0,
    category_id: foodCategoryId,
    image_url: finalImageUrl,
    images: finalImageUrl ? [finalImageUrl] : [],
    show_in_offers: Boolean(payload.discountPercentage && payload.discountPercentage > 0),
    specifications: {
      short_description: payload.shortDescription?.trim() || "",
      old_price: payload.oldPrice || null,
      status: 'published',
      featured: false,
      product_type: 'restaurant_menu_item',
      tags: [payload.restaurant.name, 'مطعم', 'منيو', ...menuSectionTag],
      keywords: [payload.restaurant.name, payload.name.trim(), 'مطاعم', 'طعام', ...menuSectionTag],
      related_product_ids: payload.relatedProductIds || [],
      restaurant_id: payload.restaurant.id,
      restaurant_name: payload.restaurant.name,
      restaurant_item: true,
      restaurant_available: payload.available !== false,
      restaurant_section: menuSection,
      restaurant_size_options: normalizedSizeOptions,
      availability_mode: 'manual',
      category_taxonomy: {
        primary: 'restaurants',
        secondary: payload.restaurant.cuisine || '',
        tertiary: menuSection,
        primary_label: 'مطاعم',
        secondary_label: payload.restaurant.cuisine || '',
        tertiary_label: menuSection,
      },
      custom_specs: (payload.specs || [])
        .filter((spec) => spec.label?.trim() && spec.description?.trim())
        .map((spec) => ({
          label: spec.label.trim(),
          description: spec.description.trim(),
        })),
    },
  };

  const result = payload.productId
    ? await updateProduct(payload.productId, productPayload)
    : await createProduct(productPayload);

  if (result.error) {
    throw new Error((result.error as any)?.message || 'فشل حفظ منتج المطعم');
  }

  const targetProductId = payload.productId || (result.data as any)?.id;
  if (targetProductId) {
    const specsResult = await saveProductSpecifications(targetProductId, payload.specs || []);
    if (specsResult.error) {
      throw new Error((specsResult.error as any)?.message || 'المنتج اتحفظ لكن المواصفات ما اتسجلتش');
    }
  }

  return result;
}

export async function fetchRestaurantManagerOrders() {
  const res = await fetch('/api/restaurant/orders', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error || 'فشل تحميل طلبات المطعم');
  }

  return payload;
}

export async function submitRestaurantOrderEta(
  orderId: string,
  payload: { etaText: string; etaHours: number; etaDays: number; etaNote?: string }
) {
  const res = await fetch(`/api/restaurant/orders/${orderId}/eta`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || 'فشل إرسال وقت التوصيل');
  }

  return data;
}
