export function normalizeAuthEmail(email: string) {
  return String(email || "").trim().toLowerCase()
}

export function isAllowedCustomerEmail(email: string) {
  return normalizeAuthEmail(email).endsWith("@gmail.com")
}

export function validateCustomerEmail(email: string) {
  const normalizedEmail = normalizeAuthEmail(email)

  if (!normalizedEmail) return "اكتب البريد الإلكتروني الأول"
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return "البريد الإلكتروني مش مكتوب بشكل صحيح"
  if (!isAllowedCustomerEmail(normalizedEmail)) return "حاليًا الحسابات العادية لازم تكون على Gmail فقط"

  return null
}

export function validateStrongPassword(password: string) {
  const value = String(password || "")
  const hasLetter = /\p{L}/u.test(value)
  const hasNumber = /\p{N}/u.test(value)
  const hasSymbol = /[^\p{L}\p{N}\s]/u.test(value)

  if (!value) return "اكتب كلمة المرور الأول"
  if (value.length < 8) return "كلمة المرور لازم تكون 8 حروف أو أكثر"
  if (!hasLetter || !hasNumber || !hasSymbol) {
    return "كلمة المرور لازم يكون فيها حرف ورقم ورمز مميز زي @ أو $"
  }

  return null
}

export function generateStrongPassword(length = 12) {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lowercase = "abcdefghijkmnopqrstuvwxyz"
  const numbers = "23456789"
  const symbols = "!@#$%&*?"
  const allChars = `${uppercase}${lowercase}${numbers}${symbols}`

  const requiredChars = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ]

  while (requiredChars.length < length) {
    requiredChars.push(allChars[Math.floor(Math.random() * allChars.length)])
  }

  return requiredChars
    .sort(() => Math.random() - 0.5)
    .join("")
}
