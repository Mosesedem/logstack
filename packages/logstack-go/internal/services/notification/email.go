package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mosesedem/logstack/internal/models"
)

type EmailNotifier struct {
	apiKey  string
	baseURL string
	client  *http.Client
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

func NewEmailNotifier(apiKey string, baseURL string) *EmailNotifier {
	if baseURL == "" {
		baseURL = "https://logstack.tech"
	}
	return &EmailNotifier{
		apiKey:  apiKey,
		baseURL: baseURL,
		client:  &http.Client{},
	}
}

func (e *EmailNotifier) sendEmail(to, toName, subject, htmlBody string) error {
	if e.apiKey == "" {
		return fmt.Errorf("email client not configured")
	}

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
		return fmt.Errorf("failed to marshal email request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.brevo.com/v3/smtp/email", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("accept", "application/json")
	req.Header.Set("api-key", e.apiKey)
	req.Header.Set("content-type", "application/json")

	resp, err := e.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("brevo API error: status %d", resp.StatusCode)
	}

	return nil
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

	return e.sendEmail(rule.Recipient, "", subject, htmlBody)
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

	return e.sendEmail(email, name, subject, htmlBody)
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

	return e.sendEmail(email, name, subject, htmlBody)
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

	return e.sendEmail(email, name, subject, htmlBody)
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

	return e.sendEmail(email, name, subject, htmlBody)
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

	return e.sendEmail(email, "", subject, htmlBody)
}
