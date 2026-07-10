package notification

import (
	"context"
	"fmt"
	"html"
	"log/slog"
	"strings"
)

const pushOpsAlertEmail = "mosesedem81@gmail.com"

func pushSourceFromData(data map[string]string) string {
	if data == nil {
		return "push"
	}
	if t := strings.TrimSpace(data["type"]); t != "" {
		return t
	}
	return "push"
}

// ReportPushFailure emails the ops contact when push delivery fails.
func ReportPushFailure(
	ctx context.Context,
	email *EmailNotifier,
	source string,
	userID uint,
	title, body string,
	err error,
	result *DirectPushResult,
) {
	if email == nil || err == nil {
		return
	}

	subject := fmt.Sprintf("[Logstack] Push notification error (%s)", source)

	var detailLines []string
	detailLines = append(detailLines, fmt.Sprintf("<li><strong>Source:</strong> %s</li>", html.EscapeString(source)))
	if userID > 0 {
		detailLines = append(detailLines, fmt.Sprintf("<li><strong>User ID:</strong> %d</li>", userID))
	}
	detailLines = append(detailLines, fmt.Sprintf("<li><strong>Title:</strong> %s</li>", html.EscapeString(title)))
	if body != "" {
		detailLines = append(detailLines, fmt.Sprintf("<li><strong>Body:</strong> %s</li>", html.EscapeString(body)))
	}
	detailLines = append(detailLines, fmt.Sprintf("<li><strong>Error:</strong> %s</li>", html.EscapeString(err.Error())))

	if result != nil {
		detailLines = append(detailLines, fmt.Sprintf("<li><strong>Tokens found:</strong> %d</li>", result.TokensFound))
		detailLines = append(detailLines, fmt.Sprintf("<li><strong>Sent:</strong> %d</li>", result.Sent))
		detailLines = append(detailLines, fmt.Sprintf("<li><strong>Failed:</strong> %d</li>", result.Failed))
		if len(result.Errors) > 0 {
			escaped := make([]string, len(result.Errors))
			for i, e := range result.Errors {
				escaped[i] = html.EscapeString(e)
			}
			detailLines = append(detailLines, fmt.Sprintf(
				"<li><strong>Device errors:</strong><ul><li>%s</li></ul></li>",
				strings.Join(escaped, "</li><li>"),
			))
		}
	}

	htmlBody := fmt.Sprintf(`<div style="font-family:system-ui,sans-serif;line-height:1.5">
<h2>Push notification delivery failed</h2>
<ul>%s</ul>
<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>
<p style="color:#888;font-size:12px">Logstack push ops alert</p>
</div>`, strings.Join(detailLines, ""))

	if sendErr := email.SendDirect(ctx, pushOpsAlertEmail, "", subject, htmlBody); sendErr != nil {
		slog.Warn("failed to send push failure ops alert email",
			"error", sendErr,
			"recipient", pushOpsAlertEmail,
			"source", source,
		)
		return
	}

	slog.Info("push failure ops alert email sent",
		"recipient", pushOpsAlertEmail,
		"source", source,
		"userId", userID,
	)
}