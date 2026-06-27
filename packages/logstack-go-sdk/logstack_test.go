package logstack

import "testing"

func TestNormalizeAPIURL(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"https://api.logstack.tech", "https://api.logstack.tech"},
		{"https://api.logstack.tech/", "https://api.logstack.tech"},
		{"https://api.logstack.tech/v1", "https://api.logstack.tech"},
		{"http://localhost:8080/v1/", "http://localhost:8080"},
	}
	for _, tc := range tests {
		if got := normalizeAPIURL(tc.in); got != tc.want {
			t.Fatalf("normalizeAPIURL(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestCloseIsIdempotent(t *testing.T) {
	c := NewClient(Config{APIKey: "test-key"})
	if err := c.Close(); err != nil {
		t.Fatalf("first close: %v", err)
	}
	if err := c.Close(); err != nil {
		t.Fatalf("second close: %v", err)
	}
}