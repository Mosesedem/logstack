"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertOptions, AlertRule } from "@/types";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertFormFields,
  AlertFormData,
  buildDefaultAlertFormData,
  validateAlertFormData,
} from "@/components/alerts/alert-form-fields";
import { useToast } from "@/hooks/use-toast";

interface AlertFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<AlertRule>) => void;
  initialData?: AlertRule | null;
  defaultRecipient?: string;
  isSubmitting?: boolean;
}

export function AlertForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  defaultRecipient,
  isSubmitting,
}: AlertFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<AlertFormData>(() =>
    buildDefaultAlertFormData({ initialData, defaultRecipient }),
  );

  useEffect(() => {
    if (open) {
      setFormData(buildDefaultAlertFormData({ initialData, defaultRecipient }));
    }
  }, [open, initialData, defaultRecipient]);

  const { data: options, isLoading: optionsLoading } = useQuery({
    queryKey: ["alert-options"],
    queryFn: () => api.get<AlertOptions>("/alerts/options"),
    staleTime: 5 * 60 * 1000,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateAlertFormData(formData);
    if (error) {
      toast({ title: "Invalid alert", description: error, variant: "destructive" });
      return;
    }
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]">
        <DialogHeader className="shrink-0 space-y-2 px-6 pt-6 text-left">
          <DialogTitle>
            {initialData ? "Edit Alert Rule" : "Create Alert Rule"}
          </DialogTitle>
          <DialogDescription>
            Configure when and how you want to be alerted about log events.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <AlertFormFields
              formData={formData}
              onChange={setFormData}
              options={options}
              optionsLoading={optionsLoading}
            />
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : initialData ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}