// Core Error Types - 错误类型定义

/** 错误代码 */
export enum MediaLunaErrorCode {
  // 通用错误 1xxx
  UNKNOWN = 1000,
  VALIDATION_FAILED = 1001,
  NOT_FOUND = 1002,
  ALREADY_EXISTS = 1003,
  PERMISSION_DENIED = 1004,

  // 管道错误 2xxx
  PIPELINE_FAILED = 2000,
  MIDDLEWARE_ERROR = 2001,
  CONNECTOR_ERROR = 2002,
  MIDDLEWARE_NOT_FOUND = 2003,
  CONNECTOR_NOT_FOUND = 2004,

  // 计费错误 3xxx
  INSUFFICIENT_BALANCE = 3001,
  BILLING_FAILED = 3002,
  REFUND_FAILED = 3003,

  // 配置错误 4xxx
  CONFIG_INVALID = 4001,
  CHANNEL_DISABLED = 4002,
  CHANNEL_NOT_FOUND = 4003,
  PLUGIN_NOT_FOUND = 4004,
  PLUGIN_LOAD_FAILED = 4005,

  // 外部服务错误 5xxx
  EXTERNAL_API_ERROR = 5001,
  NETWORK_ERROR = 5002,
  RATE_LIMITED = 5003,
  TIMEOUT = 5004,

  // 存储错误 6xxx
  STORAGE_ERROR = 6001,
  CACHE_ERROR = 6002,
  FILE_NOT_FOUND = 6003,
}

/** 错误代码描述映射 */
export const ERROR_MESSAGES: Record<MediaLunaErrorCode, string> = {
  [MediaLunaErrorCode.UNKNOWN]: '未知错误',
  [MediaLunaErrorCode.VALIDATION_FAILED]: '验证失败',
  [MediaLunaErrorCode.NOT_FOUND]: '资源不存在',
  [MediaLunaErrorCode.ALREADY_EXISTS]: '资源已存在',
  [MediaLunaErrorCode.PERMISSION_DENIED]: '权限不足',

  [MediaLunaErrorCode.PIPELINE_FAILED]: '管道执行失败',
  [MediaLunaErrorCode.MIDDLEWARE_ERROR]: '中间件错误',
  [MediaLunaErrorCode.CONNECTOR_ERROR]: '连接器错误',
  [MediaLunaErrorCode.MIDDLEWARE_NOT_FOUND]: '中间件不存在',
  [MediaLunaErrorCode.CONNECTOR_NOT_FOUND]: '连接器不存在',

  [MediaLunaErrorCode.INSUFFICIENT_BALANCE]: '余额不足',
  [MediaLunaErrorCode.BILLING_FAILED]: '计费失败',
  [MediaLunaErrorCode.REFUND_FAILED]: '退款失败',

  [MediaLunaErrorCode.CONFIG_INVALID]: '配置无效',
  [MediaLunaErrorCode.CHANNEL_DISABLED]: '渠道已禁用',
  [MediaLunaErrorCode.CHANNEL_NOT_FOUND]: '渠道不存在',
  [MediaLunaErrorCode.PLUGIN_NOT_FOUND]: '插件不存在',
  [MediaLunaErrorCode.PLUGIN_LOAD_FAILED]: '插件加载失败',

  [MediaLunaErrorCode.EXTERNAL_API_ERROR]: '外部 API 错误',
  [MediaLunaErrorCode.NETWORK_ERROR]: '网络错误',
  [MediaLunaErrorCode.RATE_LIMITED]: '请求频率超限',
  [MediaLunaErrorCode.TIMEOUT]: '请求超时',

  [MediaLunaErrorCode.STORAGE_ERROR]: '存储错误',
  [MediaLunaErrorCode.CACHE_ERROR]: '缓存错误',
  [MediaLunaErrorCode.FILE_NOT_FOUND]: '文件不存在',
}

/** Media Luna 错误类 */
export class MediaLunaError extends Error {
  public readonly code: MediaLunaErrorCode
  public readonly details?: Record<string, any>

  constructor(
    code: MediaLunaErrorCode,
    message?: string,
    details?: Record<string, any>
  ) {
    super(message || ERROR_MESSAGES[code] || '未知错误')
    this.name = 'MediaLunaError'
    this.code = code
    this.details = details
  }

  /** 转换为 API 响应格式 */
  toResponse() {
    return {
      success: false,
      error: this.message,
      errorCode: this.code,
      errorDetails: this.details
    }
  }

  /** 转换为日志字符串 */
  toLogString(): string {
    const parts = [`[${this.code}] ${this.message}`]
    if (this.details) {
      parts.push(JSON.stringify(this.details))
    }
    return parts.join(' ')
  }
}

/** 错误工厂函数 */
export const Errors = {
  // 通用
  unknown: (message?: string) =>
    new MediaLunaError(MediaLunaErrorCode.UNKNOWN, message),

  notFound: (resource: string, id?: string | number) =>
    new MediaLunaError(
      MediaLunaErrorCode.NOT_FOUND,
      id ? `${resource} 不存在: ${id}` : `${resource} 不存在`,
      { resource, id }
    ),

  validationFailed: (message: string, field?: string) =>
    new MediaLunaError(
      MediaLunaErrorCode.VALIDATION_FAILED,
      message,
      { field }
    ),

  // 管道
  middlewareError: (middlewareName: string, message: string) =>
    new MediaLunaError(
      MediaLunaErrorCode.MIDDLEWARE_ERROR,
      `中间件 ${middlewareName} 错误: ${message}`,
      { middleware: middlewareName }
    ),

  connectorError: (connectorId: string, message: string) =>
    new MediaLunaError(
      MediaLunaErrorCode.CONNECTOR_ERROR,
      `连接器 ${connectorId} 错误: ${message}`,
      { connector: connectorId }
    ),

  middlewareNotFound: (name: string) =>
    new MediaLunaError(
      MediaLunaErrorCode.MIDDLEWARE_NOT_FOUND,
      `中间件不存在: ${name}`,
      { middleware: name }
    ),

  connectorNotFound: (id: string) =>
    new MediaLunaError(
      MediaLunaErrorCode.CONNECTOR_NOT_FOUND,
      `连接器不存在: ${id}`,
      { connector: id }
    ),

  // 计费
  insufficientBalance: (required: number, available: number, currency: string) =>
    new MediaLunaError(
      MediaLunaErrorCode.INSUFFICIENT_BALANCE,
      `余额不足: 需要 ${required} ${currency}，当前 ${available} ${currency}`,
      { required, available, currency }
    ),

  billingFailed: (message: string) =>
    new MediaLunaError(MediaLunaErrorCode.BILLING_FAILED, message),

  // 渠道
  channelNotFound: (channel: string | number) =>
    new MediaLunaError(
      MediaLunaErrorCode.CHANNEL_NOT_FOUND,
      `渠道不存在: ${channel}`,
      { channel }
    ),

  channelDisabled: (channel: string | number) =>
    new MediaLunaError(
      MediaLunaErrorCode.CHANNEL_DISABLED,
      `渠道已禁用: ${channel}`,
      { channel }
    ),

  // 插件
  pluginNotFound: (pluginId: string) =>
    new MediaLunaError(
      MediaLunaErrorCode.PLUGIN_NOT_FOUND,
      `插件不存在: ${pluginId}`,
      { plugin: pluginId }
    ),

  pluginLoadFailed: (pluginId: string, reason: string) =>
    new MediaLunaError(
      MediaLunaErrorCode.PLUGIN_LOAD_FAILED,
      `插件 ${pluginId} 加载失败: ${reason}`,
      { plugin: pluginId, reason }
    ),

  // 外部服务
  externalApiError: (service: string, message: string, statusCode?: number) =>
    new MediaLunaError(
      MediaLunaErrorCode.EXTERNAL_API_ERROR,
      `外部 API 错误 (${service}): ${message}`,
      { service, statusCode }
    ),

  networkError: (message: string) =>
    new MediaLunaError(MediaLunaErrorCode.NETWORK_ERROR, message),

  rateLimited: (retryAfter?: number) =>
    new MediaLunaError(
      MediaLunaErrorCode.RATE_LIMITED,
      retryAfter ? `请求频率超限，请在 ${retryAfter} 秒后重试` : '请求频率超限',
      { retryAfter }
    ),

  timeout: (operation: string, timeoutMs: number) =>
    new MediaLunaError(
      MediaLunaErrorCode.TIMEOUT,
      `操作超时 (${operation}): ${timeoutMs}ms`,
      { operation, timeoutMs }
    ),

  // 存储
  storageError: (message: string) =>
    new MediaLunaError(MediaLunaErrorCode.STORAGE_ERROR, message),

  cacheError: (message: string) =>
    new MediaLunaError(MediaLunaErrorCode.CACHE_ERROR, message),

  fileNotFound: (path: string) =>
    new MediaLunaError(
      MediaLunaErrorCode.FILE_NOT_FOUND,
      `文件不存在: ${path}`,
      { path }
    ),
}

/** 判断是否为 MediaLunaError */
export function isMediaLunaError(error: unknown): error is MediaLunaError {
  return error instanceof MediaLunaError
}

/**
 * 脱敏错误信息，移除可能包含的敏感信息（URL、API Key等）
 */
function sanitizeErrorMessage(message: string): string {
  // 移除完整 URL（可能包含 API Key 和主机名）
  let sanitized = message.replace(
    /https?:\/\/[^\s"'<>]+/gi,
    '[API端点]'
  )

  // 移除可能的 API Key 模式（常见格式）
  // sk-xxx, key=xxx, apikey=xxx, api_key=xxx, token=xxx 等
  sanitized = sanitized.replace(
    /\b(sk-[a-zA-Z0-9]{20,}|[a-zA-Z0-9]{32,})\b/g,
    '[REDACTED]'
  )
  sanitized = sanitized.replace(
    /(api[_-]?key|apikey|key|token|secret|password|auth)[=:]\s*["']?[^\s"',]+["']?/gi,
    '$1=[REDACTED]'
  )

  return sanitized
}

/** 将任意错误转换为 MediaLunaError */
export function toMediaLunaError(error: unknown): MediaLunaError {
  if (isMediaLunaError(error)) {
    return error
  }

  if (error instanceof Error) {
    // 脱敏错误信息
    const sanitizedMessage = sanitizeErrorMessage(error.message)
    return new MediaLunaError(
      MediaLunaErrorCode.UNKNOWN,
      sanitizedMessage,
      { originalError: error.name, stack: error.stack }
    )
  }

  return new MediaLunaError(
    MediaLunaErrorCode.UNKNOWN,
    sanitizeErrorMessage(String(error))
  )
}
