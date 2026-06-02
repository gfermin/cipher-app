'use client'
import { cn } from '@/lib/utils'
import type { Toast as ToastType } from '@/types/app'

interface Props { toast: ToastType }

export function Toast({ toast }: Props) {
  return (
    <div className={cn('toast', toast.type)}>
      {toast.message}
    </div>
  )
}
