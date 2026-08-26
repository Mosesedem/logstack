package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupDevicesTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	stmts := []string{
		`CREATE TABLE push_tokens (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			token TEXT UNIQUE NOT NULL,
			device_type TEXT NOT NULL,
			session_id TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE mobile_refresh_tokens (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL,
			token TEXT UNIQUE NOT NULL,
			device_info TEXT,
			revoked INTEGER NOT NULL DEFAULT 0,
			last_used_at DATETIME,
			created_at DATETIME
		)`,
	}
	for _, stmt := range stmts {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("schema: %v\n%s", err, stmt)
		}
	}
	return db
}

func seedSession(t *testing.T, db *gorm.DB, userID uint, deviceInfo string) models.MobileRefreshToken {
	t.Helper()
	row := models.MobileRefreshToken{
		ID:         uuid.New(),
		UserID:     userID,
		Token:      uuid.NewString() + uuid.NewString(),
		DeviceInfo: deviceInfo,
		Revoked:    false,
		CreatedAt:  time.Now().UTC().Add(-2 * time.Hour),
	}
	if err := db.Create(&row).Error; err != nil {
		t.Fatalf("seed session: %v", err)
	}
	return row
}

func seedDevice(t *testing.T, db *gorm.DB, userID uint, token string, deviceType models.DeviceType) models.PushToken {
	return seedLinkedDevice(t, db, userID, token, deviceType, nil)
}

func seedLinkedDevice(t *testing.T, db *gorm.DB, userID uint, token string, deviceType models.DeviceType, sessionID *uuid.UUID) models.PushToken {
	t.Helper()
	row := models.PushToken{
		UserID:     userID,
		Token:      token,
		DeviceType: deviceType,
		SessionID:  sessionID,
		CreatedAt:  time.Now().UTC().Add(-time.Hour),
		UpdatedAt:  time.Now().UTC(),
	}
	if err := db.Create(&row).Error; err != nil {
		t.Fatalf("seed device: %v", err)
	}
	return row
}

func devicesContext(method, path string, userID uint) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, nil)
	c.Set("userID", userID)
	return c, w
}

func TestListDevicesReturnsOnlyOwnTokensMasked(t *testing.T) {
	db := setupDevicesTestDB(t)
	mine := seedDevice(t, db, 7, "aaaaaaaaaa-mine-bbbbbbbbbb", models.DeviceTypeIOS)
	seedDevice(t, db, 9, "cccccccccc-other-dddddddddd", models.DeviceTypeAndroid)

	h := NewUsersHandler(db, nil)
	c, w := devicesContext(http.MethodGet, "/users/me/devices", 7)
	h.ListDevices(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	var resp struct {
		Count   int                 `json:"count"`
		Devices []models.DeviceView `json:"devices"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Count != 1 || len(resp.Devices) != 1 {
		t.Fatalf("got %+v, want 1 own device", resp)
	}
	got := resp.Devices[0]
	wantID := models.DeviceIDPrefixPush + strconv.FormatUint(uint64(mine.ID), 10)
	if got.ID != wantID {
		t.Fatalf("id=%s want %s", got.ID, wantID)
	}
	if !got.PushEnabled {
		t.Fatal("expected pushEnabled")
	}
	if got.DeviceType != models.DeviceTypeIOS {
		t.Fatalf("deviceType=%s", got.DeviceType)
	}
	if got.MaskedToken == mine.Token || got.MaskedToken == "" {
		t.Fatalf("raw token leaked: %q", got.MaskedToken)
	}
}

func TestDeleteDeviceRemovesOwnTokenOnly(t *testing.T) {
	db := setupDevicesTestDB(t)
	mine := seedDevice(t, db, 7, "aaaaaaaaaa-mine-bbbbbbbbbb", models.DeviceTypeAndroid)
	other := seedDevice(t, db, 9, "cccccccccc-other-dddddddddd", models.DeviceTypeIOS)

	h := NewUsersHandler(db, nil)
	c, w := devicesContext(http.MethodDelete, "/users/me/devices/1", 7)
	c.Params = gin.Params{{Key: "id", Value: "999"}}
	h.DeleteDevice(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("missing id status=%d", w.Code)
	}

	c, w = devicesContext(http.MethodDelete, "/users/me/devices/"+strconv.FormatUint(uint64(other.ID), 10), 7)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(other.ID), 10)}}
	h.DeleteDevice(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("cross-user delete status=%d body=%s", w.Code, w.Body.String())
	}
	var still models.PushToken
	if err := db.First(&still, other.ID).Error; err != nil {
		t.Fatalf("other token should remain: %v", err)
	}

	c, w = devicesContext(http.MethodDelete, "/users/me/devices/"+strconv.FormatUint(uint64(mine.ID), 10), 7)
	c.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(mine.ID), 10)}}
	h.DeleteDevice(c)
	if w.Code != http.StatusOK {
		t.Fatalf("delete own status=%d body=%s", w.Code, w.Body.String())
	}
	if err := db.First(&models.PushToken{}, mine.ID).Error; err == nil {
		t.Fatal("own token still present after delete")
	}
}

func TestDeleteAllDevicesOnlyTouchesCaller(t *testing.T) {
	db := setupDevicesTestDB(t)
	seedDevice(t, db, 7, "aaaaaaaaaa-one-bbbbbbbbbb", models.DeviceTypeIOS)
	seedDevice(t, db, 7, "aaaaaaaaaa-two-bbbbbbbbbb", models.DeviceTypeAndroid)
	other := seedDevice(t, db, 9, "cccccccccc-other-dddddddddd", models.DeviceTypeIOS)

	h := NewUsersHandler(db, nil)
	c, w := devicesContext(http.MethodDelete, "/users/me/devices", 7)
	h.DeleteAllDevices(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	var mine int64
	db.Model(&models.PushToken{}).Where("user_id = ?", 7).Count(&mine)
	if mine != 0 {
		t.Fatalf("caller still has %d tokens", mine)
	}
	if err := db.First(&models.PushToken{}, other.ID).Error; err != nil {
		t.Fatalf("other user token removed: %v", err)
	}
}

func TestDeleteSessionLogsOutAndRemovesLinkedPush(t *testing.T) {
	db := setupDevicesTestDB(t)
	session := seedSession(t, db, 7, "ios")
	otherSession := seedSession(t, db, 9, "android")
	sid := session.ID
	token := seedLinkedDevice(t, db, 7, "aaaaaaaaaa-mine-bbbbbbbbbb", models.DeviceTypeIOS, &sid)

	h := NewUsersHandler(db, nil)
	c, w := devicesContext(http.MethodGet, "/users/me/devices", 7)
	h.ListDevices(c)
	if w.Code != http.StatusOK {
		t.Fatalf("list status=%d body=%s", w.Code, w.Body.String())
	}
	var listed struct {
		Devices []models.DeviceView `json:"devices"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &listed); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(listed.Devices) != 1 {
		t.Fatalf("devices=%d want 1 merged session+push", len(listed.Devices))
	}
	if listed.Devices[0].ID != models.DeviceIDPrefixSession+session.ID.String() {
		t.Fatalf("id=%s", listed.Devices[0].ID)
	}
	if !listed.Devices[0].SignedIn || !listed.Devices[0].PushEnabled {
		t.Fatalf("flags signedIn=%v pushEnabled=%v", listed.Devices[0].SignedIn, listed.Devices[0].PushEnabled)
	}

	c, w = devicesContext(http.MethodDelete, "/users/me/devices/"+listed.Devices[0].ID, 7)
	c.Params = gin.Params{{Key: "id", Value: listed.Devices[0].ID}}
	h.DeleteDevice(c)
	if w.Code != http.StatusOK {
		t.Fatalf("delete status=%d body=%s", w.Code, w.Body.String())
	}

	var revoked models.MobileRefreshToken
	if err := db.First(&revoked, "id = ?", session.ID).Error; err != nil {
		t.Fatalf("session: %v", err)
	}
	if !revoked.Revoked {
		t.Fatal("session should be revoked")
	}
	if err := db.First(&models.PushToken{}, token.ID).Error; err == nil {
		t.Fatal("linked push token still present")
	}

	var other models.MobileRefreshToken
	if err := db.First(&other, "id = ?", otherSession.ID).Error; err != nil {
		t.Fatalf("other session: %v", err)
	}
	if other.Revoked {
		t.Fatal("other user session was revoked")
	}
}

func TestDeleteAllDevicesRevokesSessions(t *testing.T) {
	db := setupDevicesTestDB(t)
	mine := seedSession(t, db, 7, "ios")
	other := seedSession(t, db, 9, "android")
	seedDevice(t, db, 7, "aaaaaaaaaa-one-bbbbbbbbbb", models.DeviceTypeIOS)

	h := NewUsersHandler(db, nil)
	c, w := devicesContext(http.MethodDelete, "/users/me/devices", 7)
	h.DeleteAllDevices(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}

	var mineRow models.MobileRefreshToken
	if err := db.First(&mineRow, "id = ?", mine.ID).Error; err != nil {
		t.Fatalf("mine session: %v", err)
	}
	if !mineRow.Revoked {
		t.Fatal("caller session should be revoked")
	}
	var otherRow models.MobileRefreshToken
	if err := db.First(&otherRow, "id = ?", other.ID).Error; err != nil {
		t.Fatalf("other session: %v", err)
	}
	if otherRow.Revoked {
		t.Fatal("other user session was revoked")
	}
}


