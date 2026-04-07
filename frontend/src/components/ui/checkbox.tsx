import * as React from "react"
import { cn } from "./button"

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className="flex items-center space-x-2 rtl:space-x-reverse">
        <input
          type="checkbox"
          className={cn(
            "peer h-5 w-5 shrink-0 rounded-md border-2 border-surface-hover ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "checked:bg-primary checked:border-primary text-white",
            "appearance-none", // Hide default to style custom
            "bg-surface",
            className
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e")`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
          }}
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
