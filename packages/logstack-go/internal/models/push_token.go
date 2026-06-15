package models

import (
	"time"
)

type DeviceType string

const (
	DeviceTypeIOS     DeviceType = "ios"
	DeviceTypeAndroid DeviceType = "android"
)

type PushToken struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	UserID     uint       `gorm:"index;not null" json:"userId"`
	Token      string     `gorm:"uniqueIndex;type:text;not null" json:"token"`
	DeviceType DeviceType `gorm:"size:10;not null" json:"deviceType"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type PushTokenCreateRequest struct {
	Token      string     `json:"token" binding:"required"`
	DeviceType DeviceType `json:"deviceType" binding:"required"`
}
