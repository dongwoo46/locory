type PhotoVariant = {
  thumbnailUrl?: string
  mediumUrl?: string
  originalUrl?: string
}

export function getPostImageUrl(
  post: { photos?: string[]; photo_variants?: PhotoVariant[] } | null | undefined,
  index: number,
  kind: 'thumbnail' | 'medium' | 'original'
): string {
  const variants = post?.photo_variants
  const variant = Array.isArray(variants) ? variants[index] : undefined
  if (variant) {
    if (kind === 'thumbnail' && variant.thumbnailUrl) return variant.thumbnailUrl
    if (kind === 'medium' && variant.mediumUrl) return variant.mediumUrl
    if (kind === 'original' && variant.originalUrl) return variant.originalUrl
  }
  return post?.photos?.[index] ?? ''
}
