import type { ConfigField } from '../../core/types'

export interface CharacterProfileConfig {
  storageSchemeNames: string
  skipReplacementMarker: string
}

export const defaultCharacterProfileConfig: CharacterProfileConfig = {
  storageSchemeNames: '',
  skipReplacementMarker: '@@'
}

export const characterProfileConfigFields: ConfigField[] = [
  {
    key: 'storageSchemeNames',
    label: '存储服务优先级',
    type: 'text',
    default: '',
    description: '设定图存储时按顺序尝试这些方案名，多个用逗号分隔；留空则使用 cache 插件默认方案'
  },
  {
    key: 'skipReplacementMarker',
    label: '跳过替换标记',
    type: 'text',
    default: '@@',
    description: '当提示词包含该标记时，角色设定替换会被跳过，并从提示词中移除这个标记'
  }
]
