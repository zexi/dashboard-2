<template>
  <div class="ai-playground-page">
    <page-header
      :title="$t('aice.aiproxy.playground.title')"
      :tabs="tabs"
      :current-tab.sync="currentTab" />
    <page-body>
      <div v-show="currentTab === 'chat'">
        <playground-chat
          v-if="currentTab === 'chat'"
          :initial-model="queryInitial.model"
          :initial-target-type="queryInitial.targetType"
          :initial-target-id="queryInitial.targetId"
          :initial-virtual-key-id="queryInitial.virtualKeyId" />
      </div>
      <div v-show="currentTab === 'embedding'">
        <playground-embedding
          v-if="currentTab === 'embedding'"
          :initial-model="queryInitial.model"
          :initial-target-type="queryInitial.targetType"
          :initial-target-id="queryInitial.targetId"
          :initial-virtual-key-id="queryInitial.virtualKeyId" />
      </div>
      <div v-show="currentTab === 'rerank'">
        <playground-rerank
          v-if="currentTab === 'rerank'"
          :initial-model="queryInitial.model"
          :initial-target-type="queryInitial.targetType"
          :initial-target-id="queryInitial.targetId"
          :initial-virtual-key-id="queryInitial.virtualKeyId" />
      </div>
    </page-body>
  </div>
</template>

<script>
import PlaygroundChat from './chat'
import PlaygroundEmbedding from './embedding'
import PlaygroundRerank from './rerank'

const TAB_KEYS = ['chat', 'embedding', 'rerank']

export default {
  name: 'AiPlaygroundIndex',
  components: {
    PlaygroundChat,
    PlaygroundEmbedding,
    PlaygroundRerank,
  },
  data () {
    const query = this.$route.query || {}
    const tab = TAB_KEYS.includes(query.tab) ? query.tab : 'chat'
    return {
      currentTab: tab,
      queryInitial: {
        // Deployments are the common entry point; only an explicit ?routing=
        // deep link switches to the routing playground.
        targetType: query.routing ? 'routing' : 'deployment',
        targetId: String(query.deployment || query.routing || ''),
        virtualKeyId: String(query.vk || ''),
        model: String(query.model || ''),
      },
      tabs: [
        { key: 'chat', label: this.$t('aice.aiproxy.playground.kind.chat') },
        { key: 'embedding', label: this.$t('aice.aiproxy.playground.kind.embedding') },
        { key: 'rerank', label: this.$t('aice.aiproxy.playground.kind.rerank') },
      ],
    }
  },
  watch: {
    currentTab (tab) {
      if (this.$route.query.tab === tab) return
      this.$router.replace({ query: { ...this.$route.query, tab } }).catch(() => {})
    },
    '$route.query.tab' (tab) {
      if (TAB_KEYS.includes(tab) && tab !== this.currentTab) {
        this.currentTab = tab
      }
    },
  },
}
</script>

<style lang="less" scoped>
.ai-playground-page {
  :deep(.ant-card) {
    border-radius: 4px;
  }
}
</style>
