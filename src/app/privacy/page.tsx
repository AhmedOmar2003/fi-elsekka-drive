import React from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Lock, ChevronRight } from "lucide-react"

export const metadata = {
  title: "سياسة الخصوصية | في السكة",
  description: "تعرّف على كيفية جمع واستخدام وحماية بياناتك الشخصية في منصة في السكة.",
}

const SECTIONS = [
  {
    id: "intro",
    title: "١. مقدمة",
    content: `تُقدّر منصة "في السكة" خصوصيتك وتلتزم بحماية بياناتك الشخصية. توضح هذه السياسة كيفية جمع معلوماتك واستخدامها وحمايتها عند استخدامك لموقعنا أو تطبيقنا. بالاستمرار في استخدام خدماتنا، فإنك توافق على الممارسات الموضحة في هذه السياسة.`,
  },
  {
    id: "data-collected",
    title: "٢. البيانات التي نجمعها",
    content: `نجمع المعلومات التالية: (أ) معلومات الهوية: الاسم الكامل، رقم الهاتف، وعنوان البريد الإلكتروني. (ب) معلومات التوصيل: العنوان التفصيلي، المنطقة، والمحافظة. (ج) معلومات الاستخدام: المنتجات التي تشاهدها وتشتريها، وتفضيلات التصفح. (د) معلومات الجهاز: نوع المتصفح، عنوان IP، ونظام التشغيل.`,
  },
  {
    id: "how-we-use",
    title: "٣. كيف نستخدم بياناتك",
    content: `نستخدم معلوماتك للأغراض التالية: معالجة طلباتك وتوصيلها، التواصل معك بشأن طلباتك وحسابك، تحسين خدماتنا ومنتجاتنا، إرسال عروض ترويجية (بموافقتك)، منع الاحتيال وضمان أمان المنصة، والامتثال للمتطلبات القانونية.`,
  },
  {
    id: "data-sharing",
    title: "٤. مشاركة البيانات",
    content: `لا نبيع بياناتك الشخصية لأطراف ثالثة. قد نشارك معلوماتك مع: مزودي خدمات الشحن والتوصيل لإتمام طلباتك، مزودي خدمات الدفع الإلكتروني، الجهات الحكومية والرقابية عند الطلب قانونياً، شركاء تقنيين يساعدون في تشغيل المنصة ويلتزمون بحماية خصوصيتك.`,
  },
  {
    id: "cookies",
    title: "٥. ملفات تعريف الارتباط (Cookies)",
    content: `نستخدم ملفات تعريف الارتباط (الكوكيز) لتحسين تجربتك. تُستخدم هذه الملفات لتذكر تفضيلاتك، الحفاظ على جلسة تسجيل الدخول، وتحليل سلوك الزوار لتحسين الموقع. يمكنك ضبط متصفحك لرفض الكوكيز، لكن قد يؤثر ذلك على بعض وظائف الموقع.`,
  },
  {
    id: "data-security",
    title: "٦. أمان البيانات",
    content: `نطبّق تدابير أمان صارمة لحماية بياناتك، تشمل: تشفير البيانات أثناء النقل باستخدام بروتوكول SSL، تشفير كلمات المرور باستخدام خوارزميات تجزئة آمنة، قيود الوصول على البيانات الشخصية للموظفين، ومراجعات أمنية دورية لأنظمتنا. رغم ذلك، لا يوجد نظام آمن بالكامل ونوصيك بحماية بيانات حسابك.`,
  },
  {
    id: "your-rights",
    title: "٧. حقوقك",
    content: `لديك الحق في: الوصول إلى بياناتك الشخصية المحفوظة لدينا، طلب تصحيح أي بيانات غير دقيقة، طلب حذف بياناتك (الحق في النسيان) وفق الضوابط القانونية المعمول بها، الاعتراض على معالجة بياناتك لأغراض التسويق، وسحب موافقتك على جمع البيانات في أي وقت.`,
  },
  {
    id: "retention",
    title: "٨. مدة الاحتفاظ بالبيانات",
    content: `نحتفظ ببياناتك الشخصية طالما كان حسابك نشطاً أو كان ذلك ضرورياً لتقديم خدماتنا. بعد إغلاق حسابك، قد نحتفظ ببعض البيانات لفترة محددة وفقاً للمتطلبات القانونية والضرائبية. بيانات المعاملات تُحفظ لمدة سبع سنوات وفقاً للقانون المصري.`,
  },
  {
    id: "children",
    title: "٩. خصوصية الأطفال",
    content: `خدماتنا غير موجهة للأطفال دون سن ١٨ عاماً. لا نجمع عن قصد أي بيانات شخصية من الأطفال. إذا علمنا أن طفلاً قد زوّدنا ببيانات شخصية من دون موافقة من وليّ أمره، سنحذف هذه البيانات على الفور.`,
  },
  {
    id: "updates",
    title: "١٠. تحديثات السياسة",
    content: `قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر. سنخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار بارز على الموقع. نوصيك بمراجعة هذه الصفحة بشكل دوري للاطلاع على أحدث نسخة من سياستنا.`,
  },
  {
    id: "contact",
    title: "١١. تواصل معنا بشأن الخصوصية",
    content: `إذا كان لديك أي استفسار أو طلب يتعلق ببياناتك الشخصية أو سياسة الخصوصية، يُرجى التواصل معنا عبر: البريد الإلكتروني: privacy@fi-elsekka.com أو من خلال صفحة "تواصل معنا" على الموقع. سنرد على طلبك في غضون ٣٠ يوماً من تاريخ استلامه.`,
  },
]

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pb-32 bg-[linear-gradient(180deg,rgba(15,21,19,1),rgba(20,28,25,1))]">
        {/* Hero Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500/8 via-background to-background border-b border-surface-hover">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
          </div>
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14 relative">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-6">
              <Link href="/" className="hover:text-primary transition-colors">الرئيسية</Link>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 rotate-180" />
              <span className="text-foreground font-medium">سياسة الخصوصية</span>
            </nav>

            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0 mt-1">
                <Lock className="w-7 h-7 text-blue-500" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-3">سياسة الخصوصية</h1>
                <p className="text-gray-500 leading-relaxed max-w-2xl">
                  خصوصيتك أمانة عندنا. اقرأ هذه السياسة لتعرف بالضبط إزاي بنتعامل مع بياناتك الشخصية وإزاي بنحافظ عليها.
                </p>
                <p className="text-xs text-gray-400 mt-3">آخر تحديث: مارس ٢٠٢٥</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-10 items-start">

            {/* Sticky Table of Contents */}
            <aside className="hidden md:block">
              <div className="sticky top-28 bg-surface border border-surface-hover rounded-2xl p-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">المحتويات</p>
                <nav className="space-y-1">
                  {SECTIONS.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="block text-sm text-gray-500 hover:text-primary transition-colors py-1.5 pr-3 border-r-2 border-transparent hover:border-primary"
                    >
                      {section.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Sections */}
            <div className="space-y-8">
              {SECTIONS.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-28">
                  <div className="bg-surface border border-surface-hover rounded-2xl p-6 hover:border-blue-500/20 transition-colors">
                    <h2 className="text-lg font-black text-foreground mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block shrink-0" />
                      {section.title}
                    </h2>
                    <p className="text-gray-500 leading-[2] text-sm">{section.content}</p>
                  </div>
                </section>
              ))}

              {/* Also see terms */}
              <div className="bg-surface border border-surface-hover rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 text-center sm:text-right">
                  <p className="font-bold text-foreground text-sm mb-1">ألقِ نظرة على الشروط والأحكام أيضاً</p>
                  <p className="text-xs text-gray-500">معاً يكوّنان الإطار القانوني الكامل لاستخدامك للمنصة</p>
                </div>
                <Link
                  href="/terms"
                  className="inline-flex items-center gap-2 bg-surface-hover hover:bg-primary/10 hover:text-primary text-gray-600 font-bold px-5 py-2.5 rounded-xl transition-colors text-sm border border-surface-hover shrink-0"
                >
                  الشروط والأحكام
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
