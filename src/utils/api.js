/**
 * =============================================
 * ENHANCED API UTILITIES - SECURITY INTEGRATED
 * =============================================
 */

import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { securityErrorHandler, InputSanitizer, SECURITY_LEVELS } from './security'

// API Configuration
const API_CONFIG = {
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    maxRetryDelay: 5000 // 5 seconds
}

/**
 * Enhanced Axios Instance with Security Features
 */
const createSecureApiClient = () => {
    const client = axios.create({
        baseURL: API_CONFIG.baseURL,
        timeout: API_CONFIG.timeout,
        headers: {
            'Content-Type': 'application/json'
        }
    })

    // Request Interceptor - Add Security Headers
    client.interceptors.request.use(
        async (config) => {
            const authStore = useAuthStore()

            try {
                // Add security headers
                const securityHeaders = authStore.getSecurityHeaders()
                config.headers = { ...config.headers, ...securityHeaders }

                // Add request timestamp
                config.headers['X-Request-Timestamp'] = Date.now()

                // Add security level
                config.headers['X-Security-Level'] = authStore.securityLevel || SECURITY_LEVELS.NORMAL

                // Input sanitization for POST/PUT requests
                if (['post', 'put', 'patch'].includes(config.method.toLowerCase()) && config.data) {
                    config.data = sanitizeRequestData(config.data)
                }

                // Cache control for GET requests
                if (config.method.toLowerCase() === 'get') {
                    config.headers['Cache-Control'] = 'max-age=300' // 5 minutes
                }

                // Update user activity
                authStore.updateActivity()

                return config
            } catch (error) {
                console.error('Request interceptor error:', error)
                return Promise.reject(error)
            }
        },
        (error) => {
            console.error('Request setup error:', error)
            return Promise.reject(error)
        }
    )

    // Response Interceptor - Handle Security Responses
    client.interceptors.response.use(
        (response) => {
            // Handle successful responses
            const authStore = useAuthStore()

            // Update CSRF token if provided
            const newCSRFToken = response.headers['x-csrf-token']
            if (newCSRFToken && authStore.csrfToken !== newCSRFToken) {
                authStore.csrfToken = newCSRFToken
            }

            // Check for security warnings
            const securityWarning = response.headers['x-security-warning']
            if (securityWarning) {
                console.warn('Security Warning:', securityWarning)
                securityErrorHandler.showSecurityAlert(securityWarning, 'warning')
            }

            return response
        },
        async (error) => {
            const authStore = useAuthStore()

            // Handle token refresh for 401 errors
            if (error.response?.status === 401 && authStore.refreshToken) {
                try {
                    await authStore.refreshTokens()

                    // Retry original request with new token
                    const originalRequest = error.config
                    if (!originalRequest._retry) {
                        originalRequest._retry = true
                        originalRequest.headers = {
                            ...originalRequest.headers,
                            ...authStore.getSecurityHeaders()
                        }
                        return client(originalRequest)
                    }
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError)
                    authStore.clearAuth()
                }
            }

            // Handle security errors
            const securityError = securityErrorHandler.handleApiError(error, {
                url: error.config?.url,
                method: error.config?.method,
                userId: authStore.user?.id
            })

            return Promise.reject(securityError)
        }
    )

    return client
}

/**
 * Sanitize request data
 */
function sanitizeRequestData(data) {
    if (typeof data === 'string') {
        return InputSanitizer.sanitizeString(data)
    }

    if (Array.isArray(data)) {
        return data.map(item => sanitizeRequestData(item))
    }

    if (typeof data === 'object' && data !== null) {
        const sanitized = {}
        for (const [key, value] of Object.entries(data)) {
            sanitized[key] = sanitizeRequestData(value)
        }
        return sanitized
    }

    return data
}

/**
 * Enhanced API Client with Retry Logic
 */
class EnhancedApiClient {
    constructor() {
        this.client = createSecureApiClient()
    }

    /**
     * Make API request with retry logic
     */
    async request(config, options = {}) {
        const {
            retryAttempts = API_CONFIG.retryAttempts,
            retryDelay = API_CONFIG.retryDelay,
            onRetry = null
        } = options

        let lastError = null

        for (let attempt = 0; attempt <= retryAttempts; attempt++) {
            try {
                const response = await this.client(config)
                return response.data
            } catch (error) {
                lastError = error

                // Don't retry for certain errors
                if (this.shouldNotRetry(error) || attempt === retryAttempts) {
                    throw error
                }

                // Calculate delay with exponential backoff
                const delay = Math.min(
                    retryDelay * Math.pow(2, attempt),
                    API_CONFIG.maxRetryDelay
                )

                console.warn(`API request failed (attempt ${attempt + 1}/${retryAttempts + 1}), retrying in ${delay}ms...`)

                if (onRetry) {
                    onRetry(attempt + 1, error)
                }

                await this.sleep(delay)
            }
        }

        throw lastError
    }

    /**
     * Check if error should not be retried
     */
    shouldNotRetry(error) {
        const noRetryStatuses = [400, 401, 403, 404, 422, 429]
        return noRetryStatuses.includes(error.response?.status)
    }

    /**
     * Sleep utility for retry delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * GET request
     */
    async get(url, config = {}) {
        return this.request({
            method: 'GET',
            url,
            ...config
        })
    }

    /**
     * POST request
     */
    async post(url, data = {}, config = {}) {
        return this.request({
            method: 'POST',
            url,
            data,
            ...config
        })
    }

    /**
     * PUT request
     */
    async put(url, data = {}, config = {}) {
        return this.request({
            method: 'PUT',
            url,
            data,
            ...config
        })
    }

    /**
     * PATCH request
     */
    async patch(url, data = {}, config = {}) {
        return this.request({
            method: 'PATCH',
            url,
            data,
            ...config
        })
    }

    /**
     * DELETE request
     */
    async delete(url, config = {}) {
        return this.request({
            method: 'DELETE',
            url,
            ...config
        })
    }

    /**
     * Upload file with progress tracking
     */
    async uploadFile(url, file, data = {}, onProgress = null) {
        const formData = new FormData()
        formData.append('file', file)

        // Add additional data
        Object.keys(data).forEach(key => {
            formData.append(key, data[key])
        })

        return this.request({
            method: 'POST',
            url,
            data: formData,
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress) {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    )
                    onProgress(percentCompleted, progressEvent)
                }
            }
        })
    }

    /**
     * Download file
     */
    async downloadFile(url, filename = null, config = {}) {
        const response = await this.request({
            method: 'GET',
            url,
            responseType: 'blob',
            ...config
        })

        // Create download link
        const blob = new Blob([response])
        const downloadUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = filename || 'download'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(downloadUrl)

        return response
    }
}

/**
 * API Endpoints with Security Context
 */
export class ApiEndpoints {
    constructor(client) {
        this.client = client
    }

    // Authentication
    async login(credentials) {
        return this.client.post('/auth/login', credentials)
    }

    async logout() {
        return this.client.post('/auth/logout')
    }

    async refreshToken(refreshToken) {
        return this.client.post('/auth/refresh', { refreshToken })
    }

    async getCSRFToken() {
        return this.client.get('/auth/csrf')
    }

    // Users
    async getUsers(params = {}) {
        return this.client.get('/auth/users', { params })
    }

    async createUser(userData) {
        return this.client.post('/auth/users', userData)
    }

    async updateUser(id, userData) {
        return this.client.put(`/auth/users/${id}`, userData)
    }

    async deleteUser(id) {
        return this.client.delete(`/auth/users/${id}`)
    }

    // Orders
    async getOrders(params = {}) {
        return this.client.get('/siparis', { params })
    }

    async getOrder(id) {
        return this.client.get(`/siparis/${id}`)
    }

    async createOrder(orderData) {
        return this.client.post('/siparis', orderData)
    }

    async updateOrder(id, orderData) {
        return this.client.put(`/siparis/${id}`, orderData)
    }

    async deleteOrder(id) {
        return this.client.delete(`/siparis/${id}`)
    }

    // Customers
    async getCustomers(params = {}) {
        return this.client.get('/cari', { params })
    }

    async createCustomer(customerData) {
        return this.client.post('/cari', customerData)
    }

    async updateCustomer(id, customerData) {
        return this.client.put(`/cari/${id}`, customerData)
    }

    // Products
    async getProducts(params = {}) {
        return this.client.get('/urunler', { params })
    }

    async createProduct(productData) {
        return this.client.post('/urunler', productData)
    }

    async updateProduct(id, productData) {
        return this.client.put(`/urunler/${id}`, productData)
    }

    // Reports
    async getSalesReport(params = {}) {
        return this.client.get('/reports/sales', { params })
    }

    async getCRMReport(params = {}) {
        return this.client.get('/reports/crm', { params })
    }

    // Dropdown data
    async getDropdownData(category = null) {
        const params = category ? { category } : {}
        return this.client.get('/dropdown', { params })
    }

    // File operations
    async uploadUserExcel(file, onProgress = null) {
        return this.client.uploadFile('/excel/upload/kullanici', file, {}, onProgress)
    }

    async uploadCustomerExcel(file, onProgress = null) {
        return this.client.uploadFile('/excel/upload/cari', file, {}, onProgress)
    }

    async downloadUserTemplate() {
        return this.client.downloadFile('/excel/template/kullanici', 'kullanici-sablon.xlsx')
    }

    async downloadCustomerTemplate() {
        return this.client.downloadFile('/excel/template/cari', 'cari-sablon.xlsx')
    }

    // Audit logs (admin only)
    async getAuditLogs(params = {}) {
        return this.client.get('/audit-logs', { params })
    }
}

// Create singleton instances
const apiClient = new EnhancedApiClient()
const api = new ApiEndpoints(apiClient)

/**
 * Universal API call wrapper for legacy compatibility
 * @param {string} url - API endpoint URL
 * @param {object} options - Request options (method, data, params, etc.)
 * @returns {Promise} API response
 */
export const apiCall = async (url, options = {}) => {
    const { method = 'GET', data, params, ...restOptions } = options

    try {
        let response

        switch (method.toUpperCase()) {
            case 'GET':
                response = await apiClient.get(url, { params, ...restOptions })
                break
            case 'POST':
                response = await apiClient.post(url, data, { params, ...restOptions })
                break
            case 'PUT':
                response = await apiClient.put(url, data, { params, ...restOptions })
                break
            case 'DELETE':
                response = await apiClient.delete(url, { params, ...restOptions })
                break
            default:
                throw new Error(`Unsupported HTTP method: ${method}`)
        }

        return response.data
    } catch (error) {
        console.error(`API call failed for ${method} ${url}:`, error)
        throw error
    }
}

// Export enhanced API client and endpoints
export default api
export { apiClient, EnhancedApiClient }

// Legacy support - keep existing api instance
export const legacyApi = createSecureApiClient() 