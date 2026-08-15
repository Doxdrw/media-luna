// 预设中间件

import type {
  MiddlewareDefinition,
  MiddlewareContext,
  MiddlewareRunStatus,
  FileData
} from '../../core'
import type { PresetMiddlewareConfig } from './config'
import type { PresetService } from './service'
import type { CacheService } from '../cache/service'

/**
 * 创建预设中间件
 */
export function createPresetMiddleware(): MiddlewareDefinition {
  return {
    name: 'preset',
    displayName: '预设处理',
    description: '应用预设模板和参考图到生成请求',
    category: 'preset',
    phase: 'lifecycle-pre-request',
    // 配置在 preset 插件的扩展插件面板中设置

    async execute(context: MiddlewareContext, next): Promise<MiddlewareRunStatus> {
      const config = await context.getMiddlewareConfig<PresetMiddlewareConfig>('preset')

      if (config?.enabled === false) {
        return next()
      }

      // 从上下文获取 presetService
      const presetService = context.getService<PresetService>('preset')
      if (!presetService) {
        return next()
      }

      const presetName = context.parameters.preset || config?.defaultPreset
      if (!presetName) {
        return next()
      }

      let preset = await presetService.getByName(presetName)
      if (!preset) {
        return next()
      }

      if (!preset.enabled) {
        return next()
      }

      // 注入预设参考图
      if (preset.referenceImages && preset.referenceImages.length > 0) {
        const cache = context.getService<CacheService>('cache')
        if (!cache) throw new Error('缓存服务不可用，无法读取预设参考图')

        const available = await Promise.all(preset.referenceImages.map(url => cache.isReferenceAvailable(url)))
        if (available.some(value => !value)) {
          await cache.repairReferences({ downloadRemote: true })
          preset = (await presetService.getByName(presetName)) || preset
        }

        const presetFiles = await loadReferenceImages(cache, preset.name, preset.referenceImages)
        context.files = [...presetFiles, ...context.files]
      }

      // 应用预设模板
      const originalPrompt = context.prompt
      context.prompt = applyTemplate(preset.promptTemplate, originalPrompt)

      // 应用参数覆盖
      if (preset.parameterOverrides) {
        context.parameters = {
          ...context.parameters,
          ...preset.parameterOverrides
        }
      }

      context.setMiddlewareLog('preset', {
        presetId: preset.id,
        presetName: preset.name,
        originalPrompt,
        transformedPrompt: context.prompt,
        referenceImagesInjected: preset.referenceImages?.length ?? 0
      })

      return next()
    }
  }
}

/** 加载参考图 */
async function loadReferenceImages(
  cache: CacheService,
  presetName: string,
  urls: string[]
): Promise<FileData[]> {
  const files: FileData[] = []

  for (let index = 0; index < urls.length; index++) {
    const loaded = await cache.loadReference(urls[index])
    if (!loaded) {
      throw new Error(`预设「${presetName}」的第 ${index + 1} 张参考图已丢失；请重新同步远程预设或重新上传图片`)
    }
    files.push(loaded)
  }

  return files
}

/** 应用模板替换 */
function applyTemplate(template: string, userText: string): string {
  if (template.includes('{prompt}')) {
    return template.replace(/\{prompt\}/g, userText)
  }

  if (template.includes('{{userText}}')) {
    return template.replace(/\{\{userText\}\}/g, userText)
  }

  return `${template}\n\n${userText}`
}
