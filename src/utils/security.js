/**
 * =============================================
 * FRONTEND SECURITY UTILITIES - COMPREHENSIVE SECURITY LAYER
 * =============================================
 */

import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

/**
 * Security Error Types
 */
export const SECURITY_ERRORS = {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    CSRF_TOKEN_MISSING: 'CSRF_TOKEN_MISSING',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    RATE_LIMITED: 'RATE_LIMITED',
    INVALID_INPUT: 'INVALID_INPUT',
    SECURITY_VIOLATION: 'SECURITY_VIOLATION'
}

/**
 * Security Levels
 */
export const SECURITY_LEVELS = {
    NORMAL: 'NORMAL',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
}

/**
 * Enhanced Error Handler with Security Features
 */
export class SecurityErrorHandler {
    constructor() {
        this._authStore = null
        this._router = null
        this.errorHistory = []
        this.maxErrorHistory = 50
    }

    // Lazy initialization for Pinia store
    get authStore() {
        if (!this._authStore) {
            try {
                this._authStore = useAuthStore()
            } catch (error) {
                console.warn('AuthStore not available yet:', error.message)
                return null
            }
        }
        return this._authStore
    }

    // Lazy initialization for Vue Router
    get router() {
        if (!this._router) {
            try {
                this._router = useRouter()
            } catch (error) {
                console.warn('Router not available yet:', error.message)
                return null
            }
        }
        return this._router
    }

    /**
     * Handle API errors with security context
     */
    handleApiError(error, context = {}) {
        const errorInfo = this.parseError(error)

        // Log error with security context
        this.logSecurityError(errorInfo, context)

        // Handle specific security errors
        this.handleSecurityError(errorInfo)

        // Store in error history
        this.addToErrorHistory(errorInfo, context)

        // Return user-friendly error
        return this.getUserFriendlyError(errorInfo)
    }

    /**
     * Parse error response
     */
    parseError(error) {
        const errorInfo = {
            type: 'UNKNOWN',
            message: 'An unexpected error occurred',
            code: null,
            statusCode: null,
            timestamp: new Date().toISOString(),
            severity: 'MEDIUM'
        }

        if (error.response) {
            // API error response
            errorInfo.statusCode = error.response.status
            errorInfo.message = error.response.data?.error || error.response.data?.message || errorInfo.message
            errorInfo.code = error.response.data?.code || null

            // Determine error type based on status code
            switch (error.response.status) {
                case 401:
                    errorInfo.type = SECURITY_ERRORS.UNAUTHORIZED
                    errorInfo.severity = 'HIGH'
                    break
                case 403:
                    errorInfo.type = SECURITY_ERRORS.FORBIDDEN
                    errorInfo.severity = 'HIGH'
                    break
                case 429:
                    errorInfo.type = SECURITY_ERRORS.RATE_LIMITED
                    errorInfo.severity = 'MEDIUM'
                    break
                case 422:
                    errorInfo.type = SECURITY_ERRORS.INVALID_INPUT
                    errorInfo.severity = 'LOW'
                    break
                default:
                    errorInfo.type = 'API_ERROR'
            }
        } else if (error.request) {
            // Network error
            errorInfo.type = 'NETWORK_ERROR'
            errorInfo.message = 'Network connection failed'
            errorInfo.severity = 'MEDIUM'
        } else {
            // Client error
            errorInfo.type = 'CLIENT_ERROR'
            errorInfo.message = error.message || errorInfo.message
            errorInfo.severity = 'LOW'
        }

        return errorInfo
    }

    /**
     * Handle specific security errors
     */
    handleSecurityError(errorInfo) {
        switch (errorInfo.type) {
            case SECURITY_ERRORS.UNAUTHORIZED:
            case SECURITY_ERRORS.SESSION_EXPIRED:
                this.handleSessionExpiry()
                break

            case SECURITY_ERRORS.FORBIDDEN:
            case SECURITY_ERRORS.PERMISSION_DENIED:
                this.handlePermissionDenied()
                break

            case SECURITY_ERRORS.ACCOUNT_LOCKED:
                this.handleAccountLocked()
                break

            case SECURITY_ERRORS.CSRF_TOKEN_MISSING:
                this.handleCSRFError()
                break

            case SECURITY_ERRORS.RATE_LIMITED:
                this.handleRateLimit()
                break

            case SECURITY_ERRORS.SECURITY_VIOLATION:
                this.handleSecurityViolation()
                break
        }
    }

    /**
     * Handle session expiry
     */
    handleSessionExpiry() {
        if (this.authStore) {
            this.authStore.clearAuth()
        }
        if (this.router) {
            this.router.push('/login?reason=expired')
        }
        this.showSecurityAlert('Your session has expired. Please log in again.', 'warning')
    }

    /**
     * Handle permission denied
     */
    handlePermissionDenied() {
        this.showSecurityAlert('You do not have permission to perform this action.', 'error')
        // Optionally redirect to dashboard or previous page
        if (this.router) {
            this.router.push('/dashboard')
        }
    }

    /**
     * Handle account locked
     */
    handleAccountLocked() {
        if (this.authStore) {
            this.authStore.clearAuth()
        }
        if (this.router) {
            this.router.push('/login?reason=locked')
        }
        this.showSecurityAlert('Your account has been temporarily locked due to security reasons.', 'error')
    }

    /**
     * Handle CSRF token error
     */
    async handleCSRFError() {
        try {
            // Try to refresh CSRF token
            if (this.authStore) {
                await this.authStore.fetchCSRFToken()
                this.showSecurityAlert('Security token refreshed. Please try again.', 'info')
            } else {
                this.handleSessionExpiry()
            }
        } catch (error) {
            this.handleSessionExpiry()
        }
    }

    /**
     * Handle rate limiting
     */
    handleRateLimit() {
        this.showSecurityAlert('Too many requests. Please wait a moment before trying again.', 'warning')
    }

    /**
     * Handle security violation
     */
    handleSecurityViolation() {
        if (this.authStore) {
            this.authStore.setSecurityLevel(SECURITY_LEVELS.CRITICAL)
        }
        this.showSecurityAlert('Security violation detected. All actions are being monitored.', 'error')

        // Log additional security context
        this.logSecurityViolation()
    }

    /**
     * Get user-friendly error message
     */
    getUserFriendlyError(errorInfo) {
        const friendlyMessages = {
            [SECURITY_ERRORS.UNAUTHORIZED]: 'Please log in to continue.',
            [SECURITY_ERRORS.FORBIDDEN]: 'Access denied. You do not have permission.',
            [SECURITY_ERRORS.SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
            [SECURITY_ERRORS.ACCOUNT_LOCKED]: 'Your account is temporarily locked.',
            [SECURITY_ERRORS.RATE_LIMITED]: 'Too many requests. Please wait and try again.',
            [SECURITY_ERRORS.INVALID_INPUT]: 'Please check your input and try again.',
            'NETWORK_ERROR': 'Connection failed. Please check your internet connection.',
            'API_ERROR': 'Server error. Please try again later.'
        }

        return {
            type: errorInfo.type,
            message: friendlyMessages[errorInfo.type] || errorInfo.message,
            severity: errorInfo.severity,
            timestamp: errorInfo.timestamp
        }
    }

    /**
     * Log security error
     */
    logSecurityError(errorInfo, context) {
        const logData = {
            ...errorInfo,
            context,
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: this.authStore?.user?.id,
            sessionId: this.authStore?.sessionId
        }

        // Log to console (development)
        if (import.meta.env.DEV) {
            console.error('Security Error:', logData)
        }

        // Send to monitoring service (production)
        if (import.meta.env.PROD && errorInfo.severity !== 'LOW') {
            this.sendToMonitoring(logData)
        }
    }

    /**
     * Log security violation
     */
    logSecurityViolation() {
        const violationData = {
            type: 'SECURITY_VIOLATION',
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: this.authStore?.user?.id,
            sessionId: this.authStore?.sessionId,
            errorHistory: this.errorHistory.slice(-10) // Last 10 errors
        }

        console.warn('Security Violation:', violationData)
        this.sendToMonitoring(violationData, true) // High priority
    }

    /**
     * Add error to history
     */
    addToErrorHistory(errorInfo, context) {
        this.errorHistory.push({
            ...errorInfo,
            context,
            timestamp: new Date().toISOString()
        })

        // Keep history size limited
        if (this.errorHistory.length > this.maxErrorHistory) {
            this.errorHistory = this.errorHistory.slice(-this.maxErrorHistory)
        }
    }

    /**
     * Send to monitoring service
     */
    async sendToMonitoring(data, highPriority = false) {
        try {
            await fetch('/api/monitoring/frontend-errors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.authStore?.getSecurityHeaders() || {})
                },
                body: JSON.stringify({
                    ...data,
                    priority: highPriority ? 'HIGH' : 'NORMAL'
                })
            })
        } catch (error) {
            console.error('Failed to send error to monitoring:', error)
        }
    }

    /**
     * Show security alert to user
     */
    showSecurityAlert(message, type = 'info') {
        // This would integrate with your notification system
        // For now, we'll use a simple approach
        console.log(`Security Alert (${type}):`, message)

        // You can replace this with your notification library
        // Example: this.notificationStore.add({ message, type, security: true })
    }
}

/**
 * Input Sanitizer
 */
export class InputSanitizer {
    /**
     * Sanitize string input
     */
    static sanitizeString(input) {
        if (typeof input !== 'string') return input

        return input
            .trim()
            .replace(/[<>]/g, '') // Remove HTML brackets
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
    }

    /**
     * Sanitize HTML content
     */
    static sanitizeHTML(html) {
        const div = document.createElement('div')
        div.textContent = html
        return div.innerHTML
    }

    /**
     * Validate email format
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }

    /**
     * Validate phone format
     */
    static isValidPhone(phone) {
        const phoneRegex = /^[\d\s\-\+\(\)]{10,15}$/
        return phoneRegex.test(phone)
    }

    /**
     * Check for potential XSS
     */
    static hasXSSAttempt(input) {
        const xssPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+=/i,
            /<iframe/i,
            /<object/i,
            /<embed/i
        ]

        return xssPatterns.some(pattern => pattern.test(input))
    }
}

/**
 * Permission Utilities
 */
export class PermissionUtils {
    static checkPermission(permission) {
        const authStore = useAuthStore()
        return authStore.checkPermission(permission)
    }

    static requirePermission(permission) {
        if (!this.checkPermission(permission)) {
            throw new Error(`Permission denied: ${permission}`)
        }
        return true
    }

    static canAccessFinancialData() {
        const authStore = useAuthStore()
        return authStore.canAccessFinancialData
    }

    static canManageUsers() {
        const authStore = useAuthStore()
        return authStore.canManageUsers
    }

    static canAccessAuditLogs() {
        const authStore = useAuthStore()
        return authStore.canAccessAuditLogs
    }

    static getRoleDisplayName(role) {
        const roleNames = {
            'ADMIN': 'Yönetici',
            'MANAGER': 'Müdür',
            'SUPERVISOR': 'Süpervizör',
            'OPERATOR': 'Operatör',
            'VIEWER': 'Görüntüleyici'
        }
        return roleNames[role] || role
    }
}

/**
 * Security Validator
 */
export class SecurityValidator {
    /**
     * Validate file upload
     */
    static validateFileUpload(file, options = {}) {
        const {
            maxSize = 5 * 1024 * 1024, // 5MB
            allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'],
            allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf']
        } = options

        const errors = []

        // Check file size
        if (file.size > maxSize) {
            errors.push(`File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`)
        }

        // Check file type
        if (!allowedTypes.includes(file.type)) {
            errors.push('File type not allowed')
        }

        // Check file extension
        const extension = '.' + file.name.split('.').pop().toLowerCase()
        if (!allowedExtensions.includes(extension)) {
            errors.push('File extension not allowed')
        }

        return {
            isValid: errors.length === 0,
            errors
        }
    }

    /**
     * Validate URL
     */
    static isValidURL(url) {
        try {
            const urlObj = new URL(url)
            return ['http:', 'https:'].includes(urlObj.protocol)
        } catch {
            return false
        }
    }

    /**
     * Check password strength
     */
    static checkPasswordStrength(password) {
        const checks = {
            length: password.length >= 8,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            numbers: /\d/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        }

        const score = Object.values(checks).filter(Boolean).length

        let strength = 'Very Weak'
        if (score >= 5) strength = 'Very Strong'
        else if (score >= 4) strength = 'Strong'
        else if (score >= 3) strength = 'Medium'
        else if (score >= 2) strength = 'Weak'

        return {
            score,
            strength,
            checks,
            isStrong: score >= 4
        }
    }
}

// Create singleton instances
export const securityErrorHandler = new SecurityErrorHandler() 