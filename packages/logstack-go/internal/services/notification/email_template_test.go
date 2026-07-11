package notification

import (
	"strings"
	"testing"
)

func TestBuildStandardEmailHTML_CoreStructure(t *testing.T) {
	htmlBody := BuildStandardEmailHTML(StandardEmail{
		Title:     "Verify your account",
		FirstName: "Ada",
		MessageHTML: pHTML(
			"Thanks for signing up.",
			"Please verify your email.",
		),
		ButtonURL:      "https://logstack.tech/verify-email?token=abc",
		ButtonText:     "Verify Email",
		HighlightTitle: "You’re almost in",
		HighlightHTML:  `<p style="margin:0">Confirm to continue.</p>`,
	})

	mustContain := []string{
		"<!DOCTYPE html>",
		`lang="en"`,
		"Hello Ada,",
		"Thanks for signing up.",
		"Verify Email",
		"https://logstack.tech/verify-email?token=abc",
		"You’re almost in",
		emailLogoURL,
		emailCompanyName,
		emailWebsiteURL,
		emailSupportURL,
		"Real-time logs, alerts, and observability",
		"background:#000000",
		"©",
	}
	for _, s := range mustContain {
		if !strings.Contains(htmlBody, s) {
			t.Fatalf("expected email HTML to contain %q", s)
		}
	}
}

func TestBuildStandardEmailHTML_EscapesName(t *testing.T) {
	htmlBody := BuildStandardEmailHTML(StandardEmail{
		FirstName:   `<script>alert(1)</script>`,
		MessageHTML: pHTML("Safe body"),
	})
	if strings.Contains(htmlBody, "<script>alert(1)</script>") {
		t.Fatal("first name must be HTML-escaped")
	}
	if !strings.Contains(htmlBody, "&lt;script&gt;") {
		t.Fatal("expected escaped script tags in greeting")
	}
}

func TestBuildStandardEmailHTML_OmitsOptionalSections(t *testing.T) {
	htmlBody := BuildStandardEmailHTML(StandardEmail{
		MessageHTML: pHTML("Body only"),
	})
	if strings.Contains(htmlBody, `class="button"`) {
		t.Fatal("button should be omitted when URL/text empty")
	}
	if strings.Contains(htmlBody, `class="card"`) {
		t.Fatal("card should be omitted when highlight empty")
	}
	if !strings.Contains(htmlBody, "Hello there,") {
		t.Fatal("empty first name should greet as 'there'")
	}
}
