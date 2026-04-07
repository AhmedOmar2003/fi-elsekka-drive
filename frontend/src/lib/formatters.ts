export function formatNumberLatin(value: number | string) {
  const numericValue = typeof value === "number" ? value : Number(value || 0);
  if (!Number.isFinite(numericValue)) return "0";

  if (Number.isInteger(numericValue)) {
    return numericValue.toLocaleString("en-US");
  }

  return numericValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMoney(value: number | string, currencyLabel: string = "ج.م") {
  return `${formatNumberLatin(value)} ${currencyLabel}`;
}
