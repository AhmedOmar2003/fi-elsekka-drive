export type TaxonomyOption = {
  value: string;
  label: string;
  children?: TaxonomyOption[];
};

export type CategoryTaxonomyConfig = {
  categoryName: string;
  primaryLabel: string;
  secondaryLabel: string;
  tertiaryLabel?: string;
  options: TaxonomyOption[];
};

export type ProductTaxonomySelection = {
  primary: string;
  secondary: string;
  tertiary: string;
};

const CATEGORY_TAXONOMIES: CategoryTaxonomyConfig[] = [
  {
    categoryName: "ملابس وأزياء",
    primaryLabel: "الفئة الأساسية",
    secondaryLabel: "التصنيف الفرعي",
    tertiaryLabel: "النوع الأدق",
    options: [
      {
        value: "men",
        label: "رجالي",
        children: [
          { value: "tshirts", label: "تيشيرتات", children: [{ value: "basic", label: "باسيك" }, { value: "oversized", label: "أوفر سايز" }, { value: "polo", label: "بولو" }] },
          { value: "shirts", label: "قمصان", children: [{ value: "formal", label: "رسمي" }, { value: "casual", label: "كاجوال" }] },
          { value: "pants", label: "بناطيل", children: [{ value: "jeans", label: "جينز" }, { value: "formal", label: "قماش" }, { value: "jogger", label: "جوجر" }] },
          { value: "sportswear", label: "ملابس رياضية" },
          { value: "underwear", label: "ملابس داخلية" },
        ],
      },
      {
        value: "women",
        label: "نسائي",
        children: [
          { value: "dresses", label: "فساتين", children: [{ value: "casual", label: "كاجوال" }, { value: "evening", label: "سواريه" }] },
          { value: "blouses", label: "بلوزات" },
          { value: "pants", label: "بناطيل" },
          { value: "abayas", label: "عبايات" },
          { value: "sleepwear", label: "ملابس نوم" },
        ],
      },
      {
        value: "kids",
        label: "أطفالي",
        children: [
          { value: "baby_sets", label: "أطقم أطفال" },
          { value: "schoolwear", label: "ملابس مدرسة" },
          { value: "winterwear", label: "شتوي" },
          { value: "summerwear", label: "صيفي" },
        ],
      },
      {
        value: "youth",
        label: "شبابي",
        children: [
          { value: "hoodies", label: "هوديز" },
          { value: "oversized", label: "أوفر سايز" },
          { value: "jeans", label: "جينز" },
          { value: "sets", label: "أطقم" },
        ],
      },
    ],
  },
  {
    categoryName: "سوبر ماركت",
    primaryLabel: "القسم الفرعي",
    secondaryLabel: "التصنيف",
    tertiaryLabel: "نوع المنتج",
    options: [
      {
        value: "dairy",
        label: "ألبان",
        children: [
          { value: "yogurt", label: "زبادي" },
          { value: "milk", label: "لبن" },
          { value: "cheese", label: "جبنة" },
        ],
      },
      {
        value: "groceries",
        label: "بقالة",
        children: [
          { value: "rice", label: "أرز ومكرونة" },
          { value: "flour", label: "دقيق وسكر" },
          { value: "oil", label: "زيوت وسمن" },
        ],
      },
      {
        value: "snacks",
        label: "سناكس",
        children: [
          { value: "chips", label: "شيبسي" },
          { value: "biscuits", label: "بسكوت" },
          { value: "chocolate", label: "شوكولاتة" },
        ],
      },
      {
        value: "beverages",
        label: "مشروبات",
        children: [
          { value: "juices", label: "عصائر" },
          { value: "water", label: "مياه" },
          { value: "soft_drinks", label: "مشروبات غازية" },
        ],
      },
    ],
  },
  {
    categoryName: "طعام",
    primaryLabel: "نوع الأكل",
    secondaryLabel: "التصنيف",
    tertiaryLabel: "النوع الأدق",
    options: [
      {
        value: "restaurants",
        label: "مطاعم",
        children: [
          { value: "pizza", label: "بيتزا" },
          { value: "grills", label: "مشويات" },
          { value: "oriental", label: "شرقي" },
          { value: "burgers", label: "برجر" },
          { value: "desserts", label: "حلويات" },
        ],
      },
      {
        value: "meals",
        label: "وجبات",
        children: [
          { value: "breakfast", label: "فطار" },
          { value: "lunch", label: "غدا" },
          { value: "dinner", label: "عشا" },
        ],
      },
      {
        value: "sandwiches",
        label: "ساندوتشات",
        children: [
          { value: "meat", label: "لحوم" },
          { value: "chicken", label: "فراخ" },
          { value: "mix", label: "ميكس" },
        ],
      },
      {
        value: "bakery",
        label: "مخبوزات",
        children: [
          { value: "pastries", label: "فطاير" },
          { value: "bread", label: "عيش ومخبوزات" },
          { value: "pizza", label: "بيتزا" },
        ],
      },
      {
        value: "desserts",
        label: "حلويات",
        children: [
          { value: "eastern", label: "شرقي" },
          { value: "western", label: "غربي" },
          { value: "icecream", label: "آيس كريم" },
        ],
      },
      {
        value: "drinks",
        label: "مشروبات",
        children: [
          { value: "hot", label: "ساخنة" },
          { value: "cold", label: "باردة" },
          { value: "fresh", label: "فريش" },
        ],
      },
    ],
  },
  {
    categoryName: "إلكترونيات",
    primaryLabel: "القسم الفرعي",
    secondaryLabel: "التصنيف",
    tertiaryLabel: "النوع الأدق",
    options: [
      {
        value: "mobiles",
        label: "موبايلات",
        children: [
          { value: "android", label: "أندرويد" },
          { value: "iphone", label: "آيفون" },
          { value: "accessories", label: "إكسسوارات موبايل" },
        ],
      },
      {
        value: "audio",
        label: "صوتيات",
        children: [
          { value: "headphones", label: "سماعات" },
          { value: "speakers", label: "سبيكر" },
          { value: "microphones", label: "مايك" },
        ],
      },
      {
        value: "computers",
        label: "كمبيوتر",
        children: [
          { value: "laptops", label: "لاب توب" },
          { value: "keyboards", label: "كيبورد" },
          { value: "mice", label: "ماوس" },
        ],
      },
      {
        value: "gaming",
        label: "جيمينج",
        children: [
          { value: "consoles", label: "أجهزة" },
          { value: "controllers", label: "أذرع تحكم" },
        ],
      },
    ],
  },
  {
    categoryName: "ألعاب أطفال",
    primaryLabel: "القسم الفرعي",
    secondaryLabel: "التصنيف",
    tertiaryLabel: "النوع الأدق",
    options: [
      {
        value: "educational",
        label: "ألعاب تعليمية",
        children: [
          { value: "letters", label: "حروف وأرقام" },
          { value: "montessori", label: "مونتيسوري" },
        ],
      },
      {
        value: "action",
        label: "ألعاب حركة",
        children: [
          { value: "ride_ons", label: "ركوبات" },
          { value: "sports", label: "كرات وألعاب رياضية" },
        ],
      },
      {
        value: "dolls",
        label: "عرائس وشخصيات",
        children: [
          { value: "dolls", label: "عرائس" },
          { value: "figures", label: "شخصيات" },
        ],
      },
      {
        value: "blocks",
        label: "مكعبات وتركيب",
        children: [
          { value: "lego", label: "ليجو" },
          { value: "puzzles", label: "بازل" },
        ],
      },
    ],
  },
  {
    categoryName: "أدوات منزلية",
    primaryLabel: "القسم الفرعي",
    secondaryLabel: "التصنيف",
    tertiaryLabel: "النوع الأدق",
    options: [
      {
        value: "kitchen",
        label: "مطبخ",
        children: [
          { value: "cookware", label: "حلل ومقالي" },
          { value: "storage", label: "تخزين" },
          { value: "tools", label: "أدوات مطبخ" },
        ],
      },
      {
        value: "cleaning",
        label: "تنظيف",
        children: [
          { value: "detergents", label: "منظفات" },
          { value: "supplies", label: "أدوات تنظيف" },
        ],
      },
      {
        value: "organization",
        label: "تنظيم",
        children: [
          { value: "closets", label: "تنظيم دواليب" },
          { value: "bathroom", label: "تنظيم حمام" },
        ],
      },
      {
        value: "hardware",
        label: "عدة وأدوات",
        children: [
          { value: "repair", label: "صيانة منزلية" },
          { value: "electric", label: "كهرباء خفيفة" },
        ],
      },
    ],
  },
  {
    categoryName: "العناية الشخصية",
    primaryLabel: "القسم الفرعي",
    secondaryLabel: "التصنيف",
    tertiaryLabel: "النوع الأدق",
    options: [
      {
        value: "haircare",
        label: "عناية بالشعر",
        children: [
          { value: "shampoo", label: "شامبو" },
          { value: "conditioner", label: "بلسم" },
          { value: "treatments", label: "ماسكات وزيوت" },
        ],
      },
      {
        value: "skincare",
        label: "عناية بالبشرة",
        children: [
          { value: "cleansers", label: "غسول" },
          { value: "moisturizers", label: "مرطبات" },
          { value: "sunscreen", label: "واقي شمس" },
        ],
      },
      {
        value: "bodycare",
        label: "عناية بالجسم",
        children: [
          { value: "soaps", label: "صابون" },
          { value: "lotions", label: "لوشن" },
          { value: "deodorant", label: "مزيل عرق" },
        ],
      },
      {
        value: "fragrance",
        label: "عطور",
        children: [
          { value: "perfume", label: "برفانات" },
          { value: "mists", label: "بودي سبلاش" },
        ],
      },
    ],
  },
  {
    categoryName: "صيدلية",
    primaryLabel: "القسم الفرعي",
    secondaryLabel: "التصنيف",
    tertiaryLabel: "النوع الأدق",
    options: [
      {
        value: "cold_flu",
        label: "برد وإنفلونزا",
        children: [
          { value: "pain_relief", label: "مسكنات" },
          { value: "cough", label: "كحة" },
          { value: "fever", label: "خفض حرارة" },
        ],
      },
      {
        value: "vitamins",
        label: "فيتامينات",
        children: [
          { value: "immune", label: "مناعة" },
          { value: "kids", label: "أطفال" },
          { value: "women", label: "للنساء" },
        ],
      },
      {
        value: "medical_supplies",
        label: "مستلزمات طبية",
        children: [
          { value: "first_aid", label: "إسعافات أولية" },
          { value: "devices", label: "أجهزة بسيطة" },
        ],
      },
      {
        value: "derma",
        label: "ديرما",
        children: [
          { value: "acne", label: "حب شباب" },
          { value: "moisturizers", label: "مرطبات" },
        ],
      },
    ],
  },
];

export function getCategoryTaxonomyConfig(categoryName?: string | null) {
  if (!categoryName) return null;
  return CATEGORY_TAXONOMIES.find((config) => config.categoryName === categoryName.trim()) || null;
}

export function getTaxonomySelection(specifications?: Record<string, any> | null): ProductTaxonomySelection {
  return {
    primary: String(specifications?.category_taxonomy?.primary || "").trim(),
    secondary: String(specifications?.category_taxonomy?.secondary || "").trim(),
    tertiary: String(specifications?.category_taxonomy?.tertiary || "").trim(),
  };
}

export function getTaxonomyPrimaryOptions(categoryName?: string | null) {
  return getCategoryTaxonomyConfig(categoryName)?.options || [];
}

export function getTaxonomySecondaryOptions(categoryName?: string | null, primaryValue?: string | null) {
  if (!primaryValue) return [];
  const primary = getTaxonomyPrimaryOptions(categoryName).find((option) => option.value === primaryValue);
  return primary?.children || [];
}

export function getTaxonomyTertiaryOptions(
  categoryName?: string | null,
  primaryValue?: string | null,
  secondaryValue?: string | null
) {
  if (!primaryValue || !secondaryValue) return [];
  const secondary = getTaxonomySecondaryOptions(categoryName, primaryValue).find((option) => option.value === secondaryValue);
  return secondary?.children || [];
}

export function getTaxonomyLabel(
  categoryName?: string | null,
  primaryValue?: string | null,
  secondaryValue?: string | null,
  tertiaryValue?: string | null
) {
  const primary = getTaxonomyPrimaryOptions(categoryName).find((option) => option.value === primaryValue);
  const secondary = getTaxonomySecondaryOptions(categoryName, primaryValue).find((option) => option.value === secondaryValue);
  const tertiary = getTaxonomyTertiaryOptions(categoryName, primaryValue, secondaryValue).find((option) => option.value === tertiaryValue);

  return {
    primary: primary?.label || "",
    secondary: secondary?.label || "",
    tertiary: tertiary?.label || "",
  };
}

export function matchesProductTaxonomy(
  specifications: Record<string, any> | null | undefined,
  filters: ProductTaxonomySelection
) {
  const selection = getTaxonomySelection(specifications);
  if (filters.primary && selection.primary !== filters.primary) return false;
  if (filters.secondary && selection.secondary !== filters.secondary) return false;
  if (filters.tertiary && selection.tertiary !== filters.tertiary) return false;
  return true;
}
