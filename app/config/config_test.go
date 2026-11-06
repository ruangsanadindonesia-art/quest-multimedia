package config

import "testing"

func TestValidateProductionSessionSecret(t *testing.T) {
    tests := []struct {
        name    string
        env     string
        secret  string
        wantErr bool
    }{
        {"development default allowed", "development", "change-this-in-production", false},
        {"production placeholder rejected", "production", "change-this-in-production", true},
        {"production short secret rejected", "production", "short-secret", true},
        {"production strong length accepted", "production", "a-long-unique-test-secret-of-32-chars-minimum", false},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            cfg := &Config{AppEnv: tt.env, SessionSecret: tt.secret}
            err := cfg.Validate()
            if (err != nil) != tt.wantErr {
                t.Fatalf("Validate() error = %v; wantErr %v", err, tt.wantErr)
            }
        })
    }
}

func TestPublicRegistrationPolicy(t *testing.T) {
	for _, tt := range []struct {
		name string
		env string
		override string
		want bool
	}{
		{"development default", "development", "", true},
		{"production default", "production", "", false},
		{"production explicit true", "production", "true", true},
		{"production explicit false", "production", "false", false},
		{"unexpected value fails closed", "production", "1", false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("ALLOW_PUBLIC_REGISTRATION", tt.override)
			if got := publicRegistrationAllowed(tt.env); got != tt.want {
				t.Fatalf("publicRegistrationAllowed(%q) = %t; want %t", tt.env, got, tt.want)
			}
		})
	}
}
