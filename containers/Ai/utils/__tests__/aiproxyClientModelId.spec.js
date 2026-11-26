import {
  buildDeploymentClientModelOptions,
  buildRoutingClientModelOptions,
  filterClientModelOptionsByCategory,
} from '../aiproxyClientModelId'

jest.mock('@/utils/manager', () => ({ Manager: class {} }), { virtual: true })
jest.mock('@Ai/constants/aiproxyResources', () => ({ getAiproxyResourceScope: () => '' }), { virtual: true })
jest.mock('@Ai/utils/aiProviderKind', () => ({ fetchRoutingModelsForRouting: async () => [] }), { virtual: true })

describe('buildRoutingClientModelOptions', () => {
  const routing = { model_key: 'qwen38-Qwen3.8-27B-NVFP4' }
  const catalogModelsById = {
    'model-a': { model_key: 'Qwen3.8-27B-NVFP4' },
    'model-b': { model_key: 'Qwen3.8-27B-NVFP4' },
    'model-c': { model_key: 'Qwen3.8-27B-Instruct' },
  }

  it('emits only the flat id for a single routing model with model_key', () => {
    const options = buildRoutingClientModelOptions({
      routing,
      routingModels: [{ ai_model_id: 'model-a', enabled: true, priority: 10 }],
      catalogModelsById,
    })
    expect(options.map(o => o.id)).toEqual(['qwen38-Qwen3.8-27B-NVFP4'])
    expect(options[0].kind).toBe('flat')
  })

  it('emits only the flat id for replica rows that share the same catalog', () => {
    const options = buildRoutingClientModelOptions({
      routing,
      routingModels: [
        { ai_model_id: 'model-a', enabled: true, priority: 10 },
        { ai_model_id: 'model-b', enabled: true, priority: 20 },
      ],
      catalogModelsById,
    })
    expect(options.map(o => o.id)).toEqual(['qwen38-Qwen3.8-27B-NVFP4'])
    expect(options[0].kind).toBe('flat')
  })

  it('emits flat plus hierarchical ids when routing binds distinct catalogs', () => {
    const options = buildRoutingClientModelOptions({
      routing,
      routingModels: [
        { ai_model_id: 'model-a', enabled: true, priority: 10 },
        { ai_model_id: 'model-c', enabled: true, priority: 20 },
      ],
      catalogModelsById,
    })
    expect(options.map(o => ({ id: o.id, kind: o.kind }))).toEqual([
      { id: 'qwen38-Qwen3.8-27B-NVFP4', kind: 'flat' },
      { id: 'qwen38-Qwen3.8-27B-NVFP4/Qwen3.8-27B-NVFP4', kind: 'hierarchical' },
      { id: 'qwen38-Qwen3.8-27B-NVFP4/Qwen3.8-27B-Instruct', kind: 'hierarchical' },
    ])
  })
})

describe('filterClientModelOptionsByCategory', () => {
  const options = [
    { id: 'chat-model', category: '' },
    { id: 'llm-model', category: 'llm' },
    { id: 'emb-model', category: 'embedding' },
    { id: 'rerank-model', category: 'reranker' },
  ]

  it('keeps legacy and llm models for chat', () => {
    expect(filterClientModelOptionsByCategory(options, 'chat').map(o => o.id))
      .toEqual(['chat-model', 'llm-model'])
  })

  it('keeps only embedding models', () => {
    expect(filterClientModelOptionsByCategory(options, 'embedding').map(o => o.id))
      .toEqual(['emb-model'])
  })

  it('keeps only reranker models', () => {
    expect(filterClientModelOptionsByCategory(options, 'rerank').map(o => o.id))
      .toEqual(['rerank-model'])
  })
})

describe('buildDeploymentClientModelOptions', () => {
  // Real aiproxy_bindings carry no model_key, only the provider id.
  const bindings = [
    { client_model_alias: 'dep-emb', ai_provider_id: 'p1' },
    { client_model_alias: 'dep-chat', ai_provider_id: 'p2' },
  ]

  it('attaches category by provider id', () => {
    const opts = buildDeploymentClientModelOptions(bindings, {}, { categoryByProvider: { p1: 'embedding' } })
    expect(opts).toHaveLength(2)
    expect(opts[0].category).toBe('embedding')
    expect(opts[1].category).toBe('')
  })

  it('falls back to the deployment category when catalogs lack one', () => {
    const opts = buildDeploymentClientModelOptions(bindings, {}, { fallbackCategory: 'embedding' })
    expect(opts.map(o => o.category)).toEqual(['embedding', 'embedding'])
  })

  it('prefers the model_key map when a binding carries one', () => {
    const withKey = [{ client_model_alias: 'dep-emb', model_key: 'Qwen3-Embedding-0.6B', ai_provider_id: 'p1' }]
    const opts = buildDeploymentClientModelOptions(withKey, { 'Qwen3-Embedding-0.6B': 'embedding' })
    expect(opts[0].category).toBe('embedding')
  })

  it('normalizes categories', () => {
    const opts = buildDeploymentClientModelOptions(bindings, {}, {
      categoryByProvider: { p1: ' Embedding ' },
      fallbackCategory: 'RERANKER',
    })
    expect(opts[0].category).toBe('embedding')
    expect(opts[1].category).toBe('reranker')
  })
})
