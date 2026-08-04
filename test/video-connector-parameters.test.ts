import assert from 'node:assert/strict'
import test from 'node:test'
import { buildOpenAIVideoRequestBody, OpenAIVideoConnector } from '../src/plugins/connector-openai-video/connector'
import { RunwayConnector } from '../src/plugins/connector-runway/connector'

test('OpenAI-compatible video keeps JSON transport and accepts canonical overrides', () => {
  const body = buildOpenAIVideoRequestBody(
    { model: 'legacy-model', size: '1280x720', seconds: 4, fps: 24, seed: 1 },
    'camera moves',
    ['https://example.com/input.png'],
    { duration: 8, resolution: '720x1280', fps: 30, seed: 42 }
  )

  assert.deepEqual(body, {
    model: 'legacy-model',
    prompt: 'camera moves',
    size: '720x1280',
    seconds: 8,
    fps: 30,
    seed: 42,
    image: 'https://example.com/input.png'
  })
  assert.deepEqual(OpenAIVideoConnector.commandParameters, ['duration', 'resolution', 'fps', 'seed'])
})

test('Runway exposes aspect ratio without a duplicate resolution option', () => {
  assert.deepEqual(RunwayConnector.commandParameters, ['duration', 'aspectRatio', 'seed'])
  const log = RunwayConnector.getRequestLog!(
    { apiUrl: 'https://example.com', model: 'legacy', duration: 5, aspectRatio: '16:9' },
    [],
    'clouds',
    { duration: 10, aspectRatio: '9:16', seed: 42 }
  )
  assert.deepEqual(log.parameters, {
    duration: 10,
    aspectRatio: '9:16',
    seed: 42
  })
})