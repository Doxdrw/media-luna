import type { ConfigField } from '../../core/types'

export interface FlowAspectEnhancerConfig {
  matchChannelTags: string
  overrideExistingAspectRatio: boolean
}

export const defaultFlowAspectEnhancerConfig: FlowAspectEnhancerConfig = {
  matchChannelTags: 'img2img,flow,gemini-flow',
  overrideExistingAspectRatio: true
}

export const flowAspectEnhancerConfigFields: ConfigField[] = [
  {
    key: 'matchChannelTags',
    label: '匹配渠道标签',
    type: 'text',
    default: 'img2img,flow,gemini-flow',
    description: '仅当渠道包含这些标签时才启用，多个用逗号分隔'
  },
  {
    key: 'overrideExistingAspectRatio',
    label: '覆盖已有比例参数',
    type: 'boolean',
    default: true,
    description: '开启后，存在首图时会直接用首图比例覆盖已有 aspectRatio 参数'
  }
]
