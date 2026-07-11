// ModelScope 插件配置字段定义

import type { ConfigField, CardField } from '../../core/types'

// ============ 类型定义 ============

export interface ModelScopeApiKeyEntry {
  key: string
  weight?: number
  enabled?: boolean
  note?: string
}

/** LoRA 别名配置 */
export interface LoraAlias {
  /** 别名（用户在 prompt 中使用的名称，如 "kotone"） */
  alias: string
  /** 真实 LoRA ID（ModelScope repo ID，如 "ziyi2333/Kotone_Fujita"） */
  repoId: string
  /** 激发词（可选，使用该 LoRA 时自动注入到 prompt 最前面） */
  triggerWords?: string
  /** 默认权重（可选，0-1） */
  defaultWeight?: number
  /** 描述/备注（可选） */
  description?: string
}

/** 中间件配置（插件级） */
export interface MiddlewareConfig {
  loraAliases: LoraAlias[]
  normalizeWeights: boolean
  // 尺寸解析配置
  enableSizeParsing: boolean
  landscapeWidth: number
  landscapeHeight: number
  portraitWidth: number
  portraitHeight: number
}

// ============ 连接器配置字段（渠道级，在创建渠道时配置） ============

export const connectorFields: ConfigField[] = [
  {
    key: 'apiUrl',
    label: 'API Base URL',
    type: 'text',
    required: true,
    default: 'https://api-inference.modelscope.cn/',
    description: 'ModelScope API 基础地址'
  },
  {
    key: 'apiKey',
    label: 'API Key',
    type: 'password',
    description: '兼容旧配置的单个 ModelScope Token。若填写了下方多 Key 列表，将优先使用列表'
  },
  {
    key: 'apiKeys',
    label: 'API Key 列表',
    type: 'table',
    default: [],
    description: '支持配置多个 Token。系统会按请求内容做无状态分流，并在单次请求内自动回退下一个可用 Key',
    columns: [
      {
        key: 'key',
        label: 'API Key',
        type: 'text',
        required: true,
        placeholder: 'ms-xxxxxx'
      },
      {
        key: 'weight',
        label: '权重',
        type: 'number',
        placeholder: '默认 1',
        width: '100px'
      },
      {
        key: 'enabled',
        label: '启用',
        type: 'boolean',
        width: '80px'
      },
      {
        key: 'note',
        label: '备注',
        type: 'text',
        placeholder: '可选备注',
        width: '160px'
      }
    ],
    tableConfig: {
      enableImport: true,
      enableExport: true,
      enableBatchDelete: true,
      enableSelection: true
    }
  },
  {
    key: 'model',
    label: '模型 ID',
    type: 'text',
    required: true,
    default: 'MusePublic/Qwen-image',
    description: 'ModelScope 模型 Repo ID'
  },
  {
    key: 'enableImageInput',
    label: '允许图片输入',
    type: 'boolean',
    default: false,
    description: '是否允许发送参考图片（图生图）。启用后会将用户上传的图片作为参考图发送给 API'
  },
  {
    key: 'negativePrompt',
    label: '负面提示词',
    type: 'textarea'
  },
  {
    key: 'width',
    label: '宽度',
    type: 'number',
    placeholder: '留空使用模型默认值',
    description: '分辨率范围: SD系列[64-2048], FLUX[64-1024], Qwen-Image[64-1664]'
  },
  {
    key: 'height',
    label: '高度',
    type: 'number',
    placeholder: '留空使用模型默认值',
    description: '分辨率范围: SD系列[64-2048], FLUX[64-1024], Qwen-Image[64-1664]'
  },
  {
    key: 'numImages',
    label: '生成数量',
    type: 'number',
    default: 1,
    description: '一次生成的图片数量'
  },
  {
    key: 'steps',
    label: '采样步数',
    type: 'number',
    placeholder: '留空使用模型默认值',
    description: '取值范围: 1-100'
  },
  {
    key: 'guidance',
    label: '提示词引导系数',
    type: 'number',
    placeholder: '留空使用模型默认值',
    description: '取值范围: 1.5-20'
  },
  {
    key: 'seed',
    label: '种子',
    type: 'number',
    placeholder: '留空随机'
  },
  {
    key: 'loras',
    label: 'LoRA 配置',
    type: 'textarea',
    description: 'LoRA 配置：单个填 repo-id，多个填 JSON 如 {"repo1":0.6,"repo2":0.4}'
  },
  {
    key: 'timeout',
    label: '超时时间（秒）',
    type: 'number',
    default: 300
  },
  {
    key: 'pollInterval',
    label: '轮询间隔（毫秒）',
    type: 'number',
    default: 5000
  }
]

// ============ 卡片展示字段 ============

export const connectorCardFields: CardField[] = [
  { source: 'connectorConfig', key: 'model', label: '模型' },
  { source: 'connectorConfig', key: 'width', label: '宽度' },
  { source: 'connectorConfig', key: 'height', label: '高度' }
]

// ============ 插件配置字段（ModelScope 中间件全局配置，在插件设置页配置） ============

export const pluginConfigFields: ConfigField[] = [
  {
    key: 'normalizeWeights',
    label: '自动归一化 LoRA 权重',
    type: 'boolean',
    default: true,
    description: '使所有 LoRA 权重之和为 1.0'
  },
  {
    key: 'enableSizeParsing',
    label: '启用尺寸解析',
    type: 'boolean',
    default: true,
    description: '解析提示词中的尺寸（如 1024x768、横屏、竖屏）'
  },
  {
    key: 'landscapeWidth',
    label: '横屏宽度',
    type: 'number',
    default: 1024,
    description: '检测到"横屏"关键词时使用的宽度',
    showWhen: { field: 'enableSizeParsing', value: true }
  },
  {
    key: 'landscapeHeight',
    label: '横屏高度',
    type: 'number',
    default: 768,
    description: '检测到"横屏"关键词时使用的高度',
    showWhen: { field: 'enableSizeParsing', value: true }
  },
  {
    key: 'portraitWidth',
    label: '竖屏宽度',
    type: 'number',
    default: 768,
    description: '检测到"竖屏"关键词时使用的宽度',
    showWhen: { field: 'enableSizeParsing', value: true }
  },
  {
    key: 'portraitHeight',
    label: '竖屏高度',
    type: 'number',
    default: 1024,
    description: '检测到"竖屏"关键词时使用的高度',
    showWhen: { field: 'enableSizeParsing', value: true }
  },
  {
    key: 'loraAliases',
    label: 'LoRA 别名映射表',
    type: 'table',
    default: [],
    description: '配置 LoRA 别名，使用 #别名# 或 #别名:权重# 在提示词中引用',
    columns: [
      {
        key: 'alias',
        label: '别名',
        type: 'text',
        required: true,
        placeholder: '如: kotone',
        width: '100px'
      },
      {
        key: 'repoId',
        label: 'LoRA ID',
        type: 'text',
        required: true,
        placeholder: '如: ziyi2333/Kotone_Fujita'
      },
      {
        key: 'triggerWords',
        label: '激发词',
        type: 'text',
        placeholder: '自动注入到提示词前'
      },
      {
        key: 'description',
        label: '描述',
        type: 'text',
        placeholder: '备注信息',
        width: '150px'
      }
    ],
    tableConfig: {
      enableImport: true,
      enableExport: true,
      enableBatchDelete: true,
      enableSelection: true,
      presetsSource: 'modelscope-lora'
    }
  }
]

// ============ 默认配置 ============

export const defaultMiddlewareConfig: MiddlewareConfig = {
  loraAliases: [],
  normalizeWeights: true,
  enableSizeParsing: true,
  landscapeWidth: 1024,
  landscapeHeight: 768,
  portraitWidth: 768,
  portraitHeight: 1024
}
