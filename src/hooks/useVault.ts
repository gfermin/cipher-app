'use client'
import { useCallback, useRef } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { verifyUserVaultCode } from '@/services/vaultService'
import { VAULT_PASSWORD_PATTERN } from '@/lib/constants'

export function useVault() {
  const { vault, setVault, showToast } = useUIStore()
  const failCountRef = useRef(0)
  const rateLimitedUntilRef = useRef(0)

  const tryUnlockWithInput = useCallback(
    async (input: string, chatId: string): Promise<boolean> => {
      if (!VAULT_PASSWORD_PATTERN.test(input)) return false

      // Client-side gate: mirrors the server cooldown so the user
      // doesn't need to wait for a round-trip to see the toast again.
      if (Date.now() < rateLimitedUntilRef.current) {
        showToast('Too many attempts. Try again later.', 'error')
        return false
      }

      // UX friction: delay the 4th+ consecutive wrong attempt by 3s.
      // This is not a security control — the server enforces the real limit.
      if (failCountRef.current >= 3) {
        await new Promise<void>((r) => setTimeout(r, 3000))
      }

      const result = await verifyUserVaultCode(chatId, input)

      if (result === 'rate_limited') {
        rateLimitedUntilRef.current = Date.now() + 60_000
        failCountRef.current = 0
        showToast('Too many attempts. Try again later.', 'error')
        return false
      }

      if (result === null) {
        failCountRef.current = 0
        showToast('No vault code set. Type secret_vault to create one.', 'info')
        return false
      }

      if (result !== false) {
        // result is the vault session token UUID string
        failCountRef.current = 0
        setVault({ isUnlocked: true, chatId, vaultToken: result })
        return true
      }

      // result === false — wrong code
      failCountRef.current += 1
      return false
    },
    [setVault, showToast]
  )

  const lockVault = useCallback(() => {
    setVault({ isUnlocked: false, chatId: null, vaultToken: null })
  }, [setVault])

  return {
    isUnlocked: vault.isUnlocked,
    vaultChatId: vault.chatId,
    tryUnlockWithInput,
    lockVault,
    showToast,
  }
}
