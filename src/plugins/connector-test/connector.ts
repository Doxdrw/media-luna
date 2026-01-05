// 测试连接器 - 将输入的文字和图片渲染成一张图片输出

import { Context } from 'koishi'
import type { ConnectorDefinition, OutputAsset, FileData, ConnectorRequestLog } from '../../core/types'
import { connectorFields, connectorCardFields } from './config'

/**
 * 转义 XML 特殊字符
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * 将文本按指定宽度换行
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = []
  let currentLine = ''

  for (const char of text) {
    if (char === '\n') {
      lines.push(currentLine)
      currentLine = ''
    } else {
      currentLine += char
      if (currentLine.length >= maxCharsPerLine) {
        lines.push(currentLine)
        currentLine = ''
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

/**
 * 生成 SVG 测试图片
 */
function generateSvg(
  prompt: string,
  files: FileData[],
  config: {
    width: number
    height: number
    backgroundColor: string
    textColor: string
    fontSize: number
  }
): string {
  const { width, height, backgroundColor, textColor, fontSize } = config
  const timestamp = new Date().toISOString()

  // 计算每行大约能容纳的字符数（中文字符）
  const charsPerLine = Math.floor((width - 40) / (fontSize * 0.6))

  // 处理提示词文本换行
  const promptLines = prompt
    ? wrapText(prompt, charsPerLine).slice(0, 10) // 最多显示10行
    : ['(无提示词)']

  // 构建提示词 tspan 元素
  const promptTspans = promptLines.map((line, i) =>
    `<tspan x="20" dy="${i === 0 ? 0 : fontSize}">${escapeXml(line)}</tspan>`
  ).join('\n      ')

  // 如果有图片，显示图片信息
  const imageInfoY = 90
  const promptStartY = files.length > 0 ? 130 : 90

  // 构建图片信息区域
  let imageInfoSection = ''
  if (files.length > 0) {
    const fileInfos = files.slice(0, 4).map((f) => {
      const size = f.data ? (f.data.byteLength / 1024).toFixed(1) + 'KB' : '?'
      return `${f.mime || 'unknown'} (${size})`
    }).join(', ')

    const moreText = files.length > 4 ? ` +${files.length - 4} more` : ''

    imageInfoSection = `
  <text x="20" y="${imageInfoY}" fill="${textColor}" font-size="${fontSize * 0.7}" font-family="sans-serif">
    输入图片: ${files.length} 张
  </text>
  <text x="20" y="${imageInfoY + fontSize * 0.8}" fill="${textColor}" fill-opacity="0.7" font-size="${fontSize * 0.5}" font-family="sans-serif">
    ${escapeXml(fileInfos)}${moreText}
  </text>`
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${backgroundColor}"/>
  <text x="20" y="40" fill="${textColor}" font-size="${fontSize}" font-weight="bold" font-family="sans-serif">
    Media Luna 测试
  </text>
  <line x1="20" y1="55" x2="${width - 20}" y2="55" stroke="${textColor}" stroke-opacity="0.3"/>
  ${imageInfoSection}
  <text x="20" y="${promptStartY}" fill="${textColor}" font-size="${fontSize * 0.7}" font-family="sans-serif">
    提示词:
  </text>
  <text x="20" y="${promptStartY + fontSize}" fill="${textColor}" font-size="${fontSize * 0.8}" font-family="sans-serif">
    ${promptTspans}
  </text>
  <text x="20" y="${height - 15}" fill="${textColor}" fill-opacity="0.5" font-size="${fontSize * 0.5}" font-family="sans-serif">
    ${timestamp}
  </text>
</svg>`

  return svg
}

/** 测试连接器生成函数 */
async function generate(
  ctx: Context,
  config: Record<string, any>,
  files: FileData[],
  prompt: string
): Promise<OutputAsset[]> {
  // 从 config 获取配置（默认值由前端字段定义提供，保存时已填充）
  // 使用 || 作为兼容旧数据的后备
  const width = config.width || 512
  const height = config.height || 512
  const backgroundColor = config.backgroundColor || '#1a1a2e'
  const textColor = config.textColor || '#ffffff'
  const fontSize = config.fontSize || 24
  const delay = config.delay ?? 1000  // delay 可以是 0

  const logger = ctx.logger('media-luna')
  logger.info(`[test] Generating test image: ${width}x${height}, prompt="${prompt.slice(0, 50)}...", files=${files.length}`)

  // 模拟延迟
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  // 生成 SVG 图片
  const svg = generateSvg(prompt, files, {
    width,
    height,
    backgroundColor,
    textColor,
    fontSize
  })

  const base64 = Buffer.from(svg).toString('base64')
  const dataUrl = `data:image/svg+xml;base64,${base64}`

  return [{
    kind: 'image',
    url: dataUrl,
    mime: 'image/svg+xml',
    meta: {
      width,
      height,
      isTest: true
    }
  }]
}

/** 测试连接器定义 */
export const TestConnector: ConnectorDefinition = {
  id: 'test',
  name: '测试连接器',
  description: '内置测试连接器，将输入的文字和图片渲染成一张图片输出，无需配置外部 API',
  icon: 'default-image',
  supportedTypes: ['image'],
  fields: connectorFields,
  cardFields: connectorCardFields,
  defaultTags: ['text2img', 'img2img'],
  generate,

  /** 获取请求日志 */
  getRequestLog(config: Record<string, any>, files: FileData[], prompt: string): ConnectorRequestLog {
    return {
      endpoint: 'local://test',
      model: 'test-generator',
      prompt,
      fileCount: files.length,
      parameters: {
        width: config.width || 512,
        height: config.height || 512
      }
    }
  }
}
