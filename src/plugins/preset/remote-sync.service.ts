// 远程预设同步服务

import { Context } from 'koishi'
import type { PluginLogger } from '../../core'
import { createPluginLogger } from '../../core'
import { PresetService, PresetData } from './service'
import type { RemoteSyncConfig } from './config'
import type { CacheService } from '../cache/service'

/** 远程 API 返回的模板数据 */
interface RemoteTemplate {
  id: number
  title: string
  prompt: string
  type: string
  tags: string[]
  category: string
  file_path: string
  thumbnail_path: string
  refs: Array<{
    id: number
    file_path: string
    is_placeholder: boolean
    position: number
  }>
  created_at: string
  description?: string
  author?: string
  heat_score?: number
}

/** 远程 API 响应 */
interface RemoteApiResponse {
  code: number
  data: RemoteTemplate[]
  message: string
  meta: {
    total_items: number
    page: number
    per_page: number
  }
}

/** 同步结果 */
export interface SyncResult {
  success: boolean
  added: number
  updated: number
  removed: number
  errors: string[]
  /** 是否命中缓存（304 Not Modified） */
  notModified?: boolean
}

/** 拉取结果 */
interface FetchResult {
  templates: RemoteTemplate[]
  notModified: boolean
  etag?: string
}

/**
 * 远程预设同步服务
 */
export class RemoteSyncService {
  private _ctx: Context
  private _logger: PluginLogger
  private _presetService: PresetService
  private _getCacheService: () => CacheService | undefined
  private _syncDispose: (() => void) | null = null
  /** 存储每个 API URL 对应的 ETag */
  private _etagCache: Map<string, string> = new Map()

  constructor(
    ctx: Context,
    presetService: PresetService,
    getCacheService: () => CacheService | undefined
  ) {
    this._ctx = ctx
    this._logger = createPluginLogger(ctx.logger('media-luna'), 'remote-sync')
    this._presetService = presetService
    this._getCacheService = getCacheService
  }

  /** 从远程 API 拉取模板列表（支持 ETag 缓存） */
  async fetchRemoteTemplates(apiUrl: string): Promise<FetchResult> {
    // 检查 context 是否仍然有效
    if (!this._ctx.scope.isActive) {
      throw new Error('Context is inactive, cannot fetch remote templates')
    }

    const headers: Record<string, string> = {}
    const cachedEtag = this._etagCache.get(apiUrl)
    if (cachedEtag) {
      headers['If-None-Match'] = cachedEtag
      this._logger.debug('Sending request with ETag: %s', cachedEtag)
    }

    try {
      // 使用原生 fetch 以获取完整响应（包括 headers 和状态码）
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(30000)
      })

      // 处理 304 Not Modified
      if (response.status === 304) {
        this._logger.info('Remote data not modified (304)')
        return {
          templates: [],
          notModified: true
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // 保存新的 ETag
      const newEtag = response.headers.get('etag')
      if (newEtag) {
        this._etagCache.set(apiUrl, newEtag)
        this._logger.debug('Saved new ETag: %s', newEtag)
      }

      const data: RemoteApiResponse = await response.json()

      // 检查 API 响应格式
      if (data.code !== undefined && data.code !== 200) {
        throw new Error(`API returned error: ${data.message || 'Unknown error'}`)
      }

      return {
        templates: data.data || [],
        notModified: false,
        etag: newEtag || undefined
      }
    } catch (error: any) {
      this._logger.error('Failed to fetch remote templates: %s', error)
      throw error
    }
  }

  /** 将远程模板转换为本地预设数据（不含缓存处理） */
  transformToPreset(template: RemoteTemplate, remoteUrl: string): Omit<PresetData, 'id'> {
    const referenceImagesRemote = template.refs
      .filter(ref => !ref.is_placeholder)
      .sort((a, b) => a.position - b.position)
      .map(ref => ref.file_path)

    const tags = [...new Set([template.type, ...template.tags].filter(Boolean))]
    const thumbnailRemote = template.thumbnail_path || template.file_path || undefined

    return {
      name: template.title,
      promptTemplate: template.prompt,
      tags,
      // 初始时 referenceImages 为空，等缓存完成后更新
      referenceImages: [],
      referenceImagesRemote,
      parameterOverrides: {},
      source: 'api',
      enabled: true,
      remoteId: template.id,
      remoteUrl,
      // 初始时 thumbnail 为空，等缓存完成后更新
      thumbnail: undefined,
      thumbnailRemote
    }
  }

  /**
   * 缓存预设的图片资源（缩略图和参考图片）
   * @param presetData 预设数据（需要包含 thumbnailRemote 和 referenceImagesRemote）
   * @param thumbnailDelay 下载间隔（毫秒），用于限流
   * @returns 更新后的预设数据（包含缓存后的 URL）
   */
  async cachePresetImages(
    presetData: Omit<PresetData, 'id'>,
    thumbnailDelay: number = 100
  ): Promise<Omit<PresetData, 'id'>> {
    // 检查 context 是否仍然有效
    if (!this._ctx.scope.isActive) {
      this._logger.debug('Context inactive, returning original preset data')
      return {
        ...presetData,
        thumbnail: presetData.thumbnailRemote,
        referenceImages: presetData.referenceImagesRemote || []
      }
    }

    const cache = this._getCacheService()

    // 如果缓存服务不可用，返回原数据（使用远程URL作为降级）
    if (!cache || !cache.isEnabled()) {
      this._logger.debug('Cache service not available, using remote URLs as fallback')
      return {
        ...presetData,
        thumbnail: presetData.thumbnailRemote,
        referenceImages: presetData.referenceImagesRemote || []
      }
    }

    const result = { ...presetData }
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // 缓存缩略图
    if (presetData.thumbnailRemote) {
      try {
        const cached = await cache.cacheFromUrl(presetData.thumbnailRemote)
        // 直接使用 cached.url，它已经包含正确的存储后端 URL
        result.thumbnail = cached.url || presetData.thumbnailRemote
        this._logger.debug('Cached thumbnail: %s -> %s', presetData.thumbnailRemote, result.thumbnail)
      } catch (e) {
        this._logger.warn('Failed to cache thumbnail %s: %s', presetData.thumbnailRemote, e)
        // 降级使用远程URL
        result.thumbnail = presetData.thumbnailRemote
      }

      // 限流
      if (thumbnailDelay > 0) {
        await delay(thumbnailDelay)
      }
    }

    // 缓存参考图片
    const cachedReferenceImages: string[] = []
    for (const remoteUrl of presetData.referenceImagesRemote || []) {
      try {
        const cached = await cache.cacheFromUrl(remoteUrl)
        // 直接使用 cached.url，它已经包含正确的存储后端 URL
        const cachedUrl = cached.url || remoteUrl
        cachedReferenceImages.push(cachedUrl)
        this._logger.debug('Cached reference image: %s -> %s', remoteUrl, cachedUrl)
      } catch (e) {
        this._logger.warn('Failed to cache reference image %s: %s', remoteUrl, e)
        // 降级使用远程URL
        cachedReferenceImages.push(remoteUrl)
      }

      // 限流
      if (thumbnailDelay > 0) {
        await delay(thumbnailDelay)
      }
    }
    result.referenceImages = cachedReferenceImages

    return result
  }

  /** 执行同步 */
  async sync(apiUrl: string, deleteRemoved: boolean = false, thumbnailDelay: number = 100): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      added: 0,
      updated: 0,
      removed: 0,
      errors: [],
      notModified: false
    }

    // 检查 context 是否仍然有效
    if (!this._ctx.scope.isActive) {
      result.errors.push('Context is inactive, sync aborted')
      this._logger.debug('Context inactive, skipping sync')
      return result
    }

    try {
      this._logger.info('Starting sync from: %s', apiUrl)

      const fetchResult = await this.fetchRemoteTemplates(apiUrl)

      // 304 Not Modified - 数据未变化，直接返回成功
      if (fetchResult.notModified) {
        result.success = true
        result.notModified = true
        this._logger.info('Sync skipped: data not modified (304)')
        return result
      }

      const remoteTemplates = fetchResult.templates
      this._logger.info('Fetched %d templates from remote', remoteTemplates.length)

      const localPresets = await this._presetService.listByRemoteUrl(apiUrl)
      const remoteIds = new Set(remoteTemplates.map(t => t.id))

      for (const template of remoteTemplates) {
        try {
          // 转换为预设数据
          let presetData = this.transformToPreset(template, apiUrl)

          // 检查是否需要重新缓存图片
          const existing = await this._presetService.getByRemoteId(template.id, apiUrl)
          const needsCaching = this._needsImageCaching(existing, presetData)

          if (needsCaching) {
            // 缓存图片资源
            presetData = await this.cachePresetImages(presetData, thumbnailDelay)
            this._logger.debug('Cached images for preset: %s', template.title)
          } else if (existing) {
            // 保留已有的缓存URL
            presetData.thumbnail = existing.thumbnail
            presetData.referenceImages = existing.referenceImages
          }

          if (existing) {
            // 更新时保留用户设置的 enabled 状态
            const { enabled: _ignored, ...updateData } = presetData
            await this._presetService.update(existing.id, updateData)
            result.updated++
            this._logger.debug('Updated preset: %s', template.title)
          } else {
            await this._presetService.create(presetData)
            result.added++
            this._logger.debug('Created preset: %s', template.title)
          }
        } catch (error) {
          const message = `Failed to sync template ${template.id}: ${error instanceof Error ? error.message : String(error)}`
          result.errors.push(message)
          this._logger.warn(message)
        }
      }

      if (deleteRemoved) {
        for (const preset of localPresets) {
          if (preset.remoteId && !remoteIds.has(preset.remoteId)) {
            try {
              await this._presetService.delete(preset.id)
              result.removed++
              this._logger.debug('Deleted preset: %s', preset.name)
            } catch (error) {
              const message = `Failed to delete preset ${preset.id}: ${error instanceof Error ? error.message : String(error)}`
              result.errors.push(message)
            }
          }
        }
      }

      result.success = result.errors.length === 0
      this._logger.info('Sync completed: %d added, %d updated, %d removed', result.added, result.updated, result.removed)

      return result
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error))
      this._logger.error('Sync failed: %s', error)
      return result
    }
  }

  /**
   * 判断是否需要重新缓存图片
   * - 新预设需要缓存
   * - 远程URL变化需要重新缓存
   * - 本地缓存URL为空需要缓存
   */
  private _needsImageCaching(
    existing: PresetData | null,
    newData: Omit<PresetData, 'id'>
  ): boolean {
    // 新预设需要缓存
    if (!existing) return true

    // 缩略图远程URL变化
    if (existing.thumbnailRemote !== newData.thumbnailRemote) return true

    // 参考图片远程URL变化
    const existingRemote = existing.referenceImagesRemote || []
    const newRemote = newData.referenceImagesRemote || []
    if (existingRemote.length !== newRemote.length) return true
    if (!existingRemote.every((url, i) => url === newRemote[i])) return true

    // 本地缓存URL为空（之前缓存失败或未缓存）
    if (newData.thumbnailRemote && !existing.thumbnail) return true
    if (newRemote.length > 0 && existing.referenceImages.length === 0) return true

    return false
  }

  /** 启动定时同步 */
  startAutoSync(config: RemoteSyncConfig): void {
    this.stopAutoSync()

    if (!config.autoSync || config.syncInterval <= 0 || !config.apiUrl) {
      return
    }

    const intervalMs = config.syncInterval * 60 * 1000
    const thumbnailDelay = config.thumbnailDelay || 100
    this._logger.info('Starting auto sync every %d minutes', config.syncInterval)

    // 立即执行一次同步（延迟执行以确保服务初始化完成）
    const initialSyncTimer = setTimeout(() => {
      // 检查 context 是否仍然有效
      if (!this._ctx.scope.isActive) {
        this._logger.debug('Context inactive, skipping initial sync')
        return
      }
      this.sync(config.apiUrl, config.deleteRemoved, thumbnailDelay).catch(e => {
        this._logger.error('Initial sync failed: %s', e)
      })
    }, 3000)

    // 使用原生 setInterval 并手动管理
    const intervalId = setInterval(() => {
      // 检查 context 是否仍然有效
      if (!this._ctx.scope.isActive) {
        this._logger.debug('Context inactive, stopping scheduled sync')
        clearInterval(intervalId)
        return
      }
      this.sync(config.apiUrl, config.deleteRemoved, thumbnailDelay).catch(e => {
        this._logger.error('Scheduled sync failed: %s', e)
      })
    }, intervalMs)

    // 保存清理函数
    this._syncDispose = () => {
      clearTimeout(initialSyncTimer)
      clearInterval(intervalId)
    }
  }

  /** 停止定时同步 */
  stopAutoSync(): void {
    if (this._syncDispose) {
      this._syncDispose()
      this._syncDispose = null
      this._logger.info('Auto sync stopped')
    }
  }

  /** 清除 ETag 缓存（强制下次完整拉取） */
  clearEtagCache(apiUrl?: string): void {
    if (apiUrl) {
      this._etagCache.delete(apiUrl)
    } else {
      this._etagCache.clear()
    }
    this._logger.debug('ETag cache cleared')
  }

  /** 销毁服务 */
  dispose(): void {
    this.stopAutoSync()
    this._etagCache.clear()
  }
}
