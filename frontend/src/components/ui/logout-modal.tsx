import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { HeartCrack } from 'lucide-react'
import { Button } from "@/components/ui/button"

interface LogoutModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function LogoutModal({ isOpen, onClose, onConfirm }: LogoutModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/70 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className="relative w-full max-w-sm rounded-[32px] border border-surface-border bg-surface-container-low p-7 shadow-[var(--shadow-material-3)] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-18 h-18 rounded-[24px] bg-rose-500/10 border border-rose-500/15 flex items-center justify-center mb-2 shadow-[var(--shadow-material-1)]">
            <HeartCrack className="w-8 h-8 text-rose-500" />
          </div>
          
          <h2 className="text-2xl font-black text-foreground leading-tight">
            هتمشي وتسيبنا بدرّي؟ 🥺
          </h2>
          
          <p className="text-sm text-gray-500 leading-relaxed mb-4">
            إحنا لسه ما شبعناش منك! قعدتك معانا بتفرق، متأكد إنك عاوز تسجل خروج دلوقتي وتسيب عروضنا الجامدة؟
          </p>
        </div>

        <div className="flex flex-col gap-3 mt-4 pt-6 border-t material-divider">
          <Button 
            onClick={onClose}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold h-12 text-lg rounded-2xl shadow-[var(--shadow-material-2)]"
          >
            لا، خليني شوية معاكم ✨
          </Button>
          <Button 
            variant="ghost" 
            onClick={onConfirm}
            className="w-full text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 h-11 rounded-2xl font-medium"
          >
            أيوه، هسجل خروج 😢
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
