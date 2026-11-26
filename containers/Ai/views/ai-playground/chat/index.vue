<template>
  <div class="playground-chat">
    <playground-toolbar
      kind="chat"
      :initial-model="initialModel"
      :initial-target-type="initialTargetType"
      :initial-target-id="initialTargetId"
      :initial-virtual-key-id="initialVirtualKeyId"
      @change="onToolbarChange" />

    <ai-chat
      v-if="selection && selection.target"
      :key="chatKey"
      mode="chatTest"
      :data="selection.target"
      :res-id="selection.target.id || ''"
      :initial-virtual-key-id="selection.virtualKeyId || ''"
      :initial-virtual-key="selection.virtualKey || ''"
      :initial-chat-model="selection.model || ''" />

    <a-empty
      v-else
      :description="$t('aice.aiproxy.playground.select_target_hint')" />
  </div>
</template>

<script>
import AiChat from '@Ai/sections/Chat'
import PlaygroundToolbar from '../components/PlaygroundToolbar'

export default {
  name: 'AiPlaygroundChat',
  components: { PlaygroundToolbar, AiChat },
  props: {
    initialModel: { type: String, default: '' },
    initialTargetType: { type: String, default: 'deployment' },
    initialTargetId: { type: String, default: '' },
    initialVirtualKeyId: { type: String, default: '' },
  },
  data () {
    return {
      selection: null,
    }
  },
  computed: {
    // Remount the chat when the target changes so conversation state is reset
    // but a model/vk switch inside the same target keeps the transcript.
    chatKey () {
      return `${this.selection?.targetType || ''}:${this.selection?.target?.id || ''}`
    },
  },
  methods: {
    onToolbarChange (selection) {
      this.selection = selection
    },
  },
}
</script>
