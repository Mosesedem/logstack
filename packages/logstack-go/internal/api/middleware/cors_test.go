package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORS(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		allowedOrigins []string
		origin         string
		method         string
		wantOrigin     string
		wantVary       string
		wantStatus     int
	}{
		{
			name:           "reflects explicit origin",
			allowedOrigins: []string{"https://app.logstack.tech"},
			origin:         "https://app.logstack.tech",
			method:         http.MethodGet,
			wantOrigin:     "https://app.logstack.tech",
			wantVary:       "Origin",
			wantStatus:     http.StatusOK,
		},
		{
			name:           "reflects origin in wildcard mode",
			allowedOrigins: []string{"*"},
			origin:         "https://app.logstack.tech",
			method:         http.MethodGet,
			wantOrigin:     "https://app.logstack.tech",
			wantVary:       "Origin",
			wantStatus:     http.StatusOK,
		},
		{
			name:           "does not allow disallowed origin",
			allowedOrigins: []string{"https://app.logstack.tech"},
			origin:         "https://evil.example",
			method:         http.MethodGet,
			wantOrigin:     "",
			wantVary:       "",
			wantStatus:     http.StatusOK,
		},
		{
			name:           "answers preflight requests",
			allowedOrigins: []string{"*"},
			origin:         "https://app.logstack.tech",
			method:         http.MethodOptions,
			wantOrigin:     "https://app.logstack.tech",
			wantVary:       "Origin",
			wantStatus:     http.StatusNoContent,
		},
		{
			name:           "allows www when apex is configured",
			allowedOrigins: []string{"https://logstack.tech", "https://www.logstack.tech"},
			origin:         "https://www.logstack.tech",
			method:         http.MethodOptions,
			wantOrigin:     "https://www.logstack.tech",
			wantVary:       "Origin",
			wantStatus:     http.StatusNoContent,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.Use(CORS(tt.allowedOrigins))
			router.GET("/", func(c *gin.Context) {
				c.Status(http.StatusOK)
			})
			router.OPTIONS("/", func(c *gin.Context) {
				c.Status(http.StatusNoContent)
			})

			req := httptest.NewRequest(tt.method, "/", nil)
			req.Header.Set("Origin", tt.origin)
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tt.wantOrigin {
				t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, tt.wantOrigin)
			}
			if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
				t.Fatalf("Access-Control-Allow-Credentials = %q, want %q", got, "true")
			}
			if got := rec.Header().Get("Vary"); got != tt.wantVary {
				t.Fatalf("Vary = %q, want %q", got, tt.wantVary)
			}
		})
	}
}