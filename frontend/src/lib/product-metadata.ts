import { getTaxonomySelection } from "@/lib/category-taxonomy";

export type ProductRecordLike = {
  id: string;
  name?: string | null;
  category_id?: string | null;
  specifications?: Record<string, any> | null;
  discount_percentage?: number | null;
  is_best_seller?: boolean | null;
  created_at?: string | null;
  categories?: { name?: string | null } | null;
};

export type ProductCatalogMetadata = {
  slug: string;
  shortDescription: string;
  oldPrice: number | null;
  sku: string;
  brand: string;
  status: string;
  featured: boolean;
  productType: string;
  tags: string[];
  keywords: string[];
  gender: string;
  ageGroup: string;
  season: string;
  style: string;
  colorFamily: string;
  material: string;
  sizeGroup: string;
  relatedProductIds: string[];
  restaurantId: string;
  restaurantName: string;
  restaurantItem: boolean;
  restaurantAvailable: boolean;
  restaurantSection: string;
  availabilityMode: string;
};

export type RelatedProductScore = {
  productId: string;
  score: number;
  reasons: string[];
};

const METADATA_KEYS = [
  "slug",
  "short_description",
  "old_price",
  "sku",
  "brand",
  "status",
  "featured",
  "product_type",
  "tags",
  "keywords",
  "gender",
  "age_group",
  "season",
  "style",
  "color_family",
  "material",
  "size_group",
  "related_product_ids",
  "category_taxonomy",
  "custom_specs",
  "product_mode",
  "bundle_items",
  "restaurant_id",
  "restaurant_name",
  "restaurant_item",
  "restaurant_available",
  "restaurant_section",
  "availability_mode",
] as const;

const DEFAULT_PROFILE = {
  tags: 8,
  keywords: 4,
  brand: 7,
  productType: 5,
  gender: 3,
  ageGroup: 3,
  season: 3,
  style: 4,
  colorFamily: 2,
  material: 3,
  sizeGroup: 2,
};

const CATEGORY_PROFILES: Record<string, Partial<typeof DEFAULT_PROFILE>> = {
  "ملابس وأزياء": {
    brand: 6,
    gender: 5,
    ageGroup: 4,
    season: 5,
    style: 6,
    colorFamily: 4,
    material: 5,
    sizeGroup: 4,
    productType: 4,
  },
  "سوبر ماركت": {
    tags: 7,
    keywords: 5,
    brand: 7,
    productType: 4,
    gender: 0,
    ageGroup: 0,
    season: 1,
    style: 0,
    colorFamily: 1,
    material: 0,
    sizeGroup: 0,
  },
  "طعام": {
    tags: 7,
    keywords: 6,
    brand: 4,
    productType: 5,
    gender: 0,
    ageGroup: 1,
    season: 2,
    style: 1,
    colorFamily: 1,
    material: 0,
    sizeGroup: 0,
  },
  "إلكترونيات": {
    tags: 6,
    keywords: 3,
    brand: 8,
    productType: 6,
    gender: 0,
    ageGroup: 0,
    season: 0,
    style: 0,
    colorFamily: 2,
    material: 1,
    sizeGroup: 0,
  },
  "ألعاب أطفال": {
    tags: 7,
    keywords: 3,
    brand: 5,
    productType: 5,
    gender: 3,
    ageGroup: 6,
    season: 0,
    style: 1,
    colorFamily: 2,
    material: 1,
    sizeGroup: 2,
  },
  "أدوات منزلية": {
    tags: 5,
    keywords: 4,
    brand: 6,
    productType: 5,
    material: 4,
    colorFamily: 2,
  },
  "العناية الشخصية": {
    tags: 6,
    keywords: 5,
    brand: 7,
    productType: 5,
    ageGroup: 2,
    material: 1,
  },
  "صيدلية": {
    tags: 6,
    keywords: 6,
    brand: 7,
    productType: 5,
    ageGroup: 3,
  },
};

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeKeywordToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[،,]+/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "");
}

function uniqueNormalizedList(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawValue of values) {
    const normalized = normalizeKeywordToken(rawValue);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(rawValue.trim());
  }

  return result;
}

export function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return uniqueNormalizedList(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    );
  }

  if (typeof value === "string") {
    return uniqueNormalizedList(
      value
        .split(/[,\n،]/g)
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }

  return [];
}

function normalizeOptionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getProductCatalogMetadata(specifications?: Record<string, any> | null): ProductCatalogMetadata {
  return {
    slug: normalizeText(specifications?.slug),
    shortDescription: normalizeText(specifications?.short_description),
    oldPrice: normalizeOptionalNumber(specifications?.old_price),
    sku: normalizeText(specifications?.sku),
    brand: normalizeText(specifications?.brand),
    status: normalizeText(specifications?.status) || "published",
    featured: specifications?.featured === true,
    productType: normalizeText(specifications?.product_type),
    tags: normalizeStringArray(specifications?.tags),
    keywords: normalizeStringArray(specifications?.keywords),
    gender: normalizeText(specifications?.gender),
    ageGroup: normalizeText(specifications?.age_group),
    season: normalizeText(specifications?.season),
    style: normalizeText(specifications?.style),
    colorFamily: normalizeText(specifications?.color_family),
    material: normalizeText(specifications?.material),
    sizeGroup: normalizeText(specifications?.size_group),
    relatedProductIds: normalizeStringArray(specifications?.related_product_ids),
    restaurantId: normalizeText(specifications?.restaurant_id),
    restaurantName: normalizeText(specifications?.restaurant_name),
    restaurantItem: specifications?.restaurant_item === true,
    restaurantAvailable: specifications?.restaurant_available !== false,
    restaurantSection: normalizeText(specifications?.restaurant_section),
    availabilityMode: normalizeText(specifications?.availability_mode) || "stock",
  };
}

export function extractBaseSpecifications(specifications?: Record<string, any> | null) {
  const safe = { ...(specifications || {}) };
  for (const key of METADATA_KEYS) delete safe[key];
  return safe;
}

export function isPublishedProduct(product?: ProductRecordLike | null) {
  if (!product) return false;
  const status = getProductCatalogMetadata(product.specifications).status.toLowerCase();
  return !["draft", "inactive", "archived", "hidden"].includes(status);
}

export function getManualRelatedProductIds(product?: ProductRecordLike | null) {
  if (!product) return [];
  return getProductCatalogMetadata(product.specifications).relatedProductIds.filter((id) => id !== product.id);
}

export function isRestaurantProduct(product?: ProductRecordLike | null) {
  if (!product) return false;
  return getProductCatalogMetadata(product.specifications).restaurantItem;
}

export function getSimilarityProfile(categoryName?: string | null) {
  const normalizedCategory = normalizeText(categoryName);
  return {
    ...DEFAULT_PROFILE,
    ...(CATEGORY_PROFILES[normalizedCategory] || {}),
  };
}

function countMatchingTokens(aValues: string[], bValues: string[]) {
  if (aValues.length === 0 || bValues.length === 0) return 0;
  const lookup = new Set(bValues.map(normalizeKeywordToken));
  return aValues.map(normalizeKeywordToken).filter((token) => token && lookup.has(token)).length;
}

function safeEquals(a?: string | null, b?: string | null) {
  return normalizeKeywordToken(String(a || "")) !== "" && normalizeKeywordToken(String(a || "")) === normalizeKeywordToken(String(b || ""));
}

export function scoreRelatedProduct(baseProduct: ProductRecordLike, candidateProduct: ProductRecordLike): RelatedProductScore {
  const reasons: string[] = [];
  const baseMeta = getProductCatalogMetadata(baseProduct.specifications);
  const candidateMeta = getProductCatalogMetadata(candidateProduct.specifications);
  const baseTaxonomy = getTaxonomySelection(baseProduct.specifications);
  const candidateTaxonomy = getTaxonomySelection(candidateProduct.specifications);
  const profile = getSimilarityProfile(baseProduct.categories?.name || candidateProduct.categories?.name);

  let score = 0;

  if (baseProduct.category_id && candidateProduct.category_id && baseProduct.category_id === candidateProduct.category_id) {
    score += 18;
    reasons.push("نفس القسم");
  }

  if (baseMeta.restaurantId && candidateMeta.restaurantId && baseMeta.restaurantId === candidateMeta.restaurantId) {
    score += 36;
    reasons.push("من نفس المطعم");
  }

  if (baseMeta.restaurantSection && candidateMeta.restaurantSection && baseMeta.restaurantSection === candidateMeta.restaurantSection) {
    score += 22;
    reasons.push("من نفس تصنيف المنيو");
  }

  if (baseTaxonomy.tertiary && candidateTaxonomy.tertiary && baseTaxonomy.tertiary === candidateTaxonomy.tertiary) {
    score += 48;
    reasons.push("نفس التصنيف الأدق");
  }

  if (baseTaxonomy.secondary && candidateTaxonomy.secondary && baseTaxonomy.secondary === candidateTaxonomy.secondary) {
    score += 32;
    reasons.push("نفس التصنيف الفرعي");
  }

  if (baseTaxonomy.primary && candidateTaxonomy.primary && baseTaxonomy.primary === candidateTaxonomy.primary) {
    score += 18;
    reasons.push("نفس التصنيف الرئيسي");
  }

  const matchedTags = countMatchingTokens(baseMeta.tags, candidateMeta.tags);
  if (matchedTags > 0) {
    score += Math.min(matchedTags * profile.tags, profile.tags * 3);
    reasons.push("تاجات مشتركة");
  }

  const matchedKeywords = countMatchingTokens(baseMeta.keywords, candidateMeta.keywords);
  if (matchedKeywords > 0) {
    score += Math.min(matchedKeywords * profile.keywords, profile.keywords * 3);
    reasons.push("كلمات مفتاحية متشابهة");
  }

  if (safeEquals(baseMeta.brand, candidateMeta.brand)) {
    score += profile.brand;
    reasons.push("نفس البراند");
  }

  if (safeEquals(baseMeta.productType, candidateMeta.productType)) {
    score += profile.productType;
    reasons.push("نفس النوع");
  }

  if (safeEquals(baseMeta.gender, candidateMeta.gender)) {
    score += profile.gender;
    reasons.push("نفس الفئة");
  }

  if (safeEquals(baseMeta.ageGroup, candidateMeta.ageGroup)) {
    score += profile.ageGroup;
    reasons.push("نفس المرحلة العمرية");
  }

  if (safeEquals(baseMeta.season, candidateMeta.season)) {
    score += profile.season;
    reasons.push("نفس الموسم");
  }

  if (safeEquals(baseMeta.style, candidateMeta.style)) {
    score += profile.style;
    reasons.push("ستايل قريب");
  }

  if (safeEquals(baseMeta.colorFamily, candidateMeta.colorFamily)) {
    score += profile.colorFamily;
    reasons.push("ألوان قريبة");
  }

  if (safeEquals(baseMeta.material, candidateMeta.material)) {
    score += profile.material;
    reasons.push("نفس الخامة");
  }

  if (safeEquals(baseMeta.sizeGroup, candidateMeta.sizeGroup)) {
    score += profile.sizeGroup;
    reasons.push("نفس مجموعة المقاس");
  }

  return {
    productId: candidateProduct.id,
    score,
    reasons,
  };
}

export function compareRelatedCandidates(
  baseProduct: ProductRecordLike,
  leftProduct: ProductRecordLike,
  rightProduct: ProductRecordLike
) {
  const leftScore = scoreRelatedProduct(baseProduct, leftProduct).score;
  const rightScore = scoreRelatedProduct(baseProduct, rightProduct).score;

  if (rightScore !== leftScore) return rightScore - leftScore;

  const leftFeatured = getProductCatalogMetadata(leftProduct.specifications).featured ? 1 : 0;
  const rightFeatured = getProductCatalogMetadata(rightProduct.specifications).featured ? 1 : 0;
  if (rightFeatured !== leftFeatured) return rightFeatured - leftFeatured;

  const leftBestSeller = leftProduct.is_best_seller ? 1 : 0;
  const rightBestSeller = rightProduct.is_best_seller ? 1 : 0;
  if (rightBestSeller !== leftBestSeller) return rightBestSeller - leftBestSeller;

  return new Date(rightProduct.created_at || 0).getTime() - new Date(leftProduct.created_at || 0).getTime();
}
