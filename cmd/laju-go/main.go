package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/maulanashalihin/laju-go/app/cache"
	"github.com/maulanashalihin/laju-go/app/config"
	"github.com/maulanashalihin/laju-go/app/handlers"
	"github.com/maulanashalihin/laju-go/app/middlewares"
	"github.com/maulanashalihin/laju-go/app/queries"
	"github.com/maulanashalihin/laju-go/app/services"
	"github.com/maulanashalihin/laju-go/app/session"
	"github.com/maulanashalihin/laju-go/routes"
	"github.com/pressly/goose/v3"

	_ "github.com/mattn/go-sqlite3"
)

var (
	Version = "v1.1.0"
	Commit  = "none"
)

func main() {
	showVersion := flag.Bool("version", false, "show version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Printf("laju-go %s (commit: %s)\n", Version, Commit)
		os.Exit(0)
	}

	// Load configuration
	cfg := config.Load()
    if err := cfg.Validate(); err != nil {
        slog.Error("invalid application configuration", "error", err)
        os.Exit(1)
    }

	logLevel := slog.LevelInfo
	if cfg.AppEnv == "development" {
		logLevel = slog.LevelDebug
	}
	opts := &slog.HandlerOptions{Level: logLevel}
	var handler slog.Handler
	if cfg.AppEnv == "development" {
		handler = slog.NewTextHandler(os.Stdout, opts)
	} else {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	}
	slog.SetDefault(slog.New(handler))
	slog.Info("starting", "version", Version, "commit", Commit, "env", cfg.AppEnv)

	// Initialize database
	db, err := initDatabase(cfg.DBPath)
	if err != nil {
		slog.Error("failed to initialize database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Run migrations
	if err := runMigrations(db, "./migrations"); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	// Initialize querier
	querier := queries.NewQuerier(db)

	// Initialize in-memory session cache
	sessionCache := cache.NewSessionCache()

	// Initialize session store with database + in-memory cache
	sessionStore := session.New(querier, sessionCache, cfg.SessionTTL)
	sessionStore.SetSecure(cfg.AppEnv == "production")

	// Start background cleanup for expired sessions, password reset tokens, and cache
	startBackgroundCleanup(querier, sessionCache)

	// Initialize services
	authService := services.NewAuthService(querier, services.AuthServiceConfig{
		SessionSecret:      cfg.SessionSecret,
		GoogleClientID:     cfg.GoogleClientID,
		GoogleClientSecret: cfg.GoogleClientSecret,
		GoogleRedirectURL:  cfg.GoogleRedirectURL,
	})
	userService := services.NewUserService(querier)

	// Initialize Asset service (for production builds with hashed filenames)
	assetService := services.NewAssetService("./dist/.vite/manifest.json", ".vite-port", cfg.IsDevelopment())

	// Initialize Inertia service (auto-detects Vite from .vite-port)
	inertiaService := services.NewInertiaService(assetService, sessionStore)

	// Create storage directories
	if err := os.MkdirAll("storage/uploads", 0755); err != nil {
		slog.Error("failed to create uploads directory", "error", err)
		os.Exit(1)
	}
	if err := os.MkdirAll("storage/avatars", 0755); err != nil {
		slog.Error("failed to create avatars directory", "error", err)
		os.Exit(1)
	}
	// Setup CSRF middleware (Secure cookies only in production with HTTPS)
	csrfMiddleware := routes.SetupCSRFMiddleware(cfg.SessionSecret, cfg.AppEnv == "production")

	// Setup mailer service (multi-provider: log / resend / mailtrap)
	appURL := routes.GetAppURL(cfg.AppPort, cfg.AppEnv)
	mailerService := services.NewMailerService(querier, services.MailConfig{
		Driver:          services.MailDriver(cfg.MailDriver),
		From:            cfg.MailFrom,
		FromName:        cfg.MailFromName,
		ResendAPIKey:    cfg.ResendAPIKey,
		MailtrapToken:   cfg.MailtrapAPIToken,
		MailtrapInboxID: cfg.MailtrapInboxID,
	}, appURL)

	// Initialize handlers
	uploadHandler := handlers.NewUploadHandler(sessionStore, userService, "storage/uploads")
	routeHandlers := routes.Handlers{
		Public: handlers.NewPublicHandler(authService, userService, inertiaService, assetService),
		Auth:   handlers.NewAuthHandler(authService, sessionStore, inertiaService, mailerService, cfg.AllowPublicRegistration),
		App:    handlers.NewAppHandler(userService, sessionStore, inertiaService),
		Upload: uploadHandler,
		Quest: handlers.NewQuestHandler(db,sessionStore,inertiaService),
	}

	// Setup password reset handler
	passwordResetHandler := routes.SetupPasswordResetHandler(
		mailerService,
		userService,
		sessionStore,
		inertiaService,
	)
	routeHandlers.PasswordReset = passwordResetHandler
	app := fiber.New(fiber.Config{
		AppName:      "Laju",
		ErrorHandler: customErrorHandler,
		// Required for TUS resumable upload — streams request body instead of buffering
		StreamRequestBody: true,
		// Read buffer for streaming large uploads
		ReadBufferSize: 64 * 1024,
	})

	// Global middleware
	// Logger: only in development (avoids string allocation per request in prod)
	if cfg.IsDevelopment() {
		app.Use(logger.New())
	}
	app.Use(recover.New())
	app.Use(middlewares.SecurityHeaders())

	// Response compression (brotli > gzip, best speed for low CPU overhead)
	app.Use(compress.New(compress.Config{
		Level: compress.LevelBestSpeed,
	}))

	// Inertia middleware: asset version checking, shared props, Vary header
	app.Use(inertiaService.Middleware())

	// CORS with explicit allowed origins (no AllowOriginsFunc in production)
	app.Use(cors.New(cors.Config{
		AllowOrigins:     strings.Join(cfg.AllowedOrigins, ","),
		AllowCredentials: true,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Inertia, X-Inertia-Version, X-Requested-With, Tus-Resumable, Upload-Length, Upload-Offset, Upload-Metadata, Upload-Draft-Interop-Version, Upload-Complete, Upload-Incomplete, Upload-Concat, Upload-Defer-Length",
		AllowMethods:     "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"version": Version,
		})
	})

	// Setup routes (includes static file serving)
	routes.SetupRoutes(app, routeHandlers, sessionStore, userService, mailerService, csrfMiddleware)

	go func() {
		slog.Info("server listening", "port", cfg.AppPort)
		if err := app.Listen(":" + cfg.AppPort); err != nil {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	slog.Info("shutting down", "signal", sig)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := app.ShutdownWithContext(ctx); err != nil {
		slog.Error("shutdown failed", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped")
}

// initDatabase initializes the SQLite database with optimized settings
func initDatabase(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	// Configure connection pooling (optimized for SQLite single-instance)
	db.SetMaxOpenConns(15)                  // Maximum number of open connections
	db.SetMaxIdleConns(10)                  // Keep more idle connections ready (avoid churn)
	db.SetConnMaxLifetime(5 * time.Minute)  // Maximum lifetime for a connection
	db.SetConnMaxIdleTime(30 * time.Second) // Recycle stale idle connections

	// Enable foreign keys
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		return nil, err
	}

	// Optimize SQLite for production (WAL mode for better concurrency)
	if _, err := db.Exec("PRAGMA journal_mode = WAL"); err != nil {
		return nil, err
	}

	// Balance between durability and performance
	if _, err := db.Exec("PRAGMA synchronous = NORMAL"); err != nil {
		return nil, err
	}

	// Set cache size to 16MB (negative value = KB) - optimized for Vultr HF 1-2GB RAM
	if _, err := db.Exec("PRAGMA cache_size = -16000"); err != nil {
		return nil, err
	}

	// Enable memory-mapped I/O for NVMe performance (256MB)
	if _, err := db.Exec("PRAGMA mmap_size = 268435456"); err != nil {
		return nil, err
	}

	// Store temporary tables in memory for better performance
	if _, err := db.Exec("PRAGMA temp_store = MEMORY"); err != nil {
		return nil, err
	}

	// Set busy timeout to 5 seconds (wait for locks instead of failing immediately)
	if _, err := db.Exec("PRAGMA busy_timeout = 5000"); err != nil {
		return nil, err
	}

	// Set WAL autocheckpoint to 1000 pages (default, but explicit is better)
	if _, err := db.Exec("PRAGMA wal_autocheckpoint = 1000"); err != nil {
		return nil, err
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, err
	}

	// Log database optimization status
	logDatabaseOptimizations(db)

	return db, nil
}

// logDatabaseOptimizations logs the current SQLite optimization settings
func logDatabaseOptimizations(db *sql.DB) {
	var journalMode, synchronous string
	var cacheSize, busyTimeout, mmapSize, walAutocheckpoint int

	// Query current settings
	err := db.QueryRow("PRAGMA journal_mode").Scan(&journalMode)
	if err != nil {
		slog.Warn("could not verify journal_mode", "error", err)
	}

	err = db.QueryRow("PRAGMA synchronous").Scan(&synchronous)
	if err != nil {
		slog.Warn("could not verify synchronous", "error", err)
	}

	err = db.QueryRow("PRAGMA cache_size").Scan(&cacheSize)
	if err != nil {
		slog.Warn("could not verify cache_size", "error", err)
	}

	err = db.QueryRow("PRAGMA busy_timeout").Scan(&busyTimeout)
	if err != nil {
		slog.Warn("could not verify busy_timeout", "error", err)
	}

	err = db.QueryRow("PRAGMA mmap_size").Scan(&mmapSize)
	if err != nil {
		slog.Warn("could not verify mmap_size", "error", err)
	}

	err = db.QueryRow("PRAGMA wal_autocheckpoint").Scan(&walAutocheckpoint)
	if err != nil {
		slog.Warn("could not verify wal_autocheckpoint", "error", err)
	}

	slog.Info("sqlite optimizations",
		"journal_mode", journalMode,
		"synchronous", synchronous,
		"cache_size_kb", cacheSize,
		"mmap_size_kb", mmapSize,
		"wal_autocheckpoint", walAutocheckpoint,
		"busy_timeout_ms", busyTimeout,
	)
}

// startBackgroundCleanup runs periodic cleanup of expired sessions, password
// reset tokens, and in-memory session cache entries.
func startBackgroundCleanup(querier *queries.Querier, sessionCache *cache.SessionCache) {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		// Run cleanup immediately on startup
		if err := querier.DeleteExpiredSessions(context.Background()); err != nil {
			slog.Error("cleanup: failed to delete expired sessions", "error", err)
		} else {
			slog.Debug("cleanup: expired sessions deleted")
		}
		if err := querier.DeleteExpiredPasswordResets(context.Background()); err != nil {
			slog.Error("cleanup: failed to delete expired password resets", "error", err)
		} else {
			slog.Debug("cleanup: expired password resets deleted")
		}
		sessionCache.EvictExpired()
		if err := querier.DeleteExpiredEmailVerifications(context.Background()); err != nil {
			slog.Error("cleanup: failed to delete expired email verifications", "error", err)
		} else {
			slog.Debug("cleanup: expired email verifications deleted")
		}

	for range ticker.C {
		if err := querier.DeleteExpiredSessions(context.Background()); err != nil {
			slog.Error("cleanup: failed to delete expired sessions", "error", err)
		}
		if err := querier.DeleteExpiredPasswordResets(context.Background()); err != nil {
			slog.Error("cleanup: failed to delete expired password resets", "error", err)
		}
		sessionCache.EvictExpired()
		if err := querier.DeleteExpiredEmailVerifications(context.Background()); err != nil {
			slog.Error("cleanup: failed to delete expired email verifications", "error", err)
		}
	}
	}()
	slog.Info("background cleanup started (interval: 1h)")
}

func runMigrations(db *sql.DB, migrationsDir string) error {
	goose.SetBaseFS(nil)
	if err := goose.SetDialect("sqlite3"); err != nil {
		return err
	}

	if err := goose.Up(db, migrationsDir); err != nil {
		return err
	}

	return nil
}

// customErrorHandler handles Fiber errors.
// Internal errors are logged server-side; clients receive a generic message
// to prevent information leakage (file paths, SQL queries, stack traces).
func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	// Log full error server-side
	slog.Error("request error", "method", c.Method(), "path", c.Path(), "status", code, "error", err)

	// For Fiber errors (4xx), the message is safe to return.
	// For 5xx, return a generic message to avoid leaking internals.
	msg := "Internal Server Error"
	if code < 500 {
		msg = err.Error()
	}

	return c.Status(code).JSON(fiber.Map{
		"error": msg,
	})
}
