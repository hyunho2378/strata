// LangContext 한국어 단일. 공용 ui 컴포넌트가 쓰는 t() 를 유지한다. 웹스토리지 금지.
import { createContext, useCallback, useContext, useMemo } from 'react'
import ko from './ko/index.js'

const LangContext = createContext(null)
export const pick = (dict, key) => key.split('.').reduce((o, k) => o?.[k], dict)

export function LangProvider({ children }) {
  const t = useCallback((key, vars) => {
    const value = pick(ko, key)
    if (typeof value !== 'string') return key
    if (!vars) return value
    return value.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
  }, [])
  const value = useMemo(() => ({ lang: 'ko', setLang: () => {}, t }), [t])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang() {
  return useContext(LangContext)
}
