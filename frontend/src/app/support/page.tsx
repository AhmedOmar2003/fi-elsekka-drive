import { Header } from "@/components/layout/header";
import { FaqSection } from "@/components/ride/shared";
import { Button } from "@/components/ui/button";
import { faqItems, supportTopics } from "@/lib/ride-content";

export default function SupportPage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex-1 w-full max-w-md px-4 pt-24 pb-32 animate-fade-in">
        
        <div className="mb-6">
          <h1 className="text-3xl font-black text-foreground">الدعم والمساعدة</h1>
          <p className="mt-2 text-sm text-gray-400">قولنا المشكلة وإحنا هنساعدك فوراً.</p>
        </div>

        <div className="space-y-6">
          {/* Contact Form */}
          <div className="bg-surface-container-low border border-white/5 rounded-[32px] p-5 shadow-sm">
            <h2 className="text-xl font-black text-foreground mb-4">قدّم شكوى أو استفسار</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold text-gray-400">الاسم</label>
                <input className="h-12 w-full rounded-[20px] border border-white/10 bg-surface-container/50 px-4 text-sm text-foreground outline-none focus:border-primary focus:bg-surface-container transition-colors" placeholder="اسمك" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold text-gray-400">رقم الموبايل</label>
                <input type="tel" dir="ltr" className="h-12 w-full rounded-[20px] border border-white/10 bg-surface-container/50 px-4 text-sm text-foreground outline-none focus:border-primary focus:bg-surface-container transition-colors text-right" placeholder="0100xxxxxxx" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold text-gray-400">نوع المشكلة</label>
                <div className="flex flex-wrap gap-2">
                  {supportTopics.map((topic) => (
                     <span key={topic} className="inline-flex rounded-full border border-white/10 bg-surface-container/30 px-3 py-1.5 text-xs font-black text-gray-300">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold text-gray-400">التفاصيل</label>
                <textarea
                  rows={4}
                  className="w-full rounded-[24px] border border-white/10 bg-surface-container/50 px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:bg-surface-container transition-colors resize-none"
                  placeholder="احكي لنا المشكلة باختصار..."
                />
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <Button className="h-14 w-full rounded-[20px] text-base font-black shadow-[0_4px_20px_-4px_rgba(61,161,132,0.4)]">إرسال الرسالة</Button>
              <Button variant="outline" className="h-14 w-full rounded-[20px] border-white/10 bg-transparent text-foreground hover:bg-white/5">واتساب المشرف</Button>
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-surface-container-low border border-white/5 rounded-[32px] p-5 shadow-sm">
            <h2 className="text-xl font-black text-foreground mb-4">أسئلة شائعة</h2>
            <FaqSection items={faqItems} />
          </div>
        </div>
      </main>
    </>
  );
}
