package history

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/abcdlsj/apic/internal/core/exec"
)

func open(t *testing.T) *DB {
	t.Helper()
	db, err := Open(filepath.Join(t.TempDir(), "history.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestAppendRecentGetPrune(t *testing.T) {
	db := open(t)

	first := &Log{
		TS: time.Now().Add(-time.Minute), Actor: "agent", Env: "staging",
		APIID: "orders/refund", Method: "POST", URL: "https://x.dev/refund",
		Status: 200, DurationMS: 118, Size: 12,
		Timings:         exec.Timings{DNS: 1, TCP: 2, TLS: 3, TTFB: 100, Download: 12},
		ResponsePreview: `{"ok":true}`,
	}
	id, err := db.Append(first)
	if err != nil {
		t.Fatal(err)
	}
	if id == 0 {
		t.Fatal("expected an id")
	}

	if _, err := db.Append(&Log{TS: time.Now(), Actor: "human", APIID: "orders/list", Method: "GET", Status: 500}); err != nil {
		t.Fatal(err)
	}

	recent, err := db.Recent(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 2 {
		t.Fatalf("rows = %d", len(recent))
	}
	if recent[0].Actor != "human" {
		t.Fatalf("newest first broken: %#v", recent)
	}

	got, err := db.Get(id)
	if err != nil {
		t.Fatal(err)
	}
	if got.APIID != "orders/refund" || got.Timings.TTFB != 100 {
		t.Fatalf("round trip lost data: %#v", got)
	}
	if got.TS.IsZero() {
		t.Fatal("timestamp not parsed")
	}

	statuses, err := db.LastStatuses()
	if err != nil {
		t.Fatal(err)
	}
	if statuses["orders/refund"] != 200 || statuses["orders/list"] != 500 {
		t.Fatalf("statuses = %#v", statuses)
	}

	if err := db.Prune(1); err != nil {
		t.Fatal(err)
	}
	recent, _ = db.Recent(10)
	if len(recent) != 1 {
		t.Fatalf("prune kept %d rows", len(recent))
	}
}

func TestPreviewIsCapped(t *testing.T) {
	db := open(t)
	big := strings.Repeat("a", PreviewLimit+100)
	if _, err := db.Append(&Log{ResponsePreview: big, APIID: "x"}); err != nil {
		t.Fatal(err)
	}
	recent, err := db.Recent(1)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent[0].ResponsePreview) != PreviewLimit {
		t.Fatalf("preview length = %d", len(recent[0].ResponsePreview))
	}
}

func TestGetMissing(t *testing.T) {
	db := open(t)
	if _, err := db.Get(42); err == nil {
		t.Fatal("expected an error")
	}
}
