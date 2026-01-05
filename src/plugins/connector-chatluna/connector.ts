// ChatLuna 连接器

import { Context } from 'koishi'
import type { ConnectorDefinition, OutputAsset, FileData, ConnectorRequestLog } from '../../core/types'
import { connectorFields, connectorCardFields } from './config'
import { HumanMessage } from '@langchain/core/messages'

/** ChatLuna 生成函数 */
async function generate(
  ctx: Context,
  config: Record<string, any>,
  files: FileData[],
  prompt: string
): Promise<OutputAsset[]> {
  const { model } = config
  const logger = ctx.logger('media-luna-chatluna')

  // 使用 any 绕过类型检查，因为 chatluna 的类型在其自己的包中声明
  const chatluna = (ctx as any).chatluna

  // 检查 chatluna 服务
  if (!chatluna) {
    throw new Error('ChatLuna service not available')
  }

  // 检查模型是否存在
  const modelRef = chatluna.platform.findModel(model)
  if (!modelRef.value) {
    throw new Error(`模型不存在或未配置: ${model}`)
  }

  logger.info(`[ChatLuna] 使用模型: ${model}`)
  logger.info(`[ChatLuna] 图片数量: ${files.length}`)

  // 构建消息内容
  const messageContent: any[] = []

  // 添加文字
  if (prompt) {
    messageContent.push({
      type: 'text',
      text: prompt
    })
  }

  // 添加图片
  for (const file of files) {
    const base64 = Buffer.from(file.data).toString('base64')
    messageContent.push({
      type: 'image_url',
      image_url: {
        url: `data:${file.mime};base64,${base64}`
      }
    })
  }

  // 创建 HumanMessage
  const humanMessage = new HumanMessage({
    content: messageContent
  })

  // 创建模型
  const llmRef = await chatluna.createChatModel(model)
  if (!llmRef.value) {
    throw new Error(`无法创建模型: ${model}`)
  }

  const llm = llmRef.value

  // 调用模型
  logger.info(`[ChatLuna] 开始调用模型...`)
  const result = await llm.invoke([humanMessage])

  logger.info(`[ChatLuna] 返回内容类型: ${typeof result.content}`)

  // 渲染结果
  const mdRenderer = await chatluna.renderer.getRenderer('text')
  const rendered = await mdRenderer.render({ content: result.content }, { type: 'text' })

  // 提取图片 URL
  const elementStr = String(rendered.element)
  const imageUrls: string[] = []

  // 提取 <img src="..."/> 格式
  const imgSrcMatches = elementStr.match(/<img[^>]+src=["']([^"']+)["']/gi)
  if (imgSrcMatches) {
    for (const match of imgSrcMatches) {
      const urlMatch = match.match(/src=["']([^"']+)["']/)
      if (urlMatch?.[1]) {
        imageUrls.push(urlMatch[1])
      }
    }
  }

  // 提取 <image url="..."/> 格式 (Koishi 消息元素)
  const imageUrlMatches = elementStr.match(/<image[^>]+url=["']([^"']+)["']/gi)
  if (imageUrlMatches) {
    for (const match of imageUrlMatches) {
      const urlMatch = match.match(/url=["']([^"']+)["']/)
      if (urlMatch?.[1]) {
        imageUrls.push(urlMatch[1])
      }
    }
  }

  // 提取 markdown 图片格式 ![...](url)
  const mdImageMatches = elementStr.match(/!\[[^\]]*\]\(([^)]+)\)/g)
  if (mdImageMatches) {
    for (const match of mdImageMatches) {
      const urlMatch = match.match(/!\[[^\]]*\]\(([^)]+)\)/)
      if (urlMatch?.[1]) {
        imageUrls.push(urlMatch[1])
      }
    }
  }

  // 提取独立的图片 URL（http/https 开头，常见图片扩展名结尾）
  const urlMatches = elementStr.match(/https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|gif|webp|bmp)(?:\?[^\s"'<>]*)?/gi)
  if (urlMatches) {
    for (const url of urlMatches) {
      if (!imageUrls.includes(url)) {
        imageUrls.push(url)
      }
    }
  }

  if (imageUrls.length > 0) {
    logger.info(`[ChatLuna] 提取到 ${imageUrls.length} 个图片`)
    return imageUrls.map(url => ({
      kind: 'image' as const,
      url,
      mime: 'image/png'
    }))
  }

  // 如果没有图片，抛出错误
  logger.warn(`[ChatLuna] 未找到图片，返回内容: ${elementStr.slice(0, 200)}...`)
  throw new Error(`模型未返回图片，返回内容: ${elementStr.slice(0, 100)}${elementStr.length > 100 ? '...' : ''}`)
}

/** ChatLuna 连接器定义 */
export const ChatLunaConnector: ConnectorDefinition = {
  id: 'chatluna',
  name: 'ChatLuna',
  description: '集成 ChatLuna 插件，复用已配置的模型和平台',
  icon: 'chatluna',
  supportedTypes: ['image'],
  fields: connectorFields,
  cardFields: connectorCardFields,
  defaultTags: ['text2img', 'img2img', 'text2video', 'img2video', 'text2audio'],
  generate,

  /** 获取请求日志 */
  getRequestLog(config: Record<string, any>, files: FileData[], prompt: string): ConnectorRequestLog {
    return {
      model: config.model,
      prompt,
      fileCount: files.length
    }
  }
}
