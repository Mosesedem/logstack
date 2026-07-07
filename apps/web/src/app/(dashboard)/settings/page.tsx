"use client";

import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { BillingContextResponse, User } from "@/types";
import { LinkMobileDialog } from "@/components/auth/link-mobile-dialog";

const COUNTRIES = [
  { code: "NG", name: "Nigeria" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IN", name: "India" },
  { code: "AU", name: "Australia" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" },
];

function detectDefaultCountry(): string {
  if (typeof navigator === "undefined") return "US";
  const lang = navigator.language.toUpperCase();
  if (lang.includes("NG")) return "NG";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Africa/Lagos") return "NG";
  } catch {
    // ignore
  }
  return "US";
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => api.get<User>("/users/me"),
  });

  const { data: billingData } = useQuery({
    queryKey: ["billing-context"],
    queryFn: () => api.get<BillingContextResponse>("/billing/context"),
  });

  const [name, setName] = useState("");
  const [country, setCountry] = useState("US");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setCountry(profile.country ?? detectDefaultCountry());
    } else if (session?.user?.name) {
      setName(session.user.name);
      setCountry(detectDefaultCountry());
    }
  }, [profile, session?.user?.name]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: { name: string; country: string }) =>
      api.put("/users/me", data),
    onSuccess: async () => {
      await updateSession({ name });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["billing-context"] });
      toast({ title: "Profile updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.put("/users/me/password", data),
    onSuccess: () => {
      toast({ title: "Password updated" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePasswordSubmit = () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    updatePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const billingContext = billingData?.context;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your profile information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={session?.user?.email ?? profile?.email ?? ""}
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Nigerian customers are billed in NGN via Paystack. All other
              countries are billed in USD via Polar.
            </p>
          </div>
          {billingContext && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              Current billing:{" "}
              <span className="font-medium">{billingContext.currency}</span> via{" "}
              <span className="font-medium">{billingContext.paymentLabel}</span>
            </div>
          )}
          <Button
            onClick={() =>
              updateProfileMutation.mutate({ name, country })
            }
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button
            onClick={handlePasswordSubmit}
            disabled={
              updatePasswordMutation.isPending ||
              !currentPassword ||
              !newPassword
            }
          >
            {updatePasswordMutation.isPending
              ? "Updating..."
              : "Update Password"}
          </Button>
        </CardContent>
      </Card>

      {/* Mobile Devices Linking */}
      <Card>
        <CardHeader>
          <CardTitle>Link Mobile Device</CardTitle>
          <CardDescription>
            Connect the Logstack mobile app for push alerts, realtime logs, and QR login.
            Use this to test push notifications from the /demo page or alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LinkMobileDialog />
          <p className="text-xs text-muted-foreground mt-3">
            After linking, enable push in the mobile app (Settings) so demo bursts and alerts reach your device in realtime.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}