package store

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/abcdlsj/hark/internal/core/model"
)

func TestOpenCreatesSkeleton(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, EnvsFile)); err != nil {
		t.Fatalf("envs.yaml missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, CollectionsDir)); err != nil {
		t.Fatalf("collections missing: %v", err)
	}
	envs, err := s.Envs()
	if err != nil {
		t.Fatal(err)
	}
	if envs.Current == "" {
		t.Fatal("expected a default environment")
	}
}

func TestSaveLoadListDelete(t *testing.T) {
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	api := &model.API{
		ID:      "orders/refund",
		Name:    "Refund",
		Method:  "post",
		URL:     "{{base_url}}/v1/orders/refund",
		Headers: []model.KV{{Key: "Content-Type", Value: "application/json"}},
		Body:    model.Body{Type: model.BodyJSON, Content: `{"order_id":"{{order_id}}"}`},
	}
	if err := s.Save(api, "agent"); err != nil {
		t.Fatal(err)
	}

	loaded, err := s.Load("orders/refund")
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Method != "POST" {
		t.Fatalf("method = %q", loaded.Method)
	}
	if loaded.Meta.UpdatedBy != "agent" || loaded.Meta.UpdatedAt == "" {
		t.Fatalf("meta = %#v", loaded.Meta)
	}
	if loaded.Body.Content != api.Body.Content {
		t.Fatalf("body = %q", loaded.Body.Content)
	}

	items, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ID != "orders/refund" {
		t.Fatalf("items = %#v", items)
	}

	if err := s.Delete("orders/refund"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Load("orders/refund"); err == nil {
		t.Fatal("expected the API to be gone")
	}
	if _, err := os.Stat(filepath.Join(s.Root(), CollectionsDir, "orders")); !os.IsNotExist(err) {
		t.Fatalf("empty module directory was not pruned: %v", err)
	}
}

func TestEnvsCacheInvalidates(t *testing.T) {
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	envs, _ := s.Envs()
	envs.Global["token"] = model.EnvVar{Value: "abc"}
	if err := s.SaveEnvs(envs); err != nil {
		t.Fatal(err)
	}
	again, err := s.Envs()
	if err != nil {
		t.Fatal(err)
	}
	if again.Global["token"].Value != "abc" {
		t.Fatalf("cache served stale data: %#v", again.Global)
	}

	// External writes must be noticed too.
	raw, err := os.ReadFile(s.EnvsPath())
	if err != nil {
		t.Fatal(err)
	}
	edited := string(raw) + "\n# touched\n"
	if err := os.WriteFile(s.EnvsPath(), []byte(edited), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Envs(); err != nil {
		t.Fatalf("reload after external edit: %v", err)
	}
}

func TestEnvsSecretNeverWritten(t *testing.T) {
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	envs, _ := s.Envs()
	envs.Global["api_key"] = model.EnvVar{Secret: true}
	if err := s.SaveEnvs(envs); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(s.EnvsPath())
	if err != nil {
		t.Fatal(err)
	}
	if want := "secret: true"; !contains(string(raw), want) {
		t.Fatalf("secret marker missing:\n%s", raw)
	}
}

func TestInvalidIDsRejected(t *testing.T) {
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"", "/abs", "a/", "a//b", "../x", "a b", "a/../b"} {
		if err := s.Save(&model.API{ID: id}, "agent"); err == nil {
			t.Fatalf("expected %q to be rejected", id)
		}
	}
}

func contains(haystack, needle string) bool {
	return len(haystack) >= len(needle) && (func() bool {
		for i := 0; i+len(needle) <= len(haystack); i++ {
			if haystack[i:i+len(needle)] == needle {
				return true
			}
		}
		return false
	})()
}
