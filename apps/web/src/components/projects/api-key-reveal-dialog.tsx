"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ApiKeyRevealDialogProps {
  apiKey: string | null;
  title?: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyRevealDialog({
  apiKey,
  title = "API key",
  description = "Copy this key now — it will not be shown again.",
  open,
  onOpenChange,
}: ApiKeyRevealDialogProps) {
  const { toast } = useToast();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="reveal-api-key">API key</Label>
          <div className="flex min-w-0 gap-2">
            <Input
              id="reveal-api-key"
              readOnly
              value={apiKey ?? ""}
              className="min-w-0 flex-1 font-mono text-xs sm:text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                if (!apiKey) return;
                navigator.clipboard.writeText(apiKey);
                toast({ title: "Copied to clipboard" });
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}