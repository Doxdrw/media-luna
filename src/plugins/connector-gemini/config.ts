// Gemini 连接器配置

import type { ConnectorField, CardDisplayField } from '../../core'

/** Gemini 配置字段 */
export const connectorFields: ConnectorField[] = [
  {
    key: 'apiUrl',
    label: 'API URL',
    type: 'text',
    required: true,
    default: 'https://generativelanguage.googleapis.com',
    placeholder: 'https://generativelanguage.googleapis.com',
    description: 'API 基础地址，用于反向代理或自定义端点'
  },
  {
    key: 'apiKey',
    label: 'API Key',
    type: 'password',
    required: true,
    description: 'Google AI Studio API Key'
  },
  {
    key: 'model',
    label: '模型',
    type: 'text',
    required: true,
    default: 'gemini-3-pro-image-preview',
    placeholder: 'gemini-3-pro-image-preview',
    description: '模型名称，如 gemini-3-pro-image-preview'
  },
  {
    key: 'numberOfImages',
    label: '生成数量',
    type: 'number',
    description: '生成图片的数量'
  },
  {
    key: 'aspectRatio',
    label: '宽高比',
    type: 'text',
    description: '支持：1:1, 3:4, 4:3, 9:16, 16:9'
  },
  {
    key: 'imageSize',
    label: '图片尺寸',
    type: 'select',
    options: [
      { label: '1024x1024 (1K)', value: '1K' },
      { label: '2048x2048 (2K)', value: '2K' },
      { label: '4096x4096 (4K)', value: '4K' }
    ],
    description: '生成图像的分辨率'
  },
  {
    key: 'enableGoogleSearch',
    label: '启用谷歌搜索',
    type: 'boolean',
    default: false,
    description: '启用后模型可使用 Google 搜索获取实时信息'
  },
  {
    key: 'thinkingLevel',
    label: '思考程度',
    type: 'select',
    options: [
      { label: '不设置', value: '' },
      { label: '高 (high)', value: 'high' },
      { label: '中 (medium) - 仅 Flash', value: 'medium' },
      { label: '低 (low)', value: 'low' },
      { label: '最小 (minimal) - 仅 Flash', value: 'minimal' }
    ],
    description: '控制模型思考的深度，medium 和 minimal 仅支持 Flash 模型'
  },
  {
    key: 'filterThoughtImages',
    label: '过滤思考图片',
    type: 'boolean',
    default: true,
    description: '高分辨率请求时，API 会返回思考过程的临时图片，启用后自动过滤这些图片，只保留最终结果'
  },
  {
    key: 'timeout',
    label: '超时时间（秒）',
    type: 'number',
    default: 600
  }
]

/** 卡片展示字段 */
export const connectorCardFields: CardDisplayField[] = [
  { source: 'connectorConfig', key: 'model', label: '模型' },
  { source: 'connectorConfig', key: 'aspectRatio', label: '比例' }
]
