import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { X, UserPlus, Mail, Lock, User as UserIcon, ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { firebaseConfig, requireDb } from '../../services/firebase'

import type { UserRole } from '../../context/auth-context'

export interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserCreated: () => void
}

export function CreateUserModal({
  isOpen,
  onClose,
  onUserCreated,
}: CreateUserModalProps) {
  const { t } = useTranslation(['users', 'common'])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName || !trimmedEmail || !tempPassword) {
      setErrorMessage(t('users:createModal.errors.allFieldsRequired'))
      return
    }

    if (tempPassword.length < 6) {
      setErrorMessage(t('users:createModal.errors.weakPassword'))
      return
    }

    setIsSubmitting(true)
    // Create an isolated secondary Firebase app to avoid mutating the current admin session
    const secondaryAppName = `SecondaryApp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName)
    const secondaryAuth = getAuth(secondaryApp)

    try {
      // 1. Create the user credential on the secondary auth instance
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        trimmedEmail,
        tempPassword,
      )
      const newUid = credential.user.uid

      // 2. Persist the user profile and role inside Firestore 'users' collection
      await setDoc(doc(requireDb(), 'users', newUid), {
        uid: newUid,
        name: trimmedName,
        email: trimmedEmail,
        role,
        createdAt: serverTimestamp(),
      })

      // 3. Reset form and inform parent
      setName('')
      setEmail('')
      setTempPassword('')
      setRole('user')
      onUserCreated()
      onClose()
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/email-already-in-use') {
        setErrorMessage(t('users:createModal.errors.emailInUse'))
      } else if (code === 'auth/weak-password') {
        setErrorMessage(t('users:createModal.errors.weakPasswordAuth'))
      } else if (code === 'auth/invalid-email') {
        setErrorMessage(t('users:createModal.errors.invalidEmail'))
      } else {
        setErrorMessage(t('users:createModal.errors.general'))
      }
    } finally {
      // 4. Safely tear down and destroy secondary app instance
      await deleteApp(secondaryApp)
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-create-user-title"
      data-testid="create-user-modal"
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="modal-panel w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Modal Header */}
        <div className="modal-header flex items-center justify-between px-6 sm:px-7 pt-6 sm:pt-7 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="modal-create-user-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                {t('users:createModal.title')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('users:createModal.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common:close')}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body px-6 sm:px-7 py-5 space-y-4">
            {/* Error banner */}
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}
            {/* Name */}
            <div className="space-y-1">
              <label
                htmlFor="user-name"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                {t('users:createModal.name')} *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="user-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('users:createModal.namePlaceholder')}
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label
                htmlFor="user-email"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                {t('users:createModal.email')} *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="user-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('users:createModal.emailPlaceholder')}
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            {/* Temporary Password */}
            <div className="space-y-1">
              <label
                htmlFor="user-password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                {t('users:createModal.password')} *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="user-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder={t('users:createModal.passwordPlaceholder')}
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
                />
                <button
                  type="button"
                  aria-label={showPassword ? t('users:createModal.hidePassword') : t('users:createModal.showPassword')}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Role selection */}
            <div className="space-y-1.5">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {t('users:createModal.role')}
              </span>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    role === 'user'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="user-role"
                    value="user"
                    checked={role === 'user'}
                    onChange={() => setRole('user')}
                    className="sr-only"
                  />
                  <UserIcon className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{t('users:createModal.roleUserTitle')}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {t('users:createModal.roleUserDesc')}
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    role === 'admin'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="user-role"
                    value="admin"
                    checked={role === 'admin'}
                    onChange={() => setRole('admin')}
                    className="sr-only"
                  />
                  <ShieldCheck className="w-4 h-4 shrink-0 text-amber-500" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{t('users:createModal.roleAdminTitle')}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {t('users:createModal.roleAdminDesc')}
                    </span>
                  </div>
                </label>
              </div>
            </div>

          </div>

          {/* Action buttons */}
          <div className="modal-footer flex items-center justify-end gap-3 px-6 sm:px-7 py-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {t('users:createModal.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t('users:createModal.submitting')}</span>
                </>
              ) : (
                <span>{t('users:createModal.submit')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

