/**
 * Model serving categories shared by aiproxy ai_model and llm_sku.
 * Values mirror backend pkg/apis/aiproxy model_category.go / pkg/apis/llm LLM_MODEL_CATEGORY_*.
 */

export const AI_MODEL_CATEGORIES = [
  'llm',
  'embedding',
  'reranker',
  'image',
  'speech_to_text',
  'text_to_speech',
]

/** i18n suffix used by aice.llm_catalog.category.* (stt/tts differ from the raw value). */
const CATEGORY_I18N_SUFFIX = {
  llm: 'llm',
  embedding: 'embedding',
  reranker: 'reranker',
  image: 'image',
  speech_to_text: 'stt',
  text_to_speech: 'tts',
}

export function normalizeAiModelCategory (value) {
  return String(value || '').trim().toLowerCase()
}

/** Empty category is legacy data and behaves like `llm` on the backend. */
export function isChatCategory (value) {
  const v = normalizeAiModelCategory(value)
  return v === '' || v === 'llm'
}

export function isEmbeddingCategory (value) {
  return normalizeAiModelCategory(value) === 'embedding'
}

export function isRerankCategory (value) {
  return normalizeAiModelCategory(value) === 'reranker'
}

export function aiModelCategoryI18nKey (value) {
  const v = normalizeAiModelCategory(value) || 'llm'
  const suffix = CATEGORY_I18N_SUFFIX[v] || v
  return `aice.llm_catalog.category.${suffix}`
}

/**
 * Ant Design Tag color for a category, aligned with GPUStack model-tag.tsx.
 * Unknown values return undefined so the tag uses the default gray style.
 */
const CATEGORY_TAG_COLOR = {
  llm: 'green',
  embedding: 'magenta',
  reranker: 'cyan',
  image: 'orange',
  speech_to_text: 'processing',
  text_to_speech: 'geekblue',
}

export function aiModelCategoryTagColor (value) {
  const v = normalizeAiModelCategory(value)
  return CATEGORY_TAG_COLOR[v]
}

/**
 * Dropdown options for selects; `vm` may be a component (uses $t) or omitted
 * (caller-provided translator).
 */
export function aiModelCategoryOptions (t) {
  const translate = typeof t === 'function' ? t : (k) => k
  return AI_MODEL_CATEGORIES.map(value => ({
    value,
    label: translate(aiModelCategoryI18nKey(value)),
  }))
}

/**
 * Effective serving category for a category list, mirroring backend
 * aiproxyModelConfigForCategories: embedding wins over reranker, otherwise the
 * first listed category is used. Empty input returns '' (unknown).
 */
export function resolveModelCategoryFromList (list) {
  const cats = []
  for (const raw of list || []) {
    const v = normalizeAiModelCategory(raw)
    if (v && !cats.includes(v)) cats.push(v)
  }
  if (cats.includes('embedding')) return 'embedding'
  if (cats.includes('reranker')) return 'reranker'
  return cats[0] || ''
}

/** Normalize a category list: lowercase, trim, de-dup; empty falls back to ['llm']. */
export function normalizeAiModelCategoryList (list) {
  const out = []
  const seen = new Set()
  for (const raw of list || []) {
    const v = normalizeAiModelCategory(raw)
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out.length ? out : ['llm']
}
