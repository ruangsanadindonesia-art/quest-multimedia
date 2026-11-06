package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"

	"github.com/gofiber/fiber/v2"
	"github.com/maulanashalihin/laju-go/app/models"
	"github.com/maulanashalihin/laju-go/app/services"
	"github.com/maulanashalihin/laju-go/app/session"
)

type AuthHandler struct {
	authService    *services.AuthService
	store          *session.Store
	inertiaService *services.InertiaService
	mailerService  *services.MailerService
	publicRegistrationEnabled bool
}

func NewAuthHandler(authService *services.AuthService, store *session.Store, inertiaService *services.InertiaService, mailerService *services.MailerService, publicRegistrationEnabled bool) *AuthHandler {
	return &AuthHandler{
		authService:    authService,
		store:          store,
		inertiaService: inertiaService,
		mailerService:  mailerService,
		publicRegistrationEnabled: publicRegistrationEnabled,
	}
}

func (h *AuthHandler) ShowLoginForm(c *fiber.Ctx) error {
	return h.inertiaService.Render(c, "auth/Login", fiber.Map{
		"Title": "Login",
		"publicRegistrationEnabled": h.publicRegistrationEnabled,
	})
}

func (h *AuthHandler) ShowRegisterForm(c *fiber.Ctx) error {
	if !h.publicRegistrationEnabled {
		return fiber.ErrNotFound
	}
	return h.inertiaService.Render(c, "auth/Register", fiber.Map{
		"Title": "Register",
	})
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	if !h.publicRegistrationEnabled {
		return fiber.ErrNotFound
	}
	var req models.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if req.Name == "" || req.Email == "" || req.Password == "" {
		h.store.Flash(c, "error", "All fields are required")
		return h.inertiaService.Redirect(c, "/register")
	}

	if err := validatePasswordStrength(req.Password); err != nil {
		h.store.Flash(c, "error", err.Error())
		return h.inertiaService.Redirect(c, "/register")
	}

	user, err := h.authService.Register(req.Name, req.Email, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrUserAlreadyExists) {
			h.store.Flash(c, "error", "Email already registered")
			return h.inertiaService.Redirect(c, "/register")
		}
		h.store.Flash(c, "error", "Failed to register user. Please try again.")
		return h.inertiaService.Redirect(c, "/register")
	}

	if err := h.store.CreateAuthenticatedSession(c, user.ID, user.Name, user.Email, user.Avatar, string(user.Role), user.EmailVerified); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create session",
		})
	}

	// Regenerate session ID to prevent session fixation
	if sess, err := h.store.Get(c); err == nil {
		sess.Regenerate()
	}

	// Send verification email (async — don't block registration)
	go func() {
		if err := h.mailerService.SendVerificationEmail(context.Background(), user.Email, user.ID); err != nil {
			slog.Error("failed to send verification email", "user_id", user.ID, "error", err)
		}
	}()

	slog.Info("session created", "handler", "Auth.Register", "user_id", user.ID, "redirect", "/app")
	return h.inertiaService.Redirect(c, "/app")
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req models.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validate input
	if req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Email and password are required",
		})
	}

	user, err := h.authService.Login(req.Email, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			h.store.Flash(c, "error", "Invalid email or password")
			return h.inertiaService.Redirect(c, "/login")
		}
		h.store.Flash(c, "error", "Failed to login. Please try again.")
		return h.inertiaService.Redirect(c, "/login")
	}

	if err := h.store.CreateAuthenticatedSession(c, user.ID, user.Name, user.Email, user.Avatar, string(user.Role), user.EmailVerified); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create session",
		})
	}

	// Regenerate session ID to prevent session fixation
	if sess, err := h.store.Get(c); err == nil {
		sess.Regenerate()
	}

	slog.Info("session created", "handler", "Auth.Login", "user_id", user.ID, "redirect", "/app")
	return h.inertiaService.Redirect(c, "/app")
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	sess, _ := h.store.Get(c)
	if err := sess.Destroy(); err != nil {
		slog.Error("failed to destroy session on logout", "error", err)
	}

	slog.Info("user logged out", "handler", "Auth.Logout", "redirect", "/login")

	return h.inertiaService.Redirect(c, "/login")
}

func (h *AuthHandler) GoogleLogin(c *fiber.Ctx) error {
	if !h.publicRegistrationEnabled {
		return fiber.ErrNotFound
	}
	state, err := generateState()
	if err != nil {
		slog.Error("failed to generate OAuth state", "error", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to initiate OAuth",
		})
	}
	c.Cookie(&fiber.Cookie{
		Name:     "oauth_state",
		Value:    state,
		MaxAge:   300, // 5 minutes
		HTTPOnly: true,
		SameSite: "Lax",
	})

	url := h.authService.GetOAuthURL(state)
	// Use Location() so Inertia triggers a full window.location navigation
	// to Google's OAuth page (not an XHR follow).
	return h.inertiaService.Location(c, url)
}

func (h *AuthHandler) GoogleCallback(c *fiber.Ctx) error {
	if !h.publicRegistrationEnabled {
		return fiber.ErrNotFound
	}
	state := c.Query("state")
	code := c.Query("code")

	storedState := c.Cookies("oauth_state")
	// Constant-time comparison to prevent timing attacks on the OAuth state
	if !constantTimeCompareString(state, storedState) {
		slog.Warn("oauth state mismatch")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid OAuth state",
		})
	}

	c.ClearCookie("oauth_state")

	user, err := h.authService.ProcessGoogleToken(c.Context(), code)
	if err != nil {
		slog.Error("google token error", "error", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to authenticate with Google",
		})
	}

	// Create session
	if err := h.store.CreateAuthenticatedSession(c, user.ID, user.Name, user.Email, user.Avatar, string(user.Role), user.EmailVerified); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create session",
		})
	}

	// Regenerate session ID to prevent session fixation
	if sess, err := h.store.Get(c); err == nil {
		sess.Regenerate()
	}

	slog.Info("session created", "handler", "Auth.GoogleCallback", "user_id", user.ID, "redirect", "/app")

	return h.inertiaService.Redirect(c, "/app")
}

// generateState generates a random state string for OAuth.
// Returns an error if crypto/rand fails — never falls back to a predictable value.
func generateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate OAuth state: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// constantTimeCompareString compares two strings in constant time.
func constantTimeCompareString(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	result := byte(0)
	for i := 0; i < len(a); i++ {
		result |= a[i] ^ b[i]
	}
	return result == 0
}

// VerifyEmail handles GET /verify-email/:token — validates the token and
// marks the user's email as verified.
func (h *AuthHandler) VerifyEmail(c *fiber.Ctx) error {
	token := c.Params("token")
	if token == "" {
		return h.inertiaService.Redirect(c, "/login")
	}

	userID, err := h.mailerService.VerifyEmail(c.Context(), token)
	if err != nil {
		slog.Warn("email verification failed", "error", err)
		return h.inertiaService.Render(c, "auth/VerifyEmail", fiber.Map{
			"Title":  "Email Verification",
			"error":  "Invalid or expired verification link.",
		})
	}

	slog.Info("email verified", "user_id", userID)
	return h.inertiaService.Render(c, "auth/VerifyEmail", fiber.Map{
		"Title":   "Email Verification",
		"success": "Your email has been verified. You can now log in.",
	})
}
