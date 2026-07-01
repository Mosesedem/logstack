"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api-client";
import { AlertOptions, AlertRule, Project } from "@/types";
import { useProject } from "@/hooks/use-project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertFormFields,
  AlertFormData,
  buildDefaultAlertFormData,
  validateAlertFormData,
} from "@/components/alerts/alert-form-fields";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  Code2,
  Copy,
  FolderOpen,
  KeyRound,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STEPS = ["name", "api-key", "alerts", "sdk"] as const;
type WizardStep = (typeof STEPS)[number];

const STEP_META: Record<
  WizardStep,
  { label: string; description: string; icon: typeof FolderOpen }
> = {
  name: {
    label: "Project",
    description: "Name your project",
    icon: FolderOpen,
  },
  "api-key": {
    label: "API key",
    description: "Save your credentials",
    icon: KeyRound,
  },
  alerts: {
    label: "Alerts",
    description: "Configure notifications",
    icon: Bell,
  },
  sdk: {
    label: "Connect SDK",
    description: "Send your first log",
    icon: Code2,
  },
};

export function ProjectCreateFlow() {
  const [step, setStep] = useState<WizardStep>("name");
  const [projectName, setProjectName] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [alertForm, setAlertForm] = useState<AlertFormData>(() =>
    buildDefaultAlertFormData(),
  );
  const [alertSkipped, setAlertSkipped] = useState(false);

  const { data: session } = useSession();
  const { refreshProjects, setCurrentProject } = useProject();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const userEmail = session?.user?.email ?? "";

  const { data: alertOptions, isLoading: optionsLoading } =
    useQuery<AlertOptions>({
      queryKey: ["alert-options"],
      queryFn: () => api.get<AlertOptions>("/alerts/options"),
      staleTime: 5 * 60 * 1000,
    });

  useEffect(() => {
    if (!project) return;
    setAlertForm(
      buildDefaultAlertFormData({
        defaultRecipient: userEmail,
        defaultName: `${project.name} alerts`,
      }),
    );
  }, [project, userEmail]);

  const stepIndex = STEPS.indexOf(step);
  const progressValue = ((stepIndex + 1) / STEPS.length) * 100;

  const createProjectMutation = useMutation({
    mutationFn: (name: string) => api.post<Project>("/projects", { name }),
    onSuccess: (created) => {
      refreshProjects();
      setCurrentProject(created);
      setProject(created);
      setApiKey(created.apiKey ?? null);
      setKeyCopied(false);
      setStep("api-key");
    },
    onError: (error: Error) => {
      toast({
        title: "Could not create project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createAlertMutation = useMutation({
    mutationFn: (data: Partial<AlertRule>) =>
      api.post(`/alerts?projectId=${project?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast({
        title: "Alert created",
        description: "You'll be notified when matching logs arrive.",
      });
      setStep("sdk");
    },
    onError: (error: Error) => {
      toast({
        title: "Could not create alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateProject = () => {
    const name = projectName.trim();
    if (!name) {
      toast({
        title: "Project name required",
        description: "Enter a name for your project.",
        variant: "destructive",
      });
      return;
    }
    createProjectMutation.mutate(name);
  };

  const copyApiKey = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setKeyCopied(true);
    toast({ title: "API key copied" });
  };

  const handleAlertContinue = () => {
    const error = validateAlertFormData(alertForm);
    if (error) {
      toast({
        title: "Check alert settings",
        description: error,
        variant: "destructive",
      });
      return;
    }
    createAlertMutation.mutate(alertForm);
  };

  const handleSkipAlerts = () => {
    setAlertSkipped(true);
    setStep("sdk");
  };

  const finishFlow = (path: string) => {
    if (project) setCurrentProject(project);
    router.push(path);
  };

  const sdkSnippet = `import { createLogStack } from "logstack-js";

const logstack = createLogStack({
  apiKey: "${apiKey ?? "YOUR_API_KEY"}",
  endpoint: "${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8082/v1").replace(/\/v1\/?$/, "")}",
  disabled: false,
});

logstack.error("Something went wrong", { source: "my-app" });`;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="-ml-2 mb-4" asChild>
          <Link href="/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to projects
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create a project</h1>
        <p className="mt-2 text-muted-foreground">
          Set up your project, save your API key, configure alerts, and connect
          the SDK.
        </p>
      </div>

      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap gap-2">
          {STEPS.map((stepId, index) => {
            const meta = STEP_META[stepId];
            const Icon = meta.icon;
            const isActive = step === stepId;
            const isComplete = index < stepIndex;

            return (
              <div
                key={stepId}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm sm:min-w-[140px] sm:flex-none",
                  isActive && "border-primary bg-primary/5 text-foreground",
                  isComplete && !isActive && "border-primary/30 text-foreground",
                  !isActive && !isComplete && "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{meta.label}</p>
                  <p className="hidden truncate text-xs text-muted-foreground sm:block">
                    {meta.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Step {stepIndex + 1} of {STEPS.length}
            </span>
            {project && step !== "name" && (
              <span className="truncate font-medium text-foreground">
                {project.name}
              </span>
            )}
          </div>
          <Progress value={progressValue} />
        </div>
      </div>

      <Card>
        {step === "name" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FolderOpen className="h-5 w-5" />
                Name your project
              </CardTitle>
              <CardDescription>
                Projects group logs, alerts, and API keys for one application or
                environment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md space-y-2">
                <Label htmlFor="create-project-name">Project name</Label>
                <Input
                  id="create-project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My App"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateProject();
                  }}
                  autoFocus
                />
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t pt-6">
              <Button
                onClick={handleCreateProject}
                disabled={
                  !projectName.trim() || createProjectMutation.isPending
                }
              >
                {createProjectMutation.isPending ? "Creating…" : "Continue"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {step === "api-key" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <KeyRound className="h-5 w-5" />
                Save your API key
              </CardTitle>
              <CardDescription>
                This key authenticates your app with Logstack. It is shown once —
                copy it before continuing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-api-key">API key</Label>
                <div className="flex min-w-0 gap-2">
                  <Input
                    id="create-api-key"
                    readOnly
                    value={apiKey ?? ""}
                    className="min-w-0 flex-1 font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={copyApiKey}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Checkbox
                id="create-key-copied"
                label="I've copied my API key to a safe place"
                checked={keyCopied}
                onChange={() => setKeyCopied((v) => !v)}
              />
            </CardContent>
            <CardFooter className="justify-end border-t pt-6">
              <Button
                onClick={() => setStep("alerts")}
                disabled={!keyCopied}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {step === "alerts" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Bell className="h-5 w-5" />
                Configure your first alert
              </CardTitle>
              <CardDescription>
                Choose when and how you want to be notified. You can add more
                rules anytime on the Alerts page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-2xl">
                <AlertFormFields
                  idPrefix="create-alert"
                  formData={alertForm}
                  onChange={setAlertForm}
                  options={alertOptions}
                  optionsLoading={optionsLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3 border-t pt-6 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("api-key")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkipAlerts}
                >
                  Skip for now
                </Button>
                <Button
                  onClick={handleAlertContinue}
                  disabled={createAlertMutation.isPending}
                >
                  {createAlertMutation.isPending ? "Saving…" : "Save & continue"}
                </Button>
              </div>
            </CardFooter>
          </>
        )}

        {step === "sdk" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Code2 className="h-5 w-5" />
                Connect your application
              </CardTitle>
              <CardDescription>
                Install the SDK and send your first log. Matching errors will
                trigger alerts{alertSkipped ? "" : " you just configured"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="mb-2 text-sm font-medium">1. Install</p>
                <code className="block overflow-x-auto rounded-md bg-background px-3 py-2 font-mono text-sm">
                  npm install logstack-js
                </code>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="mb-2 text-sm font-medium">2. Initialize</p>
                <pre className="overflow-x-auto rounded-md bg-background p-3 font-mono text-sm leading-relaxed">
                  {sdkSnippet}
                </pre>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={async () => {
                    await navigator.clipboard.writeText(sdkSnippet);
                    toast({ title: "Snippet copied" });
                  }}
                >
                  <Copy className="mr-2 h-3 w-3" />
                  Copy snippet
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3 border-t pt-6 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("alerts")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => finishFlow("/demo")}
                >
                  Try live demo
                </Button>
                <Button onClick={() => finishFlow("/logs")}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Go to logs
                </Button>
              </div>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}