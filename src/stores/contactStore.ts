'use client'
import { create } from 'zustand'
import type { ChatRequest } from '@/types/app'

interface ContactState {
  pendingRequests: ChatRequest[]

  setPendingRequests: (reqs: ChatRequest[]) => void
  addPendingRequest: (req: ChatRequest) => void
  removeRequest: (id: string) => void
}

export const useContactStore = create<ContactState>((set) => ({
  pendingRequests: [],

  setPendingRequests: (pendingRequests) => set({ pendingRequests }),

  addPendingRequest: (req) =>
    set((s) => ({
      pendingRequests: s.pendingRequests.some((r) => r.id === req.id)
        ? s.pendingRequests
        : [req, ...s.pendingRequests],
    })),

  removeRequest: (id) =>
    set((s) => ({
      pendingRequests: s.pendingRequests.filter((r) => r.id !== id),
    })),
}))
