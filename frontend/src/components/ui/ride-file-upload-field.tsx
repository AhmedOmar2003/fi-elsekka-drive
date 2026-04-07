import { UploadCloud } from "lucide-react";
import { cn } from "@/components/ui/button";

export function FileUploadField({
  label,
  hint,
  className,
}: {
  label: string;
  hint: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[24px] border border-dashed border-surface-border bg-white/70 p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UploadCloud className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-black text-foreground">{label}</p>
          <p className="mt-1 text-xs leading-6 text-gray-500">{hint}</p>
          <span className="mt-3 inline-flex rounded-full bg-surface-container px-3 py-1 text-[11px] font-black text-primary">
            Placeholder للرفع والـpreview
          </span>
        </div>
      </div>
    </div>
  );
}
