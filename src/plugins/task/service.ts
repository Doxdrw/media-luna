// 任务服务

import { Context, $ } from 'koishi'
import type { MediaLunaTask } from '../../augmentations'
import type { GenerationRequest, OutputAsset } from '../../types'

/** 任务状态 */
export type TaskStatus = 'pending' | 'processing' | 'success' | 'failed'

/** 任务数据 */
export interface TaskData {
  id: number
  uid: number | null  // Koishi user.id（可为空，表示匿名/未登录）
  channelId: number
  requestSnapshot: GenerationRequest
  responseSnapshot: OutputAsset[] | null
  status: TaskStatus
  middlewareLogs: Record<string, any>
  startTime: Date
  endTime: Date | null
  duration: number | null
}

/** 任务查询选项 */
export interface TaskQueryOptions {
  uid?: number
  channelId?: number
  status?: TaskStatus
  startDate?: Date  // 只查询此时间之后的任务
  mediaType?: string  // 媒体类型筛选: image/audio/video
  limit?: number
  offset?: number
}

/**
 * 任务服务
 *
 * 管理任务记录的 CRUD 操作
 */
export class TaskService {
  private _ctx: Context

  constructor(ctx: Context) {
    this._ctx = ctx
  }

  /** 将数据库记录转换为 TaskData */
  private _toData(record: MediaLunaTask): TaskData {
    return {
      id: record.id,
      uid: record.uid,
      channelId: record.channelId,
      requestSnapshot: JSON.parse(record.requestSnapshot || '{}'),
      responseSnapshot: record.responseSnapshot ? JSON.parse(record.responseSnapshot) : null,
      status: record.status as TaskStatus,
      middlewareLogs: JSON.parse(record.middlewareLogs || '{}'),
      startTime: record.startTime,
      endTime: record.endTime,
      duration: record.duration
    }
  }

  /** 创建任务 */
  async create(
    uid: number | null,
    channelId: number,
    request: GenerationRequest
  ): Promise<TaskData> {
    const now = new Date()
    const record = await this._ctx.database.create('medialuna_task', {
      uid,
      channelId,
      requestSnapshot: JSON.stringify(request),
      responseSnapshot: null,
      status: 'pending',
      middlewareLogs: '{}',
      startTime: now,
      endTime: null,
      duration: null,
      createdAt: now
    })

    return this._toData(record)
  }

  /** 更新任务状态 */
  async updateStatus(
    id: number,
    status: TaskStatus,
    options?: {
      responseSnapshot?: OutputAsset[]
      inputSnapshot?: OutputAsset[]
      middlewareLogs?: Record<string, any>
    }
  ): Promise<TaskData | null> {
    const updateData: Partial<MediaLunaTask> = {
      status
    }

    if (status === 'success' || status === 'failed') {
      const now = new Date()
      const record = await this._ctx.database.get('medialuna_task', { id })
      if (record.length > 0) {
        updateData.endTime = now
        updateData.duration = now.getTime() - record[0].startTime.getTime()

        // 如果有输入快照，更新 requestSnapshot 添加输入文件 URL
        if (options?.inputSnapshot) {
          const existingRequest = JSON.parse(record[0].requestSnapshot || '{}')
          existingRequest.inputFiles = options.inputSnapshot
          updateData.requestSnapshot = JSON.stringify(existingRequest)
        }
      }
    }

    if (options?.responseSnapshot) {
      updateData.responseSnapshot = JSON.stringify(options.responseSnapshot)
    }

    if (options?.middlewareLogs) {
      updateData.middlewareLogs = JSON.stringify(options.middlewareLogs)
    }

    await this._ctx.database.set('medialuna_task', { id }, updateData)

    return this.getById(id)
  }

  /** 根据 ID 获取任务 */
  async getById(id: number): Promise<TaskData | null> {
    const records = await this._ctx.database.get('medialuna_task', { id })
    return records.length > 0 ? this._toData(records[0]) : null
  }

  /** 查询任务列表 */
  async query(options: TaskQueryOptions = {}): Promise<TaskData[]> {
    let selection = this._ctx.database.select('medialuna_task')

    if (options.uid !== undefined && options.uid !== null) {
      selection = selection.where({ uid: options.uid })
    }
    if (options.channelId !== undefined && options.channelId !== null) {
      selection = selection.where({ channelId: options.channelId })
    }
    if (options.status) {
      selection = selection.where({ status: options.status })
    }
    if (options.startDate) {
      selection = selection.where(row => $.gte(row.startTime, options.startDate!))
    }

    // 如果有 mediaType 筛选，需要在内存中过滤（因为 responseSnapshot 是 JSON 字段）
    if (options.mediaType) {
      // 获取更多记录以便过滤后仍有足够结果
      const targetLimit = options.limit ?? 100
      const fetchLimit = targetLimit * 3  // 获取 3 倍数量以补偿过滤损耗

      const records = await selection
        .orderBy('id', 'desc')
        .limit(fetchLimit)
        .offset(options.offset ?? 0)
        .execute()

      // 在内存中过滤
      const filtered: TaskData[] = []
      for (const r of records) {
        const data = this._toData(r)
        // 检查 responseSnapshot 是否包含指定类型的媒体
        if (data.responseSnapshot?.some(asset => asset.kind === options.mediaType)) {
          filtered.push(data)
          if (filtered.length >= targetLimit) break
        }
      }
      return filtered
    }

    const records = await selection
      .orderBy('id', 'desc')
      .limit(options.limit ?? 100)
      .offset(options.offset ?? 0)
      .execute()

    return records.map(r => this._toData(r))
  }

  /** 获取用户最近的任务 */
  async getRecentByUid(uid: number, limit: number = 10): Promise<TaskData[]> {
    return this.query({ uid, limit })
  }

  /** 统计任务数量 */
  async count(options: Omit<TaskQueryOptions, 'limit' | 'offset'> = {}): Promise<number> {
    let selection = this._ctx.database.select('medialuna_task')

    if (options.uid !== undefined && options.uid !== null) {
      selection = selection.where({ uid: options.uid })
    }
    if (options.channelId !== undefined && options.channelId !== null) {
      selection = selection.where({ channelId: options.channelId })
    }
    if (options.status) {
      selection = selection.where({ status: options.status })
    }
    if (options.startDate) {
      selection = selection.where(row => $.gte(row.startTime, options.startDate!))
    }

    // 如果有 mediaType 筛选，需要在内存中过滤
    if (options.mediaType) {
      const records = await selection.execute()
      let count = 0
      for (const r of records) {
        const data = this._toData(r)
        if (data.responseSnapshot?.some(asset => asset.kind === options.mediaType)) {
          count++
        }
      }
      return count
    }

    const result = await selection.execute()
    return result.length
  }

  /** 删除任务 */
  async delete(id: number): Promise<boolean> {
    const existing = await this.getById(id)
    if (!existing) return false

    await this._ctx.database.remove('medialuna_task', { id })
    return true
  }

  /** 清理旧任务 */
  async cleanup(beforeDate: Date): Promise<number> {
    // 先查询符合条件的任务
    const result = await this._ctx.database.get('medialuna_task', {
      createdAt: { $lt: beforeDate }
    })

    const ids = result.map(r => r.id)
    if (ids.length > 0) {
      for (const id of ids) {
        await this._ctx.database.remove('medialuna_task', { id })
      }
    }

    return ids.length
  }

  /** 获取统计信息 */
  async getStats(): Promise<{
    total: number
    pending: number
    processing: number
    success: number
    failed: number
    successRate: number
  }> {
    const total = await this.count()
    const pending = await this.count({ status: 'pending' })
    const processing = await this.count({ status: 'processing' })
    const success = await this.count({ status: 'success' })
    const failed = await this.count({ status: 'failed' })

    const completed = success + failed
    const successRate = completed > 0 ? (success / completed) * 100 : 0

    return {
      total,
      pending,
      processing,
      success,
      failed,
      successRate: Math.round(successRate * 100) / 100
    }
  }

  /**
   * 获取用户的生成历史（仅成功的任务，用于画廊展示）
   * 返回简化的数据，适合前端展示
   */
  async getUserGallery(uid: number, options: {
    limit?: number
    offset?: number
    channelId?: number
  } = {}): Promise<{
    items: Array<{
      id: number
      prompt: string
      images: string[]  // 输出图片 URL 列表
      createdAt: Date
      channelId: number
    }>
    total: number
    hasMore: boolean
  }> {
    const limit = Math.min(options.limit || 20, 100)
    const offset = options.offset || 0

    // 查询成功的任务
    const queryOptions: TaskQueryOptions = {
      uid,
      status: 'success',
      limit: limit + 1,  // 多查一条用于判断 hasMore
      offset
    }
    if (options.channelId) {
      queryOptions.channelId = options.channelId
    }

    const tasks = await this.query(queryOptions)
    const hasMore = tasks.length > limit
    const items = tasks.slice(0, limit)

    // 统计总数
    const total = await this.count({
      uid,
      status: 'success',
      channelId: options.channelId
    })

    return {
      items: items.map(task => ({
        id: task.id,
        prompt: task.requestSnapshot?.prompt || '',
        images: (task.responseSnapshot || [])
          .filter(asset => asset.kind === 'image' && asset.url)
          .map(asset => asset.url!),
        createdAt: task.startTime,
        channelId: task.channelId
      })),
      total,
      hasMore
    }
  }

  /**
   * 获取用户最近生成的图片（扁平化，用于快速预览）
   */
  async getUserRecentImages(uid: number, limit: number = 20): Promise<Array<{
    taskId: number
    url: string
    prompt: string
    createdAt: Date
  }>> {
    const tasks = await this.query({
      uid,
      status: 'success',
      limit: Math.min(limit * 2, 100)  // 多查一些，因为一个任务可能有多张图
    })

    const images: Array<{
      taskId: number
      url: string
      prompt: string
      createdAt: Date
    }> = []

    for (const task of tasks) {
      if (!task.responseSnapshot) continue
      for (const asset of task.responseSnapshot) {
        if (asset.kind === 'image' && asset.url) {
          images.push({
            taskId: task.id,
            url: asset.url,
            prompt: task.requestSnapshot?.prompt || '',
            createdAt: task.startTime
          })
          if (images.length >= limit) break
        }
      }
      if (images.length >= limit) break
    }

    return images
  }
}
