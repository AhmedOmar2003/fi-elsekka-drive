"use client"

import React from 'react'
import {
  APP_SETTINGS_STORAGE_KEY,
  APP_SETTINGS_UPDATED_EVENT,
  DEFAULT_APP_SETTINGS,
  fetchPublicAppSettings,
  type AppSettings,
} from '@/services/appSettingsService'

type AppSettingsContextValue = {
  settings: AppSettings
  isLoading: boolean
  refreshSettings: () => Promise<void>
}

const AppSettingsContext = React.createContext<AppSettingsContextValue>({
  settings: DEFAULT_APP_SETTINGS,
  isLoading: true,
  refreshSettings: async () => {},
})

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [isLoading, setIsLoading] = React.useState(true)

  const refreshSettings = React.useCallback(async () => {
    try {
      const remote = await fetchPublicAppSettings()
      setSettings(remote)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    try {
      const cachedRaw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY)
      if (cachedRaw) {
        setSettings({
          ...DEFAULT_APP_SETTINGS,
          ...(JSON.parse(cachedRaw) as Partial<AppSettings>),
        })
        setIsLoading(false)
      }
    } catch {
      // Ignore local cache read errors.
    }

    void refreshSettings()

    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<AppSettings>).detail
      if (!detail) return
      setSettings({
        ...DEFAULT_APP_SETTINGS,
        ...detail,
      })
      setIsLoading(false)
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== APP_SETTINGS_STORAGE_KEY || !event.newValue) return

      try {
        setSettings({
          ...DEFAULT_APP_SETTINGS,
          ...(JSON.parse(event.newValue) as Partial<AppSettings>),
        })
        setIsLoading(false)
      } catch {
        // Ignore malformed values from localStorage.
      }
    }

    window.addEventListener(APP_SETTINGS_UPDATED_EVENT, handleUpdated as EventListener)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(APP_SETTINGS_UPDATED_EVENT, handleUpdated as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [refreshSettings])

  return (
    <AppSettingsContext.Provider value={{ settings, isLoading, refreshSettings }}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  return React.useContext(AppSettingsContext)
}
