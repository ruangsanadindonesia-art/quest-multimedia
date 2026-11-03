package services

import (
	"encoding/json"
	"fmt"

	"github.com/gofiber/fiber/v2"
	fiberinertia "github.com/maulanashalihin/fiber-inertia"
	"github.com/maulanashalihin/laju-go/app/session"
)

// InertiaService wraps fiber-inertia with laju-go-specific features:
// Vite asset URLs, CSRF token injection, and flash message support.
//
// All handlers continue to use the same Render(c, component, props) API
// they used before — no handler changes needed.
type InertiaService struct {
	*fiberinertia.Inertia // embedded — provides Render, Redirect, Location, Back
}

// Location overrides fiber-inertia's Location to handle direct browser navigations.
// For Inertia XHR requests: returns 409 + X-Inertia-Location (triggers window.location).
// For direct browser navigations: returns a proper 302 redirect.
func (s *InertiaService) Location(c *fiber.Ctx, url string) error {
	// Check if this is an Inertia XHR request
	if c.Get("X-Inertia") != "true" {
		// Direct browser navigation — use standard redirect
		return c.Redirect(url, fiber.StatusFound)
	}
	// Inertia XHR — use the 409 + X-Inertia-Location pattern
	return s.Inertia.Location(c, url)
}

// NewInertiaService creates an InertiaService backed by fiber-inertia.
//
// The library handles the core Inertia protocol (JSON vs HTML auto-detect,
// asset versioning, shared props, partial reloads). This wrapper adds:
//   - Custom root HTML with Vite dev/prod asset URLs
//   - CSRF token injection into <meta> tag
//   - Flash messages as a shared prop (available on every render)
func NewInertiaService(assetService *AssetService, store *session.Store) *InertiaService {
	in := fiberinertia.New(fiberinertia.Config{
		Version: "1.0",
		Render: func(c *fiber.Ctx, page *fiberinertia.Page) error {
			return renderInertiaHTML(c, page, assetService, store)
		},
	})

	// Flash messages: available as a shared prop on every page render.
	// The flash cookie is consumed on read (one-time use).
	in.ShareFunc("flash", func(c *fiber.Ctx) interface{} {
		flash := make(fiber.Map)
		if err := store.GetFlash(c, "error"); err != "" {
			flash["error"] = err
		}
		if success := store.GetFlash(c, "success"); success != "" {
			flash["success"] = success
		}
		if len(flash) > 0 {
			return flash
		}
		return nil
	})

	return &InertiaService{Inertia: in}
}

// renderInertiaHTML renders the root HTML page for initial (non-Inertia) loads.
// It is passed as Config.Render to the fiber-inertia adapter.
func renderInertiaHTML(c *fiber.Ctx, page *fiberinertia.Page, assetService *AssetService, store *session.Store) error {
	pageJSON, err := json.Marshal(page)
	if err != nil {
		return fmt.Errorf("inertia: marshal page: %w", err)
	}

	title, _ := page.Props["Title"].(string)
	isDev := assetService.IsDevelopment()

	// Vite dev server URL (from .vite-port file)
	viteURL := ""
	if isDev {
		viteURL = assetService.GetViteServerURL()
	}

	// CSRF token from session (injected into <meta> tag for JS access)
	csrfToken := ""
	if sess, err := store.Get(c); err == nil {
		if token := sess.Get("csrf_token"); token != nil {
			csrfToken = token.(string)
		}
	}

	// Production asset URLs (from Vite manifest)
	mainJS := assetService.GetMainJS()
	mainCSS := assetService.GetMainCSS()

	var html string
	if isDev {
		html = fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s - Laju</title>
    <meta name="description" content="Laju Go Fiber - High Performance SaaS Boilerplate">
    <link rel="icon" href="/public/favicon.png">
    <meta name="csrf-token" content="%s">
</head>
<body class="bg-gray-50 text-gray-900">
    <div id="app"></div>
    <script data-page="app" type="application/json">%s</script>
    <script type="module" src="%s/@vite/client"></script>
    <link rel="stylesheet" href="%s/src/app.css">
    <script type="module" src="%s/%s"></script>
</body>
</html>`, title, csrfToken, pageJSON, viteURL, viteURL, viteURL, assetService.GetEntryPoint())
	} else {
		html = fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s - Laju</title>
    <meta name="description" content="Laju Go Fiber - High Performance SaaS Boilerplate">
    <link rel="icon" href="/public/favicon.png">
    <meta name="csrf-token" content="%s">
    <link rel="stylesheet" href="%s">
</head>
<body class="bg-gray-50 text-gray-900">
    <div id="app"></div>
    <script data-page="app" type="application/json">%s</script>
    <script type="module" src="%s"></script>
</body>
</html>`, title, csrfToken, mainCSS, pageJSON, mainJS)
	}

	c.Set(fiber.HeaderContentType, "text/html; charset=utf-8")
	return c.SendString(html)
}
