<template>
  <div class="modal-overlay">
    <div class="modal-content">
      <h3>{{ title }}</h3>
      <p v-if="message">{{ message }}</p>

      <div v-if="options">
        <button
          v-for="(option, index) in options"
          :key="index"
          @click="selectOption(option)"
        >
          {{ option }}
        </button>
      </div>

      <textarea
        v-if="showCustomInput"
        v-model="customReason"
        placeholder="Введите причину"
      />

      <div class="modal-actions">
        <button @click="cancel">Отмена</button>
        <button @click="confirm">Подтвердить</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  title: String,
  message: String,
  options: Array,
  allowCustom: Boolean
});

const emit = defineEmits(['confirm', 'cancel']);

const selectedReason = ref('');
const customReason = ref('');
const showCustomInput = ref(false);

const selectOption = (option) => {
  if (option === 'Другое' && props.allowCustom) {
    showCustomInput.value = true;
  } else {
    selectedReason.value = option;
  }
};

const confirm = () => {
  const finalReason = showCustomInput.value
    ? customReason.value
    : selectedReason.value;
  emit('confirm', finalReason);
};

const cancel = () => emit('cancel');
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1a2233;
  padding: 20px;
  border-radius: 12px;
  min-width: 300px;
  max-width: 90%;
}

.modal-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>