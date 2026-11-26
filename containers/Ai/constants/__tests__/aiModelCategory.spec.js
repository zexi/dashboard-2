import {
  AI_MODEL_CATEGORIES,
  aiModelCategoryI18nKey,
  aiModelCategoryOptions,
  aiModelCategoryTagColor,
  isChatCategory,
  isEmbeddingCategory,
  isRerankCategory,
  normalizeAiModelCategory,
  normalizeAiModelCategoryList,
  resolveModelCategoryFromList,
} from '../aiModelCategory'

describe('normalizeAiModelCategory', () => {
  it('trims and lowercases', () => {
    expect(normalizeAiModelCategory('  Embedding ')).toBe('embedding')
    expect(normalizeAiModelCategory(null)).toBe('')
    expect(normalizeAiModelCategory(undefined)).toBe('')
  })
})

describe('isChatCategory', () => {
  it('treats empty as chat for legacy rows', () => {
    expect(isChatCategory('')).toBe(true)
    expect(isChatCategory(null)).toBe(true)
    expect(isChatCategory('llm')).toBe(true)
    expect(isChatCategory('LLM')).toBe(true)
  })

  it('rejects non-chat categories', () => {
    expect(isChatCategory('embedding')).toBe(false)
    expect(isChatCategory('reranker')).toBe(false)
  })
})

describe('isEmbeddingCategory / isRerankCategory', () => {
  it('matches normalized values', () => {
    expect(isEmbeddingCategory(' Embedding')).toBe(true)
    expect(isRerankCategory('RERANKER')).toBe(true)
    expect(isEmbeddingCategory('reranker')).toBe(false)
  })
})

describe('aiModelCategoryI18nKey', () => {
  it('maps stt/tts to their catalog suffixes', () => {
    expect(aiModelCategoryI18nKey('llm')).toBe('aice.llm_catalog.category.llm')
    expect(aiModelCategoryI18nKey('speech_to_text')).toBe('aice.llm_catalog.category.stt')
    expect(aiModelCategoryI18nKey('text_to_speech')).toBe('aice.llm_catalog.category.tts')
    expect(aiModelCategoryI18nKey('')).toBe('aice.llm_catalog.category.llm')
  })
})

describe('aiModelCategoryTagColor', () => {
  it('matches GPUStack category colors', () => {
    expect(aiModelCategoryTagColor('llm')).toBe('green')
    expect(aiModelCategoryTagColor('embedding')).toBe('magenta')
    expect(aiModelCategoryTagColor('reranker')).toBe('cyan')
    expect(aiModelCategoryTagColor('image')).toBe('orange')
    expect(aiModelCategoryTagColor('speech_to_text')).toBe('processing')
    expect(aiModelCategoryTagColor('text_to_speech')).toBe('geekblue')
    expect(aiModelCategoryTagColor('unknown')).toBeUndefined()
  })
})

describe('aiModelCategoryOptions', () => {
  it('returns one option per known category', () => {
    const options = aiModelCategoryOptions(k => k)
    expect(options).toHaveLength(AI_MODEL_CATEGORIES.length)
    expect(options[0]).toEqual({ value: 'llm', label: 'aice.llm_catalog.category.llm' })
  })
})

describe('resolveModelCategoryFromList', () => {
  it('prefers embedding over reranker', () => {
    expect(resolveModelCategoryFromList(['reranker', 'embedding'])).toBe('embedding')
  })

  it('returns the first category for other lists', () => {
    expect(resolveModelCategoryFromList(['llm'])).toBe('llm')
    expect(resolveModelCategoryFromList(['Text_To_Speech', 'llm'])).toBe('text_to_speech')
  })

  it('returns empty for missing data', () => {
    expect(resolveModelCategoryFromList([])).toBe('')
    expect(resolveModelCategoryFromList(null)).toBe('')
  })
})

describe('normalizeAiModelCategoryList', () => {
  it('falls back to llm when empty', () => {
    expect(normalizeAiModelCategoryList([])).toEqual(['llm'])
    expect(normalizeAiModelCategoryList(null)).toEqual(['llm'])
  })

  it('dedupes and normalizes', () => {
    expect(normalizeAiModelCategoryList(['Embedding', 'embedding', ' Reranker ']))
      .toEqual(['embedding', 'reranker'])
  })
})
