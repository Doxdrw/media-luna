<template>
  <div class="preset-picker">
    <!-- 当前选中的预设显示 -->
    <div class="selected-preset" @click="openPicker">
      <div v-if="selectedPreset" class="preset-info">
        <img v-if="selectedPreset.thumbnail" :src="selectedPreset.thumbnail" class="preset-thumb" />
        <div v-else class="preset-thumb placeholder">
          <k-icon name="image"></k-icon>
        </div>
        <div class="preset-details">
          <span class="preset-name">{{ selectedPreset.name }}</span>
          <span class="preset-source" :class="selectedPreset.source">
            {{ selectedPreset.source === 'api' ? '远程' : '本地' }}
          </span>
        </div>
        <k-icon name="times" class="clear-btn" @click.stop="clearSelection" title="清除选择"></k-icon>
      </div>
      <div v-else class="placeholder-text">
        <k-icon name="layer-group"></k-icon>
        <span>选择预设模板 (可选)</span>
      </div>
      <k-icon name="chevron-down" class="dropdown-icon"></k-icon>
    </div>

    <!-- 预设选择弹窗 - 复用 PresetsView 的布局 -->
    <el-dialog
      v-model="pickerVisible"
      title="选择预设"
      width="80vw"
      top="5vh"
      :close-on-click-modal="true"
      class="preset-picker-dialog"
    >
      <!-- 搜索和筛选 - 复用 PresetsView 的筛选样式 -->
      <div class="picker-header">
        <div class="search-wrapper">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索预设..."
            clearable
            size="small"
            class="search-input"
          >
            <template #prefix><k-icon name="search"></k-icon></template>
          </el-input>
        </div>
        <TagFilter
          v-model="selectedTags"
          :all-tags="allTags"
          :preset-tags="presetTags"
          :show-input="false"
        />
        <span class="preset-count">共 {{ filteredPresets.length }} 个预设</span>
      </div>

      <!-- 预设卡片网格 - 瀑布流布局，复用 PresetsView 的结构 -->
      <div class="picker-content">
        <div class="ml-masonry">
          <div v-for="preset in filteredPresets" :key="preset.id" class="ml-masonry-item">
            <div
              class="preset-card"
              :class="{ selected: tempSelectedId === preset.id }"
              @click="selectPreset(preset)"
            >
              <!-- 缩略图 -->
              <div class="card-thumbnail" v-if="preset.thumbnail">
                <img :src="preset.thumbnail" :alt="preset.name" loading="lazy" />
                <div class="thumbnail-overlay">
                  <span class="ref-count" v-if="preset.referenceImages?.length">
                    <k-icon name="image"></k-icon> {{ preset.referenceImages.length }}
                  </span>
                </div>
              </div>
              <div class="card-thumbnail placeholder" v-else>
                <k-icon name="image" class="placeholder-icon"></k-icon>
              </div>

              <!-- 内容 -->
              <div class="card-content">
                <div class="card-title">{{ preset.name }}</div>
                <div class="card-tags" v-if="preset.tags?.length">
                  <span v-for="tag in preset.tags.slice(0, 4)" :key="tag" class="mini-tag">
                    {{ tag }}
                  </span>
                  <span v-if="preset.tags.length > 4" class="mini-tag more">+{{ preset.tags.length - 4 }}</span>
                </div>
              </div>

              <!-- 操作按钮区 -->
              <div class="card-actions" @click.stop>
                <k-button size="mini" @click="viewDetail(preset)">
                  <template #icon><k-icon name="eye"></k-icon></template>
                  详情
                </k-button>
              </div>

              <!-- 来源标记 -->
              <div class="source-indicator" :class="preset.source">
                {{ preset.source === 'api' ? '远程' : '本地' }}
              </div>

              <!-- 选中标记 -->
              <div v-if="tempSelectedId === preset.id" class="selected-mark">
                <k-icon name="check"></k-icon>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredPresets.length === 0" class="empty-state">
          <k-icon name="search" class="empty-icon"></k-icon>
          <p>没有找到匹配的预设</p>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <k-button @click="pickerVisible = false">取消</k-button>
          <k-button type="primary" @click="confirmSelection" :disabled="!tempSelectedId">
            确认选择
          </k-button>
        </div>
      </template>
    </el-dialog>

    <!-- 预设详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      :title="detailPreset?.name || '预设详情'"
      width="600px"
      :close-on-click-modal="true"
      class="preset-detail-dialog"
    >
      <div v-if="detailPreset" class="preset-detail">
        <!-- 缩略图 -->
        <div class="detail-thumbnail" v-if="detailPreset.thumbnail">
          <img :src="detailPreset.thumbnail" :alt="detailPreset.name" />
        </div>

        <!-- 基本信息 -->
        <div class="detail-section">
          <div class="detail-row">
            <span class="detail-label">来源:</span>
            <span class="source-badge" :class="detailPreset.source">
              {{ detailPreset.source === 'api' ? '远程' : '本地' }}
            </span>
          </div>
          <div class="detail-row" v-if="detailPreset.tags?.length">
            <span class="detail-label">标签:</span>
            <div class="detail-tags">
              <span v-for="tag in detailPreset.tags" :key="tag" class="mini-tag">{{ tag }}</span>
            </div>
          </div>
        </div>

        <!-- Prompt 模板 -->
        <div class="detail-section">
          <div class="detail-label">Prompt 模板:</div>
          <div class="prompt-preview">{{ detailPreset.promptTemplate }}</div>
        </div>

        <!-- 参考图 -->
        <div class="detail-section" v-if="detailPreset.referenceImages?.length">
          <div class="detail-label">参考图片 ({{ detailPreset.referenceImages.length }}):</div>
          <div class="reference-images">
            <img
              v-for="(img, idx) in detailPreset.referenceImages"
              :key="idx"
              :src="img"
              class="ref-image"
            />
          </div>
        </div>

        <!-- 参数覆盖 -->
        <div class="detail-section" v-if="detailPreset.parameterOverrides && Object.keys(detailPreset.parameterOverrides).length">
          <div class="detail-label">参数覆盖:</div>
          <div class="param-preview">{{ JSON.stringify(detailPreset.parameterOverrides, null, 2) }}</div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <k-button @click="detailVisible = false">关闭</k-button>
          <k-button type="primary" @click="selectFromDetail">
            <template #icon><k-icon name="check"></k-icon></template>
            选择此预设
          </k-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { PresetData } from '../types'
import TagFilter from './TagFilter.vue'

const props = defineProps<{
  modelValue?: number
  presets: PresetData[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | undefined): void
}>()

// 预置标签（包含来源虚拟标签）- 复用 PresetsView 的定义
const presetTags = ['本地', '远程', 'text2img', 'img2img', 'NSFW']

// 状态
const pickerVisible = ref(false)
const detailVisible = ref(false)
const selectedTags = ref<string[]>([])
const searchKeyword = ref('')
const tempSelectedId = ref<number | undefined>(props.modelValue)
const detailPreset = ref<PresetData | null>(null)

// 从所有预设中提取标签 - 复用 PresetsView 的逻辑
const allTags = computed(() => {
  const tagSet = new Set<string>()
  props.presets.forEach(p => {
    (p.tags || []).forEach(t => tagSet.add(t))
  })
  return Array.from(tagSet).sort()
})

// 当前选中的预设
const selectedPreset = computed(() => {
  if (!props.modelValue) return null
  return props.presets.find(p => p.id === props.modelValue)
})

// 过滤后的预设列表
const filteredPresets = computed(() => {
  let result = props.presets

  // 搜索关键词过滤（名称或标签）
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (keyword) {
    result = result.filter(p => {
      // 匹配名称
      if (p.name.toLowerCase().includes(keyword)) return true
      // 匹配标签
      if ((p.tags || []).some(t => t.toLowerCase().includes(keyword))) return true
      return false
    })
  }

  // 标签过滤
  if (selectedTags.value.length > 0) {
    result = result.filter(p => {
      return selectedTags.value.every(tag => {
        // 虚拟标签：本地/远程
        if (tag === '本地') return p.source === 'user'
        if (tag === '远程') return p.source === 'api'
        // 普通标签匹配
        return (p.tags || []).includes(tag)
      })
    })
  }

  return result
})

// 方法
const openPicker = () => {
  tempSelectedId.value = props.modelValue
  selectedTags.value = []
  searchKeyword.value = ''
  pickerVisible.value = true
}

const selectPreset = (preset: PresetData) => {
  tempSelectedId.value = preset.id
}

const confirmSelection = () => {
  emit('update:modelValue', tempSelectedId.value)
  pickerVisible.value = false
}

const clearSelection = () => {
  emit('update:modelValue', undefined)
}

const viewDetail = (preset: PresetData) => {
  detailPreset.value = preset
  detailVisible.value = true
}

const selectFromDetail = () => {
  if (detailPreset.value) {
    emit('update:modelValue', detailPreset.value.id)
    detailVisible.value = false
    pickerVisible.value = false
  }
}

// 同步外部值变化
watch(() => props.modelValue, (newVal) => {
  tempSelectedId.value = newVal
})
</script>

<style scoped>
@import '../styles/shared.css';

.preset-picker {
  width: 100%;
}

/* 选中预设显示 */
.selected-preset {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  background-color: var(--k-color-bg-2);
  border: 1px solid var(--k-color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 36px;
}

.selected-preset:hover {
  border-color: var(--k-color-active);
  background-color: var(--k-color-bg-1);
}

.preset-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.preset-thumb {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.preset-thumb.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--k-color-bg-1);
  color: var(--k-color-text-description);
  font-size: 0.75rem;
}

.preset-details {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex: 1;
  min-width: 0;
}

.preset-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--k-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-source {
  font-size: 0.65rem;
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
}

.preset-source.api {
  background-color: var(--k-color-active);
  color: white;
}

.preset-source.user {
  background-color: var(--k-color-warning, #e6a23c);
  color: white;
}

.clear-btn {
  padding: 3px;
  color: var(--k-color-text-description);
  cursor: pointer;
  transition: color 0.2s;
  flex-shrink: 0;
  font-size: 0.85rem;
}

.clear-btn:hover {
  color: var(--k-color-error, #f56c6c);
}

.placeholder-text {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--k-color-text-description);
  flex: 1;
  font-size: 0.85rem;
}

.dropdown-icon {
  color: var(--k-color-text-description);
  flex-shrink: 0;
  transition: transform 0.2s;
}

.selected-preset:hover .dropdown-icon {
  color: var(--k-color-active);
}

/* 选择器弹窗 */
.picker-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.search-wrapper {
  flex-shrink: 0;
}

.search-input {
  width: 220px;
}

.preset-count {
  font-size: 0.85rem;
  color: var(--k-color-text-description);
  flex-shrink: 0;
}

/* 预设网格 - 复用 ml-masonry 布局，添加滚动容器 */
.picker-content {
  max-height: 65vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.5rem;
  /* 隐藏式滚动条 */
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.picker-content:hover {
  scrollbar-color: var(--k-color-border) transparent;
}

.picker-content::-webkit-scrollbar {
  width: 6px;
}

.picker-content::-webkit-scrollbar-track {
  background: transparent;
}

.picker-content::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.picker-content:hover::-webkit-scrollbar-thumb {
  background-color: var(--k-color-border);
}

/* 确保对话框内瀑布流正确渲染 */
.picker-content .ml-masonry {
  columns: 5;
  column-gap: 1rem;
}

.picker-content .ml-masonry-item {
  break-inside: avoid;
  margin-bottom: 1rem;
}

@media (max-width: 1400px) {
  .picker-content .ml-masonry { columns: 4; }
}

@media (max-width: 1100px) {
  .picker-content .ml-masonry { columns: 3; }
}

@media (max-width: 800px) {
  .picker-content .ml-masonry { columns: 2; }
}

/* ========== 复用 PresetsView 的卡片样式 ========== */

.preset-card {
  background-color: var(--k-color-bg-1);
  border: 2px solid var(--k-color-border);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.preset-card:hover {
  border-color: var(--k-color-active);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.preset-card.selected {
  border-color: var(--k-color-active);
  background-color: rgba(var(--k-color-primary-rgb), 0.05);
}

.card-thumbnail {
  width: 100%;
  aspect-ratio: auto;
  position: relative;
  overflow: hidden;
  background-color: var(--k-color-bg-2);
}

.card-thumbnail img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}

.card-thumbnail.placeholder {
  aspect-ratio: 4/3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 2rem;
  color: var(--k-color-text-description);
  opacity: 0.5;
}

.thumbnail-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.5rem;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  display: flex;
  justify-content: flex-end;
}

.ref-count {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 2px 6px;
  border-radius: 4px;
}

.card-content {
  padding: 0.75rem;
}

.card-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--k-color-text);
  margin-bottom: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mini-tag {
  font-size: 0.7rem;
  padding: 2px 6px;
  background-color: var(--k-color-bg-2);
  color: var(--k-color-text-description);
  border-radius: 4px;
}

.mini-tag.more {
  background-color: var(--k-color-active);
  color: white;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--k-color-border);
  background-color: var(--k-color-bg-2);
}

.source-indicator {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.source-indicator.api {
  background-color: var(--k-color-active);
  color: white;
}

.source-indicator.user {
  background-color: var(--k-color-warning, #e6a23c);
  color: white;
}

.selected-mark {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 28px;
  height: 28px;
  background-color: var(--k-color-active);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

/* 空状态 */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem;
  color: var(--k-color-text-description);
}

.empty-icon {
  font-size: 2.5rem;
  opacity: 0.3;
  margin-bottom: 1rem;
}

/* ========== 详情弹窗样式 ========== */

.preset-detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-thumbnail {
  width: 100%;
  max-height: 200px;
  overflow: hidden;
  border-radius: 8px;
  background-color: var(--k-color-bg-2);
}

.detail-thumbnail img {
  width: 100%;
  height: auto;
  object-fit: contain;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.detail-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--k-color-text-description);
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.source-badge {
  display: inline-block;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
}

.source-badge.api {
  background-color: var(--k-color-active);
  color: white;
}

.source-badge.user {
  background-color: var(--k-color-warning, #e6a23c);
  color: white;
}

.prompt-preview {
  padding: 0.75rem;
  background-color: var(--k-color-bg-2);
  border-radius: 6px;
  font-size: 0.85rem;
  color: var(--k-color-text);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 150px;
  overflow-y: auto;
  font-family: monospace;
}

.reference-images {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.ref-image {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--k-color-border);
}

.param-preview {
  padding: 0.75rem;
  background-color: var(--k-color-bg-2);
  border-radius: 6px;
  font-size: 0.8rem;
  font-family: monospace;
  white-space: pre-wrap;
  color: var(--k-color-text);
  max-height: 100px;
  overflow-y: auto;
}

/* 弹窗底部 */
.dialog-footer {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}
</style>
