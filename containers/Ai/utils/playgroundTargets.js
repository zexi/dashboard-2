/**
 * Playground target (routing / deployment) options, filtered by the playground
 * kind so an embedding playground does not list chat-only targets.
 *
 * Category sources differ per target type:
 *   - llm_deployments expose the SKU `categories` directly in list/details.
 *   - ai_routings expose derived `categories` on details (enabled binding models).
 * A target with no category at all is legacy chat-only data.
 */

import { Manager } from '@/utils/manager'
import { getAiproxyResourceScope } from '@Ai/constants/aiproxyResources'
import {
  isChatCategory,
  isEmbeddingCategory,
  isRerankCategory,
  normalizeAiModelCategory,
} from '../constants/aiModelCategory'

const TARGET_LIST_LIMIT = 100

/** Does one category serve the playground kind? */
export function targetMatchesKind (category, kind) {
  const cat = normalizeAiModelCategory(category)
  if (kind === 'embedding') return isEmbeddingCategory(cat)
  if (kind === 'rerank') return isRerankCategory(cat)
  return isChatCategory(cat)
}

/**
 * Does a target's category list serve the kind? Multi-category SKUs such as
 * ['embedding', 'llm'] match both the chat and the embedding playground.
 */
export function categoriesMatchKind (categories, kind) {
  const list = (Array.isArray(categories) ? categories : [])
    .map(normalizeAiModelCategory)
    .filter(Boolean)
  if (!list.length) return kind === 'chat'
  return list.some(cat => targetMatchesKind(cat, kind))
}

/** Keep the targets that can serve the kind. */
export function filterTargetsByKind (targets, kind) {
  return (targets || []).filter(t => t && categoriesMatchKind(t.categories, kind))
}

/** Union of the categories of a routing's enabled models. */
export function collectRoutingCategories (routing, categoryByModelId = {}) {
  const out = []
  const seen = new Set()
  for (const item of routing?.routing_models || []) {
    if (!item || item.enabled === false) continue
    const category = normalizeAiModelCategory(categoryByModelId[item.ai_model_id])
    if (!category || seen.has(category)) continue
    seen.add(category)
    out.push(category)
  }
  return out
}

/** Batch-load ai_model id → config.category. Failures degrade to an empty map. */
export async function fetchAiModelCategoryMap (modelIds, vm) {
  const out = {}
  const ids = [...new Set((modelIds || []).filter(Boolean))]
  if (!ids.length) return out
  const manager = new Manager('ai_models')
  try {
    const { data: { data = [] } } = await manager.list({
      params: {
        scope: getAiproxyResourceScope('ai_models', vm),
        details: true,
        limit: ids.length,
        filter: `id.in(${ids.map(id => `'${id}'`).join(',')})`,
      },
    })
    for (const item of data || []) {
      if (!item?.id) continue
      out[item.id] = normalizeAiModelCategory(item?.config?.category)
    }
  } catch (e) {
    return out
  }
  return out
}

/**
 * Drop targets that cannot serve traffic right now.
 *
 * A deployment scaled to zero keeps its ai_routing row (the id stays stable
 * across stop/start) but the routing is disabled and its bindings are cleared,
 * so both must be hidden from the playground. Missing fields count as servable
 * so older backends, which do not return `replicas` / `enabled`, keep working.
 */
export function filterServableDeploymentTargets (rows = []) {
  return (rows || []).filter(row => row && Number(row.replicas) !== 0)
}

export function filterServableRoutingTargets (rows = []) {
  return (rows || []).filter(row => row && row.enabled !== false)
}

export async function fetchDeploymentTargetOptions (vm) {
  const manager = new Manager('llm_deployments')
  const { data: { data = [] } } = await manager.list({
    params: {
      scope: getAiproxyResourceScope('llm_deployments', vm),
      details: true,
      limit: TARGET_LIST_LIMIT,
    },
  })
  return filterServableDeploymentTargets(data).map(row => ({
    id: row.id,
    name: row.name || row.id,
    categories: Array.isArray(row.categories) ? row.categories : [],
  }))
}

export async function fetchRoutingTargetOptions (vm) {
  const manager = new Manager('ai_routings')
  const { data: { data = [] } } = await manager.list({
    params: {
      scope: getAiproxyResourceScope('ai_routings', vm),
      details: true,
      limit: TARGET_LIST_LIMIT,
    },
  })
  // Categories come from ai_routings details (union of enabled binding model categories).
  return filterServableRoutingTargets(data).map(row => ({
    id: row.id,
    name: row.name || row.id,
    categories: Array.isArray(row.categories) ? row.categories : [],
  }))
}

/** Load the target options for one playground kind. */
export async function fetchTargetOptions (targetType, vm) {
  if (targetType === 'deployment') {
    return fetchDeploymentTargetOptions(vm)
  }
  return fetchRoutingTargetOptions(vm)
}
