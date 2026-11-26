<template>
  <page-list
    :list="list"
    :columns="columns"
    :group-actions="groupActions"
    :single-actions="singleActions"
    :export-data-options="exportDataOptions" />
</template>

<script>
import WindowsMixin from '@/mixins/windows'
import ListMixin from '@/mixins/list'
import expectStatus from '@/constants/expectStatus'
import { getRestartMeta, getStartMeta, getStopMeta } from '@Ai/utils/aiproxyDeploymentActions'
import SingleActionsMixin from '../mixins/singleActions'
import ColumnsMixin from '../mixins/columns'
import { filterOptions } from '../utils/filters'

export default {
  name: 'LlmDeploymentList',
  mixins: [WindowsMixin, ListMixin, ColumnsMixin, SingleActionsMixin],
  props: {
    id: String,
    getParams: {
      type: Object,
      default: () => { },
    },
  },
  data () {
    return {
      list: this.$list.createList(this, {
        id: this.id,
        resource: 'llm_deployments',
        getParams: this.getParam,
        steadyStatus: {
          status: [
            ...(expectStatus.llmDeployment.success || []),
            ...(expectStatus.llmDeployment.danger || []),
          ],
          aiproxy_sync_status: [
            ...(expectStatus.llmDeploymentAiproxy.success || []),
            ...(expectStatus.llmDeploymentAiproxy.danger || []),
          ],
        },
        filterOptions,
        hiddenColumns: [],
      }),
      groupActions: [
        // {
        //   label: this.$t('aice.llm_deployment.deploy_model'),
        //   // Multi-source deploy menu matching GPUStack: Catalog / HuggingFace /
        //   // ModelScope / Local Path. Phase 1 only HF is wired up; the other
        //   // sources route to placeholders.
        //   actions: () => [
        //     {
        //       label: this.$t('aice.llm_deployment.deploy.from_catalog'),
        //       action: () => {
        //         this.$router.push({ name: 'LlmDeploymentDeployFromModelSets' })
        //       },
        //     },
        //     {
        //       label: this.$t('aice.llm_deployment.deploy.from_huggingface'),
        //       action: () => {
        //         this.$router.push({ name: 'LlmDeploymentDeployFromHuggingFace' })
        //       },
        //     },
        //     {
        //       label: this.$t('aice.llm_deployment.deploy.from_modelscope'),
        //       action: () => {
        //         this.$message.info(this.$t('aice.llm_deployment.deploy.coming_soon'))
        //       },
        //       meta: () => ({ validate: false }),
        //     },
        //     {
        //       label: this.$t('aice.llm_deployment.deploy.from_local'),
        //       action: () => {
        //         this.$message.info(this.$t('aice.llm_deployment.deploy.coming_soon'))
        //       },
        //       meta: () => ({ validate: false }),
        //     },
        //   ],
        //   meta: () => ({
        //     buttonType: 'primary',
        //     validate: true,
        //   }),
        // },
        {
          label: this.$t('common.create'),
          action: () => {
            this.$router.push({ name: 'LlmDeploymentCreate' })
          },
          meta: () => ({
            validate: true,
            buttonType: 'primary',
          }),
        },
        {
          label: this.$t('aice.llm_deployment.start'),
          permission: 'llm_deployments_perform_start',
          action: () => {
            this.createDialog('LlmDeploymentStartDialog', {
              vm: this,
              data: this.list.selectedItems,
              columns: this.columns,
              onManager: this.onManager,
            })
          },
          meta: () => this.getBatchLifecycleMeta(getStartMeta),
        },
        {
          label: this.$t('aice.llm_deployment.stop'),
          permission: 'llm_deployments_perform_stop',
          action: () => {
            this.createDialog('LlmDeploymentStopDialog', {
              vm: this,
              data: this.list.selectedItems,
              columns: this.columns,
              onManager: this.onManager,
            })
          },
          meta: () => this.getBatchLifecycleMeta(getStopMeta),
        },
        {
          label: this.$t('aice.llm_deployment.restart'),
          permission: 'llm_deployments_perform_restart',
          action: () => {
            this.createDialog('LlmDeploymentRestartDialog', {
              vm: this,
              data: this.list.selectedItems,
              columns: this.columns,
              onManager: this.onManager,
            })
          },
          meta: () => this.getBatchLifecycleMeta(getRestartMeta),
        },
        {
          label: this.$t('common.text00043'),
          permission: 'llm_deployments_perform_syncstatus',
          action: () => {
            this.onManager('batchPerformAction', {
              steadyStatus: {
                status: [
                  ...(expectStatus.llmDeployment.success || []),
                  ...(expectStatus.llmDeployment.danger || []),
                ],
              },
              managerArgs: {
                action: 'syncstatus',
                data: {},
              },
            })
          },
          meta: () => ({
            validate: this.list.selectedItems.length > 0,
          }),
        },
        {
          label: this.$t('table.action.delete'),
          action: () => {
            this.createDialog('DeleteResDialog', {
              vm: this,
              data: this.list.selectedItems,
              columns: this.columns,
              title: this.$t('table.action.delete'),
              name: this.$t('aice.llm_deployment'),
              onManager: this.onManager,
            })
          },
          meta: () => {
            const ret = { validate: this.list.selected.length }
            if (this.list.selectedItems.some(item => !item.can_delete)) {
              ret.validate = false
            }
            return ret
          },
        },
      ],
    }
  },
  computed: {
    exportDataOptions () {
      return {
        downloadType: 'local',
        title: this.$t('aice.llm_deployment'),
        items: [
          { label: 'ID', key: 'id' },
          ...this.columns,
        ],
      }
    },
  },
  created () {
    this.initSidePageTab('detail')
    this.list.fetchData()
  },
  methods: {
    getParam () {
      return {
        ...this.getParams,
        details: true,
      }
    },
    getBatchLifecycleMeta (metaFn) {
      const items = this.list.selectedItems || []
      if (!items.length) {
        return { validate: false }
      }
      for (const item of items) {
        const meta = metaFn(item, this)
        if (!meta.validate) {
          return meta
        }
      }
      return { validate: true }
    },
    handleOpenSidepage (row) {
      this.sidePageTriggerHandle(this, 'LlmDeploymentSidePage', {
        id: row.id,
        resource: 'llm_deployments',
        getParams: this.getParam,
      }, {
        list: this.list,
      })
    },
  },
}
</script>
