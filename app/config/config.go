package config

import (
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppPort            string
	AppEnv             string
	DBPath             string
	SessionSecret      string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
	FrontendURL        string
	// CORS
	AllowedOrigins []string
	// Email
	MailDriver          string
	MailFrom            string
	MailFromName        string
	ResendAPIKey        string
	MailtrapAPIToken    string
	MailtrapInboxID     string
	// Session
	SessionTTL time.Duration
}


func Load() *Config {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		slog.Warn("no .env file found, using environment variables")
	}

	c := &Config{
		AppPort:            getEnv("APP_PORT", "8080"),
		AppEnv:             getEnv("APP_ENV", "development"),
		DBPath:             getEnv("DB_PATH", "./data/app.db"),
		SessionSecret:      getEnv("SESSION_SECRET", "change-this-in-production"),
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", ""),
		FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:5173"),
		AllowedOrigins:     parseAllowedOrigins(),
		// Email
		MailDriver:       getEnv("MAIL_DRIVER", "log"),
		MailFrom:         getEnv("MAIL_FROM", "noreply@example.com"),
		MailFromName:     getEnv("MAIL_FROM_NAME", "Laju"),
		ResendAPIKey:     getEnv("RESEND_API_KEY", ""),
		MailtrapAPIToken: getEnv("MAILTRAP_API_TOKEN", ""),
		MailtrapInboxID:  getEnv("MAILTRAP_INBOX_ID", ""),
		// Session
		SessionTTL: getSessionTTL(),
	}

	return c
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func getEnvAsInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	var result int
	if _, err := fmt.Sscanf(value, "%d", &result); err != nil {
		return defaultValue
	}
	return result
}

func (c *Config) GetDSN() string {
	return fmt.Sprintf("file:%s?_foreign_keys=on", c.DBPath)
}

// Validate rejects unsafe production defaults before the application starts.
func (c *Config) Validate() error {
    if c.AppEnv == "production" {
        secret := strings.TrimSpace(c.SessionSecret)
        if secret == "change-this-in-production" || len(secret) < 32 {
            return fmt.Errorf("SESSION_SECRET must be a unique value with at least 32 characters in production")
        }
    }
    return nil
}

func (c *Config) IsDevelopment() bool {
	return c.AppEnv == "development"
}

// parseAllowedOrigins parses ALLOWED_ORIGINS env var (comma-separated).
// Defaults to http://localhost:5173 in dev, empty (strict) in prod.
func parseAllowedOrigins() []string {
	val := os.Getenv("ALLOWED_ORIGINS")
	if val == "" {
		return []string{"http://localhost:5173"}
	}
	var origins []string
	for _, o := range strings.Split(val, ",") {
		trimmed := strings.TrimSpace(o)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}

func getSessionTTL() time.Duration {
	val := getEnv("SESSION_TTL", "24h")
	d, err := time.ParseDuration(val)
	if err != nil {
		return 24 * time.Hour
	}
	return d
}
