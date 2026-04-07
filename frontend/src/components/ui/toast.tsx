import * as React from "react"
import { cn } from "./button"

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "error" | "warning";
  title: string;
  description?: string;
  onClose?: () => void;
}

export function Toast({ className, variant = "default", title, description, onClose, ...props }: ToastProps) {
  const variants = {
    default: "bg-surface border-surface-hover text-foreground",
    success: "bg-emerald-950/40 border-emerald-500/30 text-emerald-100",
    error: "bg-rose-950/40 border-rose-500/30 text-rose-100",
    warning: "bg-yellow-950/40 border-yellow-500/30 text-yellow-100",
  }

  const icons = {
    default: <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    success: <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    error: <svg className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    warning: <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  }

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm overflow-hidden rounded-xl border shadow-lg ring-1 ring-black ring-opacity-5 transition-all",
        variants[variant],
        className
      )}
      {...props}
    >
      <div className="flex w-full p-4">
        <div className="flex-shrink-0">
          {icons[variant]}
        </div>
        <div className="ms-3 w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold">{title}</p>
          {description && (
            <p className="mt-1 text-xs opacity-80">{description}</p>
          )}
        </div>
        <div className="ms-4 flex flex-shrink-0">
          <button
            type="button"
            className="inline-flex rounded-md text-gray-400 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            onClick={onClose}
          >
            <span className="sr-only">إغلاق</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
