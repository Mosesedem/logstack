package models

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID                 uint       `gorm:"primaryKey" json:"id"`
	Email              string     `gorm:"uniqueIndex;size:255;not null" json:"email"`
	PasswordHash       string     `gorm:"size:255;not null" json:"-"`
	Name               string     `gorm:"size:100" json:"name"`
	Country            *string    `gorm:"size:2" json:"country,omitempty"`
	Role               string     `gorm:"size:20;not null;default:'user'" json:"role"`
	EmailVerified      bool       `gorm:"not null;default:false" json:"emailVerified"`
	VerificationToken  *string    `gorm:"size:64" json:"-"`
	VerificationSentAt *time.Time `json:"-"`
	CreatedAt          time.Time  `json:"createdAt"`
	UpdatedAt          time.Time  `json:"updatedAt"`

	// Relations
	Projects            []Project            `gorm:"foreignKey:OwnerID" json:"projects,omitempty"`
	PushTokens          []PushToken          `gorm:"foreignKey:UserID" json:"pushTokens,omitempty"`
	OrganizationMembers []OrganizationMember `gorm:"foreignKey:UserID" json:"organizationMembers,omitempty"`
}

// GenerateVerificationToken creates a new random verification token
func (u *User) GenerateVerificationToken() error {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return err
	}
	token := hex.EncodeToString(bytes)
	u.VerificationToken = &token
	now := time.Now()
	u.VerificationSentAt = &now
	return nil
}

// ClearVerificationToken clears the verification token after successful verification
func (u *User) ClearVerificationToken() {
	u.VerificationToken = nil
	u.VerificationSentAt = nil
	u.EmailVerified = true
}

// IsVerificationTokenValid checks if the verification token is still valid (24 hours)
func (u *User) IsVerificationTokenValid() bool {
	if u.VerificationToken == nil || u.VerificationSentAt == nil {
		return false
	}
	return time.Since(*u.VerificationSentAt) < 24*time.Hour
}

func (u *User) SetPassword(password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(hash)
	return nil
}

func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
	return err == nil
}

type UserResponse struct {
	ID            uint      `json:"id"`
	Email         string    `json:"email"`
	Name          string    `json:"name"`
	Country       *string   `json:"country,omitempty"`
	EmailVerified bool      `json:"emailVerified"`
	CreatedAt     time.Time `json:"createdAt"`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:            u.ID,
		Email:         u.Email,
		Name:          u.Name,
		Country:       u.Country,
		EmailVerified: u.EmailVerified,
		CreatedAt:     u.CreatedAt,
	}
}
