const DEFAULT_MAX_DIMENSION = 1600
const DEFAULT_WEBP_QUALITY = 0.84

function shouldKeepOriginalImage(file: File) {
  const mime = (file.type || "").toLowerCase()
  return mime === "image/svg+xml" || mime === "image/gif" || mime === "image/webp"
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(reader.error || new Error("تعذر قراءة الصورة"))
    reader.readAsDataURL(file)
  })
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("تعذر تجهيز الصورة"))
    img.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("تعذر تحويل الصورة إلى WebP"))
          return
        }
        resolve(blob)
      },
      "image/webp",
      quality
    )
  })
}

export async function optimizeImageForUpload(
  file: File,
  options?: { maxDimension?: number; quality?: number }
) {
  if (typeof window === "undefined" || !file.type.startsWith("image/") || shouldKeepOriginalImage(file)) {
    return file
  }

  const maxDimension = options?.maxDimension || DEFAULT_MAX_DIMENSION
  const quality = options?.quality || DEFAULT_WEBP_QUALITY
  const src = await readFileAsDataUrl(file)
  const image = await loadImageElement(src)

  const longestSide = Math.max(image.width, image.height)
  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1
  const targetWidth = Math.max(1, Math.round(image.width * scale))
  const targetHeight = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = targetWidth
  canvas.height = targetHeight

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("تعذر تجهيز الصورة قبل الرفع")
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight)
  const blob = await canvasToBlob(canvas, quality)
  const fileName = file.name.replace(/\.[^.]+$/, "") || `image-${Date.now()}`

  return new File([blob], `${fileName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  })
}
