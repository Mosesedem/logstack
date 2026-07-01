package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"time"

	"github.com/mosesedem/logstack/internal/config"
	"github.com/mosesedem/logstack/internal/services/notification"
)

func main() {
	to := flag.String("to", "", "recipient email address (required)")
	flag.Parse()

	if *to == "" {
		slog.Error("missing -to flag")
		os.Exit(1)
	}

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "error", err)
		os.Exit(1)
	}

	notifier := notification.NewEmailNotifier(cfg, cfg.BaseURL)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	slog.Info("sending test email", "to", *to)
	if err := notifier.SendTestEmail(ctx, *to); err != nil {
		slog.Error("test email failed", "error", err)
		os.Exit(1)
	}

	slog.Info("test email sent successfully")
}