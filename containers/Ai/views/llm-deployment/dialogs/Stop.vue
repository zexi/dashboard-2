<template>
  <base-dialog :width="600" @cancel="cancelDialog">
    <div slot="header">{{ $t('aice.llm_deployment.stop') }}</div>
    <div slot="body">
      <div class="mb-2">
        <span>{{ $t('common.text00002') }}</span>
        <span class="ml-2 mr-2 primary-color">{{ params.data.length }}{{ $t('common.text00003') }}{{ $t('aice.llm_deployment') }}</span>
        <span>{{ $t('common.text00004') }}</span>
        <span class="ml-2 mr-2 warning-color">{{ $t('aice.llm_deployment.stop') }}</span>
      </div>
      <p class="mb-2">{{ $t('aice.llm_deployment.stop_confirm') }}</p>
      <dialog-table :data="params.data" :columns="params.columns.slice(0, 3)" />
    </div>
    <div slot="footer">
      <a-button type="primary" @click="handleConfirm" :loading="loading">{{ $t('dialog.ok') }}</a-button>
      <a-button @click="cancelDialog">{{ $t('dialog.cancel') }}</a-button>
    </div>
  </base-dialog>
</template>

<script>
import DialogMixin from '@/mixins/dialog'
import WindowsMixin from '@/mixins/windows'

export default {
  name: 'LlmDeploymentStopDialog',
  mixins: [DialogMixin, WindowsMixin],
  data () {
    return { loading: false }
  },
  methods: {
    async handleConfirm () {
      this.loading = true
      try {
        const ids = this.params.data.map(item => item.id)
        await this.params.onManager('batchPerformAction', {
          id: ids,
          steadyStatus: ['ready', 'partial', 'stopped'],
          managerArgs: {
            action: 'stop',
            data: {},
          },
        })
        this.cancelDialog()
      } catch (error) {
        throw error
      } finally {
        this.loading = false
      }
    },
  },
}
</script>
