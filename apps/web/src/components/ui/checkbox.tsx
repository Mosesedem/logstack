"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelClassName?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, labelClassName, id, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className="flex min-w-0 items-start gap-2 cursor-pointer select-none"
      >
        <input
          type="checkbox"
          id={id}
          ref={ref}
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 rounded border border-input bg-background text-primary accent-primary cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        {label && (
          <span
            className={cn(
              "min-w-0 text-sm font-medium leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
              labelClassName,
            )}
          >
            {label}
          </span>
        )}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
