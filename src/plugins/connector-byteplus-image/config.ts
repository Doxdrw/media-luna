import type { ConnectorField, CardDisplayField } from '../../core'

export const connectorFields: ConnectorField[] = [
  {
    key: 'apiUrl',
    label: 'API URL',
    type: 'text',
    required: true,
    default: 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations',
    placeholder: 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations',
    description: 'BytePlus ModelArk 图像生成接口地址，可切换 ap-southeast 或 eu-west 区域'
  },
  {
    key: 'apiKey',
    label: 'API Key',
    type: 'password',
    required: true,
    description: 'BytePlus ModelArk API Key'
  },
  {
    key: 'model',
    label: '模型',
    type: 'text',
    required: true,
    default: 'seedream-4-0',
    placeholder: 'seedream-4-0',
    description: '如 seedream-5-0-pro / seedream-5-0-lite / seedream-4-5 / seedream-4-0 / seedream-3-0-t2i'
  },
  {
    key: 'size',
    label: '图片尺寸',
    type: 'text',
    description: '可填具体尺寸如 2048x2048，或分辨率等级如 1K / 2K / 3K / 4K（取决于模型）'
  },
  {
    key: 'seed',
    label: '种子',
    type: 'number',
    description: '仅部分模型支持，如 seedream-3-0-t2i'
  },
  {
    key: 'sequentialImageGeneration',
    label: '批量关联出图',
    type: 'select',
    default: 'disabled',
    options: [
      { label: '关闭', value: 'disabled' },
      { label: '自动', value: 'auto' }
    ],
    description: '仅 seedream-5-0-lite / 4-5 / 4-0 支持'
  },
  {
    key: 'maxImages',
    label: '最大出图数',
    type: 'number',
    description: '仅在批量关联出图为 auto 时生效，范围 1-15'
  },
  {
    key: 'guidanceScale',
    label: '提示词引导',
    type: 'number',
    description: '仅 seedream-3-0-t2i 支持，范围 1-10'
  },
  {
    key: 'outputFormat',
    label: '输出格式',
    type: 'select',
    default: 'jpeg',
    options: [
      { label: 'JPEG', value: 'jpeg' },
      { label: 'PNG', value: 'png' }
    ],
    description: '仅 seedream-5-0-pro / seedream-5-0-lite 支持自定义'
  },
  {
    key: 'responseFormat',
    label: '响应格式',
    type: 'select',
    default: 'url',
    options: [
      { label: 'URL', value: 'url' },
      { label: 'Base64', value: 'b64_json' }
    ]
  },
  {
    key: 'watermark',
    label: '添加水印',
    type: 'boolean',
    default: true
  },
  {
    key: 'optimizePromptMode',
    label: '提示词优化模式',
    type: 'select',
    options: [
      { label: '标准', value: 'standard' },
      { label: '快速', value: 'fast' }
    ],
    description: '部分模型仅支持 standard'
  },
  {
    key: 'enableImageInput',
    label: '允许图片输入',
    type: 'boolean',
    default: true,
    description: '启用后发送参考图片，支持单图或多图参考'
  },
  {
    key: 'imageInputMode',
    label: '图片输入方式',
    type: 'select',
    default: 'base64',
    options: [
      { label: 'Base64', value: 'base64' },
      { label: 'URL', value: 'url' }
    ],
    description: '默认使用 Base64。选择 URL 时会使用 storage-input 上传后的图片 URL，需保证外网可访问',
    showWhen: { field: 'enableImageInput', value: true }
  },
  {
    key: 'timeout',
    label: '超时时间（秒）',
    type: 'number',
    default: 600
  }
]

export const connectorCardFields: CardDisplayField[] = [
  { source: 'connectorConfig', key: 'model', label: '模型' },
  { source: 'connectorConfig', key: 'size', label: '尺寸' },
  { source: 'connectorConfig', key: 'responseFormat', label: '返回格式' }
]
