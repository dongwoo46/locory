import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const equalIndex = trimmed.indexOf('=')
    if (equalIndex < 1) continue
    const key = trimmed.slice(0, equalIndex).trim()
    if (!key || process.env[key] != null) continue
    let value = trimmed.slice(equalIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
loadEnvFile(path.join(appRoot, '.env'))
loadEnvFile(path.join(appRoot, '.env.local'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BATCH_SIZE = Number(process.env.BACKFILL_LIMIT ?? 100)
const START_AT = Number(process.env.BACKFILL_START ?? 0)
const FORCE = process.env.BACKFILL_FORCE === '1'
const DELETE_SOURCE = process.env.BACKFILL_DELETE_SOURCE !== '0'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
let sharpInstance = null

async function getSharp() {
  if (sharpInstance) return sharpInstance
  try {
    const sharpModule = await import('sharp')
    sharpInstance = sharpModule.default
    return sharpInstance
  } catch {
    throw new Error('sharp is required. Run: npm i sharp')
  }
}

function parseObjectPathFromPublicUrl(url) {
  try {
    const parsed = new URL(url)
    const marker = '/storage/v1/object/public/posts/'
    const markerRender = '/storage/v1/render/image/public/posts/'
    let path = ''
    if (parsed.pathname.includes(marker)) {
      path = parsed.pathname.split(marker)[1] ?? ''
    } else if (parsed.pathname.includes(markerRender)) {
      path = parsed.pathname.split(markerRender)[1] ?? ''
    }
    return decodeURIComponent(path)
  } catch {
    return ''
  }
}

function buildRenderUrl(objectPath, width, quality) {
  const safePath = objectPath.split('/').map((part) => encodeURIComponent(part)).join('/')
  return `${SUPABASE_URL}/storage/v1/render/image/public/posts/${safePath}?width=${width}&quality=${quality}&format=webp`
}

function buildVariantPaths(objectPath) {
  const base = objectPath.replace(/\.[^/.]+$/, '')
  return {
    thumbnailPath: `${base}_thumb.webp`,
    mediumPath: `${base}_medium.webp`,
    originalPath: `${base}_original.webp`,
  }
}

function isOptimizedMediumPath(objectPath) {
  return /_medium\.webp$/i.test(objectPath)
}

function buildLegacySourceCandidatesFromMediumPath(mediumPath) {
  if (!isOptimizedMediumPath(mediumPath)) return []
  const base = mediumPath.replace(/_medium\.webp$/i, '')
  const legacyExts = ['jpg', 'jpeg', 'jfif', 'png', 'webp', 'heic', 'avif']
  return legacyExts.map((ext) => `${base}.${ext}`)
}

async function removeLegacySourcesForPost(sourceUrls) {
  const candidates = new Set()
  for (const url of sourceUrls) {
    const objectPath = parseObjectPathFromPublicUrl(url)
    if (!objectPath) continue
    for (const candidate of buildLegacySourceCandidatesFromMediumPath(objectPath)) {
      candidates.add(candidate)
    }
  }
  if (candidates.size === 0) return 0
  const { data, error } = await supabase.storage.from('posts').remove(Array.from(candidates))
  if (error) {
    console.error('[warn] legacy source cleanup failed', error)
    return 0
  }
  return Array.isArray(data) ? data.length : candidates.size
}

async function downloadSourceBuffer(objectPath) {
  const { data: signed, error: signedError } = await supabase.storage
    .from('posts')
    .createSignedUrl(objectPath, 120)
  if (signedError || !signed?.signedUrl) {
    throw new Error(`Failed to create signed url for ${objectPath}`)
  }
  const signedUrl = signed.signedUrl.startsWith('http')
    ? signed.signedUrl
    : `${SUPABASE_URL}${signed.signedUrl}`
  const response = await fetch(signedUrl, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Source fetch failed (${response.status}) for ${objectPath} ${body}`.trim())
  }
  return Buffer.from(await response.arrayBuffer())
}

async function createWebpBuffer(sourceBuffer, width, quality) {
  const sharp = await getSharp()
  return sharp(sourceBuffer)
    .rotate()
    .resize({
      width,
      withoutEnlargement: true,
      fit: 'inside',
    })
    .webp({ quality })
    .toBuffer()
}

async function createWebpCoverBuffer(sourceBuffer, width, height, quality) {
  const sharp = await getSharp()
  return sharp(sourceBuffer)
    .rotate()
    .resize({
      width,
      height,
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: false,
    })
    .webp({ quality })
    .toBuffer()
}

async function uploadVariantBuffer(targetPath, buffer) {
  const { error } = await supabase.storage
    .from('posts')
    .upload(targetPath, buffer, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '31536000',
    })
  if (error) throw error
  return supabase.storage.from('posts').getPublicUrl(targetPath).data.publicUrl
}

async function uploadVariantFromSource(sourceBuffer, targetPath, width, quality) {
  const variantBuffer = await createWebpBuffer(sourceBuffer, width, quality)
  return uploadVariantBuffer(targetPath, variantBuffer)
}

async function uploadVariantFromSourceCover(sourceBuffer, targetPath, width, height, quality) {
  const variantBuffer = await createWebpCoverBuffer(sourceBuffer, width, height, quality)
  return uploadVariantBuffer(targetPath, variantBuffer)
}

async function uploadVariantFromRender(objectPath, targetPath, width, quality) {
  const renderUrl = buildRenderUrl(objectPath, width, quality)
  const response = await fetch(renderUrl, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    if (body.includes('FeatureNotEnabled')) {
      const sourceBuffer = await downloadSourceBuffer(objectPath)
      return uploadVariantFromSource(sourceBuffer, targetPath, width, quality)
    }
    throw new Error(`Render fetch failed (${response.status}) for ${renderUrl} ${body}`.trim())
  }

  const arrayBuffer = await response.arrayBuffer()
  return uploadVariantBuffer(targetPath, Buffer.from(arrayBuffer))
}

async function processPost(post) {
  const sourceUrls = Array.isArray(post.photos) ? post.photos : []
  if (!sourceUrls.length) return { updated: false, reason: 'no-photos' }
  const variants = Array.isArray(post.photo_variants) ? post.photo_variants : []
  const looksLikePlaceholderVariants =
    variants.length === sourceUrls.length &&
    variants.every((variant, index) => {
      const sourceUrl = sourceUrls[index]
      return (
        variant?.thumbnailUrl === sourceUrl &&
        variant?.mediumUrl === sourceUrl &&
        variant?.originalUrl === sourceUrl
      )
    })

  if (!FORCE && variants.length === sourceUrls.length && !looksLikePlaceholderVariants) {
    if (!DELETE_SOURCE) {
      return { updated: false, reason: 'already-variants' }
    }
    const allMediumSource = sourceUrls.every((url) => {
      const objectPath = parseObjectPathFromPublicUrl(url)
      return objectPath ? isOptimizedMediumPath(objectPath) : false
    })
    if (allMediumSource) {
      const deleted = await removeLegacySourcesForPost(sourceUrls)
      return { updated: false, reason: deleted > 0 ? `already-variants-cleaned(${deleted})` : 'already-variants', deleted }
    }
  }

  const mediumPhotoUrls = []
  const photoVariants = []
  const sourcePathsToDelete = []
  const keepPaths = new Set()

  for (let index = 0; index < sourceUrls.length; index++) {
    const sourceUrl = sourceUrls[index]
    const objectPath = parseObjectPathFromPublicUrl(sourceUrl)
    if (!objectPath) throw new Error(`Cannot parse object path from: ${sourceUrl}`)
    sourcePathsToDelete.push(objectPath)

    const { thumbnailPath, mediumPath, originalPath } = buildVariantPaths(objectPath)
    const sourceBuffer = await downloadSourceBuffer(objectPath)

    keepPaths.add(thumbnailPath)
    keepPaths.add(mediumPath)
    keepPaths.add(originalPath)
    const thumbnailUrl = await uploadVariantFromSourceCover(sourceBuffer, thumbnailPath, 720, 960, 78)
    const mediumUrl = await uploadVariantFromRender(objectPath, mediumPath, 1280, 80)
    const originalUrl = await uploadVariantFromRender(objectPath, originalPath, 2048, 88)

    mediumPhotoUrls.push(mediumUrl)
    photoVariants.push({ thumbnailUrl, mediumUrl, originalUrl })
  }

  const { error: updateError } = await supabase
    .from('posts')
    .update({
      photos: mediumPhotoUrls,
      photo_variants: photoVariants,
    })
    .eq('id', post.id)

  if (updateError) throw updateError

  let deletedCount = 0
  if (DELETE_SOURCE) {
    const removablePaths = sourcePathsToDelete.filter((path) => !keepPaths.has(path))
    if (removablePaths.length > 0) {
      const { error: removeError } = await supabase.storage
        .from('posts')
        .remove(removablePaths)
      if (removeError) {
        console.error(`[warn] source remove failed for ${post.id}`, removeError)
      } else {
        deletedCount = removablePaths.length
      }
    }
  }

  return { updated: true, reason: 'ok', deleted: deletedCount }
}

async function main() {
  const end = START_AT + Math.max(1, BATCH_SIZE) - 1
  console.log(`[backfill] range ${START_AT}..${end}, force=${FORCE ? 'yes' : 'no'}, delete_source=${DELETE_SOURCE ? 'yes' : 'no'}`)

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, photos, photo_variants, deleted_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .range(START_AT, end)

  if (error) throw error
  if (!posts?.length) {
    console.log('[backfill] no posts found in range')
    return
  }

  let updated = 0
  let skipped = 0
  for (const post of posts) {
    try {
      const result = await processPost(post)
      if (result.updated) {
        updated += 1
        const deletedLabel = result.deleted > 0 ? ` deleted=${result.deleted}` : ''
        console.log(`[ok] ${post.id}${deletedLabel}`)
      } else {
        skipped += 1
        const deletedLabel = result.deleted > 0 ? ` deleted=${result.deleted}` : ''
        console.log(`[skip] ${post.id} (${result.reason})${deletedLabel}`)
      }
    } catch (postError) {
      console.error(`[fail] ${post.id}`, postError)
    }
  }

  console.log(`[done] updated=${updated}, skipped=${skipped}, total=${posts.length}`)
}

main().catch((error) => {
  console.error('[backfill] fatal', error)
  process.exit(1)
})
