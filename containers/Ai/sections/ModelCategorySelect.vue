<template>
  <a-select
    :value="selectValue"
    :mode="multiple ? 'multiple' : undefined"
    :placeholder="placeholder"
    allow-clear
    :options="options"
    @change="onChange" />
</template>

<script>
import {
  aiModelCategoryOptions,
  normalizeAiModelCategory,
  normalizeAiModelCategoryList,
} from '@Ai/constants/aiModelCategory'

/**
 * Model category select shared by ai_model (single) and llm_sku (multiple).
 * value: string when !multiple, array when multiple.
 */
export default {
  name: 'ModelCategorySelect',
  props: {
    value: {
      type: [String, Array],
      default: null,
    },
    multiple: {
      type: Boolean,
      default: false,
    },
    placeholder: {
      type: String,
      default: '',
    },
  },
  computed: {
    options () {
      return aiModelCategoryOptions(k => this.$t(k))
    },
    selectValue () {
      if (this.multiple) {
        return normalizeAiModelCategoryList(this.value)
      }
      return normalizeAiModelCategory(this.value) || 'llm'
    },
  },
  methods: {
    onChange (val) {
      const next = this.multiple
        ? normalizeAiModelCategoryList(val)
        : (normalizeAiModelCategory(val) || 'llm')
      this.$emit('input', next)
      this.$emit('change', next)
    },
  },
}
</script>
