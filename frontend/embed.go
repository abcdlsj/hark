// Package frontend exposes the built web assets to the desktop binary.
//
// The embed directive must live next to the files it embeds, so this small
// package is the bridge between frontend/dist and cmd/desktop.
package frontend

import "embed"

// Dist holds the production Vite build.
//
//go:embed all:dist
var Dist embed.FS
