"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [show, setShow] = React.useState(false)

  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        className={`pr-11 ${className || ""}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-foreground transition-colors"
        tabIndex={-1}
        aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}
