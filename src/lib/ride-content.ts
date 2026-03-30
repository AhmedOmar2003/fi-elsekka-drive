export type TripStatus =
  | "pending"
  | "accepted"
  | "arriving"
  | "arrived"
  | "started"
  | "completed"
  | "cancelled";

export type NotificationTone = "success" | "info" | "warning" | "danger";

export const rideSitemap = [
  { label: "الرئيسية", href: "/" },
  { label: "ابدأ الحجز", href: "/book" },
  { label: "رحلاتي", href: "/trips" },
  { label: "الإشعارات", href: "/notifications" },
  { label: "حسابي", href: "/account" },
  { label: "الدعم والمساعدة", href: "/support" },
  { label: "تسجيل الدخول", href: "/login" },
  { label: "إنشاء حساب", href: "/register" },
] as const;

export const componentArchitecture = [
  "Navbar / MobileNav / Footer",
  "HeroSection / SectionHeading / TrustSection / FAQSection",
  "TripTypeSelector / BookingForm / AirportRideForm / NormalRideForm",
  "LocationInput / MapPreview / StatusBadge / TripTimeline",
  "DriverCard / VehicleCard / NotificationItem / EmptyState",
  "AuthForm / DriverRegistrationForm / FileUploadField",
] as const;

export const tripTypeCards = [
  {
    id: "airport",
    title: "مشوار المطار",
    subtitle: "لو رايح أو جاي من المطار وعايز تضيف تفاصيل زيادة",
    href: "/book",
    accent: "from-primary/20 via-primary/8 to-transparent",
    badge: "جاهز للمطار",
  },
  {
    id: "city",
    title: "مشوارك العادي",
    subtitle: "من أي مكان لأي مكان بخطوتين واضحين",
    href: "/book",
    accent: "from-secondary/18 via-secondary/8 to-transparent",
    badge: "داخل المدينة",
  },
] as const;

export const howItWorksSteps = [
  {
    title: "اكتب من فين وإلى فين",
    description: "تحدد مكان التحرك والوصول ونوع المشوار من نفس الشاشة من غير لف كتير.",
  },
  {
    title: "الطلب يروح للأدمن",
    description: "الأدمن يراجع الطلب بسرعة ويبعته للكباتن أو المندوبين المناسبين حسب المنطقة ونوع المركبة.",
  },
  {
    title: "أول كابتن يقبل يظهرلك",
    description: "بمجرد ما كابتن يوافق، تشوف بياناته وحالة الطلب وتكمل الرحلة بشكل بسيط وواضح.",
  },
] as const;

export const valueProps = [
  {
    title: "أبسط من لوحات الحجز المعقدة",
    description: "المستخدم يفتح، يكتب من وإلى، ويبعت الطلب. ده الأساس في التجربة كلها.",
  },
  {
    title: "مناسب لطبيعة التشغيل عندك",
    description: "الطلب بيروح للأدمن الأول، وبعدها يتوزع يدويًا أو شبه يدوي على الكباتن.",
  },
  {
    title: "جاهز كـPWA على الموبايل",
    description: "الواجهة متصممة كأنها تطبيق خفيف وسريع، ومناسبة جدًا للتشغيل من شاشة الموبايل.",
  },
] as const;

export const trustHighlights = [
  "متابعة حالة الرحلة خطوة بخطوة",
  "بيانات الكابتن والمركبة ظاهرة قبل التحرك",
  "إمكانية الإبلاغ أو التواصل من شاشة الدعم",
  "هيكل جاهز لإضافة الدفع والتنبيهات لاحقًا",
] as const;

export const serviceAreas = [
  "القاهرة الجديدة",
  "مدينة نصر",
  "المعادي",
  "الجيزة",
  "المنصورة",
  "الزقازيق",
] as const;

export const faqItems = [
  {
    question: "إيه الفرق بين مشوار المطار والمشوار العادي؟",
    answer:
      "في النسخة المبسطة الاتنين بيبدؤوا من نفس الفكرة: من وإلى. لو المشوار مطار تقدر تضيف تفاصيل زيادة بعد كده زي الترمينال أو رقم الرحلة.",
  },
  {
    question: "ينفع أطلب توك توك؟",
    answer:
      "أيوه، لو المنطقة بتدعم النوع ده من الرحلات. هتلاقي الاختيار ظاهر في نموذج الكباتن وفي تفضيلات بعض المشاوير.",
  },
  {
    question: "هل الخريطة شغالة دلوقتي؟",
    answer:
      "الواجهة map-ready بالكامل. دلوقتي بنعرض preview placeholders وهنربطها لاحقًا بخدمة الخرائط والتتبع الفعلي.",
  },
  {
    question: "إزاي أبقى كابتن؟",
    answer:
      "حسابات الكباتن بتتعمل من إدارة في السكة، وبعدها الكابتن بيدخل من رابط دخول الكباتن بالإيميل والباسورد اللي الإدارة بتسلمهوله.",
  },
] as const;

export const notificationItems = [
  {
    id: "notif-1",
    title: "تم قبول المشوار",
    body: "الأدمن بعت الطلب للكباتن، والكابتن أحمد قبله وهو في الطريق ليك خلال 6 دقائق.",
    time: "من 3 دقايق",
    tone: "success" as NotificationTone,
  },
  {
    id: "notif-2",
    title: "الكابتن وصل نقطة التحرك",
    body: "افتح شاشة التتبع وشوف مكان العربية بالظبط.",
    time: "من 12 دقيقة",
    tone: "info" as NotificationTone,
  },
  {
    id: "notif-3",
    title: "مراجعة بيانات الكابتن",
    body: "استلمنا مستنداتك، ولسه باقي مراجعة رخصة المركبة.",
    time: "أمس",
    tone: "warning" as NotificationTone,
  },
  {
    id: "notif-4",
    title: "تحديث من الإدارة",
    body: "الخدمة اتوسعت في المعادي ومدينة نصر. جرب تحجز من أقرب منطقة ليك.",
    time: "من يومين",
    tone: "info" as NotificationTone,
  },
] as const;

export const profileSavedPlaces = [
  { name: "البيت", address: "التجمع الخامس - شارع التسعين الجنوبي" },
  { name: "الشغل", address: "مدينة نصر - عباس العقاد" },
  { name: "المطار", address: "مطار القاهرة الدولي - مبنى 3" },
] as const;

export const tripHistory = [
  {
    id: "trip-1001",
    title: "من المعادي للمطار",
    date: "اليوم - 8:30 م",
    price: "280 ج.م",
    status: "upcoming" as const,
    href: "/trips/trip-1001",
  },
  {
    id: "trip-1002",
    title: "من مدينة نصر للتجمع",
    date: "أمس - 6:10 م",
    price: "145 ج.م",
    status: "completed" as const,
    href: "/trips/trip-1002",
  },
  {
    id: "trip-1003",
    title: "من المنصورة للجامعة",
    date: "السبت - 9:00 ص",
    price: "90 ج.م",
    status: "cancelled" as const,
    href: "/trips/trip-1003",
  },
] as const;

export const tripStatusSteps = [
  { key: "accepted", label: "الكابتن قبل الطلب" },
  { key: "arriving", label: "في الطريق ليك" },
  { key: "arrived", label: "وصل نقطة التحرك" },
  { key: "started", label: "المشوار بدأ" },
  { key: "completed", label: "تم الوصول" },
] as const;

export const supportTopics = [
  "مشكلة في الكابتن",
  "تأخير في الوصول",
  "تسعير أو تقدير تكلفة",
  "مفقودات في الرحلة",
  "اقتراح أو شكوى عامة",
] as const;

export const airports = [
  "مطار القاهرة الدولي",
  "مطار برج العرب",
  "مطار سفنكس",
  "مطار شرم الشيخ",
] as const;

export const vehicleTypes = [
  { value: "car", label: "عربية" },
  { value: "tuk-tuk", label: "توك توك" },
] as const;

export const vehicleBrands = [
  "هيونداي",
  "تويوتا",
  "كيا",
  "شيفروليه",
  "سوزوكي",
  "باجاج",
] as const;

export const driverRequirements = [
  "صورة البطاقة",
  "صورة الرخصة",
  "رخصة المركبة",
  "صورة شخصية حديثة",
  "إثبات فيش وتشبيه أو خلفية جنائية لاحقًا",
] as const;

export const liveTripCaptain = {
  name: "كابتن أحمد رمضان",
  rating: "4.9",
  phone: "0100 224 1188",
  eta: "6 دقايق",
  vehicleName: "هيونداي إلنترا",
  plate: "ق ر ص 3214",
  color: "أبيض",
};
