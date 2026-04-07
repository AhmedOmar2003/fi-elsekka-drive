"use client"

type RequestAttachmentsGalleryProps = {
  imageUrls: string[]
  title?: string
  hint?: string
  compact?: boolean
}

export function RequestAttachmentsGallery({
  imageUrls,
  title = "الصور المرفقة",
  hint,
  compact = false,
}: RequestAttachmentsGalleryProps) {
  if (!imageUrls.length) return null

  return (
    <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4">
      <p className="text-xs font-black text-sky-500">{title}</p>
      {hint ? <p className="mt-1 text-[11px] leading-6 text-gray-500">{hint}</p> : null}

      <div className={`mt-3 grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
        {imageUrls.map((imageUrl, index) => (
          <a
            key={`${imageUrl}-${index}`}
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-2xl border border-surface-hover bg-background"
          >
            <img
              src={imageUrl}
              alt={`مرفق الطلب ${index + 1}`}
              className={`w-full object-cover transition-transform duration-200 group-hover:scale-[1.03] ${compact ? "h-24" : "h-32"}`}
            />
          </a>
        ))}
      </div>
    </div>
  )
}
