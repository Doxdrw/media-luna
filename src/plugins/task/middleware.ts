// 任务记录中间件

import type {
  MiddlewareDefinition,
  MiddlewareContext,
  MiddlewareRunStatus,
  OutputAsset,
  AssetKind
} from '../../core'
import type { TaskPluginConfig } from './config'
import type { TaskService } from './service'

/**
 * 从 MIME 类型推断资产类型
 */
function getAssetKindFromMime(mime: string): AssetKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('text/')) return 'text'
  return 'file'
}

/**
 * 清理 OutputAsset，移除 base64 数据以避免数据库膨胀
 * 如果 URL 是 base64 格式，将其替换为占位符
 */
function sanitizeOutputAssets(assets: OutputAsset[] | null | undefined): OutputAsset[] | undefined {
  if (!assets || assets.length === 0) return undefined

  return assets.map(asset => {
    // 检查 URL 是否是 base64 格式
    if (asset.url && asset.url.startsWith('data:')) {
      return {
        ...asset,
        url: '[base64-data-removed]',
        meta: {
          ...asset.meta,
          _originalWasBase64: true
        }
      }
    }
    return asset
  })
}

/**
 * 创建任务记录（开始）中间件
 *
 * 在 lifecycle-prepare 阶段创建任务记录
 */
export function createTaskRecorderPrepareMiddleware(): MiddlewareDefinition {
  return {
    name: 'task-recorder-prepare',
    displayName: '任务记录（开始）',
    description: '在生成开始时创建任务记录',
    category: 'recording',
    phase: 'lifecycle-prepare',
    after: ['storage-input'],  // 确保在 storage-input 之后执行，以获取已上传的输入文件 URL
    // 配置在 task 插件的扩展插件面板中设置

    async execute(context: MiddlewareContext, next): Promise<MiddlewareRunStatus> {
      const config = await context.getMiddlewareConfig<TaskPluginConfig>('task-recorder')

      // 检查是否启用
      if (config?.enabled === false) {
        return next()
      }

      // 从上下文获取 taskService
      const taskService = context.getService<TaskService>('task')
      if (!taskService) {
        return next()
      }

      try {
        // 获取已上传的输入文件 URL（由 storage-input 中间件上传）
        const inputFileUrls = context.store.get('inputFileUrls') as string[] | undefined

        // 创建任务记录
        // 如果有已上传的输入文件 URL，使用 URL；否则只保留文件元数据
        // 注意：需要清理 base64 URL 以避免数据库膨胀
        const inputFiles: OutputAsset[] = inputFileUrls && inputFileUrls.length > 0
          ? inputFileUrls.map((url, i) => ({
              kind: getAssetKindFromMime(context.files[i]?.mime || 'application/octet-stream'),
              url: url.startsWith('data:') ? '[base64-data-removed]' : url,
              mime: context.files[i]?.mime,
              meta: {
                filename: context.files[i]?.filename,
                ...(url.startsWith('data:') ? { _originalWasBase64: true } : {})
              }
            }))
          : context.files.map(f => ({
              kind: getAssetKindFromMime(f.mime || 'application/octet-stream'),
              url: '', // 无 URL 时为空
              mime: f.mime,
              meta: { filename: f.filename }
            }))

        const request = {
          channel: context.channelId,
          prompt: context.prompt,
          inputFiles, // 使用 URL 而非二进制数据
          parameters: context.parameters,
          uid: context.uid ?? undefined
        }

        const task = await taskService.create(
          context.uid,  // uid 参数
          context.channelId,
          request as any
        )

        // 保存任务 ID 到上下文
        context.taskId = task.id
        context.store.set('taskId', task.id)

        // 更新状态为处理中
        await taskService.updateStatus(task.id, 'processing')
      } catch {
        // 不阻止流程继续
      }

      return next()
    }
  }
}

/**
 * 创建任务记录（完成）中间件
 *
 * 在 lifecycle-finalize 阶段更新任务记录
 */
export function createTaskRecorderFinalizeMiddleware(): MiddlewareDefinition {
  return {
    name: 'task-recorder-finalize',
    displayName: '任务记录（完成）',
    description: '在生成完成后更新任务状态',
    category: 'recording',
    phase: 'lifecycle-finalize',
    // 配置在 task 插件的扩展插件面板中设置

    async execute(context: MiddlewareContext, next): Promise<MiddlewareRunStatus> {
      const config = await context.getMiddlewareConfig<TaskPluginConfig>('task-recorder')

      // 检查是否启用
      if (config?.enabled === false) {
        return next()
      }

      const taskId = context.taskId ?? context.store.get('taskId')
      if (!taskId) {
        return next()
      }

      // 从上下文获取 taskService
      const taskService = context.getService<TaskService>('task')
      if (!taskService) {
        return next()
      }

      try {
        // 判断状态：有错误则为 failed，有输出则为 success，否则也是 failed
        let status: 'success' | 'failed'
        if (context.error) {
          status = 'failed'
        } else if (context.output && context.output.length > 0) {
          status = 'success'
        } else {
          status = 'failed'
        }

        // 准备中间件日志，如果有错误则记录
        const middlewareLogs = context.getMiddlewareLogs()
        if (context.error) {
          middlewareLogs._error = {
            message: context.error,
            code: context.errorCode
          }
        }

        // 清理输出快照，移除 base64 数据以避免数据库膨胀
        const sanitizedOutput = sanitizeOutputAssets(context.output)

        await taskService.updateStatus(taskId, status, {
          responseSnapshot: sanitizedOutput,
          middlewareLogs
        })
      } catch {
        // 忽略更新失败
      }

      return next()
    }
  }
}
