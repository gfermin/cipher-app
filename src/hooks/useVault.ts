'use client'
import { useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { verifyVaultPassword } from '@/services/vaultService'
import { VAULT_PASSWORD_PATTERN } from '@/lib/constants'

export function useVault() {
  const { vault, setVault, showToast } = useUIStore()

  const tryUnlockWithInput = useCallback(
    async (input: string, chatId: string): Promise<boolean> => {
      if (!VAULT_PASSWORD_PATTERN.test(input)) return false

      const valid = await verifyVaultPassword(chatId, input)
      if (valid) {
        setVault({ isUnlocked: true, chatId })
        return true
      }
      return false
    },
    [setVault]
  )

  const lockVault = useCallback(() => {
    setVault({ isUnlocked: false, chatId: null })
  }, [setVault])

  return {
    isUnlocked: vault.isUnlocked,
    vaultChatId: vault.chatId,
    tryUnlockWithInput,
    lockVault,
    showToast,
  }
}
