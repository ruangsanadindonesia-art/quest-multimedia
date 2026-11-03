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
