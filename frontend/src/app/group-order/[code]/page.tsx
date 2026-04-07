"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  fetchGroupOrder,
  joinGroupOrder,
  updateGroupOrderItem,
  type GroupOrderView,
} from "@/services/groupOrdersService"
import {
  clearStoredGroupParticipant,
  getStoredGroupParticipant,
  saveStoredGroupParticipant,
} from "@/lib/group-order-session"
import { getSelectedVariantLabel } from "@/lib/product-variants"
import { toast } from "sonner"
import { Copy, Plus, Minus, Share2, Users, ShoppingCart, Lock, ArrowLeft } from "lucide-react"

export default function GroupOrderPage() {
  const params = useParams()
  const router = useRouter()
  const code = String(params.code || "").toUpperCase()

  const [groupOrder, setGroupOrder] = React.useState<GroupOrderView | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [displayName, setDisplayName] = React.useState("")
  const [isJoining, setIsJoining] = React.useState(false)
  const [updatingItemId, setUpdatingItemId] = React.useState<string | null>(null)
  const [copying, setCopying] = React.useState(false)

  const storedParticipant = React.useMemo(
    () => (typeof window !== "undefined" ? getStoredGroupParticipant(code) : null),
    [code]
  )

  const loadGroupOrder = React.useCallback(async () => {
    if (!code) return
    setIsLoading(true)
    try {
      const data = await fetchGroupOrder(code, getStoredGroupParticipant(code)?.participantKey)
      setGroupOrder(data)
      if (data.groupOrder.status !== "open") {
        clearStoredGroupParticipant(code)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "مقدرناش نفتح الطلب الجماعي دلوقتي")
    } finally {
      setIsLoading(false)
    }
  }, [code])

  React.useEffect(() => {
    loadGroupOrder()
  }, [loadGroupOrder])

  React.useEffect(() => {
    if (storedParticipant?.displayName) {
      setDisplayName(storedParticipant.displayName)
    }
  }, [storedParticipant?.displayName])

  const shareBaseUrl = React.useMemo(() => {
    const configuredUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://fi-elsekka.vercel.app"

    if (configuredUrl) {
      return configuredUrl.replace(/\/+$/, "")
    }

    if (typeof window !== "undefined") {
      return window.location.origin.replace(/\/+$/, "")
    }

    return "https://fi-elsekka.vercel.app"
  }, [])

  const shareUrl = `${shareBaseUrl}/group-order/${code}`
  const viewerParticipantKey = storedParticipant?.participantKey || null
  const canEditGroup = groupOrder?.groupOrder.status === "open" && !!groupOrder?.viewer.canEdit

  const ensureParticipantKey = React.useCallback(async () => {
    const stored = getStoredGroupParticipant(code)
    if (stored?.participantKey) {
      return stored.participantKey
    }

    if (groupOrder?.viewer.isHost) {
      const result = await joinGroupOrder(code, groupOrder.viewer.displayName || "صاحب الطلب")
      saveStoredGroupParticipant(code, {
        participantKey: result.participantKey,
        displayName: result.displayName,
      })
      return result.participantKey
    }

    return null
  }, [code, groupOrder])

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!code) return
    if (!displayName.trim()) {
      toast.error("اكتب اسمك علشان نعرف المنتجات دي بتاعة مين")
      return
    }

    setIsJoining(true)
    try {
      const result = await joinGroupOrder(code, displayName, viewerParticipantKey)
      saveStoredGroupParticipant(code, {
        participantKey: result.participantKey,
        displayName: result.displayName,
      })
      setDisplayName(result.displayName)
      toast.success(`أهلاً يا ${result.displayName}، تقدر تضيف طلبك دلوقتي`)
      await loadGroupOrder()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "مقدرتش أدخلك الطلب الجماعي دلوقتي")
    } finally {
      setIsJoining(false)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    setCopying(true)
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success("اتنسخ الرابط، ابعته لأصحابك على طول")
    } catch {
      toast.error("مقدرتش أنسخ الرابط دلوقتي")
    } finally {
      window.setTimeout(() => setCopying(false), 1000)
    }
  }

  const handleAddProducts = () => {
    ensureParticipantKey()
      .then((participantKey) => {
        if (!participantKey) {
          toast.error("اكتب اسمك الأول داخل الطلب الجماعي قبل ما تضيف منتجات")
          return
        }
        router.push(`/category/all?groupOrder=${code}`)
      })
      .catch((error) => {
          toast.error(error instanceof Error ? error.message : "مقدرتش أجهز الإضافة للطلب الجماعي دلوقتي")
      })
  }

  const handleUpdateItem = async (itemId: string, quantity: number) => {
    const participantKey = await ensureParticipantKey()
    if (!participantKey) {
      toast.error("اكتب اسمك الأول داخل الطلب الجماعي قبل التعديل")
      return
    }

    setUpdatingItemId(itemId)
    try {
      await updateGroupOrderItem(code, itemId, participantKey, quantity)
      await loadGroupOrder()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "مقدرتش أعدّل المنتج دلوقتي")
    } finally {
      setUpdatingItemId(null)
    }
  }

  const handleConfirm = () => {
    router.push(`/checkout?groupOrder=${code}`)
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-20 pb-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="rounded-[2rem] border border-surface-hover bg-surface-container-low/70 p-6 md:p-8 shadow-premium">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                  <Users className="h-4 w-4" />
                  طلب جماعي
                </span>
                <div>
                  <h1 className="text-3xl font-black text-foreground">اطلب مع أصدقائك</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-400">
                    اعمل رابط وابعتُه لأصحابك، وكل واحد يضيف طلبه بسهولة، وفي الآخر صاحب الطلب بس هو اللي يأكد الطلب كله.
                  </p>
                </div>
              </div>

              {groupOrder ? (
                <div className="inline-flex items-center rounded-full border border-surface-hover bg-background px-4 py-2 text-sm font-black text-foreground">
                  {groupOrder.groupOrder.status === "open"
                    ? "الطلب لسه مفتوح للإضافة"
                    : groupOrder.groupOrder.status === "confirmed"
                      ? "تم تأكيد الطلب"
                      : "تم إلغاء الطلب"}
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr,0.9fr]">
              <div className="rounded-[1.75rem] border border-surface-hover bg-background/70 p-5">
                <p className="text-sm font-black text-foreground">رابط الطلب</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1 rounded-2xl border border-surface-hover bg-surface px-4 py-3 text-sm font-medium text-gray-300">
                    {shareUrl || "بنجهز الرابط..."}
                  </div>
                  <Button type="button" className="h-12 rounded-2xl px-5 font-black" onClick={handleCopy}>
                    {copying ? (
                      "اتنسخ"
                    ) : (
                      <>
                        <Copy className="ml-2 h-4 w-4" />
                        انسخ الرابط وابعتُه
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-surface-hover bg-background/70 p-5">
                <p className="text-sm font-black text-foreground">المشاركون</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {groupOrder?.participants.length ? (
                    groupOrder.participants.map((participant) => (
                      <span
                        key={participant.id}
                        className="inline-flex items-center rounded-full border border-surface-hover bg-surface px-3 py-1.5 text-xs font-black text-foreground"
                      >
                        {participant.displayName}
                        {participant.isHost ? <span className="mr-2 text-primary">المضيف</span> : null}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">لسه محدش دخل غيرك</span>
                  )}
                </div>
              </div>
            </div>

            {groupOrder?.groupOrder.status === "open" && !groupOrder.viewer.canEdit ? (
              <form onSubmit={handleJoin} className="mt-6 rounded-[1.75rem] border border-surface-hover bg-background/70 p-5">
                <LabelBlock title="اكتب اسمك" helper="الاسم ده هو اللي هيظهر فوق المنتجات اللي هتضيفها">
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <Input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="مثال: أحمد"
                      className="h-12 rounded-2xl bg-surface"
                    />
                    <Button type="submit" className="h-12 rounded-2xl px-5 font-black" disabled={isJoining}>
                      {isJoining ? "بندخلك دلوقتي..." : "ابدأ الإضافة"}
                    </Button>
                  </div>
                </LabelBlock>
              </form>
            ) : null}

            {groupOrder?.groupOrder.status === "confirmed" ? (
              <div className="mt-6 rounded-[1.75rem] border border-primary/20 bg-primary/10 p-5 text-sm font-bold text-primary">
                الطلب ده اتأكد خلاص، ومبقاش متاح يتعدل.
                {groupOrder.groupOrder.finalOrderId ? (
                  <Link href={`/order-success?orderId=${groupOrder.groupOrder.finalOrderId}`} className="mr-2 underline">
                    شوف الطلب النهائي
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="space-y-4">
                {isLoading ? (
                  <div className="rounded-[1.75rem] border border-surface-hover bg-background/70 p-8 text-center text-gray-500">
                    بنحمّل الطلب الجماعي...
                  </div>
                ) : groupOrder && groupOrder.itemGroups.length > 0 ? (
                  groupOrder.itemGroups.map((group) => (
                    <div key={group.participantId} className="rounded-[1.75rem] border border-surface-hover bg-background/70 p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-black text-foreground">{group.displayName}</h2>
                          <p className="text-xs font-bold text-gray-500">
                            {group.isHost ? "صاحب الطلب" : "مشارك"}
                          </p>
                        </div>
                        <div className="rounded-full border border-surface-hover bg-surface px-3 py-1.5 text-xs font-black text-primary">
                          {group.subtotal.toLocaleString()} ج.م
                        </div>
                      </div>

                      <div className="space-y-3">
                        {group.items.map((item) => {
                          const isOwnGroup = group.participantId === groupOrder.viewer.participantId || groupOrder.viewer.isHost

                          return (
                            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-surface-hover bg-surface px-3 py-3">
                              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-surface-hover">
                                {item.product?.image_url ? (
                                  <Image src={item.product.image_url} alt={item.product.name} fill className="object-cover" />
                                ) : null}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 font-bold text-foreground">{item.product?.name || "منتج"}</p>
                                <p className="mt-1 text-xs text-gray-500">
                                  {item.unitPrice.toLocaleString()} ج.م للوحدة
                                </p>
                                {getSelectedVariantLabel(item.selectedVariantJson) ? (
                                  <p className="mt-1 text-[11px] font-bold text-gray-400">
                                    {getSelectedVariantLabel(item.selectedVariantJson)}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                {groupOrder.groupOrder.status === "open" && isOwnGroup ? (
                                  <div className="flex items-center rounded-2xl border border-surface-hover bg-background px-1 py-1">
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 hover:bg-surface hover:text-primary"
                                      onClick={() => handleUpdateItem(item.id, item.quantity + 1)}
                                      disabled={updatingItemId === item.id}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </button>
                                    <span className="w-8 text-center text-sm font-black text-foreground">{item.quantity}</span>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 hover:bg-surface hover:text-rose-500"
                                      onClick={() => handleUpdateItem(item.id, item.quantity - 1)}
                                      disabled={updatingItemId === item.id}
                                    >
                                      <Minus className="h-4 w-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="rounded-full bg-surface px-3 py-1 text-xs font-black text-gray-300">
                                    × {item.quantity}
                                  </span>
                                )}
                                <span className="text-sm font-black text-primary">{item.lineTotal.toLocaleString()} ج.م</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.75rem] border border-dashed border-surface-hover bg-background/70 p-8 text-center">
                    <ShoppingCart className="mx-auto h-8 w-8 text-gray-500" />
                    <p className="mt-3 text-base font-black text-foreground">لسه الطلب الجماعي فاضي</p>
                    <p className="mt-2 text-sm text-gray-500">ابعت الرابط لصحابك أو ابدأ أنت وضيف أول منتجات.</p>
                  </div>
                )}
              </div>

              <div className="space-y-4 lg:sticky lg:top-28">
                <div className="rounded-[1.75rem] border border-surface-hover bg-background/70 p-5">
                  <p className="text-sm font-black text-foreground">ملخص الطلب الجماعي</p>
                  <div className="mt-4 space-y-3 text-sm text-gray-400">
                    <div className="flex items-center justify-between">
                      <span>عدد المشاركين</span>
                      <span className="font-black text-foreground">{groupOrder?.participants.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>عدد المنتجات</span>
                      <span className="font-black text-foreground">{groupOrder?.totalItems || 0}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-surface-hover pt-3">
                      <span>الإجمالي الحالي</span>
                      <span className="text-xl font-black text-primary">
                        {(groupOrder?.totalAmount || 0).toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>
                </div>

                {groupOrder?.groupOrder.status === "open" ? (
                  <div className="rounded-[1.75rem] border border-surface-hover bg-background/70 p-5 space-y-3">
                    <Button type="button" className="h-12 w-full rounded-2xl font-black" onClick={handleAddProducts} disabled={!canEditGroup}>
                      <Plus className="ml-2 h-4 w-4" />
                      أضف منتجات
                    </Button>
                    {groupOrder.viewer.isHost ? (
                      <Button type="button" variant="outline" className="h-12 w-full rounded-2xl font-black" onClick={handleConfirm}>
                        تأكيد الطلب الجماعي
                        <ArrowLeft className="mr-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="rounded-2xl border border-surface-hover bg-surface px-4 py-3 text-sm font-bold text-gray-400">
                        صاحب الطلب بس هو اللي يقدر يأكد الطلب النهائي.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[1.75rem] border border-primary/20 bg-primary/10 p-5 text-sm font-bold text-primary">
                    <Lock className="mb-3 h-5 w-5" />
                    الطلب الجماعي اتقفل بعد التأكيد.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

function LabelBlock({
  title,
  helper,
  children,
}: {
  title: string
  helper: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-sm font-black text-foreground">{title}</p>
      <p className="mt-1 text-xs text-gray-500">{helper}</p>
      {children}
    </div>
  )
}
