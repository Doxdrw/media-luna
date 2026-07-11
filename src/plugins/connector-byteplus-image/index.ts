import { definePlugin } from '../../core'
import { BytePlusImageConnector } from './connector'

export default definePlugin({
  id: 'connector-byteplus-image',
  name: 'BytePlus 图像连接器',
  description: 'BytePlus ModelArk 国际站 Seedream 图像生成连接器',
  version: '1.0.0',

  connector: BytePlusImageConnector,

  async onLoad(ctx) {
    ctx.logger.info('BytePlus image connector loaded')
  }
})

export { BytePlusImageConnector } from './connector'
