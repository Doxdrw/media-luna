import { definePlugin } from '../../core'
import {
  defaultFlowAspectEnhancerConfig,
  flowAspectEnhancerConfigFields,
  type FlowAspectEnhancerConfig
} from './config'
import { createFlowAspectEnhancerMiddleware } from './middleware'

export default definePlugin({
  id: 'flow-aspect-enhancer',
  name: 'Flow 比例增强',
  description: '根据首张输入图宽高比自动改写 Flow/Gemini 逆向接口使用的 aspectRatio 参数',
  version: '1.0.0',

  configFields: flowAspectEnhancerConfigFields,
  configDefaults: defaultFlowAspectEnhancerConfig,

  middlewares: [
    createFlowAspectEnhancerMiddleware()
  ],

  async onLoad(pluginCtx) {
    pluginCtx.logger.info('Flow aspect enhancer plugin loaded')
  }
})

export type { FlowAspectEnhancerConfig } from './config'
export { createFlowAspectEnhancerMiddleware } from './middleware'
