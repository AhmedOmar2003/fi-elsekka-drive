"use client";

import * as React from "react";
import { X } from "lucide-react";
import { normalizeStringArray } from "@/lib/product-metadata";

type ChipsInputProps = {
  label: string;
  helper?: string;
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
};

export function ChipsInput({
  label,
  helper,
  placeholder,
  values,
  onChange,
}: ChipsInputProps) {
  const [draft, setDraft] = React.useState("");

  const commitDraft = React.useCallback(() => {
    const nextValues = normalizeStringArray([...values, ...draft.split(/[,\n،]/g)]);
    onChange(nextValues);
    setDraft("");
  }, [draft, onChange, values]);

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-bold text-gray-500 mb-1.5">{label}</label>
        {helper ? <p className="text-[11px] text-gray-500">{helper}</p> : null}
      </div>

      <div className="rounded-2xl border border-surface-hover bg-surface p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black text-primary"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((item) => item !== value))}
                className="rounded-full p-0.5 text-primary/80 hover:bg-primary/10 hover:text-primary"
                aria-label={`حذف ${value}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {values.length === 0 ? (
            <span className="text-[11px] text-gray-500">لسه مفيش عناصر مضافة.</span>
          ) : null}
        </div>

        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "," || event.key === "،") {
              event.preventDefault();
              if (draft.trim()) commitDraft();
            }

            if (event.key === "Backspace" && !draft && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim()) commitDraft();
          }}
          placeholder={placeholder || "اكتب واضغط Enter"}
          className="w-full bg-background border border-surface-hover rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-primary/50"
        />
      </div>
    </div>
  );
}
