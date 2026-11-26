<template>
  <detail :onManager="onManager" :data="data" :base-info="baseInfo" resource="ai_models" />
</template>

<script>
import AiproxyProviderLinkDetailMixin from '@Ai/mixins/aiproxyProviderLinkDetailMixin'
import { getAiProviderDetailField, getVisualProviderDetailField } from '@Ai/utils/aiproxyLlmLinkColumns'
import { aiModelCategoryI18nKey, normalizeAiModelCategory } from '@Ai/constants/aiModelCategory'
import { getEnabledTableColumn, getProjectTableColumn, getTimeTableColumn } from '@/utils/common/tableColumn'

export default {
  name: 'AiModelDetail',
  mixins: [AiproxyProviderLinkDetailMixin],
  props: {
    data: { type: Object, required: true },
    onManager: { type: Function, required: true },
  },
  computed: {
    visualConfig () {
      return this.data.config?.extensions?.visual || {}
    },
    category () {
      return normalizeAiModelCategory(this.data.config?.category)
    },
    isChatModel () {
      return !this.category || this.category === 'llm'
    },
    baseInfo () {
      const info = [
        getEnabledTableColumn(),
        getAiProviderDetailField(this, {
          providerName: this.aiProviderDetailName,
          providerKey: this.aiProviderDetailKey,
        }),
        { field: 'model_key', title: this.$t('aice.aiproxy.model_key') },
        {
          field: 'category',
          title: this.$t('aice.aiproxy.category'),
          formatter: () => (this.category ? this.$t(aiModelCategoryI18nKey(this.category)) : '-'),
        },
        {
          field: 'context_window',
          title: this.$t('aice.aiproxy.context_window'),
          formatter: ({ row }) => row.context_window || '-',
        },
        {
          field: 'input_modalities',
          title: this.$t('aice.aiproxy.input_modalities'),
          formatter: ({ row }) => (Array.isArray(row.input_modalities) && row.input_modalities.length ? row.input_modalities.join(', ') : '-'),
        },
      ]
      // Vision delegation only applies to chat models; hide the block for
      // embedding/reranker rows so the detail page stays readable.
      if (this.isChatModel) {
        info.push(
          {
            field: 'visual_enabled',
            title: this.$t('aice.aiproxy.visual_enabled'),
            formatter: () => (this.visualConfig.enabled ? this.$t('status.enabled.true') : this.$t('status.enabled.false')),
          },
          getVisualProviderDetailField(this, {
            providerName: this.visualProviderDetailName,
            providerKey: this.visualProviderDetailKey,
          }),
          {
            field: 'visual_model_key',
            title: this.$t('aice.aiproxy.visual_model_key'),
            formatter: ({ row }) => row.visual_model_key || '-',
          },
          {
            field: 'visual_max_rounds',
            title: this.$t('aice.aiproxy.visual_max_rounds'),
            formatter: () => this.visualConfig.max_rounds || '-',
          },
          {
            field: 'visual_max_tokens',
            title: this.$t('aice.aiproxy.visual_max_tokens'),
            formatter: () => this.visualConfig.max_tokens || '-',
          },
        )
      }
      info.push(getProjectTableColumn(), getTimeTableColumn())
      return info
    },
  },
}
</script>
