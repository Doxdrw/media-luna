// Runway 连接器
// 适配 Runway Gen-3 Alpha (第三方/模拟 API)
// 视频生成通常耗时较长，必须异步轮询

import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'

/** Runway 生成函数 */
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
    duration,
    aspectRatio,
    seed,
    timeout = 600
  } = config

  if (!model) {
    throw new Error('模型未配置')
  }

  const baseUrl = apiUrl.replace(/\/$/, '')

  // 1. 发起任务 (POST /image_to_video 或 /text_to_video)
  let endpoint = `${baseUrl}/tasks` // 假设通用任务接口

  const body: any = {
    promptText: prompt,
    model: model,
    parameters: {}
  }

  const requestedDuration = parameters?.duration ?? parameters?.time ?? duration
  const requestedAspectRatio = parameters?.aspectRatio ?? aspectRatio
  const requestedSeed = parameters?.seed ?? seed
  if (requestedDuration) body.parameters.durationSeconds = Number(requestedDuration)
  if (requestedAspectRatio) body.parameters.aspectRatio = requestedAspectRatio
  if (requestedSeed !== undefined && requestedSeed !== null && requestedSeed !== '') {
    body.parameters.seed = Number(requestedSeed)
  }

  // 处理输入图片 (Gen-3 支持 Image-to-Video)
  const imageFile = files.find(f => f.mime.startsWith('image/'))
  if (imageFile) {
    const base64 = Buffer.from(imageFile.data).toString('base64')
    body.promptImage = `data:${imageFile.mime};base64,${base64}`
    // 或者需要先上传图片获得 URL，视具体 API 实现而定
  }

  let taskId: string

  try {
    const res = await ctx.http.post(endpoint, body, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    taskId = res.id || res.taskId
    if (!taskId) throw new Error(`Invalid Runway response: ${JSON.stringify(res)}`)

  } catch (e: any) {
    if (e.response?.data) {
      throw new Error(`Runway API Error: ${JSON.stringify(e.response.data)}`)
    }
    throw e
  }

  // 2. 轮询结果
  const startTime = Date.now()
  const interval = 5000

  while (Date.now() - startTime < timeout * 1000) {
    await new Promise(resolve => setTimeout(resolve, interval))

    try {
      const res = await ctx.http.get(`${baseUrl}/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })

      const status = res.status // PENDING, RUNNING, SUCCEEDED, FAILED

      if (status === 'SUCCEEDED') {
        const url = res.output?.[0] || res.url
        if (!url) throw new Error('Task succeeded but no URL found')

        return [{
          kind: 'video',
          url: url,
          mime: 'video/mp4',
          meta: {
            model,
            duration: requestedDuration,
            aspectRatio: requestedAspectRatio,
            seed: requestedSeed,
            taskId
          }
        }]
      } else if (status === 'FAILED') {
        throw new Error(`Runway Task Failed: ${res.failureReason || 'Unknown error'}`)
      }

    } catch (e) {
      // ignore
    }
  }

  throw new Error('Runway task timeout')
}

/** Runway 连接器定义 */
export const RunwayConnector: ConnectorDefinition = {
  id: 'runway',
  name: 'Runway',
  description: 'Runway Gen-3 视频生成，支持图生视频',
  icon: 'runway',
  supportedTypes: ['video'],
  fields: connectorFields,
  cardFields: connectorCardFields,
  defaultTags: ['text2video', 'img2video'],
  commandParameters: ['duration', 'aspectRatio', 'seed'],
  generate,

  getRequestLog(config, files, prompt, parameters): ConnectorRequestLog {
    const { apiUrl, model } = config
    return {
      endpoint: apiUrl,
      model,
      prompt,
      fileCount: files.length,
      parameters: {
        duration: parameters?.duration ?? parameters?.time ?? config.duration,
        aspectRatio: parameters?.aspectRatio ?? config.aspectRatio,
        seed: parameters?.seed ?? config.seed
      }
    }
  }
}
