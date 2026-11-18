package ops

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/abcdlsj/apic/internal/core/model"
)

func newOps(t *testing.T) *Ops {
	t.Helper()
	o, err := New(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { o.Close() })
	return o
}

func TestGuideListsEnvironmentsAndKeysWithoutValues(t *testing.T) {
	o := newOps(t)
	if err := o.SetVar("global", "api_key", "sk-should-not-appear", false); err != nil {
		t.Fatal(err)
	}
	if err := o.EnsureEnv("prod"); err != nil {
		t.Fatal(err)
	}
	guide, err := o.Guide()
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"apic run", "apic save", "base_url", "api_key"} {
		if !strings.Contains(guide, want) {
			t.Fatalf("guide missing %q:\n%s", want, guide)
		}
	}
	if strings.Contains(guide, "sk-should-not-appear") {
		t.Fatal("guide leaked a variable value")
	}
}

func TestSaveFromCurlWithAutoVar(t *testing.T) {
	o := newOps(t)
	envs, _ := o.Store.Envs()
	envs.Global["base_url"] = model.EnvVar{Value: "https://staging.example.com"}
	if err := o.Store.SaveEnvs(envs); err != nil {
		t.Fatal(err)
	}

	res, err := o.Save(SaveParams{
		ID:   "orders/refund",
		Name: "Refund an order",
		Curl: `curl -X POST 'https://staging.example.com/v1/orders/refund' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-live-123' \
  --data-raw '{"order_id":"ord_9981"}'`,
		AutoVar: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.API.URL != "{{base_url}}/v1/orders/refund" {
		t.Fatalf("url = %q", res.API.URL)
	}
	if res.NewToken != "sk-live-123" {
		t.Fatalf("token = %q", res.NewToken)
	}
	if res.API.Meta.UpdatedBy != ActorAgent {
		t.Fatalf("meta = %#v", res.API.Meta)
	}

	items, err := o.List("")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Name != "Refund an order" {
		t.Fatalf("items = %#v", items)
	}

	curl, err := o.ExportCurl(res.API, "", false)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(curl, "{{base_url}}/v1/orders/refund") {
		t.Fatalf("export lost placeholders:\n%s", curl)
	}
}

func TestSaveStructuredAPIKeepsAuth(t *testing.T) {
	o := newOps(t)
	api := &model.API{
		ID: "auth/login", Name: "Login", Method: "POST",
		URL:  "{{base_url}}/login",
		Auth: model.Auth{Type: model.AuthBearer, Token: "{{api_key}}"},
		Body: model.Body{Type: model.BodyJSON, Content: `{"u":"a"}`},
	}
	if _, err := o.Save(SaveParams{API: api, AutoVar: true}); err != nil {
		t.Fatal(err)
	}
	loaded, err := o.Store.Load("auth/login")
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Auth.Type != model.AuthBearer || loaded.Auth.Token != "{{api_key}}" {
		t.Fatalf("auth = %#v", loaded.Auth)
	}
}

func TestRunSavedAPIRecordsHistory(t *testing.T) {
	o := newOps(t)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		io.WriteString(w, `{"ok":true}`)
	}))
	defer srv.Close()

	envs, _ := o.Store.Envs()
	envs.Global["base_url"] = model.EnvVar{Value: srv.URL}
	if err := o.Store.SaveEnvs(envs); err != nil {
		t.Fatal(err)
	}
	if _, err := o.Save(SaveParams{ID: "ping", Curl: `curl '` + srv.URL + `/ping'`}); err != nil {
		t.Fatal(err)
	}

	out, err := o.Run(context.Background(), RunParams{ID: "ping"})
	if err != nil {
		t.Fatal(err)
	}
	if out.Result.Status != 200 || out.LogID == 0 {
		t.Fatalf("out = %#v", out)
	}
	if !strings.Contains(out.Result.BodyText, `"ok":true`) {
		t.Fatalf("body = %q", out.Result.BodyText)
	}

	recent, err := o.History(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 1 || recent[0].APIID != "ping" || recent[0].Actor != ActorAgent {
		t.Fatalf("history = %#v", recent)
	}
	items, _ := o.List("")
	if items[0].LastStatus != 200 {
		t.Fatalf("list status = %#v", items)
	}
}

func TestRunAdhocCurl(t *testing.T) {
	o := newOps(t)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, "pong")
	}))
	defer srv.Close()

	out, err := o.Run(context.Background(), RunParams{Curl: `curl '` + srv.URL + `'`})
	if err != nil {
		t.Fatal(err)
	}
	if out.Result.APIID != AdhocID {
		t.Fatalf("api id = %q", out.Result.APIID)
	}
}

func TestVarsAndEnvSwitch(t *testing.T) {
	o := newOps(t)
	if err := o.EnsureEnv("prod"); err != nil {
		t.Fatal(err)
	}
	if err := o.SetVar("global", "region", "eu", false); err != nil {
		t.Fatal(err)
	}
	if err := o.SetVar("prod", "base_url", "https://api.prod", false); err != nil {
		t.Fatal(err)
	}
	items, err := o.Vars("prod")
	if err != nil {
		t.Fatal(err)
	}
	found := map[string]VarItem{}
	for _, it := range items {
		found[it.Key] = it
	}
	if found["base_url"].Value != "https://api.prod" || found["base_url"].Scope != "prod" {
		t.Fatalf("base_url = %#v", found["base_url"])
	}
	if found["region"].Scope != "global" {
		t.Fatalf("region = %#v", found["region"])
	}

	if err := o.SetEnv("prod"); err != nil {
		t.Fatal(err)
	}
	current, names, err := o.EnvNames()
	if err != nil {
		t.Fatal(err)
	}
	if current != "prod" || len(names) != 2 {
		t.Fatalf("current = %q names = %v", current, names)
	}
	if err := o.SetEnv("nope"); err == nil {
		t.Fatal("expected an error for an unknown environment")
	}

	r, err := o.Resolver("", nil)
	if err != nil {
		t.Fatal(err)
	}
	if v, _ := r.Render("{{base_url}}"); v != "https://api.prod" {
		t.Fatalf("resolved = %q", v)
	}
}

func TestEventsEmitted(t *testing.T) {
	var seen []string
	o, err := New(t.TempDir(), nil, func(name string, _ any) { seen = append(seen, name) })
	if err != nil {
		t.Fatal(err)
	}
	defer o.Close()
	if _, err := o.Save(SaveParams{ID: "x", Curl: `curl https://x.dev`}); err != nil {
		t.Fatal(err)
	}
	if err := o.Delete("x"); err != nil {
		t.Fatal(err)
	}
	if len(seen) != 2 || seen[0] != EventAPISaved || seen[1] != EventAPIDeleted {
		t.Fatalf("events = %v", seen)
	}
}
