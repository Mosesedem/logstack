package notification

import (
	"fmt"
	"html"
	"strings"
	"time"
)

// Brand defaults for every transactional email.
const (
	emailCompanyName   = "Logstack"
	emailLogoURL       = "https://www.logstack.tech/icon.png"
	emailWebsiteURL    = "https://logstack.tech"
	emailSupportURL    = "https://logstack.tech"
	emailSubtitle      = "Real-time logs, alerts, and observability"
	emailCompanyAddr   = "Logstack · logstack.tech"
)

// StandardEmail is the content payload for the shared HTML layout.
// Button and highlight sections are omitted when their primary fields are empty.
type StandardEmail struct {
	// FirstName appears in the greeting. Empty → "there".
	FirstName string
	// Greeting overrides the default "Hello {name}," line when non-empty.
	Greeting string
	// MessageHTML is the main body (trusted internal HTML; escape user data before setting).
	MessageHTML string
	// Optional CTA.
	ButtonURL  string
	ButtonText string
	// Optional card below the body.
	HighlightTitle string
	HighlightHTML  string
	// Optional browser tab / preheader text.
	Title string
}

// BuildStandardEmailHTML returns a full HTML document using the Logstack
// standard email design (black header, white card, system footer).
func BuildStandardEmailHTML(s StandardEmail) string {
	title := strings.TrimSpace(s.Title)
	if title == "" {
		title = emailCompanyName
	}

	greeting := strings.TrimSpace(s.Greeting)
	if greeting == "" {
		name := strings.TrimSpace(s.FirstName)
		if name == "" {
			name = "there"
		}
		greeting = fmt.Sprintf("Hello %s,", html.EscapeString(name))
	}

	buttonBlock := ""
	if strings.TrimSpace(s.ButtonURL) != "" && strings.TrimSpace(s.ButtonText) != "" {
		buttonBlock = fmt.Sprintf(`
            <a href="%s" class="button" style="display:inline-block;margin-top:35px;padding:16px 32px;background:#000000;color:#ffffff !important;text-decoration:none;border-radius:8px;font-weight:600;">
                %s
            </a>`,
			html.EscapeString(s.ButtonURL),
			html.EscapeString(s.ButtonText),
		)
	}

	cardBlock := ""
	if strings.TrimSpace(s.HighlightTitle) != "" || strings.TrimSpace(s.HighlightHTML) != "" {
		titleHTML := ""
		if strings.TrimSpace(s.HighlightTitle) != "" {
			titleHTML = fmt.Sprintf(`<strong style="color:#111111;font-size:16px;">%s</strong>`, html.EscapeString(s.HighlightTitle))
		}
		bodyHTML := s.HighlightHTML
		if bodyHTML == "" {
			bodyHTML = ""
		}
		cardBlock = fmt.Sprintf(`
            <div class="card" style="background:#fafafa;border:1px solid #eeeeee;border-radius:10px;padding:25px;margin-top:30px;">
                %s
                <div style="margin-top:15px;color:#666666;line-height:1.7;font-size:15px;">
                    %s
                </div>
            </div>`, titleHTML, bodyHTML)
	}

	year := time.Now().UTC().Year()

	// Layout mirrors the product standard template: black brand header, white
	// content card, muted footer with website + support links.
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>%s</title>
<style>
    body {
        margin: 0;
        padding: 0;
        background-color: #f5f5f5;
        font-family: Arial, Helvetica, sans-serif;
        color: #111111;
        -webkit-text-size-adjust: 100%%;
    }
    table { border-spacing: 0; border-collapse: collapse; }
    img { border: 0; display: block; }
    .wrapper {
        width: 100%%;
        table-layout: fixed;
        background-color: #f5f5f5;
        padding: 40px 0;
    }
    .container {
        max-width: 620px;
        background: #ffffff;
        margin: 0 auto;
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 10px 35px rgba(0,0,0,0.08);
    }
    .header {
        background: #000000;
        padding: 40px 30px;
        text-align: center;
    }
    .logo {
        width: 80px;
        height: 80px;
        margin: 0 auto;
    }
    .brand-title {
        color: #ffffff;
        font-size: 28px;
        font-weight: 700;
        margin-top: 20px;
        letter-spacing: 1px;
    }
    .subtitle {
        color: #cccccc;
        font-size: 14px;
        margin-top: 8px;
    }
    .content {
        padding: 50px 40px;
    }
    .greeting {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 20px;
        color: #111111;
    }
    .message {
        font-size: 16px;
        line-height: 1.8;
        color: #555555;
    }
    .message a { color: #111111; }
    .button {
        display: inline-block;
        margin-top: 35px;
        padding: 16px 32px;
        background: #000000;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
    }
    .card {
        background: #fafafa;
        border: 1px solid #eeeeee;
        border-radius: 10px;
        padding: 25px;
        margin-top: 30px;
    }
    .footer {
        padding: 30px;
        text-align: center;
        font-size: 13px;
        color: #888888;
        border-top: 1px solid #eeeeee;
    }
    .social a {
        color: #000000;
        text-decoration: none;
        margin: 0 10px;
        font-weight: 600;
    }
    @media only screen and (max-width: 600px) {
        .content { padding: 35px 25px !important; }
        .greeting { font-size: 24px !important; }
        .brand-title { font-size: 24px !important; }
    }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111111;">
<div class="wrapper" style="width:100%%;background-color:#f5f5f5;padding:40px 0;">
  <div class="container" style="max-width:620px;background:#ffffff;margin:0 auto;border-radius:14px;overflow:hidden;">

    <div class="header" style="background:#000000;padding:40px 30px;text-align:center;">
      <img src="%s" alt="%s" width="80" height="80" class="logo" style="width:80px;height:80px;margin:0 auto;display:block;border:0;">
      <div class="brand-title" style="color:#ffffff;font-size:28px;font-weight:700;margin-top:20px;letter-spacing:1px;">%s</div>
      <div class="subtitle" style="color:#cccccc;font-size:14px;margin-top:8px;">%s</div>
    </div>

    <div class="content" style="padding:50px 40px;">
      <div class="greeting" style="font-size:28px;font-weight:700;margin-bottom:20px;color:#111111;">
        %s
      </div>
      <div class="message" style="font-size:16px;line-height:1.8;color:#555555;">
        %s
      </div>
      %s
      %s
    </div>

    <div class="footer" style="padding:30px;text-align:center;font-size:13px;color:#888888;border-top:1px solid #eeeeee;">
      © %d %s
      <br><br>
      %s
      <br><br>
      <div class="social">
        <a href="%s" style="color:#000000;text-decoration:none;margin:0 10px;font-weight:600;">Website</a>
        <a href="%s" style="color:#000000;text-decoration:none;margin:0 10px;font-weight:600;">Support</a>
      </div>
    </div>

  </div>
</div>
</body>
</html>`,
		html.EscapeString(title),
		html.EscapeString(emailLogoURL),
		html.EscapeString(emailCompanyName),
		html.EscapeString(emailCompanyName),
		html.EscapeString(emailSubtitle),
		greeting,
		s.MessageHTML,
		buttonBlock,
		cardBlock,
		year,
		html.EscapeString(emailCompanyName),
		html.EscapeString(emailCompanyAddr),
		html.EscapeString(emailWebsiteURL),
		html.EscapeString(emailSupportURL),
	)
}

// pHTML wraps plain text paragraphs as simple HTML (escaped).
func pHTML(paragraphs ...string) string {
	var b strings.Builder
	for i, p := range paragraphs {
		if i > 0 {
			b.WriteString("<br><br>")
		}
		b.WriteString(html.EscapeString(p))
	}
	return b.String()
}

// linkFallbackHTML shows a copy-paste URL under the CTA button.
func linkFallbackHTML(url string) string {
	esc := html.EscapeString(url)
	return fmt.Sprintf(
		`<br><br><span style="color:#666666;font-size:14px;">Or copy and paste this link into your browser:</span><br>`+
			`<a href="%s" style="color:#111111;word-break:break-all;font-size:14px;">%s</a>`,
		esc, esc,
	)
}
