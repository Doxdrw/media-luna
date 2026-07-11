import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'

function toDataUrl(file: FileData): string {
  const base64 = Buffer.from(file.data).toString('base64')
  return `data:${file.mime};base64,${base64}`
}

function getInputImageUrls(parameters?: Record<string, any>): string[] {
  const urls = parameters?.inputFileUrls
  if (!Array.isArray(urls)) return []
  return urls.filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url))
}

function getInputImages(files: FileData[], mode: unknown, parameters?: Record<string, any>): string[] {
  if (mode === 'url') return getInputImageUrls(parameters)
  return files.filter(file => file.mime?.startsWith('image/')).map(toDataUrl)
}

function normalizeSize(value: unknown): string | undefined {
  if (!value) return undefined
  const size = String(value).trim()
  if (!size) return undefined
  const levelMatch = /^([1-4])k$/i.exec(size)
  if (levelMatch) return `${levelMatch[1]}K`
  return size.replace(/\s+/g, '')
}

async function generate(
  ctx: Context,
  config: Record<string, any>,
  files: FileData[],
  prompt: string,
  parameters?: Record<string, any>
): Promise<OutputAsset[]> {
  const {
    apiUrl,
    apiKey,
    model,
    size,
    seed,
    sequentialImageGeneration,
    maxImages,
    guidanceScale,
    outputFormat,
    responseFormat = 'url',
    watermark,
    optimizePromptMode,
    enableImageInput = true,
    imageInputMode = 'base64',
    timeout = 600
  } = config

  if (!apiUrl) throw new Error('API URL 未配置')
  if (!apiKey) throw new Error('API Key 未配置')
  if (!model) throw new Error('模型名称未配置')

  const requestBody: Record<string, any> = {
    model,
    prompt,
    response_format: responseFormat
  }

  const normalizedSize = normalizeSize(size)
  if (normalizedSize) requestBody.size = normalizedSize
  if (seed !== undefined && seed !== null && seed !== '') requestBody.seed = Number(seed)
  if (guidanceScale !== undefined && guidanceScale !== null && guidanceScale !== '') requestBody.guidance_scale = Number(guidanceScale)
  if (watermark !== undefined) requestBody.watermark = !!watermark
  if (outputFormat) requestBody.output_format = outputFormat

  if (optimizePromptMode) {
    requestBody.optimize_prompt_options = { mode: optimizePromptMode }
  }

  if (sequentialImageGeneration && sequentialImageGeneration !== 'disabled') {
    requestBody.sequential_image_generation = sequentialImageGeneration
    if (maxImages !== undefined && maxImages !== null && maxImages !== '') {
      requestBody.sequential_image_generation_options = {
        max_images: Number(maxImages)
      }
    }
  }

  if (enableImageInput) {
    const inputImages = getInputImages(files, imageInputMode, parameters).slice(0, 14)
    if (inputImages.length === 1) {
      requestBody.image = inputImages[0]
    } else if (inputImages.length > 1) {
      requestBody.image = inputImages
    }
  }

  ctx.logger('media-luna').debug('[BytePlus] Request body: %o', requestBody)

  const response = await ctx.http.post(apiUrl, requestBody, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: timeout * 1000
  })

  ctx.logger('media-luna').debug('[BytePlus] Response: %o', response)

  if (response?.error) {
    throw new Error(response.error.message || response.error.code || 'BytePlus image generation failed')
  }

  const dataArray = Array.isArray(response?.data) ? response.data : []
  if (dataArray.length === 0) {
    throw new Error('Invalid response from BytePlus API: no data')
  }

  return dataArray
    .map((item: any) => {
      if (item?.error) return null
      const url = item?.url || (item?.b64_json ? `data:image/${item.output_format || outputFormat || 'jpeg'};base64,${item.b64_json}` : undefined)
      if (!url) return null
      return {
        kind: 'image' as const,
        url,
        mime: item?.output_format === 'png' || outputFormat === 'png' ? 'image/png' : 'image/jpeg',
        meta: {
          source: 'byteplus',
          model: response?.model || model,
          size: item?.size,
          outputFormat: item?.output_format || outputFormat,
          usage: response?.usage
        }
      }
    })
    .filter(Boolean) as OutputAsset[]
}

export const BytePlusImageConnector: ConnectorDefinition = {
  id: 'byteplus-image',
  name: 'BytePlus Seedream',
  description: 'BytePlus ModelArk 国际站图像生成连接器，支持 Seedream 系列模型',
  icon: 'volcengine',
  supportedTypes: ['image'],
  fields: connectorFields,
  cardFields: connectorCardFields,
  defaultTags: ['text2img', 'img2img'],
  generate,

  getRequestLog(config, files, prompt, parameters): ConnectorRequestLog {
    const {
      apiUrl,
      model,
      size,
      seed,
      sequentialImageGeneration,
      maxImages,
      guidanceScale,
      outputFormat,
      responseFormat,
      watermark,
      optimizePromptMode,
      enableImageInput = true,
      imageInputMode = 'base64'
    } = config

    const imageCount = enableImageInput ? getInputImages(files, imageInputMode, parameters).length : 0

    return {
      endpoint: apiUrl?.split('?')[0],
      model,
      prompt,
      fileCount: imageCount,
      parameters: {
        size: normalizeSize(size),
        seed: seed !== undefined && seed !== null && seed !== '' ? Number(seed) : undefined,
        sequential_image_generation: sequentialImageGeneration && sequentialImageGeneration !== 'disabled' ? sequentialImageGeneration : undefined,
        max_images: maxImages !== undefined && maxImages !== null && maxImages !== '' ? Number(maxImages) : undefined,
        guidance_scale: guidanceScale !== undefined && guidanceScale !== null && guidanceScale !== '' ? Number(guidanceScale) : undefined,
        output_format: outputFormat || undefined,
        response_format: responseFormat || undefined,
        watermark: watermark !== undefined ? !!watermark : undefined,
        optimize_prompt_mode: optimizePromptMode || undefined,
        imageInputMode,
        imageInput: imageCount > 0 ? true : undefined
      }
    }
  }
}
