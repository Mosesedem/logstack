package db

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"strings"

	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

// SeedAdmins ensures every email in adminEmails has role=admin and is verified.
// Existing users are promoted; missing users are created with a seed password
// (adminSeedPassword when set, otherwise a one-time random password logged once).
func SeedAdmins(db *gorm.DB, adminEmails []string, adminSeedPassword string) error {
	if len(adminEmails) == 0 {
		return nil
	}

	for _, raw := range adminEmails {
		email := strings.ToLower(strings.TrimSpace(raw))
		if email == "" {
			continue
		}

		var user models.User
		err := db.Where("email = ?", email).First(&user).Error
		if err == nil {
			updates := map[string]interface{}{}
			if user.Role != "admin" {
				updates["role"] = "admin"
			}
			if !user.EmailVerified {
				updates["email_verified"] = true
			}
			if len(updates) > 0 {
				if err := db.Model(&user).Updates(updates).Error; err != nil {
					return fmt.Errorf("promote admin %s: %w", email, err)
				}
				slog.Info("Promoted user to platform admin", "email", email, "userID", user.ID)
			} else {
				slog.Info("Admin already seeded", "email", email, "userID", user.ID)
			}
			continue
		}
		if err != gorm.ErrRecordNotFound {
			return fmt.Errorf("lookup admin %s: %w", email, err)
		}

		password := strings.TrimSpace(adminSeedPassword)
		generated := false
		if password == "" {
			pw, genErr := generateSeedPassword()
			if genErr != nil {
				return fmt.Errorf("generate admin password for %s: %w", email, genErr)
			}
			password = pw
			generated = true
		}

		user = models.User{
			Email:         email,
			Name:          "Admin",
			Role:          "admin",
			EmailVerified: true,
		}
		if err := user.SetPassword(password); err != nil {
			return fmt.Errorf("hash admin password for %s: %w", email, err)
		}
		if err := db.Create(&user).Error; err != nil {
			return fmt.Errorf("create admin %s: %w", email, err)
		}

		if generated {
			slog.Warn(
				"Created platform admin with generated password — change it after first login",
				"email", email,
				"userID", user.ID,
				"password", password,
			)
		} else {
			slog.Info("Created platform admin from ADMIN_SEED_PASSWORD", "email", email, "userID", user.ID)
		}
	}

	return nil
}

func generateSeedPassword() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "Ls!" + hex.EncodeToString(buf), nil
}
