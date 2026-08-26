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
	if err := db.AutoMigrate(&models.PushToken{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func seedDevice(t *testing.T, db *gorm.DB, userID uint, token string, deviceType models.DeviceType) models.PushToken {
	t.Helper()
	row := models.PushToken{
		UserID:     userID,
		Token:      token,
		DeviceType: deviceType,
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
	if got.ID != mine.ID {
		t.Fatalf("id=%d want %d", got.ID, mine.ID)
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


