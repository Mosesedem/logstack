package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// InvoiceLineItem represents a single line item on an invoice.
type InvoiceLineItem struct {
	Description string `json:"description"`
	Amount      int    `json:"amount"`   // in cents
	Quantity    int    `json:"quantity"`
}

// Invoice represents a billing invoice issued to a user.
type Invoice struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID      uint           `gorm:"not null;index" json:"userId"`
	Reference   string         `gorm:"size:255;uniqueIndex;not null" json:"reference"`
	AmountCents int            `gorm:"not null" json:"amountCents"`
	Currency    string         `gorm:"size:3;not null" json:"currency"`
	Status      string         `gorm:"size:20;not null;default:'pending'" json:"status"` // pending | paid | failed
	LineItems   datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'::jsonb" json:"lineItems"`
	PaidAt      *time.Time     `json:"paidAt,omitempty"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
