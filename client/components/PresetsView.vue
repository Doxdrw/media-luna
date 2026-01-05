<template>
  <div class="ml-view-container">
    <!-- 紧凑工具栏 -->
    <div class="compact-toolbar">
      <!-- 左侧：视图切换 + 筛选 -->
      <div class="toolbar-left">
        <div class="btn-group">
          <button
            class="group-btn icon-only"
            :class="{ active: viewMode === 'list' }"
            @click="viewMode = 'list'"
            title="列表视图"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <rect x="3" y="4" width="18" height="3" rx="1"/>
              <rect x="3" y="10.5" width="18" height="3" rx="1"/>
              <rect x="3" y="17" width="18" height="3" rx="1"/>
            </svg>
          </button>
          <button
            class="group-btn icon-only"
            :class="{ active: viewMode === 'card' }"
            @click="viewMode = 'card'"
            title="卡片视图"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <rect x="3" y="3" width="8" height="8" rx="1"/>
              <rect x="13" y="3" width="8" height="8" rx="1"/>
              <rect x="3" y="13" width="8" height="8" rx="1"/>
              <rect x="13" y="13" width="8" height="8" rx="1"/>
            </svg>
          </button>
        </div>
        <div class="filter-divider"></div>
        <el-select v-model="filter.source" placeholder="来源" clearable size="small" style="width: 90px">
          <el-option label="本地" value="user" />
          <el-option label="远程" value="api" />
        </el-select>
        <el-select v-model="filter.enabled" placeholder="状态" clearable size="small" style="width: 90px">
          <el-option label="已启用" :value="true" />
          <el-option label="已禁用" :value="false" />
        </el-select>
        <el-select
          v-model="selectedTags"
          placeholder="标签筛选"
          clearable
          multiple
          collapse-tags
          collapse-tags-tooltip
          size="small"
          style="width: 150px"
        >
          <el-option-group label="预置标签">
            <el-option v-for="tag in presetTags" :key="tag" :label="tag" :value="tag" />
          </el-option-group>
          <el-option-group label="自定义标签" v-if="customTags.length > 0">
            <el-option v-for="tag in customTags" :key="tag" :label="tag" :value="tag" />
          </el-option-group>
        </el-select>
        <span class="result-count">共{{ filteredPresets.length }}个预设</span>
      </div>
      <!-- 右侧：操作按钮 -->
      <div class="toolbar-right">
        <button class="toolbar-btn icon-only" @click="fetchData" title="刷新">
          <k-icon name="refresh"></k-icon>
        </button>
        <button class="toolbar-btn primary" @click="openCreateDialog">
          <k-icon name="add"></k-icon>
          <span>新建</span>
        </button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="ml-view-content" :class="{ 'no-scroll': viewMode === 'list' }">
      <!-- 列表视图 -->
      <template v-if="viewMode === 'list'">
        <el-table
          :data="displayPresets"
          style="width: 100%"
          height="100%"
          class="preset-table"
          @row-click="handleRowClick"
        >
          <el-table-column label="缩略图" width="70" align="center">
            <template #default="{ row }">
              <div class="thumb-cell">
                <img v-if="row.thumbnail" :src="row.thumbnail" class="thumb-img" />
                <div v-else class="thumb-empty">
                  <k-icon name="image"></k-icon>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="名称" width="160">
            <template #default="{ row }">
              <span class="preset-name">{{ row.name }}</span>
            </template>
          </el-table-column>

          <el-table-column label="Prompt 模板" min-width="280">
            <template #default="{ row }">
              <div class="prompt-cell" :title="row.promptTemplate">
                {{ truncate(row.promptTemplate, 60) }}
              </div>
            </template>
          </el-table-column>

          <el-table-column label="参考图" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.referenceImages?.length" class="badge-count">
                {{ row.referenceImages.length }}
              </span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>

          <el-table-column label="来源" width="90" align="center">
            <template #default="{ row }">
              <span class="source-tag" :class="row.source">
                {{ row.source === 'api' ? '远程' : '本地' }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="70" align="center">
            <template #default="{ row }">
              <el-switch
                v-model="row.enabled"
                size="small"
                @change="handleToggle(row)"
                @click.stop
              />
            </template>
          </el-table-column>

          <el-table-column width="50" align="center" fixed="right">
            <template #default="{ row }">
              <span
                v-if="row.source === 'user' && row.thumbnail"
                class="upload-btn"
                title="上传到云端"
                @click.stop="handleUpload(row)"
              >
                <k-icon name="upload"></k-icon>
              </span>
            </template>
          </el-table-column>

          <el-table-column width="50" align="center" fixed="right">
            <template #default="{ row }">
              <span
                v-if="row.source === 'user'"
                class="delete-btn"
                title="删除"
                @click.stop="handleDelete(row)"
              >
                <k-icon name="delete"></k-icon>
              </span>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <!-- 卡片视图 -->
      <template v-else-if="viewMode === 'card'">
        <div v-if="displayPresets.length === 0" class="empty-view">
          <k-icon name="inbox" class="empty-icon"></k-icon>
          <p>暂无预设</p>
        </div>
        <MasonryGrid
          v-else
          :items="displayPresets"
          :item-key="(preset) => preset.id"
          :min-column-width="200"
          :gap="16"
        >
          <template #default="{ item: preset }">
            <div class="preset-card" @click="openEditDialog(preset)">
              <!-- 缩略图 - 卡片主体 -->
              <div class="card-thumb" v-if="preset.thumbnail">
                <img :src="preset.thumbnail" loading="lazy" />
                <!-- 悬浮时显示的中央操作区 -->
                <div class="thumb-overlay">
                  <div class="overlay-controls" @click.stop>
                    <el-switch v-model="preset.enabled" @change="handleToggle(preset)" class="overlay-switch" />
                    <button class="overlay-btn" title="复制为新预设" @click="handleCopy(preset)">
                      <k-icon name="clone"></k-icon>
                    </button>
                    <button
                      v-if="preset.source === 'user'"
                      class="overlay-btn danger"
                      title="删除"
                      @click="handleDelete(preset)"
                    >
                      <k-icon name="delete"></k-icon>
                    </button>
                    <button class="overlay-btn upload" v-if="preset.source === 'user'" title="上传到云端" @click="handleUpload(preset)">
                      <k-icon name="upload"></k-icon>
                    </button>
                  </div>
                </div>
                <!-- 参考图数量 -->
                <span v-if="preset.referenceImages?.length" class="ref-badge">
                  <k-icon name="image"></k-icon>{{ preset.referenceImages.length }}
                </span>
              </div>
              <div class="card-thumb empty" v-else>
                <k-icon name="image"></k-icon>
                <!-- 悬浮时显示的中央操作区 -->
                <div class="thumb-overlay">
                  <div class="overlay-controls" @click.stop>
                    <el-switch v-model="preset.enabled" @change="handleToggle(preset)" class="overlay-switch" />
                    <button class="overlay-btn" title="复制为新预设" @click="handleCopy(preset)">
                      <k-icon name="clone"></k-icon>
                    </button>
                    <button
                      v-if="preset.source === 'user'"
                      class="overlay-btn danger"
                      title="删除"
                      @click="handleDelete(preset)"
                    >
                      <k-icon name="delete"></k-icon>
                    </button>
                  </div>
                </div>
              </div>

              <!-- 紧凑底部：名称 + 标签 -->
              <div class="card-info">
                <div class="card-name">{{ preset.name }}</div>
                <div class="card-tags" v-if="preset.tags?.length">
                  <span v-for="tag in preset.tags.slice(0, 3)" :key="tag" class="tag-item">{{ tag }}</span>
                  <span v-if="preset.tags.length > 3" class="tag-more">+{{ preset.tags.length - 3 }}</span>
                </div>
              </div>

              <!-- 来源标记 -->
              <div class="card-source" :class="preset.source">
                {{ preset.source === 'api' ? '远程' : '本地' }}
              </div>
            </div>
          </template>
        </MasonryGrid>
      </template>
    </div>

    <!-- 分页栏 -->
    <div class="pagination-bar">
      <div class="page-size-select">
        <span class="page-size-label">每页</span>
        <el-select v-model="pageSize" size="small" @change="page = 1" style="width: 70px">
          <el-option :value="20" label="20" />
          <el-option :value="50" label="50" />
          <el-option :value="100" label="100" />
        </el-select>
        <span class="page-size-label">条</span>
      </div>
      <div class="page-nav">
        <button class="page-btn" :disabled="page <= 1" @click="page--">
          <k-icon name="chevron-left"></k-icon>
        </button>
        <span class="page-info">{{ page }} / {{ totalPages }}</span>
        <button class="page-btn" :disabled="page >= totalPages" @click="page++">
          <k-icon name="chevron-right"></k-icon>
        </button>
      </div>
      <div class="page-total">共 {{ filteredPresets.length }} 条</div>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑预设' : '新建预设'"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" label-width="100px" v-if="dialogVisible">
        <el-form-item label="名称" required>
          <el-input
            v-model="form.name"
            :disabled="isEdit && form.source === 'api'"
            placeholder="预设名称"
          />
        </el-form-item>

        <el-form-item label="Prompt 模板" required>
          <el-input
            v-model="form.promptTemplate"
            type="textarea"
            :rows="4"
            placeholder="提示词模板，可用 {prompt} 指定用户输入位置"
          />
        </el-form-item>

        <el-form-item label="缩略图" v-if="form.source === 'user'">
          <ImageUpload v-model="thumbnailList" :max-count="1" />
        </el-form-item>

        <el-form-item label="参考图">
          <ImageUpload v-model="form.referenceImages!" :max-count="5" />
        </el-form-item>

        <el-divider content-position="left">高级设置</el-divider>

        <el-form-item label="标签">
          <TagInput v-model="form.tags!" placeholder="添加标签" />
        </el-form-item>

        <el-form-item label="参数覆盖">
          <JsonEditor v-model="form.parameterOverrides" :rows="3" />
        </el-form-item>

        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <k-button @click="dialogVisible = false">取消</k-button>
          <k-button type="primary" @click="handleSubmit">保存</k-button>
        </div>
      </template>
    </el-dialog>

    <!-- 上传对话框 -->
    <UploadDialog
      v-if="uploadPreset"
      v-model="uploadDialogVisible"
      mode="preset"
      :preset-data="{
        name: uploadPreset.name,
        promptTemplate: uploadPreset.promptTemplate,
        thumbnail: uploadPreset.thumbnail,
        tags: uploadPreset.tags,
        referenceImages: uploadPreset.referenceImages
      }"
      @success="loadPresets"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { message } from '@koishijs/client'
import type { PresetData } from '../types'
import { presetApi } from '../api'
import TagInput from './TagInput.vue'
import JsonEditor from './JsonEditor.vue'
import ImageUpload from './ImageUpload.vue'
import MasonryGrid from './MasonryGrid.vue'
import UploadDialog from './UploadDialog.vue'

type ViewMode = 'list' | 'card'

// 预置标签
const presetTags = ['本地', '远程', 'text2img', 'img2img', 'NSFW']

// 视图状态
const viewMode = ref<ViewMode>('card')
const loading = ref(false)
const presets = ref<PresetData[]>([])
const selectedTags = ref<string[]>([])

// 筛选
const filter = ref({
  source: '',
  enabled: undefined as boolean | undefined
})

// 分页
const page = ref(1)
const pageSize = ref(20)

// 对话框
const dialogVisible = ref(false)
const isEdit = ref(false)
const form = ref<Partial<PresetData>>({})
const thumbnailList = ref<string[]>([])

// 从预设中提取自定义标签（排除预置标签）
const customTags = computed(() => {
  const tagSet = new Set<string>()
  presets.value.forEach(p => {
    (p.tags || []).forEach(t => {
      if (!presetTags.includes(t)) tagSet.add(t)
    })
  })
  return Array.from(tagSet).sort()
})

// 筛选后的数据
const filteredPresets = computed(() => {
  return presets.value.filter(p => {
    // 来源筛选
    if (filter.value.source && p.source !== filter.value.source) return false
    // 状态筛选
    if (filter.value.enabled !== undefined && p.enabled !== filter.value.enabled) return false
    // 标签筛选
    if (selectedTags.value.length > 0) {
      const match = selectedTags.value.every(tag => {
        if (tag === '本地') return p.source === 'user'
        if (tag === '远程') return p.source === 'api'
        return (p.tags || []).includes(tag)
      })
      if (!match) return false
    }
    return true
  })
})

// 总页数
const totalPages = computed(() => Math.max(1, Math.ceil(filteredPresets.value.length / pageSize.value)))

// 当前页数据
const displayPresets = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredPresets.value.slice(start, start + pageSize.value)
})

// 缩略图同步
watch(() => form.value.thumbnail, val => {
  thumbnailList.value = val ? [val] : []
}, { immediate: true })

watch(thumbnailList, val => {
  form.value.thumbnail = val[0] || ''
})

// 方法
const fetchData = async () => {
  loading.value = true
  try {
    presets.value = await presetApi.list()
  } catch {
    message.error('加载失败')
  } finally {
    loading.value = false
  }
}

const truncate = (text: string, len: number) => {
  if (!text) return '-'
  const s = text.replace(/\s+/g, ' ').trim()
  return s.length > len ? s.slice(0, len) + '...' : s
}

const openCreateDialog = () => {
  isEdit.value = false
  form.value = {
    name: '',
    promptTemplate: '',
    referenceImages: [],
    tags: ['text2img', 'img2img'],
    parameterOverrides: {},
    enabled: true,
    source: 'user'
  }
  dialogVisible.value = true
}

const openEditDialog = (preset: PresetData) => {
  isEdit.value = true
  form.value = JSON.parse(JSON.stringify(preset))
  dialogVisible.value = true
}

const handleRowClick = (row: PresetData) => openEditDialog(row)

const handleToggle = async (preset: PresetData) => {
  try {
    await presetApi.toggle(preset.id, preset.enabled)
  } catch {
    preset.enabled = !preset.enabled
    message.error('操作失败')
  }
}

const handleCopy = (preset: PresetData) => {
  isEdit.value = false
  const copy = JSON.parse(JSON.stringify(preset))
  delete copy.id
  copy.name = `${preset.name} (副本)`
  copy.source = 'user'
  form.value = copy
  dialogVisible.value = true
}

const handleDelete = async (preset: PresetData) => {
  if (!confirm(`确定删除预设 "${preset.name}"？`)) return
  try {
    await presetApi.delete(preset.id)
    message.success('已删除')
    fetchData()
  } catch {
    message.error('删除失败')
  }
}

// 上传相关
const uploadDialogVisible = ref(false)
const uploadPreset = ref<PresetData | null>(null)

const handleUpload = (preset: PresetData) => {
  // 需要有缩略图才能上传
  if (!preset.thumbnail) {
    message.warning('预设没有缩略图，无法上传')
    return
  }
  uploadPreset.value = preset
  uploadDialogVisible.value = true
}

const handleSubmit = async () => {
  if (!form.value.name || !form.value.promptTemplate) {
    message.warning('请填写必要信息')
    return
  }
  try {
    if (isEdit.value && form.value.id) {
      await presetApi.update(form.value.id, form.value)
      message.success('已保存')
    } else {
      await presetApi.create(form.value as Omit<PresetData, 'id'>)
      message.success('已创建')
    }
    dialogVisible.value = false
    fetchData()
  } catch {
    message.error('保存失败')
  }
}

onMounted(fetchData)
</script>

<style scoped>
@import '../styles/shared.css';

/* 滚动控制 */
.ml-view-content.no-scroll {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 紧凑工具栏 */
.compact-toolbar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  gap: 0.5rem;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.filter-divider {
  width: 1px;
  height: 20px;
  background: var(--k-color-border);
  margin: 0 0.25rem;
}

.result-count {
  font-size: 0.8rem;
  color: var(--k-color-text-description);
  margin-left: 0.25rem;
  white-space: nowrap;
}

.btn-group {
  display: flex;
  background: var(--k-color-bg-2);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  padding: 2px;
}

.group-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border: none;
  background: transparent;
  color: var(--k-color-text-description);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
  font-size: 13px;
  font-weight: 500;
}

.group-btn.icon-only {
  padding: 4px 6px;
}

.group-btn:hover {
  color: var(--k-color-text);
}

.group-btn.active {
  color: var(--k-color-active);
  background: var(--k-card-bg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid var(--k-color-border);
  background: var(--k-card-bg);
  color: var(--k-color-text-description);
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.15s;
}

.toolbar-btn.icon-only {
  padding: 5px 8px;
}

.toolbar-btn:hover {
  color: var(--k-color-text);
  border-color: var(--k-color-active);
}

.toolbar-btn.primary {
  background: var(--k-color-active);
  border-color: var(--k-color-active);
  color: white;
}

.toolbar-btn.primary:hover {
  filter: brightness(1.1);
}

/* 表格 */
.preset-table {
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  --el-table-header-bg-color: var(--k-color-bg-1);
  --el-table-row-hover-bg-color: var(--k-color-bg-2);
  --el-table-border-color: var(--k-color-border);
}

.preset-table :deep(th.el-table__cell) {
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--k-color-text-description);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.thumb-cell {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--k-color-bg-2);
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--k-color-text-description);
  opacity: 0.5;
}

.preset-name {
  font-weight: 500;
  color: var(--k-color-text);
}

.prompt-cell {
  color: var(--k-color-text-description);
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--k-color-bg-2);
  border-radius: 10px;
  font-size: 0.75rem;
  color: var(--k-color-text-description);
}

.source-tag {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.source-tag.api {
  background: var(--k-color-active);
  color: white;
}

.source-tag.user {
  background: var(--k-color-warning, #e6a23c);
  color: white;
}

.text-muted {
  color: var(--k-color-text-description);
  opacity: 0.5;
}

.upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  color: var(--k-color-text-description);
  cursor: pointer;
  transition: all 0.15s;
}

.upload-btn:hover {
  color: var(--k-color-primary, #409eff);
  background: var(--k-color-primary-light, rgba(64, 158, 255, 0.1));
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  color: var(--k-color-text-description);
  cursor: pointer;
  transition: all 0.15s;
}

.delete-btn:hover {
  color: var(--k-color-error, #f56c6c);
  background: var(--k-color-error-light, rgba(245, 108, 108, 0.1));
}

/* 分页栏 */
.pagination-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 0.625rem 1rem;
  margin-top: 0.75rem;
  border-top: 1px solid var(--k-color-border);
  background: var(--k-card-bg);
}

.page-size-select {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.page-size-label {
  font-size: 0.85rem;
  color: var(--k-color-text-description);
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--k-color-border);
  border-radius: 4px;
  background: var(--k-color-bg-1);
  color: var(--k-color-text);
  cursor: pointer;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--k-color-active);
  color: var(--k-color-active);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.85rem;
  color: var(--k-color-text);
  min-width: 50px;
  text-align: center;
}

.page-total {
  font-size: 0.85rem;
  color: var(--k-color-text-description);
}

/* 卡片视图 */
.empty-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: var(--k-color-text-description);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.4;
}

.preset-card {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
}

.preset-card:hover {
  border-color: var(--k-color-active);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* 缩略图区域 */
.card-thumb {
  width: 100%;
  position: relative;
  overflow: hidden;
  background: var(--k-color-bg-2);
}

.card-thumb img {
  width: 100%;
  height: auto;
  display: block;
  transition: transform 0.3s;
}

.preset-card:hover .card-thumb img {
  transform: scale(1.03);
}

.card-thumb.empty {
  aspect-ratio: 4/3;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--k-color-text-description);
  opacity: 0.4;
  font-size: 2rem;
}

/* 悬浮遮罩层 */
.thumb-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.preset-card:hover .thumb-overlay {
  opacity: 1;
}

.overlay-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.65);
  border-radius: 28px;
  backdrop-filter: blur(4px);
}

/* 开关样式调大 */
.overlay-switch {
  --el-switch-on-color: var(--k-color-active);
  --el-switch-off-color: rgba(255, 255, 255, 0.3);
  height: 28px;
}

.overlay-switch :deep(.el-switch__core) {
  min-width: 46px;
  height: 24px;
  border-radius: 12px;
}

.overlay-switch :deep(.el-switch__action) {
  width: 20px;
  height: 20px;
}

.overlay-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  padding: 0 14px;
  border: none;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.15s;
}

.overlay-btn:hover {
  background: rgba(255, 255, 255, 0.35);
}

.overlay-btn.danger {
  padding: 0 10px;
}

.overlay-btn.danger:hover {
  background: var(--k-color-error, #f56c6c);
}

.overlay-btn.upload:hover {
  background: var(--k-color-primary, #409eff);
}

/* 参考图徽章 */
.ref-badge {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 0.7rem;
  border-radius: 4px;
}

/* 紧凑底部 */
.card-info {
  padding: 0.5rem 0.625rem;
}

.card-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--k-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.25rem;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.tag-item {
  font-size: 0.65rem;
  padding: 1px 5px;
  background: var(--k-color-bg-2);
  color: var(--k-color-text-description);
  border-radius: 3px;
}

.tag-more {
  font-size: 0.65rem;
  padding: 1px 5px;
  background: var(--k-color-active);
  color: white;
  border-radius: 3px;
}

/* 来源标记 */
.card-source {
  position: absolute;
  top: 0.375rem;
  left: 0.375rem;
  font-size: 0.6rem;
  padding: 2px 5px;
  border-radius: 3px;
  font-weight: 600;
}

.card-source.api {
  background: var(--k-color-active);
  color: white;
}

.card-source.user {
  background: var(--k-color-warning, #e6a23c);
  color: white;
}

/* 对话框 */
.dialog-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
