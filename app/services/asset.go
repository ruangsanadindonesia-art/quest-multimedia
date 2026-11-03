package services

import (
	"encoding/json"
	"os"
	"strings"
	"sync"

	"github.com/gofiber/fiber/v2"
)

// ViteManifest represents the Vite manifest structure
type ViteManifest struct {
	Entries map[string]ManifestEntry `json:"-"`
}

// ManifestEntry represents a single entry in the manifest
type ManifestEntry struct {
	File           string   `json:"file"`
	Name           string   `json:"name"`
	Src            string   `json:"src"`
	IsEntry        bool     `json:"isEntry"`
	IsDynamicEntry bool     `json:"isDynamicEntry"`
	DynamicImports []string `json:"dynamicImports"`
	Imports        []string `json:"imports"`
	CSS            []string `json:"css,omitempty"`
	Assets         []string `json:"assets,omitempty"`
}

// AssetService handles frontend asset management
type AssetService struct {
	manifest      *ViteManifest
	manifestPath  string
	vitePortPath  string
	viteServerURL string
	entryPoint    string // Vite entry point (e.g. "src/main.ts" or "src/main.tsx")
	isDevEnv      bool
	mu            sync.RWMutex
}

// NewAssetService creates a new AssetService
func NewAssetService(manifestPath string, vitePortPath string, isDevEnv bool) *AssetService {
	service := &AssetService{
		manifestPath:  manifestPath,
		vitePortPath:  vitePortPath,
		viteServerURL: getViteServerURL(vitePortPath),
		entryPoint:    getEntryPoint(),
		isDevEnv:      isDevEnv,
	}
	service.loadManifest()
	return service
}

// getViteServerURL reads Vite dev server URL from .vite-port file
func getViteServerURL(vitePortPath string) string {
	data, err := os.ReadFile(vitePortPath)
	if err != nil {
		return "" // File not found (production or Vite not running)
	}
	return strings.TrimSpace(string(data))
}

// getEntryPoint returns the Vite entry point from VITE_ENTRY env var.
// Defaults to "src/main.ts" (Svelte/Vue). React templates set VITE_ENTRY=src/main.tsx.
func getEntryPoint() string {
	if entry := os.Getenv("VITE_ENTRY"); entry != "" {
		return entry
	}
	return "src/main.ts"
}

// loadManifest loads the Vite manifest file
func (s *AssetService) loadManifest() {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.manifestPath)
	if err != nil {
		return // Manifest not found (development mode)
	}

	var raw map[string]ManifestEntry
	if err := json.Unmarshal(data, &raw); err != nil {
		return
	}

	s.manifest = &ViteManifest{Entries: raw}
}

// GetJS returns the hashed JS filename for a given entry
func (s *AssetService) GetJS(entry string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.manifest == nil {
		return "/assets/main.js" // Fallback
	}

	if e, ok := s.manifest.Entries[entry]; ok {
		return "/" + e.File
	}

	return "/assets/main.js" // Fallback
}

// GetCSS returns the hashed CSS filename for a given entry
func (s *AssetService) GetCSS(entry string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.manifest == nil {
		return "/assets/app.css" // Fallback
	}

	// Try to get CSS from the entry itself
	if e, ok := s.manifest.Entries[entry]; ok {
		if len(e.CSS) > 0 {
			return "/" + e.CSS[0]
		}
	}
	
	// Try to get CSS from app.css entry
	if e, ok := s.manifest.Entries["src/app.css"]; ok {
		return "/" + e.File
	}

	return "/assets/app.css" // Fallback
}

// GetEntry returns the full manifest entry
func (s *AssetService) GetEntry(entry string) *ManifestEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.manifest == nil {
		return nil
	}

	if e, ok := s.manifest.Entries[entry]; ok {
		return &e
	}

	return nil
}

// ReloadManifest reloads the manifest (useful after build)
func (s *AssetService) ReloadManifest() {
	s.loadManifest()
}

// GetViteServerURL returns the Vite dev server URL
func (s *AssetService) GetViteServerURL() string {
	return s.viteServerURL
}

// IsDevelopment returns true if Vite dev server is running AND env is development
func (s *AssetService) IsDevelopment() bool {
	return s.isDevEnv && s.viteServerURL != ""
}

// GetMainJS returns the main JS asset path
func (s *AssetService) GetMainJS() string {
	return s.GetJS(s.entryPoint)
}

// GetMainCSS returns the main CSS asset path
func (s *AssetService) GetMainCSS() string {
	return s.GetCSS(s.entryPoint)
}

// GetEntryPoint returns the Vite entry point (e.g. "src/main.ts" or "src/main.tsx")
func (s *AssetService) GetEntryPoint() string {
	return s.entryPoint
}

// GetAssetData returns a fiber.Map with Vite/asset data for templates
// Use this to inject asset data into any template render
func (s *AssetService) GetAssetData() fiber.Map {
	if s.viteServerURL != "" {
		return fiber.Map{
			"ViteServerURL": s.viteServerURL,
		}
	}
	return fiber.Map{
		"MainJS":  s.GetMainJS(),
		"MainCSS": s.GetMainCSS(),
	}
}
