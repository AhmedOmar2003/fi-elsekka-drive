const CATEGORY_CODES: Record<string, string> = {
  "ملابس وأزياء": "FAS",
  "سوبر ماركت": "SUP",
  "إلكترونيات": "ELC",
  "ألعاب أطفال": "TOY",
  "أدوات منزلية": "HOM",
  "عناية شخصية": "PCR",
  "صيدلية": "PHR",
  "طعام": "FOD",
};

const VALUE_LABELS: Record<string, string> = {
  men: "رجالي",
  women: "نسائي",
  boys: "أولاد",
  girls: "بنات",
  unisex: "للجميع",
  baby: "بيبي",
  kids: "أطفال",
  teens: "مراهقين",
  adults: "كبار",
  summer: "صيفي",
  winter: "شتوي",
  "all-season": "كل المواسم",
  casual: "كاجوال",
  formal: "رسمي",
  sport: "رياضي",
  oversized: "أوفر سايز",
};

const uniq = (items: string[]) =>
  Array.from(
    new Set(
      items
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const normalizeText = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim();

const keywordizeTitle = (title: string) => {
  const clean = normalizeText(title);
  if (!clean) return [];

  const words = clean.split(" ").filter((word) => word.length > 1);
  const pairs = words.slice(0, Math.max(0, words.length - 1)).map((word, index) => `${word} ${words[index + 1]}`);

  return uniq([clean, ...words, ...pairs]).slice(0, 6);
};

const toCode = (value: string, fallback = "GEN") => {
  const clean = normalizeText(value);
  if (!clean) return fallback;

  const latinized = clean
    .replace(/[أإآ]/g, "A")
    .replace(/ة/g, "H")
    .replace(/ى/g, "Y")
    .replace(/[ؤئ]/g, "E")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .trim();

  if (!latinized) return fallback;

  const parts = latinized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 3).toUpperCase());

  return parts.join("").slice(0, 6) || fallback;
};

const toReadableLabel = (value: string) => VALUE_LABELS[value] || value;

export type SuggestionInput = {
  name: string;
  brand?: string;
  categoryName?: string;
  taxonomyPrimary?: string;
  taxonomySecondary?: string;
  taxonomyTertiary?: string;
  taxonomyPrimaryLabel?: string;
  taxonomySecondaryLabel?: string;
  taxonomyTertiaryLabel?: string;
  productType?: string;
  gender?: string;
  ageGroup?: string;
  season?: string;
  style?: string;
  material?: string;
  colorFamily?: string;
  sizeGroup?: string;
};

export type AdminProductPreset = {
  id: string;
  title: string;
  description: string;
  productType?: string;
  gender?: string;
  ageGroup?: string;
  season?: string;
  style?: string;
  material?: string;
  colorFamily?: string;
  sizeGroup?: string;
  tags: string[];
  keywords: string[];
};

type SuggestionResult = {
  sku: string;
  productType: string;
  tags: string[];
  keywords: string[];
};

const buildPreset = (
  id: string,
  title: string,
  description: string,
  values: Omit<AdminProductPreset, "id" | "title" | "description" | "tags" | "keywords"> & {
    tags?: string[];
    keywords?: string[];
  },
): AdminProductPreset => ({
  id,
  title,
  description,
  ...values,
  tags: uniq(values.tags || []),
  keywords: uniq(values.keywords || []),
});

export const getAdminProductPresets = (categoryName?: string): AdminProductPreset[] => {
  switch (categoryName) {
    case "ملابس وأزياء":
      return [
        buildPreset("fashion-casual-tee", "تيشيرت كاجوال", "مناسب لمنتجات اللبس اليومية والسريعة.", {
          productType: "تيشيرت",
          gender: "unisex",
          season: "summer",
          style: "casual",
          material: "cotton",
          tags: ["ملابس", "تيشيرت", "كاجوال", "لبس يومي", "صيفي"],
          keywords: ["تيشيرت كاجوال", "ملابس يومية", "تيشيرت قطن", "لبس مريح"],
        }),
        buildPreset("fashion-daily-pants", "بنطلون يومي", "قالب مناسب للبناطيل والجينز واللبس العملي.", {
          productType: "بنطلون",
          gender: "unisex",
          season: "all-season",
          style: "casual",
          material: "cotton",
          tags: ["ملابس", "بنطلون", "كاجوال", "لبس عملي"],
          keywords: ["بنطلون يومي", "ملابس عملية", "بنطلون مريح", "لبس خروج"],
        }),
        buildPreset("fashion-light-jacket", "جاكيت خفيف", "قالب مناسب للجاكيتات والقطعة الخارجية.", {
          productType: "جاكيت",
          gender: "unisex",
          season: "winter",
          style: "casual",
          material: "polyester",
          tags: ["جاكيت", "شتوي", "ملابس خروج", "لبس عملي"],
          keywords: ["جاكيت خفيف", "جاكيت شتوي", "ملابس خارجية", "ملابس عملية"],
        }),
      ];
    case "سوبر ماركت":
      return [
        buildPreset("market-grocery", "بقالة أساسية", "مناسب للسلع اليومية مثل السكر والأرز والدقيق.", {
          productType: "بقالة",
          tags: ["بقالة", "طلبات البيت", "سلع أساسية", "مواد غذائية"],
          keywords: ["بقالة", "سلع غذائية", "طلبات البيت", "مشتريات شهرية"],
        }),
        buildPreset("market-daily-dairy", "ألبان يومية", "مناسب للألبان والمنتجات اليومية السريعة.", {
          productType: "ألبان",
          tags: ["ألبان", "منتجات يومية", "فطار البيت", "طلبات يومية"],
          keywords: ["ألبان", "منتجات يومية", "لبن", "زبادي"],
        }),
        buildPreset("market-drinks", "مشروبات", "مناسب للعصائر والمياه والمشروبات الباردة.", {
          productType: "مشروبات",
          tags: ["مشروبات", "منتجات يومية", "طلبات البيت", "بارد"],
          keywords: ["مشروبات", "عصير", "مياه", "مشروب بارد"],
        }),
      ];
    case "ألعاب أطفال":
      return [
        buildPreset("toy-educational", "لعبة تعليمية", "مناسب للألعاب التعليمية وتنمية المهارات.", {
          productType: "تعليمي",
          ageGroup: "kids",
          tags: ["ألعاب أطفال", "تعليمي", "تنمية مهارات", "لعبة مفيدة"],
          keywords: ["لعبة تعليمية", "ألعاب أطفال", "تنمية مهارات", "ألعاب ذكاء"],
        }),
        buildPreset("toy-action", "لعبة حركة", "مناسب للألعاب الحركية والمسلية.", {
          productType: "حركي",
          ageGroup: "kids",
          tags: ["ألعاب أطفال", "حركة", "لعبة مسلية", "نشاط أطفال"],
          keywords: ["لعبة حركة", "ألعاب أطفال", "نشاط أطفال", "لعبة مسلية"],
        }),
        buildPreset("toy-puzzle", "بازل وتركيب", "مناسب للمكعبات والبازل وألعاب التركيب.", {
          productType: "تركيب",
          ageGroup: "kids",
          tags: ["ألعاب أطفال", "تركيب", "بازل", "تنمية الذكاء"],
          keywords: ["بازل أطفال", "لعبة تركيب", "ألعاب ذكاء", "مكعبات"],
        }),
      ];
    default:
      return [];
  }
};

export const getAdminCategoryPresets = getAdminProductPresets;

export const getAdminProductSuggestions = (input: SuggestionInput): SuggestionResult => {
  const {
    name,
    brand,
    categoryName,
    taxonomyPrimary,
    taxonomySecondary,
    taxonomyTertiary,
    productType,
    gender,
    ageGroup,
    season,
    style,
    material,
    colorFamily,
    sizeGroup,
  } = input;

  const categoryCode = CATEGORY_CODES[categoryName || ""] || "GEN";
  const primaryCode = toCode(taxonomyPrimary || productType || name, "CAT");
  const detailCode = toCode(taxonomyTertiary || taxonomySecondary || brand || name, "PRD");

  const inferredType =
    normalizeText(productType || taxonomyTertiary || taxonomySecondary || taxonomyPrimary || keywordizeTitle(name)[1] || name) ||
    "منتج عام";

  const labelFields = [
    categoryName,
    taxonomyPrimary,
    taxonomySecondary,
    taxonomyTertiary,
    brand,
    toReadableLabel(gender || ""),
    toReadableLabel(ageGroup || ""),
    toReadableLabel(season || ""),
    toReadableLabel(style || ""),
    material,
    colorFamily,
    sizeGroup,
  ].filter(Boolean) as string[];

  const tags = uniq([
    inferredType,
    ...labelFields,
    ...keywordizeTitle(name).slice(0, 4),
  ]).slice(0, 8);

  const keywords = uniq([
    ...keywordizeTitle(name),
    ...(brand ? [`${name} ${brand}`, `${inferredType} ${brand}`] : []),
    ...(taxonomyPrimary ? [`${inferredType} ${taxonomyPrimary}`] : []),
    ...(taxonomySecondary ? [`${inferredType} ${taxonomySecondary}`] : []),
    ...(categoryName ? [`${categoryName} ${inferredType}`] : []),
    ...(gender ? [`${inferredType} ${toReadableLabel(gender)}`] : []),
    ...(season ? [`${inferredType} ${toReadableLabel(season)}`] : []),
  ]).slice(0, 10);

  return {
    sku: `${categoryCode}-${primaryCode}-${detailCode}-001`,
    productType: inferredType,
    tags,
    keywords,
  };
};
