// 测试连接器配置

import type { ConnectorField, CardDisplayField } from '../../core'

/** 测试连接器配置字段 */
export const connectorFields: ConnectorField[] = [
  {
    key: 'width',
    label: '图片宽度',
    type: 'number',
    default: 512,
    description: '生成图片的宽度（像素）'
  },
  {
    key: 'height',
    label: '图片高度',
    type: 'number',
    default: 512,
    description: '生成图片的高度（像素）'
  },
  {
    key: 'backgroundColor',
    label: '背景颜色',
    type: 'text',
    default: '#1a1a2e',
    placeholder: '#1a1a2e',
    description: '背景颜色（十六进制，如 #1a1a2e）'
  },
  {
    key: 'textColor',
    label: '文字颜色',
    type: 'text',
    default: '#ffffff',
    placeholder: '#ffffff',
    description: '文字颜色（十六进制，如 #ffffff）'
  },
  {
    key: 'fontSize',
    label: '字体大小',
    type: 'number',
    default: 24,
    description: '文字大小（像素）'
  },
  {
    key: 'delay',
    label: '模拟延迟（毫秒）',
    type: 'number',
    default: 1000,
    description: '模拟 API 响应延迟，用于测试加载状态'
  }
]

/** 卡片展示字段 */
export const connectorCardFields: CardDisplayField[] = [
  { source: 'connectorConfig', key: 'width', label: '宽度' },
  { source: 'connectorConfig', key: 'height', label: '高度' }
]
