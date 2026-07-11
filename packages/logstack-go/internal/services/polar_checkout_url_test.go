package services

import "testing"

func TestAbsolutePolarCheckoutURLs(t *testing.T) {
	success, ret, err := absolutePolarCheckoutURLs("https://www.logstack.tech/billing?success=true")
	if err != nil {
		t.Fatal(err)
	}
	if success != "https://www.logstack.tech/billing?success=true" {
		t.Fatalf("success=%q", success)
	}
	if ret != "https://www.logstack.tech/billing" {
		t.Fatalf("return=%q", ret)
	}

	_, _, err = absolutePolarCheckoutURLs("/billing")
	if err == nil {
		t.Fatal("expected error for relative URL")
	}
}
