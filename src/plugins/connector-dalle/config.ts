// DALL-E 连接器配置

import type { ConnectorField, CardDisplayField } from '../../core'

/** DALL-E 配置字段 */
export const connectorFields: ConnectorField[] = [
  {
    key: 'apiUrl',
    label: 'API URL',
    type: 'text',
    required: true,
    default: 'https://api.openai.com/v1/images/generations',
    placeholder: 'https://api.openai.com/v1/images/generations'
  },
  {
    key: 'apiKey',
    label: 'API Key',
    type: 'password',
    required: true
  },
  {
    key: 'model',
    label: '模型',
    type: 'text',
    required: true,
    default: 'dall-e-3',
    placeholder: 'dall-e-3',
    description: '模型名称，如 dall-e-3、dall-e-2 或其他兼容模型'
  },
  {
    key: 'apiMode',
    label: '接口模式',
    type: 'select',
    default: 'generations',
    options: [
      { label: 'generations (文生图/JSON)', value: 'generations' },
      { label: 'edits (图生图/FormData)', value: 'edits' }
    ],
    description: 'generations 使用 JSON 格式，edits 使用 multipart/form-data 上传图片'
  },
  {
    key: 'size',
    label: '图片尺寸',
    type: 'text',
    description: '常用尺寸：1024x1024、1792x1024、1024x1792、512x512'
  },
  {
    key: 'quality',
    label: '质量',
    type: 'text',
    description: 'standard 或 hd（DALL-E 3 专用）'
  },
  {
    key: 'style',
    label: '风格',
    type: 'text',
    description: 'vivid（生动）或 natural（自然），DALL-E 3 专用'
  },
  {
    key: 'n',
    label: '生成数量',
    type: 'number',
  },
  {
    key: 'enableImageInput',
    label: '允许图片输入',
    type: 'boolean',
    default: true,
    description: '是否允许发送参考图片。启用后会将用户上传的图片作为参考图发送给 API'
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
  { source: 'connectorConfig', key: 'size', label: '尺寸', format: 'size' }
]
