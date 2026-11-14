<script setup lang="ts">
import { computed } from "vue";
import { MButton, MDialog } from "material/vue";

const props = defineProps<{
  open: boolean;
  name?: string;
  symbol?: string;
  icon?: string | null;
  image?: string | null;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const isSleekWow = computed(
  () => (props.name ?? "").toLowerCase() === "sleekwow.png",
);

function close() {
  emit("update:open", false);
}
</script>

<template>
  <MDialog
    :open="open"
    headline="只需要点击一次即可"
    size="medium"
    animation="scale"
    @close="close"
  >
    <div class="wow-dialog">
      <div v-if="image" class="wow-art">
        <img :src="image" :alt="name || '预览图'" draggable="false" />
      </div>
      <div v-else class="wow-icon-tile">
        <img v-if="icon" :src="icon" alt="" draggable="false" />
        <span v-else class="material-symbols-rounded" aria-hidden="true">
          {{ symbol || "touch_app" }}
        </span>
      </div>

      <p v-if="isSleekWow">
        已经收到你的连续点击啦。sleekwow.png 就在这里，它不会跑掉，点一次就够了。
      </p>
      <p v-else-if="name">
        “{{ name }}”已经收到你的点击啦，点一次就够了，再点也不会多开一个。
      </p>
      <p v-else>点一次就够了，再点也不会多开一个。</p>
    </div>

    <template #actions>
      <MButton variant="text" @click="close">取消</MButton>
      <MButton variant="text" @click="close">知道了，继续</MButton>
    </template>
  </MDialog>
</template>

<style scoped>
.wow-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.wow-art {
  overflow: hidden;
  border-radius: 20px;
  background: var(--surface-inner);
}

.wow-art img {
  display: block;
  width: 100%;
  height: 184px;
  object-fit: cover;
  object-position: center;
}

.wow-icon-tile {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  margin: 2px 0;
  overflow: hidden;
  border-radius: 24px;
  background: var(--accent-container);
  color: var(--on-accent-container);
}

.wow-icon-tile img {
  width: 100%;
  height: 100%;
  padding: 14px;
  object-fit: contain;
}

.wow-icon-tile .material-symbols-rounded {
  font-size: 38px;
}

.wow-dialog p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.65;
}
</style>
