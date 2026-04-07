export function normalizeDisplayCity(value?: string | null) {
  const rawValue = String(value || "").trim()
  const normalized = rawValue.toLowerCase()

  if (!normalized) return "ميت العامل"
  if (["cairo", "القاهرة", "الدقهلية", "dakahlia", "ميت العامل"].includes(normalized)) return "ميت العامل"
  if (["giza", "الجيزة", "القرى المجاورة"].includes(normalized)) return "القرى المجاورة"

  return rawValue
}

export function formatDeliveryAddressLines(shippingAddress?: Record<string, any> | null) {
  if (!shippingAddress) {
    return {
      zone: "ميت العامل",
      secondary: "",
      street: "",
      landmark: "",
    }
  }

  const zone = normalizeDisplayCity(shippingAddress.city)
  const secondary = String(shippingAddress.area || "").trim()
  const street = String(shippingAddress.street || shippingAddress.address || "").trim()
  const landmark = String(shippingAddress.notes || "").trim()

  return { zone, secondary, street, landmark }
}
