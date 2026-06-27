export type LogLevel = "debug" | "info" | "warn" | "error" | "critical" | "fatal";

export interface Log {
  id: number;
  projectId: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  source?: string;
  createdAt: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  country?: string;
  createdAt: string;
}

export type BillingProvider = "paystack" | "polar" | "none";

export interface BillingContext {
  provider: BillingProvider;
  currency: string;
  country: string;
  isNigeria: boolean;
  paymentLabel: string;
}

export interface BillingContextResponse {
  context: BillingContext;
  tiers: PricingTier[];
}

export interface Project {
  id: string;
  name: string;
  ownerId: number;
  apiKey?: string;
  createdAt: string;
}

export type AlertChannel = "email" | "push" | "webhook";

export interface AlertOptions {
  channels: string[];
  triggerPatterns: string[];
  triggerLevels: string[];
  cooldownOptions: number[];
}

export interface AlertRule {
  id: number;
  projectId: string;
  name: string;
  triggerPatterns: string[];
  triggerLevel?: LogLevel;
  channels: string[];
  recipient: string;
  cooldownMinutes: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertHistory {
  id: number;
  alertRuleId: number;
  logId?: number;
  sentAt: string;
  status: "success" | "failed";
  errorMessage?: string;
  log?: Log;
}

export interface PushToken {
  id: number;
  userId: number;
  token: string;
  deviceType: "ios" | "android";
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface ApiError {
  error: string;
}

// Billing types
export type SubscriptionTier = "free" | "starter" | "pro" | "enterprise";
export type SubscriptionStatus =
  | "active"
  | "cancelled"
  | "past_due"
  | "trialing"
  | "paused";

export interface Subscription {
  id: number;
  userId: number;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currency: string;
  amountCents: number;
  periodStart?: string;
  periodEnd?: string;
  logLimit: number;
  createdAt: string;
}

export interface PricingTier {
  tier: SubscriptionTier;
  name: string;
  description: string;
  logLimit: number;
  features: string[];
  prices: Record<string, number>; // currency -> amount in cents
  limits: {
    logs: string;
    retention: string;
    projects: string;
  };
}

export interface PricingResponse {
  tiers: PricingTier[];
  currencies: Array<{ code: string; symbol: string; name: string }>;
}

// Organization types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: number;
  role: "owner" | "admin" | "member" | "viewer";
  createdAt: string;
  updatedAt: string;
  user?: User;
}

export interface UsageSummary {
  userId: number;
  month: string;
  totalLogCount: number;
  totalBytesIngested: number;
  activeProjects: number;
  tier: SubscriptionTier;
  logLimit: number;
  usagePercentage: number;
  isOverLimit: boolean;
}

export interface PaymentInitResponse {
  authorizationUrl: string;
  reference: string;
  accessCode: string;
  provider: BillingProvider;
}

export interface Transaction {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string;
  channel: string;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  meta: {
    total: number;
    page: number;
    perPage?: number;
    pageCount?: number;
  };
}

export interface Invite {
  id: string;
  organizationId: string;
  email: string;
  role: "admin" | "member" | "viewer";
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface InvoiceLineItem {
  description: string;
  amount: number;
  quantity: number;
}

export interface Invoice {
  id: string;
  userId: number;
  reference: string;
  amountCents: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  lineItems: InvoiceLineItem[];
  paidAt?: string;
  createdAt: string;
}
