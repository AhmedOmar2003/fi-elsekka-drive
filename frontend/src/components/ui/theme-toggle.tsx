"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="w-10 h-10 rounded-xl bg-surface-hover animate-pulse" />
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:text-foreground hover:bg-surface-hover active:scale-95 transition-all shadow-sm border border-transparent hover:border-surface-border"
      title={resolvedTheme === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع المظلم'}
    >
      {resolvedTheme === "dark" ? (
        <Moon className="w-5 h-5 text-gray-300" />
      ) : (
        <Sun className="w-5 h-5 text-amber-500" />
      )}
      <span className="sr-only">تبديل المظهر</span>
    </button>
  )
}
