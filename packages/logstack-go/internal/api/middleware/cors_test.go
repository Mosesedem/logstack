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
		path           string
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
		{
			name:           "allows log ingestion from any origin (explicit check)",
			allowedOrigins: []string{"https://app.logstack.tech"},
			origin:         "https://another-domain.com",
			method:         http.MethodPost,
			path:           "/v1/logs",
			wantOrigin:     "https://another-domain.com",
			wantVary:       "Origin",
			wantStatus:     http.StatusOK,
		},
		{
			name:           "allows log ingestion preflight from any origin",
			allowedOrigins: []string{"https://app.logstack.tech"},
			origin:         "https://another-domain.com",
			method:         http.MethodOptions,
			path:           "/v1/logs",
			wantOrigin:     "https://another-domain.com",
			wantVary:       "Origin",
			wantStatus:     http.StatusNoContent,
		},
		{
			name:           "allows log ingestion subpath preflight from any origin",
			allowedOrigins: []string{"https://app.logstack.tech"},
			origin:         "https://another-domain.com",
			method:         http.MethodOptions,
			path:           "/v1/logs/123",
			wantOrigin:     "https://another-domain.com",
			wantVary:       "Origin",
			wantStatus:     http.StatusNoContent,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := tt.path
			if path == "" {
				path = "/"
			}

			router := gin.New()
			router.Use(CORS(tt.allowedOrigins))
			
			// Setup route handler dynamically based on path
			router.Any(path, func(c *gin.Context) {
				if c.Request.Method == http.MethodOptions {
					c.Status(http.StatusNoContent)
				} else {
					c.Status(http.StatusOK)
				}
			})
			if path != "/" {
				router.Any("/", func(c *gin.Context) {
					if c.Request.Method == http.MethodOptions {
						c.Status(http.StatusNoContent)
					} else {
						c.Status(http.StatusOK)
					}
				})
			}

			req := httptest.NewRequest(tt.method, path, nil)
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