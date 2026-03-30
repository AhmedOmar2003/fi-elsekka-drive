import React from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Shield, ChevronRight } from "lucide-react"

export const metadata = {
  title: "الشروط والأحكام | في السكة",
  description: "اقرأ الشروط والأحكام الخاصة بمنصة في السكة للتسوق الإلكتروني.",
}

const SECTIONS = [
  {
    id: "acceptance",
    title: "١. القبول والموافقة",
    content: `باستخدامك لموقع "في السكة" أو تطبيقاته، فإنك توافق على الالتزام بهذه الشروط والأحكام بالكامل. إذا كنت لا توافق على أي من هذه الشروط، يُرجى عدم استخدام خدماتنا. نحتفظ بحق تعديل هذه الشروط في أي وقت، وسيتم إخطارك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار على المنصة.`,
  },
  {
    id: "services",
    title: "٢. وصف الخدمة",
    content: `تُقدّم منصة "في السكة" خدمة تسوق إلكتروني تتيح لك تصفح المنتجات وشراءها عبر الإنترنت مع خيار الدفع عند الاستلام. نطاق التشغيل الحالي داخل قرية ميت العامل فقط، وقريبًا القرى المجاورة. قد تتغير المنتجات المتاحة أو أسعارها في أي وقت دون إشعار مسبق.`,
  },
  {
    id: "account",
    title: "٣. حساب المستخدم",
    content: `أنت مسؤول عن الحفاظ على سرية بيانات حسابك وكلمة المرور. يجب إخطارنا فوراً في حالة الاشتباه بأي استخدام غير مصرح به لحسابك. لا نتحمل أي مسؤولية عن أي خسارة تنتج عن عدم الحفاظ على سرية بيانات حسابك. يجب أن يكون عمرك ١٨ عاماً أو أكثر لاستخدام المنصة.`,
  },
  {
    id: "orders",
    title: "٤. الطلبات والدفع",
    content: `جميع الطلبات تخضع للتحقق من توفر المنتج. نحتفظ بحق رفض أو إلغاء أي طلب في أي وقت لأسباب تشمل عدم توفر المنتج أو أخطاء في الأسعار. طريقة الدفع الوحيدة المتاحة حالياً هي الدفع كاشاً عند الاستلام. تأكيد الطلب يُعدّ عقداً ملزماً بين الطرفين.`,
  },
  {
    id: "delivery",
    title: "٥. الشحن والتوصيل",
    content: `نسعى لتوصيل طلباتك في أسرع وقت ممكن داخل نطاق التشغيل الحالي، وهو قرية ميت العامل فقط، وقريبًا القرى المجاورة. مواعيد التوصيل تقديرية وقد تتأثر بعوامل خارجة عن إرادتنا كالأحوال الجوية أو ظروف الطريق. يُجري المندوب اتصالاً بك قبل الوصول. في حالة غيابك عند التوصيل، سيُعاد جدولة موعد التسليم أو إلغاء الطلب وفقاً لسياستنا.`,
  },
  {
    id: "returns",
    title: "٦. الإرجاع والاستبدال",
    content: `يحق لك إرجاع المنتج خلال ٧ أيام من تاريخ الاستلام في حالة وجود عيب مصنعي أو مغايرة للوصف. يجب أن يكون المنتج في حالته الأصلية وبغلافه المحكم. لا نقبل إرجاع المنتجات التي تم فتحها أو استخدامها إلا في حالات العيوب الجوهرية. اتصل بخدمة العملاء لبدء عملية الإرجاع.`,
  },
  {
    id: "privacy",
    title: "٧. الخصوصية وحماية البيانات",
    content: `نلتزم بحماية خصوصيتك وبياناتك الشخصية وفقاً لسياسة الخصوصية المعتمدة لدينا. لن نبيع أو نشارك معلوماتك الشخصية مع أطراف ثالثة دون موافقتك، إلا في الحالات التي يوجبها القانون. للمزيد من التفاصيل، يُرجى الاطلاع على سياسة الخصوصية الخاصة بنا.`,
  },
  {
    id: "liability",
    title: "٨. تحديد المسؤولية",
    content: `لا تتحمل منصة "في السكة" المسؤولية عن أي أضرار غير مباشرة أو عرضية أو تبعية ناتجة عن استخدام خدماتنا. مسؤوليتنا القصوى في أي حالة محدودة بقيمة الطلب الذي نشأت عنه المطالبة. نحن لسنا مسؤولين عن أي تأخير أو فشل ناتج عن قوة قاهرة أو ظروف خارجة عن سيطرتنا.`,
  },
  {
    id: "law",
    title: "٩. القانون المطبّق",
    content: `تخضع هذه الشروط والأحكام لقوانين جمهورية مصر العربية وتُفسَّر وفقاً لها. أي نزاع ينشأ عن هذه الشروط أو يتعلق بها يخضع للاختصاص القضائي الحصري لمحاكم جمهورية مصر العربية.`,
  },
  {
    id: "contact",
    title: "١٠. التواصل معنا",
    content: `إذا كان لديك أي استفسار بشأن هذه الشروط والأحكام، يُرجى التواصل معنا عبر صفحة "تواصل معنا" على موقعنا أو إرسال بريد إلكتروني على support@fi-elsekka.com. سنرد على استفساراتك في أقرب وقت ممكن خلال أيام العمل.`,
  },
]

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pb-32 bg-[linear-gradient(180deg,rgba(15,21,19,1),rgba(20,28,25,1))]">
        {/* Hero Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background border-b border-surface-hover">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          </div>
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14 relative">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-6">
              <Link href="/" className="hover:text-primary transition-colors">الرئيسية</Link>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 rotate-180" />
              <span className="text-foreground font-medium">الشروط والأحكام</span>
            </nav>

            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-3">الشروط والأحكام</h1>
                <p className="text-gray-500 leading-relaxed max-w-2xl">
                  يُرجى قراءة هذه الشروط بعناية قبل استخدام منصة "في السكة". استخدامك للمنصة يعني موافقتك التامة على جميع هذه الشروط.
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
                  <div className="bg-surface border border-surface-hover rounded-2xl p-6 hover:border-primary/20 transition-colors">
                    <h2 className="text-lg font-black text-foreground mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary inline-block shrink-0" />
                      {section.title}
                    </h2>
                    <p className="text-gray-500 leading-[2] text-sm">{section.content}</p>
                  </div>
                </section>
              ))}

              {/* Footer CTA */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center">
                <p className="text-sm text-gray-500 mb-4">هل لديك سؤال عن الشروط؟</p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-colors text-sm"
                >
                  تواصل معنا
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
