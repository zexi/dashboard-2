<template>
  <div class="playground-embedding">
    <playground-toolbar
      kind="embedding"
      :initial-model="initialModel"
      :initial-target-type="initialTargetType"
      :initial-target-id="initialTargetId"
      :initial-virtual-key-id="initialVirtualKeyId"
      @change="onToolbarChange" />

    <a-card size="small" class="mb-3">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div class="playground-section-title">{{ $t('aice.aiproxy.playground.embedding.input') }}</div>
        <div class="playground-doc-actions">
          <span class="mr-2 text-color-help">{{ $t('aice.aiproxy.playground.batch_mode') }}</span>
          <a-switch v-model="batchMode" size="small" class="mr-3" />
          <a-button
            v-if="!batchMode"
            size="small"
            icon="plus"
            class="mr-2"
            @click="addInput">
            {{ $t('aice.aiproxy.playground.embedding.add_input') }}
          </a-button>
          <a-button size="small" icon="delete" :disabled="loading" @click="reset">
            {{ $t('aice.aiproxy.playground.clear') }}
          </a-button>
        </div>
      </div>

      <a-textarea
        v-if="batchMode"
        v-model="batchText"
        class="playground-limited"
        :rows="6"
        :placeholder="$t('aice.aiproxy.playground.batch_placeholder')" />
      <div v-else class="playground-doc-list playground-limited">
        <div
          v-for="(row, index) in inputs"
          :key="row.key"
          class="playground-doc-card">
          <div class="playground-doc-card__head">
            <a-textarea
              v-model="row.text"
              :auto-size="{ minRows: 1, maxRows: 4 }"
              :placeholder="$t('aice.aiproxy.playground.embedding.input_placeholder')" />
            <a-button
              class="playground-doc-card__remove"
              type="link"
              icon="delete"
              :disabled="inputs.length <= 2"
              @click="removeInput(index)" />
          </div>
        </div>
      </div>

      <a-row :gutter="16" class="mt-3">
        <a-col :span="8">
          <div class="playground-field-label">{{ $t('aice.aiproxy.playground.embedding.dimensions') }}</div>
          <a-input-number
            v-model="dimensions"
            :min="1"
            style="width: 100%"
            :placeholder="$t('aice.aiproxy.playground.optional')" />
        </a-col>
        <a-col :span="8">
          <div class="playground-field-label">{{ $t('aice.aiproxy.playground.embedding.encoding_format') }}</div>
          <a-select v-model="encodingFormat" style="width: 100%">
            <a-select-option value="float">float</a-select-option>
            <a-select-option value="base64">base64</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="8" class="d-flex align-items-end">
          <a-button type="primary" :loading="loading" @click="submit">
            {{ $t('aice.aiproxy.playground.submit') }}
          </a-button>
        </a-col>
      </a-row>
    </a-card>

    <a-alert v-if="errorMessage" type="error" show-icon :message="errorMessage" class="mb-3" />

    <template v-if="result">
      <a-card size="small" class="mb-3">
        <div class="d-flex align-items-center justify-content-between">
          <div>
            <span class="mr-4">{{ $t('aice.aiproxy.playground.embedding.vectors') }}: {{ result.vectors }}</span>
            <span class="mr-4">{{ $t('aice.aiproxy.playground.embedding.dimension') }}: {{ result.dimension || '-' }}</span>
            <span>{{ $t('aice.aiproxy.playground.token_usage') }}: {{ result.promptTokens }}</span>
          </div>
          <a-button size="small" @click="toggleCode">
            {{ $t('aice.aiproxy.playground.view_code') }}
          </a-button>
        </div>
      </a-card>

      <a-collapse v-model="codePanel" class="mb-3">
        <a-collapse-panel v-if="codeVisible" key="code" :header="$t('aice.aiproxy.playground.view_code')">
          <a-tabs v-model="codeTab" size="small">
            <a-tab-pane key="curl" tab="curl">
              <pre class="playground-code">{{ code.curl }}</pre>
            </a-tab-pane>
            <a-tab-pane key="python" tab="Python">
              <pre class="playground-code">{{ code.python }}</pre>
            </a-tab-pane>
            <a-tab-pane key="node" tab="Node.js">
              <pre class="playground-code">{{ code.node }}</pre>
            </a-tab-pane>
          </a-tabs>
        </a-collapse-panel>
      </a-collapse>

      <a-card size="small">
        <a-tabs v-model="resultTab" size="small">
          <a-tab-pane key="chart" :tab="$t('aice.aiproxy.playground.embedding.chart')">
            <a-alert
              v-if="!canVisualize"
              type="info"
              show-icon
              :message="$t('aice.aiproxy.playground.embedding.visualize_unsupported')" />
            <template v-else>
              <e-chart
                :options="chartOptions"
                :autoresize="true"
                style="width: 100%; height: 360px;" />
              <div class="playground-chart-caption text-color-help mt-2">
                <p class="mb-1">{{ $t('aice.aiproxy.playground.embedding.chart_hint_pca') }}</p>
                <p class="mb-0">{{ $t('aice.aiproxy.playground.embedding.chart_hint_similarity') }}</p>
              </div>
            </template>
          </a-tab-pane>
          <a-tab-pane key="json" :tab="'JSON'">
            <pre class="playground-code">{{ jsonText }}</pre>
          </a-tab-pane>
        </a-tabs>
      </a-card>
    </template>
  </div>
</template>

<script>
import 'echarts/lib/chart/scatter'
import 'echarts/lib/component/tooltip'
import 'echarts/lib/component/grid'
import EChart from '@/components/EChart'
import { computePca2D } from '@Ai/utils/pca'
import { buildCodeSnippets, buildEmbeddingPayload } from '@Ai/utils/playgroundCode'
import { buildEmbeddingsUrl, rewriteAiproxyUrlForBrowser } from '@Ai/utils/aiproxyEndpoint'
import { uuid } from '@/utils/utils'
import PlaygroundToolbar from '../components/PlaygroundToolbar'

export default {
  name: 'AiPlaygroundEmbedding',
  components: { PlaygroundToolbar, EChart },
  props: {
    initialModel: { type: String, default: '' },
    initialTargetType: { type: String, default: 'deployment' },
    initialTargetId: { type: String, default: '' },
    initialVirtualKeyId: { type: String, default: '' },
  },
  data () {
    return {
      selection: null,
      // Sample texts are clustered on purpose: two cafe questions, a place to
      // study, and two unrelated facts. The PCA scatter then shows the
      // "closer points = higher similarity" hint from the chart caption.
      // Locale-aware via i18n (zh-CN Chinese; other languages English).
      inputs: [1, 2, 3, 4, 5].map(i => ({
        key: uuid(),
        text: this.$t(`aice.aiproxy.playground.embedding.sample_input_${i}`),
      })),
      batchMode: false,
      batchText: this.$t('aice.aiproxy.playground.embedding.sample_batch'),
      dimensions: undefined,
      encodingFormat: 'float',
      loading: false,
      errorMessage: '',
      rawResponse: null,
      codeVisible: false,
      codePanel: [],
      codeTab: 'curl',
      resultTab: 'chart',
    }
  },
  computed: {
    texts () {
      if (this.batchMode) {
        return String(this.batchText || '')
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean)
      }
      return this.inputs.map(i => String(i.text || '').trim()).filter(Boolean)
    },
    endpoint () {
      return this.selection?.openaiBase ? buildEmbeddingsUrl(this.selection.openaiBase) : ''
    },
    payload () {
      return buildEmbeddingPayload({
        model: this.selection?.model,
        input: this.texts,
        dimensions: this.dimensions,
        encodingFormat: this.encodingFormat,
      })
    },
    result () {
      const resp = this.rawResponse
      if (!resp) return null
      const data = Array.isArray(resp.data) ? resp.data : []
      const first = data[0]?.embedding
      return {
        vectors: data.length,
        dimension: Array.isArray(first) ? first.length : 0,
        promptTokens: resp.usage?.prompt_tokens ?? resp.usage?.total_tokens ?? 0,
        isBase64: typeof first === 'string',
      }
    },
    canVisualize () {
      return this.result && !this.result.isBase64 && this.result.dimension > 0 && this.texts.length > 1
    },
    chartOptions () {
      const vectors = (this.rawResponse?.data || []).map(d => d.embedding).filter(Array.isArray)
      const points = computePca2D(vectors)
      return {
        tooltip: {
          formatter: params => {
            const p = params.data
            return `${p.name}<br/>x=${p.value[0].toFixed(4)}<br/>y=${p.value[1].toFixed(4)}`
          },
        },
        xAxis: { type: 'value', name: 'PC1', scale: true },
        yAxis: { type: 'value', name: 'PC2', scale: true },
        series: [{
          type: 'scatter',
          symbolSize: 12,
          data: points.map((p, idx) => ({
            name: this.texts[idx] || `#${idx + 1}`,
            value: [p.x, p.y],
          })),
        }],
      }
    },
    jsonText () {
      return JSON.stringify(this.rawResponse || {}, null, 2)
    },
    code () {
      return buildCodeSnippets({
        endpoint: this.endpoint,
        virtualKey: this.selection?.virtualKey,
        payload: this.payload,
        kind: 'embeddings',
      })
    },
  },
  methods: {
    onToolbarChange (selection) {
      this.selection = selection
    },
    /**
     * Resolve the virtual key, waiting for a pending secret fetch. The toolbar
     * emits the key id synchronously and the secret asynchronously, so a submit
     * landing in between would otherwise report "select a virtual key first".
     * Returns the usable secret ('' when none is available).
     */
    async ensureVirtualKeyReady () {
      const pending = this.selection?.virtualKeyFetchPromise
      if (pending) {
        try {
          const secret = await pending
          if (secret) return secret
        } catch (e) {
          // the mixin already reset the key on failure
        }
      }
      return this.selection?.virtualKey || ''
    },
    addInput () {
      this.inputs.push({ key: uuid(), text: '' })
    },
    removeInput (index) {
      if (this.inputs.length <= 2) return
      this.inputs.splice(index, 1)
    },
    reset () {
      this.rawResponse = null
      this.errorMessage = ''
    },
    async submit () {
      this.errorMessage = ''
      if (!this.endpoint) {
        this.errorMessage = this.$t('aice.aiproxy.playground.endpoint_missing')
        return
      }
      // Picking a virtual key stores its id immediately but the secret arrives
      // from a follow-up request. Wait for it so the first submit already has
      // the key instead of asking the user to pick it twice.
      const virtualKey = await this.ensureVirtualKeyReady()
      if (!virtualKey) {
        this.errorMessage = this.$t('aice.aiproxy.playground.vk_missing')
        return
      }
      if (!this.selection?.model) {
        this.errorMessage = this.$t('aice.aiproxy.playground.model_missing')
        return
      }
      if (!this.texts.length) {
        this.errorMessage = this.$t('aice.aiproxy.playground.embedding.input_required')
        return
      }
      this.loading = true
      try {
        const apiBase = this.$http.defaults.baseURL || process.env.VUE_APP_BASE_API || '/api'
        const feedUrl = rewriteAiproxyUrlForBrowser(this.endpoint, apiBase)
        const response = await fetch(feedUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${virtualKey}`,
          },
          credentials: 'include',
          body: JSON.stringify(this.payload),
        })
        const text = await response.text()
        if (!response.ok) {
          this.errorMessage = this.extractError(text, response.status)
          return
        }
        this.rawResponse = JSON.parse(text)
      } catch (e) {
        this.errorMessage = String(e?.message || e)
      } finally {
        this.loading = false
      }
    },
    toggleCode () {
      this.codeVisible = !this.codeVisible
      this.codePanel = this.codeVisible ? ['code'] : []
    },
    extractError (text, status) {
      const raw = String(text || '').trim()
      if (raw) {
        try {
          const data = JSON.parse(raw)
          const msg = data?.error?.message || data?.message
          if (msg) return msg
        } catch (e) {
          // not JSON
        }
        return raw.length > 300 ? raw.slice(0, 300) : raw
      }
      return `HTTP ${status}`
    },
  },
}
</script>

<style lang="less" scoped>
@import '../playground-shared.less';

.playground-chart-caption {
  font-size: 12px;
  line-height: 1.6;
}
</style>
