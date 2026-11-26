<template>
  <a-card size="small" class="playground-toolbar mb-3">
    <div class="playground-toolbar__row">
      <div class="playground-toolbar__field playground-toolbar__field--target">
        <div class="playground-field-label">{{ $t('aice.aiproxy.playground.target') }}</div>
        <a-radio-group v-model="targetType" size="small" button-style="solid" @change="onTargetTypeChange">
          <a-radio-button value="deployment">{{ $t('aice.llm_deployment') }}</a-radio-button>
          <a-radio-button value="routing">{{ $t('aice.aiproxy.routing') }}</a-radio-button>
        </a-radio-group>
      </div>
      <div class="playground-toolbar__field">
        <div class="playground-field-label">
          {{ targetType === 'deployment'
            ? $t('aice.aiproxy.playground.select_deployment')
            : $t('aice.aiproxy.playground.select_routing') }}
        </div>
        <base-select
          v-model="selectedTargetId"
          :resource="targetType === 'routing' ? 'ai_routings' : 'llm_deployments'"
          :options="targetSelectOptions"
          filterable
          version="v2"
          :select-props="{ placeholder: $t('common.tips.select', [$t('aice.aiproxy.playground.target')]), loading: targetsLoading }"
          @change="onTargetChange" />
      </div>
      <div class="playground-toolbar__field">
        <div class="playground-field-label">{{ $t('aice.aiproxy.client_model_select') }}</div>
        <a-select
          v-model="selectedModelId"
          style="width: 100%"
          :loading="modelsLoading"
          :dropdown-match-select-width="false"
          :placeholder="$t('aice.aiproxy.client_model_select')"
          :not-found-content="modelsEmptyText"
          @change="onModelChange">
          <a-select-option v-for="opt in filteredModelOptions" :key="opt.id" :value="opt.id">
            {{ opt.id }}
          </a-select-option>
        </a-select>
      </div>
      <div class="playground-toolbar__field">
        <div class="playground-field-label">{{ $t('aice.aiproxy.virtual_key') }}</div>
        <base-select
          v-model="selectedVirtualKeyId"
          resource="ai_virtual_keys"
          :params="virtualKeySelectParams"
          :extra-opts="virtualKeyExtraOpts"
          filterable
          version="v2"
          :loading="virtualKeyLoading"
          :select-props="{ placeholder: $t('common.tips.select', [$t('aice.aiproxy.virtual_key')]) }"
          @change="onVirtualKeyChange" />
      </div>
    </div>
    <a-alert
      v-if="noCategoryTargetHint"
      class="mt-3 mb-0"
      type="warning"
      show-icon
      :message="noCategoryTargetHint" />
    <a-alert
      v-if="noCategoryModelHint"
      class="mt-3 mb-0"
      type="warning"
      show-icon
      :message="noCategoryModelHint" />
  </a-card>
</template>

<script>
import { Manager } from '@/utils/manager'
import { getAiproxyResourceScope } from '@Ai/constants/aiproxyResources'
import AiproxyVirtualKeySelectMixin from '@Ai/mixins/aiproxyVirtualKeySelectMixin'
import { resolveModelCategoryFromList } from '@Ai/constants/aiModelCategory'
import {
  buildDeploymentClientModelOptions,
  defaultClientModelOption,
  fetchCategoryMapsForBindings,
  fetchRoutingClientModelOptions,
  filterClientModelOptionsByCategory,
} from '@Ai/utils/aiproxyClientModelId'
import { resolveAiproxyBaseUrl } from '@Ai/utils/aiproxyEndpoint'
import {
  filterTargetsByKind,
  fetchTargetOptions,
} from '@Ai/utils/playgroundTargets'

const CATEGORY_KIND_LABEL = {
  chat: 'chat',
  embedding: 'embedding',
  rerank: 'rerank',
}

/**
 * Shared playground controls: target (routing/deployment), virtual key and a
 * model dropdown filtered by the current playground kind.
 */
export default {
  name: 'PlaygroundToolbar',
  mixins: [AiproxyVirtualKeySelectMixin],
  props: {
    kind: {
      type: String,
      default: 'chat',
      validator: v => ['chat', 'embedding', 'rerank'].includes(v),
    },
    initialTargetType: {
      type: String,
      default: 'deployment',
    },
    initialTargetId: {
      type: String,
      default: '',
    },
    initialModel: {
      type: String,
      default: '',
    },
    initialVirtualKeyId: {
      type: String,
      default: '',
    },
  },
  data () {
    return {
      targetType: this.initialTargetType === 'routing' ? 'routing' : 'deployment',
      selectedTargetId: this.initialTargetId || '',
      targetRecord: null,
      targetOptions: [],
      targetsLoading: false,
      selectedModelId: this.initialModel || '',
      modelOptions: [],
      modelsLoading: false,
      openaiBase: '',
    }
  },
  computed: {
    /** Targets that can serve the current kind (embedding playground lists embedding targets only). */
    kindTargetOptions () {
      return filterTargetsByKind(this.targetOptions, this.kind)
    },
    /**
     * BaseSelect `options` prop: only targets that serve the current kind. A deep
     * linked target (`?routing=` / `?deployment=`) is kept so its name renders
     * instead of a raw id; the category mismatch gets its own hint.
     */
    targetSelectOptions () {
      const list = this.kindTargetOptions.map(t => ({ id: t.id, name: t.name }))
      if (this.selectedTargetId && !list.some(t => t.id === this.selectedTargetId)) {
        const selected = this.targetOptions.find(t => t.id === this.selectedTargetId)
        if (selected) list.unshift({ id: selected.id, name: selected.name })
      }
      return list
    },
    /** The selected target exists but cannot serve the current kind. */
    selectedTargetMismatch () {
      const id = String(this.selectedTargetId || '').trim()
      if (!id) return false
      return !this.kindTargetOptions.some(t => t.id === id)
    },
    noCategoryTargetHint () {
      if (this.targetsLoading) return ''
      if (this.selectedTargetMismatch) {
        return this.$t('aice.aiproxy.playground.selected_target_mismatch', {
          kind: this.kindLabel,
          target: this.targetLabel,
        })
      }
      if (this.kindTargetOptions.length) return ''
      return this.$t('aice.aiproxy.playground.no_category_targets', {
        kind: this.kindLabel,
        target: this.targetLabel,
      })
    },
    kindLabel () {
      return this.$t(`aice.aiproxy.playground.kind.${CATEGORY_KIND_LABEL[this.kind] || 'chat'}`)
    },
    targetLabel () {
      return this.targetType === 'routing'
        ? this.$t('aice.aiproxy.routing')
        : this.$t('aice.llm_deployment')
    },
    filteredModelOptions () {
      return filterClientModelOptionsByCategory(this.modelOptions, this.kind)
    },
    modelsEmptyText () {
      return this.$t('aice.aiproxy.playground.no_models')
    },
    noCategoryModelHint () {
      if (!this.modelOptions.length) return ''
      if (this.filteredModelOptions.length) return ''
      return this.$t('aice.aiproxy.playground.no_category_models', {
        kind: this.kindLabel,
      })
    },
    selectedModelOption () {
      return this.modelOptions.find(o => o.id === this.selectedModelId) || null
    },
  },
  watch: {
    kind () {
      this.applyModelSelection()
    },
    selectedVirtualKeyId () {
      this.emitChange()
    },
    // emitChange does not fire when only the secret resolves; consumers such as
    // the embedding submit button need the resolved key, so re-emit on it.
    selectedVirtualKey () {
      this.emitChange()
    },
  },
  mounted () {
    if (this.initialVirtualKeyId) {
      this.selectedVirtualKeyId = this.initialVirtualKeyId
      this.fetchVirtualKeySecret(this.initialVirtualKeyId)
    }
    this.loadTargetOptions(this.selectedTargetId)
  },
  methods: {
    onTargetTypeChange () {
      this.selectedTargetId = ''
      this.targetRecord = null
      this.targetOptions = []
      this.modelOptions = []
      this.selectedModelId = ''
      this.openaiBase = ''
      this.emitChange()
      this.loadTargetOptions('')
    },
    async loadTargetOptions (keepId) {
      this.targetsLoading = true
      try {
        this.targetOptions = await fetchTargetOptions(this.targetType, this)
      } catch (e) {
        this.targetOptions = []
      } finally {
        this.targetsLoading = false
      }
      // A preselected target keeps loading even when it is filtered out, so the
      // deep link still shows its own warning instead of silently doing nothing.
      if (keepId) {
        await this.loadTarget()
      }
    },
    async onTargetChange (id) {
      this.selectedTargetId = String(id || '')
      await this.loadTarget()
    },
    async loadTarget () {
      const id = this.selectedTargetId
      if (!id) {
        this.targetRecord = null
        this.modelOptions = []
        this.selectedModelId = ''
        this.emitChange()
        return
      }
      this.modelsLoading = true
      try {
        const resource = this.targetType === 'routing' ? 'ai_routings' : 'llm_deployments'
        const manager = new Manager(resource)
        const { data } = await manager.get({
          id,
          params: {
            scope: getAiproxyResourceScope(resource, this),
            details: true,
          },
        })
        this.targetRecord = data || null
        await this.loadModelOptions()
        await this.loadOpenaiBase()
      } catch (e) {
        this.targetRecord = null
        this.modelOptions = []
        this.selectedModelId = ''
        this.openaiBase = ''
      } finally {
        this.modelsLoading = false
        this.emitChange()
      }
    },
    async loadModelOptions () {
      const record = this.targetRecord || {}
      const bindings = Array.isArray(record.aiproxy_bindings) ? record.aiproxy_bindings : []
      if (this.targetType === 'deployment' || bindings.length) {
        const { byModelKey, byProvider } = await fetchCategoryMapsForBindings(bindings, this)
        this.modelOptions = buildDeploymentClientModelOptions(bindings, byModelKey, {
          categoryByProvider: byProvider,
          fallbackCategory: resolveModelCategoryFromList(record.categories),
        })
      } else {
        const routingId = record.aiproxy_routing_id || record.id
        if (!routingId) {
          this.modelOptions = []
          return
        }
        const { options } = await fetchRoutingClientModelOptions(routingId, record, this)
        this.modelOptions = options || []
      }
      this.applyModelSelection()
    },
    async loadOpenaiBase () {
      const record = this.targetRecord || {}
      const routingId = this.targetType === 'routing'
        ? (record.id || '')
        : (record.aiproxy_routing_id || '')
      this.openaiBase = await resolveAiproxyBaseUrl(this, { routingId })
    },
    applyModelSelection () {
      const initial = String(this.initialModel || '').trim()
      const candidates = this.filteredModelOptions
      if (initial && candidates.some(o => o.id === initial)) {
        this.selectedModelId = initial
        this.emitChange()
        return
      }
      if (this.selectedModelId && candidates.some(o => o.id === this.selectedModelId)) {
        this.emitChange()
        return
      }
      this.selectedModelId = defaultClientModelOption(candidates) || ''
      this.emitChange()
    },
    onModelChange () {
      this.emitChange()
    },
    emitChange () {
      this.$emit('change', {
        kind: this.kind,
        targetType: this.targetType,
        target: this.targetRecord,
        model: this.selectedModelId,
        modelOption: this.selectedModelOption,
        virtualKey: this.selectedVirtualKey,
        virtualKeyId: this.selectedVirtualKeyId,
        virtualKeyLoading: this.virtualKeyLoading,
        // Expose the pending secret request so a submit handler can await it.
        virtualKeyFetchPromise: this.virtualKeyFetchPromise,
        openaiBase: this.openaiBase,
      })
    },
  },
}
</script>

<style lang="less" scoped>
.playground-toolbar {
  .playground-field-label {
    margin-bottom: 4px;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.45);
  }
  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px 16px;
  }
  &__field {
    flex: 0 1 260px;
    min-width: 180px;
    max-width: 320px;
    ::v-deep .ant-select {
      width: 100%;
    }
  }
  &__field--target {
    flex: 0 0 auto;
    min-width: 0;
    max-width: none;
  }
}
</style>
