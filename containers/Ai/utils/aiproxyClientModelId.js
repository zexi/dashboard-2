/**
 * Client-facing model ids for aiproxy routing (mirrors backend list_models.go).
 */

import { Manager } from '@/utils/manager'
import { getAiproxyResourceScope } from '@Ai/constants/aiproxyResources'
import { fetchRoutingModelsForRouting } from '@Ai/utils/aiProviderKind'
import {
  isChatCategory,
  isEmbeddingCategory,
  isRerankCategory,
  normalizeAiModelCategory,
} from '../constants/aiModelCategory'

export const CLAUDE_CODE_ENV_MODEL_FIELDS = [
  { key: 'model', labelKey: 'aice.aiproxy.claude_env.ANTHROPIC_MODEL', envVar: 'ANTHROPIC_MODEL' },
  { key: 'opusModel', labelKey: 'aice.aiproxy.claude_env.ANTHROPIC_DEFAULT_OPUS_MODEL', envVar: 'ANTHROPIC_DEFAULT_OPUS_MODEL' },
  { key: 'sonnetModel', labelKey: 'aice.aiproxy.claude_env.ANTHROPIC_DEFAULT_SONNET_MODEL', envVar: 'ANTHROPIC_DEFAULT_SONNET_MODEL' },
  { key: 'haikuModel', labelKey: 'aice.aiproxy.claude_env.ANTHROPIC_DEFAULT_HAIKU_MODEL', envVar: 'ANTHROPIC_DEFAULT_HAIKU_MODEL' },
  { key: 'subagentModel', labelKey: 'aice.aiproxy.claude_env.CLAUDE_CODE_SUBAGENT_MODEL', envVar: 'CLAUDE_CODE_SUBAGENT_MODEL' },
]

function trim (s) {
  return String(s || '').trim()
}

export function clientFacingModelId (routing, entry, catalogModel) {
  if (entry) {
    const mp = trim(entry.model_pattern)
    if (mp && !mp.includes('*')) {
      return mp
    }
  }
  if (routing) {
    const mp = trim(routing.model_pattern)
    if (mp && !mp.includes('*')) {
      return mp
    }
  }
  if (catalogModel) {
    return trim(catalogModel.model_key)
  }
  return ''
}

export function hierarchicalClientModelId (routing, entry, catalogModel) {
  if (!routing) return ''
  const routeKey = trim(routing.model_key)
  if (!routeKey) return ''
  const part = clientFacingModelId(routing, entry, catalogModel)
  if (!part) return ''
  return `${routeKey}/${part}`
}

export function listClientModelIdForEntry (routing, entry, catalogModel) {
  const routeKey = trim(routing?.model_key)
  if (routeKey) {
    return hierarchicalClientModelId(routing, entry, catalogModel)
  }
  return clientFacingModelId(routing, entry, catalogModel)
}

function catalogContextWindow (catalog) {
  const n = Number(catalog?.context_window)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function catalogCategory (catalog) {
  return normalizeAiModelCategory(catalog?.config?.category)
}

function uniqueClientFacingParts (routing, entries, catalogModelsById) {
  const parts = new Set()
  for (const entry of entries) {
    const catalog = catalogModelsById[entry.ai_model_id] || {}
    const part = clientFacingModelId(routing, entry, catalog)
    if (part) parts.add(part)
  }
  return parts
}

/**
 * Build selectable client model options for access panel.
 * Hierarchical ids are only emitted when the routing binds more than one unique catalog.
 * Replica rows that share the same catalog part still count as a single model.
 * @returns {{ id: string, kind: 'flat'|'hierarchical', catalogKey: string, contextWindow: number, priority: number }[]}
 */
export function buildRoutingClientModelOptions ({
  routing = {},
  routingModels = [],
  catalogModelsById = {},
} = {}) {
  const entries = [...(routingModels || [])]
    .filter(e => e && e.enabled !== false)
    .sort((a, b) => (a.priority || 0) - (b.priority || 0))

  if (!entries.length) {
    const fallback = trim(routing.model_key)
    return fallback ? [{ id: fallback, kind: 'flat', catalogKey: '', contextWindow: 0, priority: 0 }] : []
  }

  const routeKey = trim(routing.model_key)
  const seen = new Set()
  const options = []

  const push = (opt) => {
    if (!opt?.id || seen.has(opt.id)) return
    seen.add(opt.id)
    options.push(opt)
  }

  const multiCatalog = uniqueClientFacingParts(routing, entries, catalogModelsById).size > 1

  if (routeKey && multiCatalog) {
    push({ id: routeKey, kind: 'flat', catalogKey: '', contextWindow: 0, priority: -1 })
  }

  for (const entry of entries) {
    const catalog = catalogModelsById[entry.ai_model_id] || {}
    const catalogKey = trim(catalog.model_key)
    const contextWindow = catalogContextWindow(catalog)
    const category = catalogCategory(catalog)
    if (routeKey && multiCatalog) {
      const hierarchical = hierarchicalClientModelId(routing, entry, catalog)
      if (hierarchical) {
        push({
          id: hierarchical,
          kind: 'hierarchical',
          catalogKey,
          contextWindow,
          category,
          priority: entry.priority || 0,
        })
      }
      continue
    }
    if (routeKey) {
      push({
        id: routeKey,
        kind: 'flat',
        catalogKey,
        contextWindow,
        category,
        priority: entry.priority || 0,
      })
      continue
    }
    const flat = clientFacingModelId(routing, entry, catalog)
    if (flat) {
      push({
        id: flat,
        kind: 'flat',
        catalogKey,
        contextWindow,
        category,
        priority: entry.priority || 0,
      })
    }
  }

  if (!options.length && routeKey) {
    push({ id: routeKey, kind: 'flat', catalogKey: '', contextWindow: 0, priority: 0 })
  }

  return options
}

export function defaultClientModelOption (options = []) {
  if (!options.length) return ''
  return options.find(o => o.kind === 'flat')?.id || options[0]?.id || ''
}

export function mergeClientModelOptions (...optionLists) {
  const seen = new Set()
  const options = []
  for (const list of optionLists) {
    for (const opt of list || []) {
      if (!opt?.id || seen.has(opt.id)) continue
      seen.add(opt.id)
      options.push(opt)
    }
  }
  return options
}

/**
 * Flat client model ids from LLM deployment aiproxy_bindings.
 *
 * Bindings only carry ai_provider_id (there is no model_key field), so the
 * category is resolved by provider first: every ai_model of one provider is
 * registered from the same deployment and shares its SKU categories.
 * `fallbackCategory` covers deployments whose ai_model rows predate category
 * registration — the deployment details still expose the SKU categories.
 */
export function buildDeploymentClientModelOptions (instances = [], categoryByModelKey = {}, options = {}) {
  const { categoryByProvider = {}, fallbackCategory = '' } = options || {}
  const fallback = normalizeAiModelCategory(fallbackCategory)
  const seen = new Set()
  const out = []
  for (const item of instances || []) {
    const id = trim(item?.client_model_alias)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const catalogKey = trim(item?.model_key) || id
    const providerId = trim(item?.ai_provider_id)
    out.push({
      id,
      kind: 'flat',
      catalogKey,
      contextWindow: 0,
      category: normalizeAiModelCategory(
        categoryByModelKey[catalogKey] || categoryByProvider[providerId] || fallback,
      ),
      priority: 0,
    })
  }
  return out
}

/**
 * Filter client model options for one playground kind.
 * kind: 'chat' | 'embedding' | 'rerank'
 * Unknown (legacy, empty) categories only stay selectable for chat.
 */
export function filterClientModelOptionsByCategory (options = [], kind = 'chat') {
  const list = (options || []).filter(Boolean)
  if (kind === 'embedding') {
    return list.filter(o => isEmbeddingCategory(o.category))
  }
  if (kind === 'rerank') {
    return list.filter(o => isRerankCategory(o.category))
  }
  return list.filter(o => isChatCategory(o.category))
}

async function fetchCatalogModelsById (modelIds, vm) {
  const out = {}
  const ids = [...new Set((modelIds || []).filter(Boolean))]
  if (!ids.length) return out
  const manager = new Manager('ai_models')
  await Promise.all(ids.map(async (id) => {
    try {
      const { data } = await manager.get({
        id,
        params: { scope: getAiproxyResourceScope('ai_models', vm), details: true },
      })
      if (data?.id) {
        out[data.id] = data
      }
    } catch (e) {
      // ignore missing catalog rows
    }
  }))
  return out
}

/**
 * Resolve ai_model config.category for deployment bindings.
 *
 * Bindings have no model_key, so categories are indexed by ai_provider_id
 * (one provider per replica, all its models registered from this deployment).
 * The model_key map is kept for callers that already hold one.
 * Per-provider queries avoid relying on an unsupported `ai_provider_id.in`
 * filter. Failures degrade to empty maps (no filtering).
 * @returns {Promise<{ byModelKey: Object, byProvider: Object }>}
 */
export async function fetchCategoryMapsForBindings (bindings = [], vm) {
  const byModelKey = {}
  const byProvider = {}
  const providerIds = [...new Set((bindings || []).map(b => trim(b?.ai_provider_id)).filter(Boolean))]
  if (!providerIds.length) return { byModelKey, byProvider }
  const manager = new Manager('ai_models')
  const scope = getAiproxyResourceScope('ai_models', vm)
  await Promise.all(providerIds.map(async (providerId) => {
    try {
      const { data: { data = [] } } = await manager.list({
        params: {
          scope,
          details: true,
          limit: 500,
          ai_provider_id: providerId,
        },
      })
      for (const item of data || []) {
        const category = normalizeAiModelCategory(item?.config?.category)
        const key = trim(item?.model_key)
        if (key) byModelKey[key] = category
        if (category && !byProvider[providerId]) byProvider[providerId] = category
      }
    } catch (e) {
      // ignore: the provider's category stays unknown
    }
  }))
  return { byModelKey, byProvider }
}

/** Backward-compatible wrapper returning only the model_key → category map. */
export async function fetchCategoryByModelKeyForBindings (bindings = [], vm) {
  const { byModelKey } = await fetchCategoryMapsForBindings(bindings, vm)
  return byModelKey
}

/**
 * Load routing detail, bindings, and client-facing model options.
 * @returns {{ options: object[], routing: object }}
 */
export async function fetchRoutingClientModelOptions (routingId, routing, vm) {
  routingId = trim(routingId)
  if (!routingId) {
    return { options: [], routing: routing || {} }
  }

  let routingData = routing && Object.keys(routing).length ? { ...routing } : {}
  if (!trim(routingData.model_key)) {
    try {
      const manager = new Manager('ai_routings')
      const { data } = await manager.get({
        id: routingId,
        params: { scope: getAiproxyResourceScope('ai_routings', vm) },
      })
      if (data?.id) {
        routingData = data
      }
    } catch (e) {
      // fall back to partial routing object
    }
  }

  const rows = await fetchRoutingModelsForRouting(routingId, vm)
  const enabledRows = [...(rows || [])]
    .filter(r => r && r.enabled !== false)
    .sort((a, b) => (a.priority || 0) - (b.priority || 0))
  const modelIds = [...new Set(enabledRows.map(r => r.ai_model_id).filter(Boolean))]
  const catalogModelsById = await fetchCatalogModelsById(modelIds, vm)
  const options = buildRoutingClientModelOptions({
    routing: routingData,
    routingModels: enabledRows,
    catalogModelsById,
  })

  return { options, routing: routingData }
}

function findHierarchicalByKeyword (options, keyword) {
  const kw = String(keyword || '').toLowerCase()
  return options.find(o => o.kind === 'hierarchical' && String(o.catalogKey || '').toLowerCase().includes(kw))?.id || ''
}

/**
 * Map Claude Code env vars when routing has multiple catalog models.
 */
export function buildClaudeCodeModelEnv ({
  options = [],
  selectedModel = '',
  routing = {},
} = {}) {
  const flatId = trim(routing.model_key) || options.find(o => o.kind === 'flat')?.id || ''
  const selected = trim(selectedModel) || defaultClientModelOption(options) || flatId || 'your-model'

  const opus = findHierarchicalByKeyword(options, 'opus') || flatId || selected
  const sonnet = findHierarchicalByKeyword(options, 'sonnet') || flatId || selected
  const haiku = findHierarchicalByKeyword(options, 'haiku') || flatId || selected
  const subagent = findHierarchicalByKeyword(options, 'subagent') ||
    findHierarchicalByKeyword(options, 'haiku') ||
    sonnet ||
    selected

  const mainModel = selected || sonnet || flatId || 'your-model'

  return {
    model: mainModel,
    opusModel: opus,
    sonnetModel: sonnet,
    haikuModel: haiku,
    subagentModel: subagent,
  }
}

/** Default per-env model selections for Claude Code UI. */
export function defaultClaudeEnvModelSelections ({
  options = [],
  selectedModel = '',
  routing = {},
} = {}) {
  return buildClaudeCodeModelEnv({ options, selectedModel, routing })
}
