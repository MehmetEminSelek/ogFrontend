<template>
  <v-dialog
    v-model="dialogModel"
    max-width="480"
    persistent
  >
    <v-card class="forgot-password-dialog">
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2" color="primary">mdi-lock-reset</v-icon>
        <span>Şifre Sıfırlama</span>
        <v-spacer></v-spacer>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          @click="closeDialog"
        ></v-btn>
      </v-card-title>

      <v-card-text>
        <div v-if="!emailSent">
          <p class="text-body-2 mb-4 text-medium-emphasis">
            E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.
          </p>

          <v-form ref="forgotForm" @submit.prevent="handleSubmit">
            <v-text-field
              v-model="email"
              label="E-posta Adresi"
              type="email"
              prepend-inner-icon="mdi-email"
              :rules="emailRules"
              :loading="loading"
              :disabled="loading"
              variant="outlined"
              density="comfortable"
              required
            ></v-text-field>

            <div v-if="error" class="text-error text-caption mb-3">
              {{ error }}
            </div>
          </v-form>
        </div>

        <div v-else class="text-center">
          <v-icon size="64" color="success" class="mb-4">mdi-email-check</v-icon>
          <h3 class="text-h6 mb-3">E-posta Gönderildi!</h3>
          <p class="text-body-2 text-medium-emphasis">
            <strong>{{ email }}</strong> adresine şifre sıfırlama bağlantısı gönderildi.
            <br><br>
            E-postanızı kontrol edin ve bağlantıya tıklayarak şifrenizi sıfırlayın.
          </p>
        </div>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn
          v-if="!emailSent"
          variant="text"
          @click="closeDialog"
          :disabled="loading"
        >
          İptal
        </v-btn>
        <v-btn
          v-if="!emailSent"
          color="primary"
          variant="flat"
          :loading="loading"
          @click="handleSubmit"
        >
          Gönder
        </v-btn>
        <v-btn
          v-else
          color="primary"
          variant="flat"
          @click="closeDialog"
        >
          Tamam
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

// Reactive data
const forgotForm = ref(null)
const email = ref('')
const loading = ref(false)
const error = ref(null)
const emailSent = ref(false)

// Computed
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Validation rules
const emailRules = [
  v => !!v || 'E-posta adresi gerekli',
  v => /.+@.+\..+/.test(v) || 'Geçerli bir e-posta adresi girin'
]

// Methods
const handleSubmit = async () => {
  if (!forgotForm.value) return

  const { valid } = await forgotForm.value.validate()
  if (!valid) return

  loading.value = true
  error.value = null

  try {
    // TODO: API call to send reset email
    await new Promise(resolve => setTimeout(resolve, 2000)) // Simulated API call
    
    emailSent.value = true
  } catch (err) {
    error.value = err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.'
  } finally {
    loading.value = false
  }
}

const closeDialog = () => {
  dialogModel.value = false
}

const resetForm = () => {
  email.value = ''
  error.value = null
  emailSent.value = false
  loading.value = false
  if (forgotForm.value) {
    forgotForm.value.resetValidation()
  }
}

// Watch for dialog close to reset form
watch(dialogModel, (newVal) => {
  if (!newVal) {
    setTimeout(resetForm, 300) // Delay to allow dialog animation
  }
})
</script>

<style scoped>
.forgot-password-dialog {
  overflow: hidden;
}
</style> 