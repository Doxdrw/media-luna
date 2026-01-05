<template>
  <div class="masonry-wrapper" ref="wrapperRef">
    <div class="masonry-container">
      <div
        v-for="colIndex in columnCount"
        :key="'col-' + colIndex"
        class="masonry-column"
        :style="{ width: columnWidth }"
        :ref="(el: any) => setColumnRef(colIndex - 1, el)"
      >
        <div
          v-for="assignment in columnAssignments[colIndex - 1] || []"
          :key="itemKey(assignment.item as any, assignment.index)"
          class="masonry-item"
          :data-index="assignment.index"
        >
          <slot :item="assignment.item" :index="assignment.index"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

interface Props {
  items: T[]
  /** 获取每个 item 的唯一 key */
  itemKey: (item: T, index: number) => string | number
  /** 最小列宽，用于自动计算列数 */
  minColumnWidth?: number
  /** 列间距 */
  gap?: number
}

const props = withDefaults(defineProps<Props>(), {
  minColumnWidth: 200,
  gap: 16
})

const wrapperRef = ref<HTMLElement | null>(null)
const containerWidth = ref(0)

// 列元素引用
const columnRefs = ref<Map<number, HTMLElement>>(new Map())

const setColumnRef = (index: number, el: any) => {
  if (el) {
    columnRefs.value.set(index, el as HTMLElement)
  } else {
    columnRefs.value.delete(index)
  }
}

// 列分配结果
interface Assignment {
  item: T
  index: number
}

// 计算列数
const columnCount = computed(() => {
  if (containerWidth.value <= 0) return 1
  const count = Math.floor((containerWidth.value + props.gap) / (props.minColumnWidth + props.gap))
  return Math.max(1, count)
})

// CSS 列宽
const columnWidth = computed(() => {
  return `calc((100% - ${(columnCount.value - 1) * props.gap}px) / ${columnCount.value})`
})

// 列分配状态
const columnAssignments = ref<Assignment[][]>([])

// 当前分配版本
let currentVersion = 0

/**
 * 简单轮询分配（用于初始快速显示）
 */
function simpleAssign(items: T[], colCount: number): Assignment[][] {
  const cols: Assignment[][] = []
  for (let i = 0; i < colCount; i++) {
    cols.push([])
  }
  for (let i = 0; i < items.length; i++) {
    cols[i % colCount].push({ item: items[i], index: i })
  }
  return cols
}

/**
 * 根据实际列高度重新分配
 */
function reassignByHeight(items: T[], colCount: number): Assignment[][] {
  // 获取每列当前真实高度
  const colHeights: number[] = []
  for (let i = 0; i < colCount; i++) {
    const colEl = columnRefs.value.get(i)
    colHeights.push(colEl ? colEl.offsetHeight : 0)
  }

  // 获取每个 item 的真实高度
  const itemHeights: number[] = []
  for (let i = 0; i < colCount; i++) {
    const colEl = columnRefs.value.get(i)
    if (colEl) {
      const itemEls = colEl.querySelectorAll('.masonry-item')
      itemEls.forEach((el) => {
        const idx = parseInt((el as HTMLElement).dataset.index || '0', 10)
        itemHeights[idx] = (el as HTMLElement).offsetHeight
      })
    }
  }

  // 使用贪心算法重新分配
  const cols: Assignment[][] = []
  const newColHeights: number[] = []
  for (let i = 0; i < colCount; i++) {
    cols.push([])
    newColHeights.push(0)
  }

  for (let i = 0; i < items.length; i++) {
    // 找最短列
    let minHeight = Infinity
    let minCol = 0
    for (let c = 0; c < colCount; c++) {
      if (newColHeights[c] < minHeight) {
        minHeight = newColHeights[c]
        minCol = c
      }
    }

    cols[minCol].push({ item: items[i], index: i })
    newColHeights[minCol] += (itemHeights[i] || 200) + props.gap
  }

  return cols
}

/**
 * 等待所有图片加载完成
 */
function waitForAllImages(): Promise<void> {
  return new Promise((resolve) => {
    const images = wrapperRef.value?.querySelectorAll('img') || []
    if (images.length === 0) {
      resolve()
      return
    }

    let loaded = 0
    const total = images.length
    const checkDone = () => {
      loaded++
      if (loaded >= total) {
        resolve()
      }
    }

    images.forEach((img) => {
      if (img.complete) {
        checkDone()
      } else {
        img.addEventListener('load', checkDone, { once: true })
        img.addEventListener('error', checkDone, { once: true })
      }
    })

    // 超时保护
    setTimeout(resolve, 5000)
  })
}

/**
 * 重新分配 items
 * 1. 先用简单轮询快速显示
 * 2. 等图片加载完后按真实高度重新分配
 */
async function redistributeItems() {
  const version = ++currentVersion
  const colCount = columnCount.value
  const items = props.items

  if (items.length === 0) {
    columnAssignments.value = []
    return
  }

  // 1. 先用简单轮询快速显示
  columnAssignments.value = simpleAssign(items, colCount) as any

  // 等待 DOM 更新
  await nextTick()

  if (version !== currentVersion) return

  // 2. 等待所有图片加载完成
  await waitForAllImages()

  if (version !== currentVersion) return

  // 3. 按真实高度重新分配
  await nextTick()

  if (version !== currentVersion) return

  columnAssignments.value = reassignByHeight(items, colCount) as any
}

// 监听 items 变化
watch(
  () => props.items,
  () => {
    redistributeItems()
  },
  { deep: true }
)

// 监听列数变化
watch(columnCount, () => {
  nextTick(() => {
    redistributeItems()
  })
})

// 监听容器宽度变化
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (wrapperRef.value) {
    containerWidth.value = wrapperRef.value.offsetWidth

    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width
        if (Math.abs(newWidth - containerWidth.value) > 5) {
          containerWidth.value = newWidth
        }
      }
    })
    resizeObserver.observe(wrapperRef.value)
  }

  // 初始分配
  nextTick(() => {
    redistributeItems()
  })
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})
</script>

<style scoped>
.masonry-wrapper {
  width: 100%;
  position: relative;
}

.masonry-container {
  display: flex;
  gap: v-bind('props.gap + "px"');
  width: 100%;
  align-items: flex-start;
}

.masonry-column {
  display: flex;
  flex-direction: column;
  gap: v-bind('props.gap + "px"');
  min-width: 0;
}

.masonry-item {
  break-inside: avoid;
}
</style>
