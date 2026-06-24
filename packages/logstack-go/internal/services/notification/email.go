package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/mosesedem/logstack/internal/config"
	"github.com/mosesedem/logstack/internal/models"
)

// EmailProvider is the interface every email provider struct implements.
// Each provider is responsible for a single delivery attempt.
type EmailProvider interface {
	// Name returns the human-readable name of the provider (e.g. "Brevo").
	Name() string
	// IsConfigured reports whether the provider has sufficient credentials to attempt delivery.
	IsConfigured() bool
	// Send attempts to deliver an email and returns an error on failure.
	Send(ctx context.Context, to, toName, subject, htmlBody string) error
}

// EmailNotifier composes an ordered chain of EmailProvider implementations.
type EmailNotifier struct {
	providers []EmailProvider
	baseURL   string
}

// Brevo API structures
type brevoSender struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type brevoRecipient struct {
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

type brevoEmailRequest struct {
	Sender      brevoSender      `json:"sender"`
	To          []brevoRecipient `json:"to"`
	Subject     string           `json:"subject"`
	HtmlContent string           `json:"htmlContent"`
}

// legacyBrevoClient removed — replaced by the provider chain in task 2.6.

func NewEmailNotifier(cfg *config.Config, baseURL string) *EmailNotifier {
	if baseURL == "" {
		baseURL = "https://logstack.tech"
	}

	providers := []EmailProvider{
		newMailcowProvider(cfg.MailcowAPIKey, cfg.MailcowAPIURL),
		&brevoProvider{
			apiKey: cfg.BrevoAPIKey,
			client: &http.Client{Timeout: 10 * time.Second},
		},
		&resendProvider{
			apiKey: cfg.ResendAPIKey,
			client: &http.Client{Timeout: 10 * time.Second},
		},
		newZohoProvider(cfg.ZohoClientID, cfg.ZohoClientSecret, cfg.ZohoRefreshToken),
	}

	notifier := &EmailNotifier{
		providers: providers,
		baseURL:   baseURL,
	}

	// Warn at startup if no provider has credentials
	configured := 0
	for _, p := range providers {
		if p.IsConfigured() {
			configured++
		}
	}
	if configured == 0 {
		slog.Warn("NewEmailNotifier: no email providers are configured — all send calls will fail")
	}

	return notifier
}

func (e *EmailNotifier) sendEmail(ctx context.Context, to, toName, subject, htmlBody string) error {
	if !e.hasConfiguredProvider() {
		return fmt.Errorf("no email providers configured")
	}
	start := time.Now()
	var errs []string
	attempt := 0
	for _, p := range e.providers {
		if !p.IsConfigured() {
			continue
		}
		attempt++
		providerStart := time.Now()
		slog.Debug("attempting email provider",
			"provider", p.Name(),
			"recipient", maskEmail(to),
			"attempt", attempt,
		)
		if err := p.Send(ctx, to, toName, subject, htmlBody); err != nil {
			slog.Warn("email provider failed",
				"provider", p.Name(),
				"error", err,
				"elapsed", time.Since(providerStart),
			)
			errs = append(errs, fmt.Sprintf("%s: %v", p.Name(), err))
			continue
		}
		slog.Info("email delivered",
			"provider", p.Name(),
			"elapsed_total", time.Since(start),
		)
		return nil
	}
	return fmt.Errorf("all email providers failed: %s", strings.Join(errs, "; "))
}

func (e *EmailNotifier) hasConfiguredProvider() bool {
	for _, p := range e.providers {
		if p.IsConfigured() {
			return true
		}
	}
	return false
}

func maskEmail(addr string) string {
	at := strings.LastIndex(addr, "@")
	if at < 0 {
		return "***"
	}
	return addr[:at] + "@***"
}


func (e *EmailNotifier) Send(ctx context.Context, rule *models.AlertRule, log *models.Log) error {
	subject := fmt.Sprintf("[Logstack Alert] %s - %s", rule.Name, log.Level)
	htmlBody := fmt.Sprintf(`
		<h2>Logstack Alert: %s</h2>
		<p><strong>Level:</strong> %s</p>
		<p><strong>Message:</strong> %s</p>
		<p><strong>Source:</strong> %s</p>
		<p><strong>Time:</strong> %s</p>
		<hr>
		<p>This alert was triggered by rule: <strong>%s</strong></p>
		<p>Pattern: <code>%s</code></p>
	`, rule.Name, log.Level, log.Message, log.Source, log.CreatedAt.Format("2006-01-02 15:04:05 MST"), rule.Name, rule.TriggerPattern)

	return e.sendEmail(ctx, rule.Recipient, "", subject, htmlBody)
}

// SendVerificationEmail sends an email verification link to the user
func (e *EmailNotifier) SendVerificationEmail(ctx context.Context, email, name, token string) error {
	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", e.baseURL, token)

	subject := "Verify your Logstack account"
	htmlBody := fmt.Sprintf(`
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
			<div style="text-align: center; margin-bottom: 30px;">
				<h1 style="color: #4F46E5; margin: 0;">Logstack</h1>
			</div>
			
			<h2>Welcome, %s!</h2>
			
			<p>Thanks for signing up for Logstack. Please verify your email address by clicking the button below:</p>
			
			<div style="text-align: center; margin: 30px 0;">
				<a href="%s" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Verify Email</a>
			</div>
			
			<p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
			<p style="color: #4F46E5; word-break: break-all; font-size: 14px;">%s</p>
			
			<p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
			
			<hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
			
			<p style="color: #999; font-size: 12px;">If you didn't create an account with Logstack, you can safely ignore this email.</p>
		</body>
		</html>
	`, name, verifyURL, verifyURL)

	return e.sendEmail(ctx, email, name, subject, htmlBody)
}

// SendUsageAlert sends a usage alert email when thresholds are reached
func (e *EmailNotifier) SendUsageAlert(ctx context.Context, email, name string, summary *models.UserUsageSummary, thresholdPercentage float64) error {
	dashboardURL := fmt.Sprintf("%s/billing", e.baseURL)
	
	var alertLevel, alertColor, actionText string
	if thresholdPercentage >= 100 {
		alertLevel = "Critical"
		alertColor = "#DC2626" // red
		actionText = "Your log ingestion has been limited. Please upgrade your plan to continue logging."
	} else {
		alertLevel = "Warning"
		alertColor = "#F59E0B" // orange
		actionText = "Consider upgrading your plan to avoid hitting your limit."
	}

	subject := fmt.Sprintf("Logstack Usage Alert: %v%% of Monthly Limit Reached", thresholdPercentage)
	htmlBody := fmt.Sprintf(`
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
			<div style="text-align: center; margin-bottom: 30px;">
				<h1 style="color: #4F46E5; margin: 0;">Logstack</h1>
			</div>
			
			<div style="background-color: %s; color: white; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
				<h2 style="margin: 0; font-size: 18px;">%s: Usage Alert</h2>
			</div>
			
			<p>Hi %s,</p>
			
			<p>Your Logstack account has reached <strong>%v%%</strong> of your monthly log quota.</p>
			
			<div style="background-color: #F3F4F6; padding: 20px; border-radius: 6px; margin: 20px 0;">
				<h3 style="margin-top: 0; color: #4F46E5;">Usage Summary</h3>
				<table style="width: 100%%; border-collapse: collapse;">
					<tr>
						<td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;"><strong>Current Plan:</strong></td>
						<td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">%s</td>
					</tr>
					<tr>
						<td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;"><strong>Logs Ingested:</strong></td>
						<td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">%s / %s</td>
					</tr>
					<tr>
						<td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;"><strong>Usage:</strong></td>
						<td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">%v%%</td>
					</tr>
					<tr>
						<td style="padding: 8px 0;"><strong>Active Projects:</strong></td>
						<td style="padding: 8px 0; text-align: right;">%d</td>
					</tr>
				</table>
			</div>
			
			<p style="background-color: #FEF3C7; border-left: 4px solid %s; padding: 12px; margin: 20px 0;">
				<strong>Action Required:</strong> %s
			</p>
			
			<div style="text-align: center; margin: 30px 0;">
				<a href="%s" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Dashboard</a>
			</div>
			
			<hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
			
			<p style="color: #999; font-size: 12px;">You're receiving this email because your Logstack usage has crossed an important threshold. To adjust your notification preferences, visit your account settings.</p>
		</body>
		</html>
	`, alertColor, alertLevel, name, thresholdPercentage, 
	   summary.Tier, formatNumber(summary.TotalLogCount), formatNumber(summary.LogLimit), 
	   summary.UsagePercentage, summary.ActiveProjects, alertColor, actionText, dashboardURL)

	return e.sendEmail(ctx, email, name, subject, htmlBody)
}

// SendUsageWarningEmail sends a simple usage warning email at a given percentage threshold
func (e *EmailNotifier) SendUsageWarningEmail(ctx context.Context, email, name string, usagePct float64) error {
	dashboardURL := fmt.Sprintf("%s/billing", e.baseURL)

	var alertLevel, alertColor, actionText string
	if usagePct >= 100 {
		alertLevel = "Critical"
		alertColor = "#DC2626"
		actionText = "Your log ingestion has been limited. Please upgrade your plan to continue logging."
	} else {
		alertLevel = "Warning"
		alertColor = "#F59E0B"
		actionText = "You're approaching your monthly limit. Consider upgrading your plan to avoid disruption."
	}

	subject := fmt.Sprintf("Logstack Usage Alert: %.0f%% of Monthly Limit Reached", usagePct)
	htmlBody := fmt.Sprintf(`
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
			<div style="text-align: center; margin-bottom: 30px;">
				<h1 style="color: #4F46E5; margin: 0;">Logstack</h1>
			</div>

			<div style="background-color: %s; color: white; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
				<h2 style="margin: 0; font-size: 18px;">%s: Usage Alert</h2>
			</div>

			<p>Hi %s,</p>

			<p>Your Logstack account has reached <strong>%.0f%%</strong> of your monthly log quota.</p>

			<p style="background-color: #FEF3C7; border-left: 4px solid %s; padding: 12px; margin: 20px 0;">
				<strong>Action Required:</strong> %s
			</p>

			<div style="text-align: center; margin: 30px 0;">
				<a href="%s" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Dashboard</a>
			</div>

			<hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

			<p style="color: #999; font-size: 12px;">You're receiving this email because your Logstack usage has crossed an important threshold.</p>
		</body>
		</html>
	`, alertColor, alertLevel, name, usagePct, alertColor, actionText, dashboardURL)

	return e.sendEmail(ctx, email, name, subject, htmlBody)
}

// formatNumber formats a number with thousand separators
func formatNumber(n int64) string {
	if n < 1000 {
		return fmt.Sprintf("%d", n)
	}
	if n < 1000000 {
		return fmt.Sprintf("%.1fK", float64(n)/1000)
	}
	if n < 1000000000 {
		return fmt.Sprintf("%.1fM", float64(n)/1000000)
	}
	return fmt.Sprintf("%.1fB", float64(n)/1000000000)
}
// SendPasswordResetEmail sends a password reset link to the user
func (e *EmailNotifier) SendPasswordResetEmail(ctx context.Context, email, name, token string) error {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", e.baseURL, token)

	subject := "Reset your Logstack password"
	htmlBody := fmt.Sprintf(`
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
			<div style="text-align: center; margin-bottom: 30px;">
				<h1 style="color: #4F46E5; margin: 0;">Logstack</h1>
			</div>
			
			<h2>Password Reset Request</h2>
			
			<p>Hi %s,</p>
			
			<p>We received a request to reset your password. Click the button below to create a new password:</p>
			
			<div style="text-align: center; margin: 30px 0;">
				<a href="%s" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
			</div>
			
			<p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
			<p style="color: #4F46E5; word-break: break-all; font-size: 14px;">%s</p>
			
			<p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
			
			<hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
			
			<p style="color: #999; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
		</body>
		</html>
	`, name, resetURL, resetURL)

	return e.sendEmail(ctx, email, name, subject, htmlBody)
}

// SendInviteEmail sends an organization invite email to the specified address
func (e *EmailNotifier) SendInviteEmail(ctx context.Context, email, orgName, role, inviteURL string) error {
	subject := fmt.Sprintf("You've been invited to join %s on Logstack", orgName)
	htmlBody := fmt.Sprintf(`
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
			<div style="text-align: center; margin-bottom: 30px;">
				<h1 style="color: #4F46E5; margin: 0;">Logstack</h1>
			</div>

			<h2>You've been invited!</h2>

			<p>You've been invited to join <strong>%s</strong> on Logstack as a <strong>%s</strong>.</p>

			<p>Click the button below to accept the invitation and get started:</p>

			<div style="text-align: center; margin: 30px 0;">
				<a href="%s" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Accept Invitation</a>
			</div>

			<p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
			<p style="color: #4F46E5; word-break: break-all; font-size: 14px;">%s</p>

			<p style="color: #666; font-size: 14px;">This invitation will expire in 48 hours.</p>

			<hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

			<p style="color: #999; font-size: 12px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
		</body>
		</html>
	`, orgName, role, inviteURL, inviteURL)

	return e.sendEmail(ctx, email, "", subject, htmlBody)
}

// brevoProvider implements EmailProvider for the Brevo transactional email API.
type brevoProvider struct {
	apiKey string
	client *http.Client
}

// Name returns the human-readable provider name.
func (b *brevoProvider) Name() string {
	return "Brevo"
}

// IsConfigured reports whether the provider has a non-empty API key.
func (b *brevoProvider) IsConfigured() bool {
	return b.apiKey != ""
}

// Send delivers an email via the Brevo SMTP API.
// It expects an HTTP 201 response with a {"messageId":"..."} body.
func (b *brevoProvider) Send(ctx context.Context, to, toName, subject, htmlBody string) error {
	payload := brevoEmailRequest{
		Sender: brevoSender{
			Name:  "Logstack",
			Email: "noreply@logstack.tech",
		},
		To: []brevoRecipient{
			{Email: to, Name: toName},
		},
		Subject:     subject,
		HtmlContent: htmlBody,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("brevo: failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.brevo.com/v3/smtp/email", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("brevo: failed to create request: %w", err)
	}

	req.Header.Set("accept", "application/json")
	req.Header.Set("content-type", "application/json")
	req.Header.Set("api-key", b.apiKey)

	resp, err := b.client.Do(req)
	if err != nil {
		return fmt.Errorf("brevo: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("brevo: unexpected status %d (expected 201)", resp.StatusCode)
	}

	var result struct {
		MessageID string `json:"messageId"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("brevo: failed to parse response body: %w", err)
	}
	if result.MessageID == "" {
		return fmt.Errorf("brevo: response missing messageId")
	}

	return nil
}

// mailcowProvider sends email via the self-hosted Mailcow SMTP Relay API.
type mailcowProvider struct {
	apiKey string
	apiURL string
	client *http.Client
}

// newMailcowProvider constructs a mailcowProvider with a 10-second timeout client.
func newMailcowProvider(apiKey, apiURL string) *mailcowProvider {
	return &mailcowProvider{
		apiKey: apiKey,
		apiURL: apiURL,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Name returns the provider's human-readable name.
func (m *mailcowProvider) Name() string {
	return "Mailcow"
}

// IsConfigured reports whether both apiKey and apiURL are set.
func (m *mailcowProvider) IsConfigured() bool {
	return m.apiKey != "" && m.apiURL != ""
}

// mailcowRequest is the JSON body sent to the Mailcow SMTP relay API.
type mailcowRequest struct {
	RcptTo  []string `json:"rcpt_to"`
	From    string   `json:"from"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

// mailcowResponseItem is a single element in the Mailcow API response array.
type mailcowResponseItem struct {
	Type string `json:"type"`
	Msg  string `json:"msg,omitempty"`
}

// Send delivers an email via the Mailcow SMTP relay API.
// It calls POST {apiURL}/api/v1/send/email with the X-API-Key header and a
// From address of noreply@logstack.tech.
// The response must be a JSON array whose first element has "type":"success";
// any other body or non-2xx status is returned as an error.
func (m *mailcowProvider) Send(ctx context.Context, to, toName, subject, htmlBody string) error {
	payload := mailcowRequest{
		RcptTo:  []string{to},
		From:    "noreply@logstack.tech",
		Subject: subject,
		HTML:    htmlBody,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal mailcow request: %w", err)
	}

	endpoint := m.apiURL + "/api/v1/send/email"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create mailcow request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", m.apiKey)

	resp, err := m.client.Do(req)
	if err != nil {
		return fmt.Errorf("mailcow request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("mailcow API returned non-2xx status: %d", resp.StatusCode)
	}

	// Parse response body: expect a JSON array where the first element has type="success".
	var items []mailcowResponseItem
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return fmt.Errorf("mailcow response parse error: %w", err)
	}

	if len(items) == 0 || items[0].Type != "success" {
		typ := ""
		if len(items) > 0 {
			typ = items[0].Type
		}
		return fmt.Errorf("mailcow send not accepted: type=%q", typ)
	}

	return nil
}

// resendProvider implements EmailProvider using the Resend transactional email API.
// Requirements: 7.1, 7.2, 7.3, 4.7
type resendProvider struct {
	apiKey string
	client *http.Client
}

// resendEmailRequest is the JSON body sent to POST https://api.resend.com/emails.
type resendEmailRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	Html    string   `json:"html"`
}

// resendEmailResponse is the expected success body: {"id":"..."}.
type resendEmailResponse struct {
	ID string `json:"id"`
}

// Name returns the provider's human-readable name.
func (r *resendProvider) Name() string {
	return "Resend"
}

// IsConfigured reports whether the provider has a non-empty API key.
func (r *resendProvider) IsConfigured() bool {
	return r.apiKey != ""
}

// Send delivers an email via the Resend API.
// It expects HTTP 200 with a {"id":"..."} body; anything else is treated as a failure.
func (r *resendProvider) Send(ctx context.Context, to, toName, subject, htmlBody string) error {
	payload := resendEmailRequest{
		From:    "Logstack <noreply@logstack.tech>",
		To:      []string{to},
		Subject: subject,
		Html:    htmlBody,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("resend: failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("resend: failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+r.apiKey)

	resp, err := r.client.Do(req)
	if err != nil {
		return fmt.Errorf("resend: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("resend: unexpected status %d", resp.StatusCode)
	}

	var result resendEmailResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("resend: failed to decode response: %w", err)
	}

	if result.ID == "" {
		return fmt.Errorf("resend: response missing id field — delivery may not have been accepted")
	}

	return nil
}

// zohoTokenResponse holds the OAuth2 token response from Zoho's token endpoint.
type zohoTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
	Error       string `json:"error,omitempty"`
}

// zohoAccountsResponse holds the response from the Zoho Mail accounts list endpoint.
type zohoAccountsResponse struct {
	Status struct {
		Code int `json:"code"`
	} `json:"status"`
	Data []struct {
		AccountID string `json:"accountId"`
	} `json:"data"`
}

// zohoSendResponse holds the response from the Zoho Mail send message endpoint.
type zohoSendResponse struct {
	Status struct {
		Code int `json:"code"`
	} `json:"status"`
}

// zohoProvider implements EmailProvider using Zoho Mail's OAuth2-authenticated API.
// It is the final fallback in the provider chain.
//
// On each Send() call it:
//  1. Exchanges the stored refresh token for a fresh access token.
//  2. Fetches the account list to resolve the accountId (or uses the configured accountID).
//  3. POSTs the message to /api/accounts/{accountId}/messages.
type zohoProvider struct {
	clientID     string
	clientSecret string
	refreshToken string
	accountID    string // optional; if empty, fetched dynamically from the accounts API
	client       *http.Client
}

// Name returns the human-readable provider name.
func (z *zohoProvider) Name() string {
	return "Zoho"
}

// IsConfigured reports whether all three mandatory Zoho OAuth credentials are present.
func (z *zohoProvider) IsConfigured() bool {
	return z.clientID != "" && z.clientSecret != "" && z.refreshToken != ""
}

// Send delivers an email via the Zoho Mail API.
//
// Steps:
//  1. POST https://accounts.zoho.com/oauth/v2/token  (refresh-token grant)
//  2. GET  https://mail.zoho.com/api/accounts         (resolve accountId)
//  3. POST https://mail.zoho.com/api/accounts/{id}/messages
//
// A successful response is HTTP 200 with {"status":{"code":200}}.
func (z *zohoProvider) Send(ctx context.Context, to, toName, subject, htmlBody string) error {
	// ── Step 1: obtain a fresh access token ────────────────────────────────
	accessToken, err := z.fetchAccessToken(ctx)
	if err != nil {
		return fmt.Errorf("zoho: token request failed: %w", err)
	}

	// ── Step 2: resolve the Zoho Mail account ID ───────────────────────────
	accountID := z.accountID
	if accountID == "" {
		accountID, err = z.fetchAccountID(ctx, accessToken)
		if err != nil {
			return fmt.Errorf("zoho: failed to retrieve account ID: %w", err)
		}
	}

	// ── Step 3: send the message ───────────────────────────────────────────
	return z.sendMessage(ctx, accessToken, accountID, to, toName, subject, htmlBody)
}

// fetchAccessToken exchanges the refresh token for a new access token.
func (z *zohoProvider) fetchAccessToken(ctx context.Context) (string, error) {
	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("client_id", z.clientID)
	data.Set("client_secret", z.clientSecret)
	data.Set("refresh_token", z.refreshToken)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		"https://accounts.zoho.com/oauth/v2/token",
		strings.NewReader(data.Encode()),
	)
	if err != nil {
		return "", fmt.Errorf("create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := z.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("token request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token endpoint returned status %d: %s", resp.StatusCode, string(body))
	}

	var tokenResp zohoTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("parse token response: %w", err)
	}
	if tokenResp.Error != "" {
		return "", fmt.Errorf("token error: %s", tokenResp.Error)
	}
	if tokenResp.AccessToken == "" {
		return "", fmt.Errorf("token response missing access_token")
	}

	return tokenResp.AccessToken, nil
}

// fetchAccountID calls GET https://mail.zoho.com/api/accounts and returns the
// first account's ID. This is required to construct the send-message endpoint.
func (z *zohoProvider) fetchAccountID(ctx context.Context, accessToken string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://mail.zoho.com/api/accounts", nil)
	if err != nil {
		return "", fmt.Errorf("create accounts request: %w", err)
	}
	req.Header.Set("Authorization", "Zoho-oauthtoken "+accessToken)

	resp, err := z.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("accounts request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read accounts response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("accounts endpoint returned status %d: %s", resp.StatusCode, string(body))
	}

	var accountsResp zohoAccountsResponse
	if err := json.Unmarshal(body, &accountsResp); err != nil {
		return "", fmt.Errorf("parse accounts response: %w", err)
	}
	if len(accountsResp.Data) == 0 {
		return "", fmt.Errorf("no Zoho Mail accounts found")
	}

	return accountsResp.Data[0].AccountID, nil
}

// sendMessage POSTs the email to Zoho Mail and validates the response body.
func (z *zohoProvider) sendMessage(
	ctx context.Context,
	accessToken, accountID, to, toName, subject, htmlBody string,
) error {
	payload := map[string]string{
		"fromAddress": "noreply@logstack.tech",
		"toAddress":   to,
		"subject":     subject,
		"content":     htmlBody,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal send request: %w", err)
	}

	endpoint := "https://mail.zoho.com/api/accounts/" + accountID + "/messages"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("create send request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Zoho-oauthtoken "+accessToken)

	resp, err := z.client.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read send response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("send endpoint returned status %d: %s", resp.StatusCode, string(body))
	}

	var sendResp zohoSendResponse
	if err := json.Unmarshal(body, &sendResp); err != nil {
		return fmt.Errorf("parse send response: %w", err)
	}
	if sendResp.Status.Code != 200 {
		return fmt.Errorf("zoho send not accepted: status code %d", sendResp.Status.Code)
	}

	return nil
}

// newZohoProvider constructs a zohoProvider with a 10-second HTTP timeout.
func newZohoProvider(clientID, clientSecret, refreshToken string) *zohoProvider {
	return &zohoProvider{
		clientID:     clientID,
		clientSecret: clientSecret,
		refreshToken: refreshToken,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}
