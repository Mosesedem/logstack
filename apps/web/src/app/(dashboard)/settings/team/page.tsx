"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Loader2,
  Mail,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useOrgRole } from "@/hooks/use-org-role";
import { api } from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TeamPageSkeleton } from "@/components/loading";
import type { Invite } from "@/types";

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member" | "viewer";
  createdAt: string;
}

interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: number;
  role: "owner" | "admin" | "member" | "viewer";
  createdAt: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
}

interface Subscription {
  tier: "free" | "starter" | "pro" | "enterprise";
}

const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const ROLE_DESCRIPTIONS = {
  owner: "Full access and billing control",
  admin: "Can manage members and settings",
  member: "Can create and manage projects",
  viewer: "Read-only access",
};

const TIER_LIMITS = {
  free: 1,
  starter: 3,
  pro: 10,
  enterprise: -1, // Unlimited
};

export default function TeamPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentRole = useOrgRole();

  const canManage =
    currentRole === "owner" || currentRole === "admin";

  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [memberToRemove, setMemberToRemove] =
    useState<OrganizationMember | null>(null);
  const [inviteToRevoke, setInviteToRevoke] = useState<Invite | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">(
    "member",
  );

  useEffect(() => {
    loadTeamData();
  }, []);

  const loadTeamData = async () => {
    try {
      setIsLoading(true);
      const [orgData, subData] = await Promise.all([
        api.get<Organization>("/organizations/me"),
        api.get<Subscription>("/billing/subscription"),
      ]);

      setOrganization(orgData);
      setSubscription(subData);

      const membersData = await api.get<{ members: OrganizationMember[] }>(
        `/organizations/${orgData.id}/members`,
      );
      setMembers(membersData.members);
    } catch (error) {
      console.error("Failed to load team data:", error);
      toast({
        title: "Error",
        description: "Failed to load team information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch pending invites
  const {
    data: invitesData,
    isLoading: isLoadingInvites,
    refetch: refetchInvites,
    error: invitesError,
  } = useQuery({
    queryKey: ["org-invites", organization?.id],
    queryFn: async () => {
      try {
        const res = await api.get<{ invites: Invite[] }>(
          `/organizations/${organization!.id}/invites`,
        );
        return res;
      } catch (err: any) {
        if (err?.response?.status === 402) {
          // Expected on free/low tier — handled in UI
          return { invites: [] };
        }
        throw err;
      }
    },
    enabled: !!organization?.id && canManage,
    select: (data) => data.invites ?? [],
  });

  const pendingInvites: Invite[] = invitesData ?? [];

  // Revoke invite mutation
  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) =>
      api.delete(`/organizations/${organization!.id}/invites/${inviteId}`),
    onSuccess: () => {
      toast({ title: "Invite revoked", description: "The invitation has been revoked." });
      queryClient.invalidateQueries({ queryKey: ["org-invites", organization?.id] });
      setInviteToRevoke(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to revoke invitation.",
        variant: "destructive",
      });
    },
  });

  const getMemberLimit = () => {
    if (!subscription) return 1;
    return TIER_LIMITS[subscription.tier];
  };

  const canInviteMore = () => {
    const limit = getMemberLimit();
    return limit === -1 || members.length < limit;
  };

  const handleInviteMember = async () => {
    if (!organization) return;

    if (!canInviteMore()) {
      toast({
        title: "Member Limit Reached",
        description: `Your ${subscription?.tier} plan allows up to ${getMemberLimit()} team members. Please upgrade to add more.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsInviting(true);
      await api.post(`/organizations/${organization.id}/invites`, {
        email: inviteEmail,
        role: inviteRole,
      });

      toast({
        title: "Invite sent",
        description: "An invitation email has been sent to " + inviteEmail,
      });

      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      queryClient.invalidateQueries({ queryKey: ["org-invites", organization.id] });
      loadTeamData();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error || "Failed to send invitation";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (!organization) return;

    try {
      await api.patch(`/organizations/${organization.id}/members/${memberId}`, {
        role: newRole,
      });

      toast({
        title: "Success",
        description: "Member role updated successfully",
      });

      loadTeamData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update member role",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async () => {
    if (!organization || !memberToRemove) return;

    try {
      await api.delete(
        `/organizations/${organization.id}/members/${memberToRemove.id}`,
      );

      toast({
        title: "Success",
        description: "Member removed successfully",
      });

      setMemberToRemove(null);
      loadTeamData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <TeamPageSkeleton />;
  }

  const limit = getMemberLimit();
  const canManageTeam = subscription?.tier !== "free";

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
        <p className="text-muted-foreground mt-2">
          Manage your team members and their access levels
        </p>
      </div>

      {/* Team Limit Info */}
      <Card>
        <CardHeader>
          <CardTitle>Team Size</CardTitle>
          <CardDescription>
            {limit === -1
              ? "Unlimited team members on your Enterprise plan"
              : `You have ${members.length} of ${limit} team member${limit > 1 ? "s" : ""} on your ${subscription?.tier} plan`}
          </CardDescription>
        </CardHeader>
        {!canManageTeam && (
          <CardContent>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Upgrade to Starter or higher to invite team members.{" "}
                <a href="/billing" className="font-medium underline">
                  View plans
                </a>
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              {members.length} member{members.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          {/* Invite Member button — only visible to owner/admin */}
          {canManageTeam && canManage && (
            <Dialog
              open={isInviteDialogOpen}
              onOpenChange={setIsInviteDialogOpen}
            >
              <DialogTrigger asChild>
                <Button disabled={!canInviteMore()}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to add a new member to your team
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(value: any) => setInviteRole(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">Admin</span>
                            <span className="text-xs text-muted-foreground">
                              {ROLE_DESCRIPTIONS.admin}
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="member">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">Member</span>
                            <span className="text-xs text-muted-foreground">
                              {ROLE_DESCRIPTIONS.member}
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="viewer">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">Viewer</span>
                            <span className="text-xs text-muted-foreground">
                              {ROLE_DESCRIPTIONS.viewer}
                            </span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsInviteDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInviteMember}
                    disabled={isInviting || !inviteEmail}
                  >
                    {isInviting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Invitation"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{member.user.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {member.user.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {member.role === "owner" ? (
                    <Badge variant="default" className="gap-1">
                      <Shield className="h-3 w-3" />
                      {ROLE_LABELS[member.role]}
                    </Badge>
                  ) : canManage && canManageTeam ? (
                    // owner/admin see an editable role dropdown
                    <Select
                      value={member.role}
                      onValueChange={(value) =>
                        handleUpdateRole(member.id, value)
                      }
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    // member/viewer see a read-only badge
                    <Badge variant="outline">{ROLE_LABELS[member.role]}</Badge>
                  )}
                  {member.role !== "owner" && canManage && canManageTeam && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMemberToRemove(member)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites — only visible to owner/admin */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invites</CardTitle>
            <CardDescription>
              Invitations that have been sent but not yet accepted
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitesError && (invitesError as any)?.response?.status === 402 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">Team invites require a paid plan.</p>
                <Button variant="outline" className="mt-2" onClick={() => (window.location.href = "/billing")}>
                  Upgrade to manage team
                </Button>
              </div>
            ) : isLoadingInvites ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingInvites.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No pending invitations
              </p>
            ) : (
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{invite.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires{" "}
                          {new Date(invite.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">
                        {ROLE_LABELS[invite.role]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setInviteToRevoke(invite)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Remove Member Confirmation */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={() => setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.user.name} from
              your team? They will lose access to all projects and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember}>
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Invite Confirmation */}
      <AlertDialog
        open={!!inviteToRevoke}
        onOpenChange={(open) => !open && setInviteToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the invitation sent to{" "}
              <strong>{inviteToRevoke?.email}</strong>? They will no longer be
              able to join using this invite link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                inviteToRevoke && revokeMutation.mutate(inviteToRevoke.id)
              }
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Revoke Invitation"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
