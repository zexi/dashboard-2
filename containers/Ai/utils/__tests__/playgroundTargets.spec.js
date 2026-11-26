import {
  categoriesMatchKind,
  collectRoutingCategories,
  filterServableDeploymentTargets,
  filterServableRoutingTargets,
  filterTargetsByKind,
  targetMatchesKind,
} from '../playgroundTargets'

jest.mock('@/utils/manager', () => ({ Manager: class {} }), { virtual: true })
jest.mock('@Ai/constants/aiproxyResources', () => ({ getAiproxyResourceScope: () => '' }), { virtual: true })

describe('targetMatchesKind', () => {
  it('keeps legacy/llm targets for chat only', () => {
    expect(targetMatchesKind('', 'chat')).toBe(true)
    expect(targetMatchesKind('llm', 'chat')).toBe(true)
    expect(targetMatchesKind('', 'embedding')).toBe(false)
    expect(targetMatchesKind('llm', 'embedding')).toBe(false)
  })

  it('matches embedding and reranker categories', () => {
    expect(targetMatchesKind('embedding', 'embedding')).toBe(true)
    expect(targetMatchesKind('embedding', 'chat')).toBe(false)
    expect(targetMatchesKind('reranker', 'rerank')).toBe(true)
    expect(targetMatchesKind('reranker', 'chat')).toBe(false)
  })
})

describe('categoriesMatchKind', () => {
  it('treats an empty list as chat-only', () => {
    expect(categoriesMatchKind([], 'chat')).toBe(true)
    expect(categoriesMatchKind(null, 'chat')).toBe(true)
    expect(categoriesMatchKind([], 'embedding')).toBe(false)
  })

  it('matches any of several categories', () => {
    expect(categoriesMatchKind(['embedding', 'llm'], 'embedding')).toBe(true)
    expect(categoriesMatchKind(['embedding', 'llm'], 'chat')).toBe(true)
    expect(categoriesMatchKind(['reranker', 'llm'], 'embedding')).toBe(false)
  })

  it('normalizes casing and blanks', () => {
    expect(categoriesMatchKind([' Embedding '], 'embedding')).toBe(true)
    expect(categoriesMatchKind(['', 'embedding'], 'chat')).toBe(false)
  })
})

describe('filterTargetsByKind', () => {
  const targets = [
    { id: 'embed-1', categories: ['embedding'] },
    { id: 'rerank-1', categories: ['reranker'] },
    { id: 'chat-1', categories: ['llm'] },
    { id: 'legacy-1', categories: [] },
  ]

  it('lists only embedding-capable targets for the embedding playground', () => {
    expect(filterTargetsByKind(targets, 'embedding').map(t => t.id)).toEqual(['embed-1'])
  })

  it('lists only reranker targets for the rerank playground', () => {
    expect(filterTargetsByKind(targets, 'rerank').map(t => t.id)).toEqual(['rerank-1'])
  })

  it('lists chat and legacy targets for the chat playground', () => {
    expect(filterTargetsByKind(targets, 'chat').map(t => t.id)).toEqual(['chat-1', 'legacy-1'])
  })

  it('tolerates malformed rows', () => {
    expect(filterTargetsByKind([null, undefined, {}], 'embedding')).toEqual([])
  })
})

describe('filterServableDeploymentTargets', () => {
  it('drops deployments scaled to zero', () => {
    const rows = [
      { id: 'dep-1', replicas: 1 },
      { id: 'dep-0', replicas: 0 },
      { id: 'dep-2', replicas: 2 },
    ]
    expect(filterServableDeploymentTargets(rows).map(r => r.id)).toEqual(['dep-1', 'dep-2'])
  })

  it('keeps rows whose replicas is unknown', () => {
    expect(filterServableDeploymentTargets([{ id: 'legacy' }]).map(r => r.id)).toEqual(['legacy'])
  })

  it('tolerates malformed input', () => {
    expect(filterServableDeploymentTargets()).toEqual([])
    expect(filterServableDeploymentTargets([null, undefined])).toEqual([])
  })
})

describe('filterServableRoutingTargets', () => {
  it('drops disabled routings (scale-to-zero) but keeps enabled and legacy rows', () => {
    const rows = [
      { id: 'enabled', enabled: true },
      { id: 'disabled', enabled: false },
      { id: 'legacy' },
    ]
    expect(filterServableRoutingTargets(rows).map(r => r.id)).toEqual(['enabled', 'legacy'])
  })

  it('tolerates malformed input', () => {
    expect(filterServableRoutingTargets()).toEqual([])
    expect(filterServableRoutingTargets([null])).toEqual([])
  })
})

describe('collectRoutingCategories', () => {
  const categoryByModelId = {
    'model-emb': 'embedding',
    'model-chat': 'llm',
    'model-rerank': 'Reranker',
  }

  it('unions enabled model categories', () => {
    const routing = {
      routing_models: [
        { ai_model_id: 'model-emb', enabled: true },
        { ai_model_id: 'model-rerank', enabled: true },
      ],
    }
    expect(collectRoutingCategories(routing, categoryByModelId)).toEqual(['embedding', 'reranker'])
  })

  it('skips disabled and unknown models', () => {
    const routing = {
      routing_models: [
        { ai_model_id: 'model-emb', enabled: false },
        { ai_model_id: 'model-chat', enabled: true },
        { ai_model_id: 'model-missing', enabled: true },
      ],
    }
    expect(collectRoutingCategories(routing, categoryByModelId)).toEqual(['llm'])
  })

  it('returns empty for routings without models', () => {
    expect(collectRoutingCategories({}, categoryByModelId)).toEqual([])
    expect(collectRoutingCategories(null, categoryByModelId)).toEqual([])
  })
})
