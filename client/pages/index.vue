<template>
  <k-layout class="app-layout media-luna-app">
    <!-- 设置向导 -->
    <SetupWizard v-if="showSetupWizard" @complete="handleSetupComplete" />

    <!-- 主界面 -->
    <template v-else>
      <div class="top-nav">
        <div class="nav-container">
          <!-- Logo 区域（左侧） -->
          <div
            class="logo-area"
            @mouseenter="showVersionTooltip = true"
            @mouseleave="showVersionTooltip = false"
          >
            <span class="logo-text">MEDIA LUNA</span>
            <span class="version-text">v{{ versionInfo.current }}</span>
            <!-- 版本提示 -->
            <Transition name="tooltip-fade">
              <div v-if="showVersionTooltip" class="version-tooltip">
                <template v-if="versionInfo.hasUpdate">
                  <span class="tooltip-update">v{{ versionInfo.latest }} 可用</span>
                </template>
                <template v-else>
                  <span class="tooltip-ok">已是最新</span>
                </template>
              </div>
            </Transition>
            <!-- 更新按钮 -->
            <div
              v-if="versionInfo.hasUpdate"
              class="update-btn"
              @click="openUpdateLink"
              title="点击更新"
            >
              <svg class="update-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/>
              </svg>
            </div>
          </div>
          <!-- 导航标签（靠右） -->
          <div class="nav-tabs" role="tablist">
            <div
              v-for="item in menuItems"
              :key="item.id"
              class="nav-tab"
              :class="{ active: currentView === item.id }"
              @click="currentView = item.id"
              role="tab"
              :aria-selected="currentView === item.id"
            >
              <component :is="item.icon" class="tab-icon" />
              <span>{{ item.label }}</span>
            </div>
            <!-- 帮助按钮 -->
            <div
              class="nav-tab help-btn"
              @click="openHelp"
              title="查看使用帮助"
            >
              <svg class="tab-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
              </svg>
              <span>帮助</span>
            </div>
          </div>
        </div>
      </div>

      <div class="main-content">
        <keep-alive>
          <component :is="activeComponent" />
        </keep-alive>
      </div>
    </template>
  </k-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, h, reactive } from 'vue'
import ChannelsView from '../components/ChannelsView.vue'
import PresetsView from '../components/PresetsView.vue'
import TasksView from '../components/TasksView.vue'
import GenerateView from '../components/GenerateView.vue'
import SettingsView from '../components/SettingsView.vue'
import SetupWizard from '../components/SetupWizard.vue'
import { setupApi, versionApi } from '../api'

const currentView = ref('generate')
const showSetupWizard = ref(false)
const showVersionTooltip = ref(false)

// 版本信息
const versionInfo = reactive({
  current: '0.0.0',
  latest: '0.0.0',
  hasUpdate: false,
  npmUrl: ''
})

// 检查版本更新
const checkVersion = async () => {
  try {
    const info = await versionApi.check()
    versionInfo.current = info.current
    versionInfo.latest = info.latest
    versionInfo.hasUpdate = info.hasUpdate
    versionInfo.npmUrl = info.npmUrl
  } catch (e) {
    console.error('Failed to check version:', e)
  }
}

// 打开更新链接（跳转到 Koishi 依赖管理页面）
const openUpdateLink = () => {
  window.location.href = '/dependencies'
}

// 打开帮助文档
const openHelp = () => {
  window.open('https://github.com/ziyi233/media-luna#readme', '_blank')
}

// 检查是否需要显示设置向导
const checkSetupStatus = async () => {
  try {
    const status = await setupApi.status()
    showSetupWizard.value = status.needsSetup
  } catch (e) {
    // 出错时不显示向导，正常进入应用
    console.error('Failed to check setup status:', e)
    showSetupWizard.value = false
  }
}

// 设置完成回调
const handleSetupComplete = () => {
  showSetupWizard.value = false
}

const activeComponent = computed(() => {
  switch (currentView.value) {
    case 'generate': return GenerateView
    case 'channels': return ChannelsView
    case 'presets': return PresetsView
    case 'tasks': return TasksView
    case 'settings': return SettingsView
    default: return GenerateView
  }
})

const createIcon = (d: string) => () => h('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [ h('path', { d }) ])

const menuItems = [
  { id: 'generate', label: '生成', icon: createIcon('M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2 6.4 4.5 5 7zM19 2l-2.5 1.4L14 2l1.4 2.5L14 7l2.5-1.4L19 7l-1.4-2.5zm-5.6 5.4L9 12l4.4 4.6L17.8 12zM2 13l2.5 1.4L6 17l1.4-2.5L10 13 7.5 11.6 6 9l-1.4 2.5z') },
  { id: 'channels', label: '渠道', icon: createIcon('M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z') },
  { id: 'presets', label: '预设', icon: createIcon('M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z') },
  { id: 'tasks', label: '任务', icon: createIcon('M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z') },
  { id: 'settings', label: '设置', icon: createIcon('M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.58 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z') },
]

// Logic to hide Koishi's default header
let prevHeaderDisplay = ''
function hideHeader() {
  const el = document.querySelector('.layout-header') as HTMLElement
  if (el) { prevHeaderDisplay = el.style.display; el.style.display = 'none' }
}
function restoreHeader() {
  const el = document.querySelector('.layout-header') as HTMLElement
  if (el) el.style.display = prevHeaderDisplay || ''
}
onMounted(() => {
  hideHeader()
  checkSetupStatus()
  checkVersion()
})
onBeforeUnmount(restoreHeader)
</script>

<style scoped>
.app-layout { background: var(--k-color-bg-1); height: 100vh; min-height: 0; }
.top-nav { position: sticky; top: 0; z-index: 10; background: var(--k-color-bg-2); border-bottom: 1px solid var(--k-color-border); height: 50px; }
.nav-container { max-width: 1200px; margin: 0 auto; padding: 0 20px; height: 50px; display: flex; flex-direction: row; align-items: center; gap: 16px; }
.nav-tabs { display: flex; flex-direction: row; gap: 8px; margin-left: auto; }
.nav-tab { display: inline-flex; flex-direction: row; align-items: center; gap: 6px; padding: 6px 12px; cursor: pointer; color: var(--k-color-text-description); border-bottom: 2px solid transparent; transition: color .15s ease, border-color .15s ease; white-space: nowrap; }
.nav-tab:hover { color: var(--k-color-text); }
.nav-tab.active { color: var(--k-color-active); border-bottom-color: var(--k-color-active); font-weight: 600; }
.tab-icon { display: inline-flex; font-size: 14px; width: 14px; height: 14px; flex-shrink: 0; }
.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  height: calc(100vh - 50px);
  overflow: hidden;
  box-sizing: border-box;
}
.logo-area {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 6px;
  cursor: default;
}

.logo-area .logo-text {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--k-color-text);
  white-space: nowrap;
}

.logo-area .version-text {
  font-size: 11px;
  color: var(--k-color-text-description);
  font-weight: 400;
  opacity: 0.7;
}

/* 版本信息悬浮提示 */
.version-tooltip {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  padding: 4px 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  white-space: nowrap;
  font-size: 12px;
}

.tooltip-ok {
  color: var(--k-color-success, #67c23a);
}

.tooltip-update {
  color: var(--k-color-active);
  font-weight: 500;
}

/* Tooltip 过渡动画 */
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 更新按钮 - 箭头样式 */
.update-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--k-color-active);
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(64, 158, 255, 0.4);
}

.update-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 3px 10px rgba(64, 158, 255, 0.5);
}

.update-icon {
  width: 14px;
  height: 14px;
}

/* Hide default Koishi console headers */
.app-layout :deep(.k-header),
.app-layout :deep(.k-view-header),
.app-layout :deep(.k-page-header),
.app-layout :deep(.k-toolbar) { display: none !important; height: 0 !important; margin: 0 !important; padding: 0 !important; }
</style>

<style>
/* Global Element Plus Overrides */
.el-dialog {
  background-color: var(--k-card-bg) !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
  border: 1px solid var(--k-color-border) !important;
  --el-dialog-bg-color: var(--k-card-bg) !important;
}

.el-dialog__header {
  padding: 1.25rem 1.5rem !important;
  border-bottom: 1px solid var(--k-color-border) !important;
  margin-right: 0 !important;
}

.el-dialog__title {
  font-weight: 600 !important;
  color: var(--k-color-text) !important;
  font-size: 1.1rem !important;
}

.el-dialog__headerbtn {
  top: 1.25rem !important;
}

.el-dialog__body {
  padding: 1.5rem !important;
  color: var(--k-color-text) !important;
}

.el-dialog__footer {
  padding: 1.25rem 1.5rem !important;
  border-top: 1px solid var(--k-color-border) !important;
  background-color: var(--k-color-bg-1) !important;
}

/* Fix Input Backgrounds in Dialogs */
.el-input__wrapper, .el-textarea__inner {
  background-color: var(--k-color-bg-2) !important;
  box-shadow: 0 0 0 1px var(--k-color-border) inset !important;
}

.el-input__wrapper:hover, .el-textarea__inner:hover {
  box-shadow: 0 0 0 1px var(--k-color-active) inset !important;
}

.el-input__wrapper.is-focus, .el-textarea__inner:focus {
  box-shadow: 0 0 0 1px var(--k-color-active) inset !important;
  background-color: var(--k-color-bg-1) !important;
}

.el-input__inner {
  color: var(--k-color-text) !important;
}

/* Fix Select Dropdown */
.el-select-dropdown__item {
  color: var(--k-color-text) !important;
}

.el-select-dropdown__item.hover, .el-select-dropdown__item:hover {
  background-color: var(--k-color-bg-2) !important;
}

.el-popper.is-light {
  background: var(--k-card-bg) !important;
  border: 1px solid var(--k-color-border) !important;
}
</style>
