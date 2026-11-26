<template>
  <div class="playground-rerank">
    <playground-toolbar
      kind="rerank"
      :initial-model="initialModel"
      :initial-target-type="initialTargetType"
      :initial-target-id="initialTargetId"
      :initial-virtual-key-id="initialVirtualKeyId"
      @change="onToolbarChange" />

    <a-card size="small" class="mb-3">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div class="playground-section-title">{{ $t('aice.aiproxy.playground.rerank.query') }}</div>
        <a-button size="small" :disabled="!rawResponse" @click="toggleCode">
          {{ $t('aice.aiproxy.playground.view_code') }}
        </a-button>
      </div>
      <div class="playground-query-row playground-limited">
        <a-input
          v-model="query"
          class="playground-query-input"
          :placeholder="$t('aice.aiproxy.playground.rerank.query_placeholder')"
          @pressEnter="submit" />
        <a-button
          type="primary"
          class="playground-query-submit"
          :loading="loading"
          @click="submit">
          {{ $t('aice.aiproxy.playground.submit') }}
        </a-button>
      </div>

      <a-row :gutter="16" class="mt-3">
        <a-col :span="6">
          <div class="playground-field-label">{{ $t('aice.aiproxy.playground.rerank.top_n') }}</div>
          <a-input-number
            v-model="topN"
            :min="1"
            style="width: 100%"
            :placeholder="$t('aice.aiproxy.playground.optional')" />
        </a-col>
        <a-col :span="6">
          <div class="playground-field-label">{{ $t('aice.aiproxy.playground.rerank.return_documents') }}</div>
          <a-switch v-model="returnDocuments" />
        </a-col>
      </a-row>

      <a-collapse v-if="codeVisible" v-model="codePanel" class="mt-3">
        <a-collapse-panel key="code" :header="$t('aice.aiproxy.playground.view_code')">
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
    </a-card>

    <a-card size="small" class="mb-3">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div class="playground-section-title">{{ $t('aice.aiproxy.playground.rerank.documents') }}</div>
        <div class="playground-doc-actions">
          <span class="mr-2 text-color-help">{{ $t('aice.aiproxy.playground.batch_mode') }}</span>
          <a-switch v-model="batchMode" size="small" class="mr-3" @change="onBatchModeChange" />
          <a-button
            v-if="!batchMode"
            size="small"
            icon="plus"
            class="mr-2"
            @click="addDocument">
            {{ $t('aice.aiproxy.playground.rerank.add_document') }}
          </a-button>
          <a-button size="small" icon="delete" @click="reset">
            {{ $t('aice.aiproxy.playground.clear') }}
          </a-button>
        </div>
      </div>

      <a-textarea
        v-if="batchMode"
        v-model="batchText"
        class="playground-limited"
        :rows="6"
        :placeholder="$t('aice.aiproxy.playground.batch_placeholder')"
        @change="clearScores" />
      <div v-else class="playground-doc-list playground-limited">
        <div
          v-for="(row, index) in documents"
          :key="row.key"
          class="playground-doc-card">
          <div class="playground-doc-card__head">
            <a-textarea
              v-model="row.text"
              :auto-size="{ minRows: 1, maxRows: 4 }"
              :placeholder="$t('aice.aiproxy.playground.rerank.document_placeholder')"
              @change="clearScores" />
            <a-button
              class="playground-doc-card__remove"
              type="link"
              icon="delete"
              :disabled="documents.length <= 2"
              @click="removeDocument(index)" />
          </div>
          <div v-if="scoreMeta[row.key]" class="playground-doc-card__footer">
            <div class="playground-doc-card__bar">
              <div
                class="playground-doc-card__bar-fill"
                :style="{ width: scoreBarWidth(scoreMeta[row.key].score) }" />
            </div>
            <div class="playground-doc-card__meta">
              <span class="playground-doc-card__rank">
                {{ $t('aice.aiproxy.playground.rerank.rank') }}: {{ scoreMeta[row.key].rank }}
              </span>
              <span class="playground-doc-card__score">
                {{ $t('aice.aiproxy.playground.rerank.score_label') }}:
                {{ formatScore(scoreMeta[row.key].score) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="promptTokens" class="playground-token-usage">
        {{ $t('aice.aiproxy.playground.token_usage') }}: {{ promptTokens }}
      </div>
    </a-card>

    <a-alert v-if="errorMessage" type="error" show-icon :message="errorMessage" class="mb-3" />
  </div>
</template>

<script>
import { buildCodeSnippets, buildRerankPayload } from '@Ai/utils/playgroundCode'
import { buildRerankUrl, rewriteAiproxyUrlForBrowser } from '@Ai/utils/aiproxyEndpoint'
import { uuid } from '@/utils/utils'
import PlaygroundToolbar from '../components/PlaygroundToolbar'

export default {
  name: 'AiPlaygroundRerank',
  components: { PlaygroundToolbar },
  props: {
    initialModel: { type: String, default: '' },
    initialTargetType: { type: String, default: 'deployment' },
    initialTargetId: { type: String, default: '' },
    initialVirtualKeyId: { type: String, default: '' },
  },
  data () {
    return {
      selection: null,
      query: this.$t('aice.aiproxy.playground.rerank.sample_query'),
      documents: this.buildSampleDocuments(),
      batchMode: false,
      batchText: this.$t('aice.aiproxy.playground.rerank.sample_batch'),
      topN: undefined,
      returnDocuments: true,
      loading: false,
      errorMessage: '',
      rawResponse: null,
      // key -> { rank, score }; filled after a successful rerank
      scoreMeta: {},
      codeVisible: false,
      codePanel: [],
      codeTab: 'curl',
    }
  },
  computed: {
    docTexts () {
      if (this.batchMode) {
        return String(this.batchText || '')
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean)
      }
      return this.documents.map(d => String(d.text || '').trim()).filter(Boolean)
    },
    endpoint () {
      return this.selection?.openaiBase ? buildRerankUrl(this.selection.openaiBase) : ''
    },
    payload () {
      return buildRerankPayload({
        model: this.selection?.model,
        query: this.query,
        documents: this.docTexts,
        topN: this.topN,
        returnDocuments: this.returnDocuments,
      })
    },
    promptTokens () {
      return this.rawResponse?.usage?.prompt_tokens ?? this.rawResponse?.usage?.total_tokens ?? 0
    },
    code () {
      return buildCodeSnippets({
        endpoint: this.endpoint,
        virtualKey: this.selection?.virtualKey,
        payload: this.payload,
        kind: 'rerank',
      })
    },
  },
  methods: {
    buildSampleDocuments () {
      return [1, 2, 3].map(i => ({
        key: uuid(),
        text: this.$t(`aice.aiproxy.playground.rerank.sample_doc_${i}`),
      }))
    },
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
    scoreBarWidth (score) {
      const n = Math.max(0, Math.min(1, Number(score) || 0))
      return `${(n * 100).toFixed(1)}%`
    },
    formatScore (score) {
      const n = Number(score)
      if (!Number.isFinite(n)) return '-'
      return n.toFixed(2)
    },
    clearScores () {
      this.rawResponse = null
      this.scoreMeta = {}
      this.codeVisible = false
      this.codePanel = []
    },
    onBatchModeChange (checked) {
      this.clearScores()
      if (checked) {
        this.batchText = this.documents
          .map(d => String(d.text || '').trim())
          .filter(Boolean)
          .join('\n') || this.$t('aice.aiproxy.playground.rerank.sample_batch')
      } else {
        const lines = String(this.batchText || '')
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean)
        if (lines.length >= 2) {
          this.documents = lines.map(text => ({ key: uuid(), text }))
        }
      }
    },
    addDocument () {
      this.clearScores()
      this.documents.push({ key: uuid(), text: '' })
    },
    removeDocument (index) {
      if (this.documents.length <= 2) return
      this.clearScores()
      this.documents.splice(index, 1)
    },
    /**
     * Apply API results: attach rank/score by original index, then reorder
     * documents high-score-first for display.
     */
    applyRerankResults (response) {
      const rows = Array.isArray(response?.results) ? response.results : []
      const scored = this.documents.map((doc, index) => {
        const hit = rows.find((row, i) => {
          const idx = Number.isFinite(Number(row.index)) ? Number(row.index) : i
          return idx === index
        })
        return {
          doc,
          score: hit != null ? Number(hit.relevance_score ?? hit.score ?? 0) : null,
        }
      })
      scored.sort((a, b) => {
        if (a.score == null && b.score == null) return 0
        if (a.score == null) return 1
        if (b.score == null) return -1
        return b.score - a.score
      })
      const meta = {}
      let rank = 0
      scored.forEach((item) => {
        if (item.score != null) {
          rank += 1
          meta[item.doc.key] = { rank, score: item.score }
        }
      })
      this.documents = scored.map(item => item.doc)
      this.scoreMeta = meta
      this.rawResponse = response
    },
    reset () {
      this.clearScores()
      this.errorMessage = ''
      this.batchMode = false
      this.query = this.$t('aice.aiproxy.playground.rerank.sample_query')
      this.documents = this.buildSampleDocuments()
      this.batchText = this.$t('aice.aiproxy.playground.rerank.sample_batch')
    },
    async submit () {
      this.errorMessage = ''
      if (!this.endpoint) {
        this.errorMessage = this.$t('aice.aiproxy.playground.endpoint_missing')
        return
      }
      const virtualKey = await this.ensureVirtualKeyReady()
      if (!virtualKey) {
        this.errorMessage = this.$t('aice.aiproxy.playground.vk_missing')
        return
      }
      if (!this.selection?.model) {
        this.errorMessage = this.$t('aice.aiproxy.playground.model_missing')
        return
      }
      if (!String(this.query || '').trim() || !this.docTexts.length) {
        this.errorMessage = this.$t('aice.aiproxy.playground.rerank.input_required')
        return
      }

      // Batch mode: materialize lines into cards so scores can render inline.
      if (this.batchMode) {
        const lines = this.docTexts
        this.documents = lines.map(text => ({ key: uuid(), text }))
        this.batchMode = false
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
        this.applyRerankResults(JSON.parse(text))
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

.playground-query-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.playground-query-input {
  flex: 1;
}
.playground-query-submit {
  flex-shrink: 0;
}
.playground-doc-card__footer {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}
.playground-doc-card__bar {
  flex: 1;
  min-width: 0;
  height: 3px;
  background: #e6f7ff;
  border-radius: 2px;
  overflow: hidden;
}
.playground-doc-card__bar-fill {
  height: 100%;
  background: #1890ff;
  border-radius: 2px;
  transition: width 0.2s ease;
}
.playground-doc-card__meta {
  display: flex;
  flex-shrink: 0;
  gap: 12px;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}
.playground-doc-card__rank {
  color: #1890ff;
}
.playground-doc-card__score {
  color: #fa8c16;
}
.playground-token-usage {
  max-width: 720px;
  margin-top: 12px;
  text-align: center;
  font-size: 12px;
  color: #fa8c16;
}
</style>
