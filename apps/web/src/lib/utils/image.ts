export interface OptimizeImageOptions {
  maxWidth: number
  maxHeight: number
  quality?: number
  mimeType?: 'image/webp' | 'image/jpeg'
}

export interface OptimizeImageCoverOptions {
  width: number
  height: number
  quality?: number
  mimeType?: 'image/webp' | 'image/jpeg'
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create image blob'))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality
    )
  })
}

export async function optimizeImageFile(file: File, options: OptimizeImageOptions): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return file
  }

  const mimeType = options.mimeType ?? 'image/webp'
  const quality = options.quality ?? 0.82
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImageElement(objectUrl)
    const { width, height } = image
    if (!width || !height) return file

    const ratio = Math.min(options.maxWidth / width, options.maxHeight / height, 1)
    const targetWidth = Math.max(1, Math.round(width * ratio))
    const targetHeight = Math.max(1, Math.round(height * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext('2d')
    if (!context) return file

    context.drawImage(image, 0, 0, targetWidth, targetHeight)
    const blob = await canvasToBlob(canvas, mimeType, quality)

    if (blob.size >= file.size) {
      return file
    }

    const ext = mimeType === 'image/webp' ? 'webp' : 'jpg'
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    return new File([blob], `${baseName}.${ext}`, { type: mimeType })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function optimizeImageFileCover(
  file: File,
  options: OptimizeImageCoverOptions
): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return file
  }

  const mimeType = options.mimeType ?? 'image/webp'
  const quality = options.quality ?? 0.8
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImageElement(objectUrl)
    const { width, height } = image
    if (!width || !height) return file

    const targetWidth = Math.max(1, Math.round(options.width))
    const targetHeight = Math.max(1, Math.round(options.height))
    const sourceRatio = width / height
    const targetRatio = targetWidth / targetHeight

    let sx = 0
    let sy = 0
    let sw = width
    let sh = height

    if (sourceRatio > targetRatio) {
      sw = Math.round(height * targetRatio)
      sx = Math.round((width - sw) / 2)
    } else if (sourceRatio < targetRatio) {
      sh = Math.round(width / targetRatio)
      sy = Math.round((height - sh) / 2)
    }

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext('2d')
    if (!context) return file

    context.drawImage(image, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)
    const blob = await canvasToBlob(canvas, mimeType, quality)

    const ext = mimeType === 'image/webp' ? 'webp' : 'jpg'
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    return new File([blob], `${baseName}.${ext}`, { type: mimeType })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
