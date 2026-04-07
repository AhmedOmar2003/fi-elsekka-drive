"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ImagePlus, NotebookPen, Pill, ShoppingBasket, Sparkles, Trash2 } from "lucide-react"
import {
  getTextRequestCategoryConfig,
  TEXT_CATEGORY_ORDER_MODE,
  uploadTextCategoryRequestImage,
  writeTextCategoryOrderDraft,
} from "@/lib/text-category-orders"

type RequestCategory = {
  id: string
  name: string
}

export function CategoryRequestPanel({
  category,
  compact = false,
}: {
  category: RequestCategory
  compact?: boolean
}) {
  const router = useRouter()
  const textRequestCategoryConfig = React.useMemo(
    () => getTextRequestCategoryConfig(category.name),
    [category.name]
  )

  const [textRequest, setTextRequest] = React.useState("")
  const [requestImageUrls, setRequestImageUrls] = React.useState<string[]>([])
  const [isUploadingImages, setIsUploadingImages] = React.useState(false)
  const [requestError, setRequestError] = React.useState("")

  const canContinueTextRequest = React.useMemo(() => {
    if (!textRequestCategoryConfig) return false
    const hasText = textRequest.trim().length >= (textRequestCategoryConfig.requireText ? 12 : 1)
    const hasImages = requestImageUrls.length > 0
    return textRequestCategoryConfig.requireText ? hasText : hasText || hasImages
  }, [requestImageUrls.length, textRequest, textRequestCategoryConfig])

  React.useEffect(() => {
    setTextRequest("")
    setRequestImageUrls([])
    setRequestError("")

    try {
      const raw = window.sessionStorage.getItem(`text-category-order-draft:${category.id}`)
      if (!raw) return
      const draft = JSON.parse(raw) as { requestText?: string; imageUrls?: string[] }
      if (draft?.requestText) {
        setTextRequest(draft.requestText)
      }
      setRequestImageUrls(Array.isArray(draft?.imageUrls) ? draft.imageUrls.filter(Boolean) : [])
    } catch {
      // Ignore malformed draft state
    }
  }, [category.id])

  const handleUploadRequestImages = async (files: FileList | null) => {
    if (!files || !textRequestCategoryConfig?.allowImages) return

    const selectedFiles = Array.from(files)
    const availableSlots = Math.max((textRequestCategoryConfig.maxImages || 0) - requestImageUrls.length, 0)

    if (availableSlots <= 0) {
      setRequestError(`يمكنك رفع ${textRequestCategoryConfig.maxImages} صور فقط لهذا الطلب.`)
      return
    }

    const validFiles = selectedFiles.slice(0, availableSlots)
    const invalidType = validFiles.find(file => !file.type.startsWith('image/'))

    if (invalidType) {
      setRequestError('ارفع صورًا واضحة فقط بصيغة صور فعلية مثل JPG أو PNG.')
      return
    }

    setRequestError('')
    setIsUploadingImages(true)

    try {
      const uploadedUrls: string[] = []

      for (const file of validFiles) {
        const uploadedUrl = await uploadTextCategoryRequestImage(category.id, file)
        if (!uploadedUrl) {
          throw new Error('تعذر رفع إحدى الصور. حاول مرة أخرى بصورة أوضح أو بعد تسجيل الدخول.')
        }
        uploadedUrls.push(uploadedUrl)
      }

      setRequestImageUrls(prev => [...prev, ...uploadedUrls].slice(0, textRequestCategoryConfig.maxImages))
    } catch (error: any) {
      setRequestError(error.message || 'تعذر رفع الصور الآن.')
    } finally {
      setIsUploadingImages(false)
    }
  }

  const handleRemoveRequestImage = (imageUrl: string) => {
    setRequestImageUrls(prev => prev.filter(url => url !== imageUrl))
  }

  const handleContinueTextOrder = () => {
    const normalizedText = textRequest.trim()
    const hasImages = requestImageUrls.length > 0
    const requiresText = Boolean(textRequestCategoryConfig?.requireText)

    if (!textRequestCategoryConfig) return
    if (requiresText && normalizedText.length < 12) {
      setRequestError('اكتب الطلب بشكل واضح قبل المتابعة.')
      return
    }
    if (!requiresText && normalizedText.length === 0 && !hasImages) {
      setRequestError('اكتب طلبك أو ارفع صورة واحدة واضحة على الأقل قبل المتابعة.')
      return
    }

    writeTextCategoryOrderDraft({
      categoryId: category.id,
      categoryName: category.name,
      requestText: normalizedText,
      imageUrls: requestImageUrls,
    })

    router.push(`/checkout?requestMode=${TEXT_CATEGORY_ORDER_MODE}&categoryId=${category.id}`)
  }

  if (!textRequestCategoryConfig) {
    return null
  }

  const isPharmacy = category.name === 'صيدلية'

  return (
    <div className={compact ? "mx-auto max-w-4xl" : ""}>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-surface-hover bg-surface p-6 shadow-premium sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              {isPharmacy ? <Pill className="h-7 w-7" /> : <ShoppingBasket className="h-7 w-7" />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground">
                {isPharmacy ? 'اطلب من الصيدلية بالنص أو بالروشتة' : 'ملقتش المنتج اللي عاوزه؟'}
              </h2>
              <p className="mt-2 text-sm leading-7 text-gray-500">
                {isPharmacy
                  ? 'اكتب أسماء الأدوية أو ارفع لحد 3 صور واضحة جدًا للروشتة أو العبوة. إحنا هنراجع الطلب وبعدها نكملك عليه.'
                  : 'اكتب المنتج اللي محتاجه أو ارفع لحد 3 صور واضحة له، وممكن تجمع بين النص والصور عادي. أول ما نلاقيه هنبلغك بالسعر وتشوف تحب نكمل ولا لأ.'}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs font-black">اكتبها إزاي بشكل واضح؟</p>
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-7 text-gray-500">
              {isPharmacy ? (
                <>
                  <li>اكتب اسم الدواء أو التركيز والكمية المطلوبة إن كنت تعرفها.</li>
                  <li>لو سترفع روشتة، خليك متأكد إن الصورة واضحة ومقروءة بالكامل.</li>
                  <li>ممكن تجمع بين النص والصور لو ده يوضّح الطلب أكتر.</li>
                </>
              ) : (
                <>
                  <li>اكتب اسم المنتج أو وصفه بشكل واضح، ولو تعرف الماركة أو المقاس اكتبه.</li>
                  <li>ممكن ترفع صور المنتج من أي زاوية تساعدنا نوصله أسرع.</li>
                  <li>تقدر تكتب فقط أو ترفع صور فقط أو تستخدم الاثنين معًا.</li>
                </>
              )}
            </ul>
          </div>

          {textRequestCategoryConfig.allowText && (
            <div className="mt-6">
              <label className="mb-3 flex items-center gap-2 text-sm font-black text-foreground">
                <NotebookPen className="h-4 w-4 text-primary" />
                {isPharmacy ? 'تفاصيل الطلب أو أسماء الأدوية' : 'اكتب المنتج اللي محتاجه'}
              </label>
              <textarea
                value={textRequest}
                onChange={(e) => setTextRequest(e.target.value)}
                rows={isPharmacy ? 9 : 7}
                placeholder={isPharmacy
                  ? `مثال:\nأوجمنتين 1 جم - عبوة\nكونجستال - 2 شريط\nلو دواء غير متوفر كلموني قبل الاستبدال`
                  : `مثال:\nعاوز تيشيرت أسود قطن مقاس L\nأو لعبة تركيب مناسبة لطفل 7 سنين\nأو خلاط يدوي ماركة معروفة`}
                className="w-full resize-none rounded-[1.5rem] border border-surface-hover bg-background px-4 py-4 text-sm leading-7 text-foreground outline-none transition-colors focus:border-primary/40"
              />
              <p className="mt-2 text-xs text-gray-500">
                {isPharmacy
                  ? 'حاول تكتب الاسم أو التركيز بشكل واضح عشان نراجع الطلب بسرعة.'
                  : 'لو كتبت الاسم أو الوصف بوضوح هنعرف نوصل للمنتج أسرع.'}
              </p>
            </div>
          )}

          {textRequestCategoryConfig.allowImages && (
            <div className="mt-6">
              <label className="mb-3 flex items-center gap-2 text-sm font-black text-foreground">
                <ImagePlus className="h-4 w-4 text-primary" />
                {isPharmacy ? 'ارفع صورة الروشتة أو الدواء' : 'ارفع صور المنتج لو متاحة'}
              </label>
              <div className="rounded-[1.5rem] border border-dashed border-primary/25 bg-background/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-foreground">حتى 3 صور واضحة</p>
                    <p className="mt-1 text-xs leading-6 text-gray-500">
                      {isPharmacy
                        ? 'صوّر الروشتة كاملة وبوضوح، أو صور عبوة الدواء من الأمام. الصور غير الواضحة ممكن تأخر التنفيذ.'
                        : 'ارفع صور المنتج من أي زاوية توضح شكله أو نوعه. الصور الواضحة بتساعدنا نوصل له أسرع.'}
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-black text-primary transition-colors hover:bg-primary hover:text-white">
                    {isUploadingImages ? 'جاري الرفع...' : 'اختيار الصور'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={isUploadingImages || requestImageUrls.length >= (textRequestCategoryConfig.maxImages || 0)}
                      onChange={(event) => {
                        handleUploadRequestImages(event.target.files)
                        event.currentTarget.value = ''
                      }}
                    />
                  </label>
                </div>

                {requestImageUrls.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {requestImageUrls.map((imageUrl, index) => (
                      <div key={`${imageUrl}-${index}`} className="relative overflow-hidden rounded-2xl border border-surface-hover bg-surface">
                        <img src={imageUrl} alt={`مرفق الطلب ${index + 1}`} className="h-32 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveRequestImage(imageUrl)}
                          className="absolute left-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-rose-500 shadow-sm transition-colors hover:bg-rose-500 hover:text-white"
                          aria-label="حذف الصورة"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {requestError ? (
            <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
              {requestError}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              {isPharmacy
                ? 'هنراجع الطلب ونقولك السعر وبعدها أنت تقرر نكمل ولا لأ.'
                : 'مش هتدفع دلوقتي. هنرد عليك الأول لو لقينا الطلب.'}
            </p>
            <Button
              onClick={handleContinueTextOrder}
              disabled={!canContinueTextRequest || isUploadingImages}
              className="rounded-2xl px-6 py-6 text-sm font-black"
            >
              {isPharmacy ? 'ابعت طلبك' : 'ابعت طلب البحث'}
            </Button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-surface-hover bg-surface p-6 shadow-premium sm:p-8">
          <h3 className="text-lg font-black text-foreground">
            {isPharmacy ? 'طريقة الطلب المقترحة' : 'مثال سريع'}
          </h3>
          <div className="mt-4 rounded-3xl border border-surface-hover bg-background/70 p-4 text-sm leading-7 text-gray-500">
            {isPharmacy ? (
              <>
                أوجمنتين 1 جم - عبوة
                <br />
                بروفين شراب للأطفال
                <br />
                لو التركيز غير واضح في الروشتة سأتواصل معكم
              </>
            ) : (
              <>
                عاوز سماعة بلوتوث لون أسود
                <br />
                أو تيشيرت رجالي قطن مقاس XL
                <br />
                أو لعبة تركيب مناسبة لطفل 7 سنين
              </>
            )}
          </div>

          <div className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4">
            <p className="text-xs font-black text-amber-500">مهم</p>
            <p className="mt-2 text-sm leading-7 text-gray-500">
              {isPharmacy
                ? 'اكتب اسم الدواء بوضوح أو ارفع صورًا مقروءة جدًا. أي صورة غير واضحة ممكن تأخر تجهيز الطلب.'
                : 'بعد ما نلاقي طلبك ونحدد سعره هنرجعلك الأول، وساعتها أنت اللي تختار نكمل أو نقفل الطلب.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
