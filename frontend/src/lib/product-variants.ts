export type RestaurantSizeOption = {
  id: string
  label: string
  price: number
}

export type SelectedVariantJson = Record<string, any> | null

function normalizeText(value: unknown) {
  return String(value || "").trim()
}

function normalizePositiveNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function getRestaurantSizeOptions(specifications?: Record<string, any> | null): RestaurantSizeOption[] {
  const rawOptions = Array.isArray(specifications?.restaurant_size_options)
    ? specifications?.restaurant_size_options
    : []

  return rawOptions
    .map((option: any, index: number) => {
      const label = normalizeText(option?.label)
      const price = normalizePositiveNumber(option?.price)

      if (!label || price === null) return null

      return {
        id: normalizeText(option?.id) || `size-${index + 1}`,
        label,
        price,
      }
    })
    .filter((option): option is RestaurantSizeOption => Boolean(option))
}

export function normalizeSelectedVariant(selectedVariantJson?: SelectedVariantJson): SelectedVariantJson {
  if (!selectedVariantJson || typeof selectedVariantJson !== "object") {
    return null
  }

  const type = normalizeText(selectedVariantJson.type)
  const label = normalizeText(selectedVariantJson.label)
  const optionId = normalizeText(selectedVariantJson.optionId)
  const price = normalizePositiveNumber(selectedVariantJson.price)

  const normalized: Record<string, any> = {}

  if (type) normalized.type = type
  if (optionId) normalized.optionId = optionId
  if (label) normalized.label = label
  if (price !== null) normalized.price = price

  return Object.keys(normalized).length > 0 ? normalized : null
}

export function buildRestaurantSizeVariant(option?: RestaurantSizeOption | null): SelectedVariantJson {
  if (!option) return null

  return normalizeSelectedVariant({
    type: "restaurant_size",
    optionId: option.id,
    label: option.label,
    price: option.price,
  })
}

export function getSelectedVariantKey(selectedVariantJson?: SelectedVariantJson) {
  const normalized = normalizeSelectedVariant(selectedVariantJson)
  return normalized ? JSON.stringify(normalized) : "__default__"
}

export function isSameSelectedVariant(
  leftSelectedVariant?: SelectedVariantJson,
  rightSelectedVariant?: SelectedVariantJson
) {
  return getSelectedVariantKey(leftSelectedVariant) === getSelectedVariantKey(rightSelectedVariant)
}

export function getSelectedVariantLabel(selectedVariantJson?: SelectedVariantJson) {
  const normalized = normalizeSelectedVariant(selectedVariantJson)
  if (!normalized) return null

  if (normalized.type === "restaurant_size" && normalized.label) {
    return `الحجم: ${normalized.label}`
  }

  return normalized.label || null
}

export function resolveVariantUnitPrice(
  product: {
    price?: number | null
    discount_percentage?: number | null
    specifications?: Record<string, any> | null
  },
  selectedVariantJson?: SelectedVariantJson
) {
  const normalized = normalizeSelectedVariant(selectedVariantJson)
  const sizeOptions = getRestaurantSizeOptions(product.specifications)

  if (normalized?.type === "restaurant_size" && sizeOptions.length > 0) {
    const matched = sizeOptions.find(
      (option) =>
        option.id === normalized.optionId ||
        option.label === normalized.label
    )

    if (matched) {
      return matched.price
    }
  }

  const basePrice = Number(product.price || 0)
  const discount = Number(product.discount_percentage || 0)
  if (discount > 0) {
    return Math.round(basePrice * (1 - discount / 100))
  }

  return basePrice
}
