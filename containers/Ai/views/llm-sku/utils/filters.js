import i18n from '@/locales'
import {
  getNameFilter,
  getStatusFilter,
  getTenantFilter,
  getDomainFilter,
  getCreatedAtFilter,
} from '@/utils/common/tableFilter'
import { aiModelCategoryOptions, normalizeAiModelCategory } from '@Ai/constants/aiModelCategory'
import { LLM_TYPE_OPTIONS } from '../constants/llmTypeConfig'

export const filterOptions = {
  id: {
    label: i18n.t('table.title.id'),
  },
  name: getNameFilter(),
  status: getStatusFilter('llmSku'),
  llm_type: {
    label: i18n.t('aice.llm_type'),
    dropdown: true,
    items: LLM_TYPE_OPTIONS.map(opt => ({ key: opt.id, label: i18n.t(opt.name) })),
    filter: true,
    formatter: val => `llm_type.equals('${val}')`,
  },
  // categories is a JSON list column, not searchable: send it as a plain query
  // param (backend LLMSkuListInput.Categories does a contains match).
  categories: {
    label: i18n.t('aice.llm_sku.categories'),
    dropdown: true,
    items: aiModelCategoryOptions(k => i18n.t(k)).map(opt => ({ key: opt.value, label: opt.label })),
    formatter: val => normalizeAiModelCategory(val),
  },
  projects: getTenantFilter(),
  project_domains: getDomainFilter(),
  image: getNameFilter({ label: i18n.t('aice.image') }),
  llm_model_name: getNameFilter({ label: i18n.t('aice.model_name') }),
  created_at: getCreatedAtFilter(),
}
