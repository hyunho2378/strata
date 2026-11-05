// useToast.js 전역 Toast 큐. ui/Toast.jsx 가 이 스토어를 그린다.
import { create } from 'zustand'

const DURATION = 4000
let seq = 0

export const useToastStore = create((set) => ({
  toasts: [],
  push: (message, tone = 'neutral') => {
    const id = ++seq
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), DURATION)
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

export default function useToast() {
  return useToastStore((s) => s.push)
}
