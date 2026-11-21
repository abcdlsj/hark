// Command desktop is the hark window: a Wails v3 shell around internal/core.
//
// The desktop process is the single writer for the workspace while it runs. It
// listens on a Unix socket and answers `hark` CLI commands, forwarding each
// mutation to the webview as an event.
package main

import (
	"log"

	"github.com/abcdlsj/hark/frontend"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func init() {
	// Registered events get typed bindings on the frontend.
	application.RegisterEvent[map[string]any]("api:saved")
	application.RegisterEvent[map[string]any]("api:deleted")
	application.RegisterEvent[map[string]any]("run:completed")
	application.RegisterEvent[map[string]any]("env:changed")
	application.RegisterEvent[map[string]any]("workspace:changed")
}

func main() {
	svc := &AppService{}
	app := application.New(application.Options{
		Name:        "Hark",
		Description: "Local-first API workbench",
		Services: []application.Service{
			application.NewService(svc),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(frontend.Dist),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})
	svc.app = app

	if err := svc.start(); err != nil {
		log.Fatal(err)
	}
	defer svc.stop()

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Hark",
		Width:            1280,
		Height:           800,
		MinWidth:         960,
		MinHeight:        640,
		BackgroundColour: application.NewRGB(0xFA, 0xFA, 0xFA),
		URL:              "/",
		Mac: application.MacWindow{
			TitleBar: application.MacTitleBar{
				AppearsTransparent:   true,
				HideTitle:            true,
				FullSizeContent:      true,
				UseToolbar:           true,
				HideToolbarSeparator: true,
				ToolbarStyle:         application.MacToolbarStyleUnifiedCompact,
			},
			InvisibleTitleBarHeight: 40,
			Backdrop:                application.MacBackdropNormal,
		},
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
