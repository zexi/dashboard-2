import { Manager } from '@/utils/manager'
import { getAiproxyVirtualKeySelectParams } from '@Ai/constants/aiproxyResources'
import { isPlaceholderApiKey } from '@Ai/utils/aiproxyEndpoint'

/** Shared virtual key select + secret fetch for aiproxy access panels. */
export default {
  data () {
    return {
      selectedVirtualKeyId: '',
      selectedVirtualKey: '',
      virtualKeyExtraOpts: [],
      virtualKeyLoading: false,
      // Tracks the in-flight secret request so consumers can await it instead of
      // racing it (a fresh selection has an id before its secret arrives).
      virtualKeyFetchPromise: null,
    }
  },
  computed: {
    virtualKeySelectParams () {
      return getAiproxyVirtualKeySelectParams(this, { enabled: true, limit: 100 }, this.data)
    },
    hasConfiguredApiKey () {
      return !!this.selectedVirtualKey && !isPlaceholderApiKey(`Bearer ${this.selectedVirtualKey}`)
    },
    selectedVirtualKeyRef () {
      const name = this.virtualKeyExtraOpts?.[0]?.name
      if (name) return name
      if (this.selectedVirtualKeyId) return this.selectedVirtualKeyId
      return '<virtual-key>'
    },
  },
  methods: {
    async onVirtualKeyChange (id) {
      if (!id) {
        this.selectedVirtualKey = ''
        this.virtualKeyExtraOpts = []
        return
      }
      await this.fetchVirtualKeySecret(id)
    },
    async fetchVirtualKeySecret (id) {
      if (!id) {
        this.selectedVirtualKey = ''
        this.virtualKeyFetchPromise = null
        return
      }
      this.virtualKeyLoading = true
      // Clear any secret from a previously selected key so a stale value is
      // never sent while the new one loads.
      this.selectedVirtualKey = ''
      const request = (async () => {
        try {
          const manager = new Manager('ai_virtual_keys')
          const { data } = await manager.get({
            id,
            params: getAiproxyVirtualKeySelectParams(this, {}, this.data),
          })
          // A slower response for an older selection must not overwrite the
          // secret of the key the user picked last.
          if (String(this.selectedVirtualKeyId || '') !== String(id)) return ''
          this.selectedVirtualKey = data?.virtual_key || ''
          if (data?.id && data?.name) {
            this.virtualKeyExtraOpts = [{
              id: data.id,
              name: data.name,
            }]
          }
          return this.selectedVirtualKey
        } catch (e) {
          if (String(this.selectedVirtualKeyId || '') === String(id)) {
            this.selectedVirtualKey = ''
          }
          return ''
        } finally {
          if (this.virtualKeyFetchPromise === request) {
            this.virtualKeyFetchPromise = null
            this.virtualKeyLoading = false
          }
        }
      })()
      this.virtualKeyFetchPromise = request
      // Resolves to the secret so callers can use it without racing the state.
      return request
    },
  },
}
