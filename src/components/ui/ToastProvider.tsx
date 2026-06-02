'use client'
import { useUIStore } from '@/stores/uiStore'
import { Toast } from './Toast'

export function ToastProvider() {
  const { toasts } = useUIStore()

  if (!toasts.length) return null

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>
  )
}
