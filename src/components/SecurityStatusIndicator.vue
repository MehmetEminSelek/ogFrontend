<template>
  <div class="security-status-indicator" v-if="showIndicator">
    <v-chip
      :color="statusColor"
      :variant="variant"
      size="small"
      class="security-chip"
    >
      <v-icon start :icon="statusIcon" size="16"></v-icon>
      {{ statusText }}
    </v-chip>
    
    <!-- Detailed View -->
    <v-expand-transition>
      <div v-if="showDetails" class="security-details mt-2">
        <v-card class="security-details-card" variant="outlined">
          <v-card-text class="pa-3">
            <div class="d-flex align-center mb-2">
              <v-icon :color="statusColor" class="me-2">{{ statusIcon }}</v-icon>
              <span class="font-weight-medium">Güvenlik Durumu: {{ statusText }}</span>
            </div>
            <div class="security-metrics">
              <div class="metric-item">
                <span class="metric-label">Şifreleme:</span>
                <v-chip size="x-small" color="success">AES-256</v-chip>
              </div>
              <div class="metric-item">
                <span class="metric-label">Oturum:</span>
                <v-chip size="x-small" color="success">Güvenli</v-chip>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>
    </v-expand-transition>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  securityLevel: {
    type: String,
    default: 'high',
    validator: (value) => ['low', 'medium', 'high', 'critical'].includes(value)
  },
  showDetails: {
    type: Boolean,
    default: false
  },
  showIndicator: {
    type: Boolean,
    default: true
  }
})

const statusConfig = {
  high: {
    color: 'success',
    icon: 'mdi-shield-check',
    text: 'Yüksek Güvenlik',
    variant: 'flat'
  },
  medium: {
    color: 'warning',
    icon: 'mdi-shield-alert',
    text: 'Orta Güvenlik',
    variant: 'flat'
  },
  low: {
    color: 'error',
    icon: 'mdi-shield-remove',
    text: 'Düşük Güvenlik',
    variant: 'flat'
  },
  critical: {
    color: 'error',
    icon: 'mdi-shield-off',
    text: 'Kritik Risk',
    variant: 'flat'
  }
}

const statusColor = computed(() => statusConfig[props.securityLevel].color)
const statusIcon = computed(() => statusConfig[props.securityLevel].icon)
const statusText = computed(() => statusConfig[props.securityLevel].text)
const variant = computed(() => statusConfig[props.securityLevel].variant)
</script>

<style scoped>
.security-status-indicator {
  position: relative;
}

.security-chip {
  font-size: 12px;
  height: 28px;
}

.security-details-card {
  max-width: 300px;
  font-size: 13px;
}

.security-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-label {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
</style> 