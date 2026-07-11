import type { FileData, MiddlewareContext, MiddlewareDefinition, MiddlewareRunStatus } from '../../core/types'
import { defaultFlowAspectEnhancerConfig, type FlowAspectEnhancerConfig } from './config'

const SUPPORTED_RATIOS = [
  { label: '1:1', width: 1, height: 1 },
  { label: '3:4', width: 3, height: 4 },
  { label: '4:3', width: 4, height: 3 },
  { label: '9:16', width: 9, height: 16 },
  { label: '16:9', width: 16, height: 9 }
]

const RATIO_REGEX = /(1\s*[:：]\s*1|3\s*[:：]\s*4|4\s*[:：]\s*3|9\s*[:：]\s*16|16\s*[:：]\s*9)/

interface RatioDetection {
  aspectRatio: string
  source: 'prompt' | 'first-image'
  token?: string
  width?: number
  height?: number
}

function normalizeConfig(config: FlowAspectEnhancerConfig): FlowAspectEnhancerConfig {
  const matchChannelTags = typeof config.matchChannelTags === 'string'
    ? config.matchChannelTags
    : defaultFlowAspectEnhancerConfig.matchChannelTags

  return {
    ...defaultFlowAspectEnhancerConfig,
    ...config,
    matchChannelTags,
    overrideExistingAspectRatio: config.overrideExistingAspectRatio !== false
  }
}

function isChannelMatched(mctx: MiddlewareContext, config: FlowAspectEnhancerConfig): boolean {
  const matchTags = config.matchChannelTags
    ? config.matchChannelTags.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean)
    : []

  if (matchTags.length === 0) return true

  const channelTags = (mctx.channel?.tags || []).map(tag => String(tag).trim().toLowerCase())
  return matchTags.some(tag => channelTags.includes(tag))
}

export function createFlowAspectEnhancerMiddleware(): MiddlewareDefinition {
  return {
    name: 'flow-aspect-enhancer',
    displayName: 'Flow 比例增强',
    description: '读取首张输入图比例并写回 Flow/Gemini 逆向接口使用的 aspectRatio 参数',
    category: 'transform',
    phase: 'lifecycle-pre-request',
    after: ['preset'],
    before: ['prompt-censor-bypass', 'request'],
    configGroup: 'flow-aspect-enhancer',

    async execute(mctx: MiddlewareContext, next): Promise<MiddlewareRunStatus> {
      const mwConfig = await mctx.getMiddlewareConfig<FlowAspectEnhancerConfig>('flow-aspect-enhancer')
      const config = normalizeConfig({
        ...defaultFlowAspectEnhancerConfig,
        ...(mwConfig || {})
      })

      if (!isChannelMatched(mctx, config)) {
        mctx.setMiddlewareLog('flow-aspect-enhancer', { skipped: true, reason: 'channel tags not matched' })
        return next()
      }

      if (!config.overrideExistingAspectRatio && mctx.parameters.aspectRatio) {
        mctx.setMiddlewareLog('flow-aspect-enhancer', { skipped: true, reason: 'aspectRatio already exists' })
        return next()
      }

      const detection = parseAspectRatioFromPrompt(mctx.prompt || '') || detectAspectRatioFromFirstImage(mctx.files || [])
      if (!detection) {
        mctx.setMiddlewareLog('flow-aspect-enhancer', { skipped: true, reason: 'aspect ratio not detected' })
        return next()
      }

      mctx.parameters = {
        ...mctx.parameters,
        aspectRatio: detection.aspectRatio
      }

      if (mctx.channel) {
        mctx.channel.connectorConfig = {
          ...mctx.channel.connectorConfig,
          aspectRatio: detection.aspectRatio
        }
      }

      mctx.setMiddlewareLog('flow-aspect-enhancer', {
        aspectRatio: detection.aspectRatio,
        source: detection.source,
        token: detection.token,
        width: detection.width,
        height: detection.height
      })

      return next()
    }
  }
}

function parseAspectRatioFromPrompt(prompt: string): RatioDetection | null {
  const match = prompt.match(RATIO_REGEX)
  const token = match?.[1]
  if (!token) return null

  return {
    aspectRatio: token.replace(/\s+/g, '').replace('：', ':'),
    source: 'prompt',
    token
  }
}

function pickClosestAspectRatio(width: number, height: number): string | null {
  const target = width / height
  let best: { label: string; diff: number } | null = null

  for (const ratio of SUPPORTED_RATIOS) {
    const current = ratio.width / ratio.height
    const diff = Math.abs(current - target)
    if (!best || diff < best.diff) {
      best = { label: ratio.label, diff }
    }
  }

  return best?.label || null
}

function detectAspectRatioFromFirstImage(files: FileData[]): RatioDetection | null {
  const firstImage = files.find((file) => file.mime?.startsWith('image/'))
  if (!firstImage) return null

  const dimensions = readImageDimensions(firstImage)
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) return null

  const aspectRatio = pickClosestAspectRatio(dimensions.width, dimensions.height)
  if (!aspectRatio) return null

  return {
    aspectRatio,
    source: 'first-image',
    width: dimensions.width,
    height: dimensions.height
  }
}

function readImageDimensions(file: FileData): { width: number; height: number } | null {
  if (!file.mime?.startsWith('image/')) return null

  const bytes = new Uint8Array(file.data)
  return readPngDimensions(bytes) || readJpegDimensions(bytes) || readWebpDimensions(bytes)
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return null
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false)
  }
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null

  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    const marker = bytes[offset + 1]
    offset += 2

    if (marker === 0xd8 || marker === 0xd9) continue
    if (offset + 2 > bytes.length) return null

    const length = (bytes[offset] << 8) + bytes[offset + 1]
    if (length < 2 || offset + length > bytes.length) return null

    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof && length >= 7) {
      return {
        height: (bytes[offset + 3] << 8) + bytes[offset + 4],
        width: (bytes[offset + 5] << 8) + bytes[offset + 6]
      }
    }

    offset += length
  }

  return null
}

function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null
  const riff = String.fromCharCode(...bytes.slice(0, 4))
  const webp = String.fromCharCode(...bytes.slice(8, 12))
  if (riff !== 'RIFF' || webp !== 'WEBP') return null

  const chunk = String.fromCharCode(...bytes.slice(12, 16))
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  if (chunk === 'VP8X' && bytes.length >= 30) {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
    }
  }

  if (chunk === 'VP8 ' && bytes.length >= 30) {
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff
    }
  }

  if (chunk === 'VP8L' && bytes.length >= 25) {
    const b0 = bytes[21]
    const b1 = bytes[22]
    const b2 = bytes[23]
    const b3 = bytes[24]
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
    }
  }

  return null
}
