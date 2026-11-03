package services

import "testing"

func TestGetEntryPointDefaultsToReact(t *testing.T) {
    t.Setenv("VITE_ENTRY", "")
    if got := getEntryPoint(); got != "src/main.tsx" {
        t.Fatalf("default entry point = %q, want src/main.tsx", got)
    }
}

func TestGetEntryPointAllowsOverride(t *testing.T) {
    t.Setenv("VITE_ENTRY", "src/custom.tsx")
    if got := getEntryPoint(); got != "src/custom.tsx" {
        t.Fatalf("entry point = %q, want src/custom.tsx", got)
    }
}
