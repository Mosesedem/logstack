"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export function useAdminList<T>(
  path: string,
  extract: (data: unknown) => T[],
  deps: unknown[] = [],
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Record<string, unknown>>(path);
      const list = extract(data);
      setItems(list);
      const t = data.total;
      setTotal(typeof t === "number" ? t : list.length);
    } catch (e) {
      toast({
        title: "Failed to load",
        description:
          e instanceof ApiClientError ? e.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, toast, ...deps]);

  useEffect(() => {
    const t = setTimeout(() => {
      void reload();
    }, 200);
    return () => clearTimeout(t);
  }, [reload]);

  return { items, total, loading, reload, setItems };
}

export function useAdminMutations(reload: () => Promise<void>) {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const run = useCallback(
    async (
      action: () => Promise<unknown>,
      success: string,
      failTitle: string,
    ) => {
      setSaving(true);
      try {
        await action();
        toast({ title: success });
        await reload();
        return true;
      } catch (e) {
        toast({
          title: failTitle,
          description:
            e instanceof ApiClientError ? e.message : "Unexpected error",
          variant: "destructive",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [reload, toast],
  );

  return { saving, run };
}
