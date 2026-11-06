package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"github.com/gofiber/fiber/v2"
	"github.com/maulanashalihin/laju-go/app/models"
	"github.com/maulanashalihin/laju-go/app/queries"
	"github.com/maulanashalihin/laju-go/app/services"
	"github.com/maulanashalihin/laju-go/app/session"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestApp(t *testing.T, registrationEnabled ...bool) (*fiber.App, *queries.Querier) {
	t.Helper()
	allowRegistration := true
	if len(registrationEnabled) > 0 {
		allowRegistration = registrationEnabled[0]
	}

	db, err := sql.Open("sqlite3", ":memory:?_pragma=journal_mode(WAL)")
	require.NoError(t, err)
	t.Cleanup(func() { db.Close() })

	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
		password TEXT, avatar TEXT DEFAULT '',
		role TEXT NOT NULL DEFAULT 'user', google_id TEXT UNIQUE,
		email_verified BOOLEAN NOT NULL DEFAULT FALSE,
		failed_login_attempts INTEGER NOT NULL DEFAULT 0,
		locked_until DATETIME,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
	CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
	CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
		data TEXT NOT NULL, expires_at DATETIME NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);`)
	require.NoError(t, err)

	querier := queries.NewQuerier(db)
	store := session.New(querier, nil, 24*time.Hour)
	authSvc := services.NewAuthService(querier, services.AuthServiceConfig{
		SessionSecret: "test-secret-32-chars-long-for-testing!!",
	})
	inertiaSvc := services.NewInertiaService(services.NewAssetService("", "", false), store)
	mailerSvc := services.NewMailerService(querier, services.MailConfig{Driver: services.MailDriverLog}, "http://localhost:8080")

	app := fiber.New()
	h := NewAuthHandler(authSvc, store, inertiaSvc, mailerSvc, allowRegistration)
	app.Get("/login", h.ShowLoginForm)
	app.Get("/register", h.ShowRegisterForm)
	app.Post("/register", h.Register)
	app.Get("/auth/google", h.GoogleLogin)
	app.Get("/auth/google/callback", h.GoogleCallback)
	app.Post("/login", h.Login)
	app.Get("/logout", h.Logout)

	return app, querier
}

func hashPW(t *testing.T, pw string) string {
	t.Helper()
	h, err := services.HashPassword(pw)
	require.NoError(t, err)
	return h
}

func TestShowForms(t *testing.T) {
	app, _ := setupTestApp(t)

	tests := []struct {
		path string
	}{
		{"/login"},
		{"/register"},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			resp, err := app.Test(req)
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}
}

func TestRegisterEndpoint(t *testing.T) {
	app, querier := setupTestApp(t)

	ctx := context.Background()
	err := querier.CreateUser(ctx, &models.User{
		Email: "dup@example.com", Name: "Existing",
		Password: sql.NullString{String: hashPW(t, "x"), Valid: true},
		Role:     models.RoleUser,
	})
	require.NoError(t, err)

	tests := []struct {
		name         string
		body         string
		wantStatus   int
		wantLocation string
		wantSession  bool
	}{
		{
		"success", `{"name":"T","email":"a@b.com","password":"Pass1234"}`,
			http.StatusSeeOther, "/app", true,
		},
		{
			"empty fields", `{"name":"","email":"","password":""}`,
			http.StatusSeeOther, "/register", false,
		},
		{
			"duplicate email", `{"name":"T","email":"dup@example.com","password":"x"}`,
			http.StatusSeeOther, "/register", false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/register", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			resp, err := app.Test(req)
			require.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)
			assert.Equal(t, tt.wantLocation, resp.Header.Get("Location"))

			if tt.wantSession {
				hasSession := false
				for _, c := range resp.Header["Set-Cookie"] {
					if strings.HasPrefix(c, "session_id=") {
						hasSession = true
						break
					}
				}
				assert.True(t, hasSession, "response should set session cookie")
			}
		})
	}
}

func TestLoginEndpoint(t *testing.T) {
	app, querier := setupTestApp(t)

	ctx := context.Background()
	err := querier.CreateUser(ctx, &models.User{
		Email: "user@example.com", Name: "Test User",
		Password: sql.NullString{String: hashPW(t, "pass123"), Valid: true},
		Role:     models.RoleUser,
	})
	require.NoError(t, err)

	tests := []struct {
		name         string
		body         string
		wantStatus   int
		wantLocation string
	}{
		{"success", `{"email":"user@example.com","password":"pass123"}`, http.StatusSeeOther, "/app"},
		{"wrong password", `{"email":"user@example.com","password":"wrong"}`, http.StatusSeeOther, "/login"},
		{"unknown user", `{"email":"nobody@example.com","password":"any"}`, http.StatusSeeOther, "/login"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			resp, err := app.Test(req)
			require.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)
			assert.Equal(t, tt.wantLocation, resp.Header.Get("Location"))
		})
	}
}

func TestLogout(t *testing.T) {
	app, querier := setupTestApp(t)
	ctx := context.Background()

	err := querier.CreateUser(ctx, &models.User{
		Email: "logout@example.com", Name: "Logout User",
		Password: sql.NullString{String: hashPW(t, "pw"), Valid: true},
		Role:     models.RoleUser,
	})
	require.NoError(t, err)

	loginReq := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"email":"logout@example.com","password":"pw"}`))
	loginReq.Header.Set("Content-Type", "application/json")
	loginResp, err := app.Test(loginReq)
	require.NoError(t, err)
	require.Equal(t, http.StatusSeeOther, loginResp.StatusCode)

	var sessionCookie string
	for _, c := range loginResp.Header["Set-Cookie"] {
		if strings.HasPrefix(c, "session_id=") {
			sessionCookie = strings.Split(c, ";")[0]
			break
		}
	}
	require.NotEmpty(t, sessionCookie)

	logoutReq := httptest.NewRequest(http.MethodGet, "/logout", nil)
	logoutReq.Header.Set("Cookie", sessionCookie)
	logoutResp, err := app.Test(logoutReq)
	require.NoError(t, err)
	assert.Equal(t, http.StatusSeeOther, logoutResp.StatusCode)
	assert.Equal(t, "/login", logoutResp.Header.Get("Location"))
}

func TestRegistrationClosed(t *testing.T) {
	app, querier := setupTestApp(t, false)

	for _, tt := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/register"},
		{http.MethodPost, "/register"},
		{http.MethodGet, "/auth/google"},
		{http.MethodGet, "/auth/google/callback?state=x&code=y"},
	} {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, strings.NewReader(`{"name":"Blocked","email":"blocked@example.com","password":"Pass1234"}`))
			req.Header.Set("Content-Type", "application/json")
			resp, err := app.Test(req)
			require.NoError(t, err)
			assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		})
	}

	_, err := querier.GetUserByEmail(context.Background(), "blocked@example.com")
	require.ErrorIs(t, err, queries.ErrUserNotFound)

	loginResp, err := app.Test(httptest.NewRequest(http.MethodGet, "/login", nil))
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, loginResp.StatusCode)
}
