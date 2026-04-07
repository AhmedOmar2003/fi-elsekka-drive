"use client"

import React from "react"
import { CheckCircle2, CircleDot, Search, XCircle } from "lucide-react"

type SearchRequestProgressOrder = {
  status?: string | null
  total_amount?: number | null
  shipping_address?: Record<string, any> | null
}

type SearchRequestProgressProps = {
  order: SearchRequestProgressOrder
  audience?: "customer" | "admin"
}

function getSearchRequestStage(order: SearchRequestProgressOrder) {
  const shipping = order?.shipping_address || {}
  const quoteResponse = shipping.customer_quote_response as "approve" | "reject" | undefined
  const quotedFinalTotal = Number(shipping.quoted_final_total || order?.total_amount || 0)
  const searchStatus = String(shipping.search_status || "")

  if (
    quoteResponse === "reject" ||
    searchStatus === "not_found_for_now" ||
    (order?.status === "cancelled" && shipping.search_closed_reason === "not_available_now")
  ) {
    return "closed" as const
  }

  if (quoteResponse === "approve" || shipping.customer_confirmed_after_quote === true) {
    return "approved" as const
  }

  if (searchStatus === "found_and_priced" || quotedFinalTotal > 0 || shipping.search_pending === false) {
    return "awaiting_response" as const
  }

  return "searching" as const
}

function getStageMeta(stage: ReturnType<typeof getSearchRequestStage>, audience: "customer" | "admin") {
  switch (stage) {
    case "approved":
      return {
        note:
          audience === "customer"
            ? "تمام، إحنا سجلنا موافقتك وهنكمل تجهيز الطلب."
            : "العميل وافق، والطلب جاهز للخطوة اللي بعدها.",
        tone: "border-primary/20 bg-primary/5 text-primary",
      }
    case "awaiting_response":
      return {
        note:
          audience === "customer"
            ? "لقينالك طلبك وبعتنالك السعر. مستنيين قرارك."
            : "لقيناه واتبعت للعميل. مستنيين يرد علينا.",
        tone: "border-sky-500/20 bg-sky-500/5 text-sky-500",
      }
    case "closed":
      return {
        note:
          audience === "customer"
            ? "الطلب اتقفل حاليًا. لو حصل تحديث جديد هنبلغك."
            : "الطلب اتقفل حاليًا أو العميل رفض يكمل.",
        tone: "border-rose-500/20 bg-rose-500/5 text-rose-400",
      }
    default:
      return {
        note:
          audience === "customer"
            ? "إحنا لسه بندور على طلبك ولسه ما نسينكش."
            : "الطلب لسه في مرحلة البحث والتجهيز للتسعير.",
        tone: "border-violet-500/20 bg-violet-500/5 text-violet-400",
      }
  }
}

export function SearchRequestProgress({
  order,
  audience = "customer",
}: SearchRequestProgressProps) {
  const stage = getSearchRequestStage(order)
  const stageIndex = stage === "searching" ? 0 : stage === "awaiting_response" ? 2 : stage === "approved" ? 3 : -1
  const meta = getStageMeta(stage, audience)

  if (stage === "closed") {
    return (
      <div className={`rounded-2xl border p-4 ${meta.tone}`}>
        <p className="mb-3 text-xs font-black uppercase tracking-wider opacity-80">رحلة الطلب</p>
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4" />
          <p className="text-sm font-black">الطلب اتقفل حاليًا</p>
        </div>
        <p className="mt-2 text-xs leading-6 opacity-90">{meta.note}</p>
      </div>
    )
  }

  const steps = [
    { label: "بندور عليه", icon: Search },
    { label: "لقيناه", icon: CheckCircle2 },
    { label: "مستنيين رد العميل", icon: CircleDot },
    { label: "تمت الموافقة", icon: CheckCircle2 },
  ]

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${meta.tone}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider opacity-80">رحلة الطلب</p>
          <p className="mt-1 text-sm font-black">
            {audience === "admin" ? "الطلب ماشي لحد فين دلوقتي؟" : "طلبك وصل لحد فين دلوقتي؟"}
          </p>
        </div>
        <span className="rounded-full border border-current/20 bg-current/10 px-3 py-1 text-[11px] font-black">
          {stage === "searching"
            ? "جاري البحث"
            : stage === "awaiting_response"
              ? "بانتظار الرد"
              : "تمت الموافقة"}
        </span>
      </div>
      <div className="flex items-start justify-between gap-3">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isDone = index < stageIndex
          const isActive = index === stageIndex

          return (
            <React.Fragment key={step.label}>
              <div className="relative flex min-w-0 flex-1 flex-col items-center text-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                    isDone || isActive
                      ? "border-current bg-current/10"
                      : "border-surface-hover bg-background text-gray-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className={`mt-2 text-[11px] font-black leading-5 ${isDone || isActive ? "text-current" : "text-gray-400"}`}>
                  {step.label}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className="mt-4 h-[2px] flex-1 rounded-full bg-surface-hover">
                  <div
                    className={`h-full rounded-full transition-all ${
                      index < stageIndex ? "w-full bg-current" : "w-0 bg-current"
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      <p className="mt-4 text-xs leading-6 opacity-90">{meta.note}</p>
    </div>
  )
}
