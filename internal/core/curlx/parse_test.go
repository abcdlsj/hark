package curlx

import (
	"strings"
	"testing"

	"github.com/abcdlsj/hark/internal/core/model"
)

func TestParseBodyImpliesPost(t *testing.T) {
	cases := []string{
		`curl -d 'a=1' https://x.dev`,
		`curl --data-raw '{"a":1}' https://x.dev`,
		`curl --json '{"a":1}' https://x.dev`,
		`curl -F 'f=@/tmp/x' https://x.dev`,
	}
	for _, c := range cases {
		p, err := Parse(c)
		if err != nil {
			t.Fatalf("%s: %v", c, err)
		}
		if p.Method != "POST" {
			t.Fatalf("%s: method = %s, want POST", c, p.Method)
		}
	}
}

func TestParseMethodOverrides(t *testing.T) {
	cases := map[string]string{
		`curl -X PUT -d 'a=1' https://x.dev`: "PUT",
		`curl -G -d 'a=1' https://x.dev`:     "GET",
		`curl -I https://x.dev`:              "HEAD",
		`curl -XDELETE https://x.dev`:        "DELETE",
		`curl https://x.dev`:                 "GET",
		`curl -X patch -d 'x' https://x.dev`: "PATCH",
	}
	for cmd, want := range cases {
		p, err := Parse(cmd)
		if err != nil {
			t.Fatalf("%s: %v", cmd, err)
		}
		if p.Method != want {
			t.Fatalf("%s: method = %s, want %s", cmd, p.Method, want)
		}
	}
}

func TestParseFullCommand(t *testing.T) {
	cmd := `curl -X POST 'https://api.example.com/v1/orders/refund?dry=1' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-live-123' \
  -H 'X-Trace: abc' \
  --data-raw '{"order_id":"ord_9981"}' \
  --compressed -k`
	p, err := Parse(cmd)
	if err != nil {
		t.Fatal(err)
	}
	if p.URL != "https://api.example.com/v1/orders/refund" {
		t.Fatalf("url = %q", p.URL)
	}
	if len(p.Query) != 1 || p.Query[0].Key != "dry" || p.Query[0].Value != "1" {
		t.Fatalf("query = %#v", p.Query)
	}
	if len(p.Headers) != 3 {
		t.Fatalf("headers = %#v", p.Headers)
	}
	if p.Body.Type != model.BodyJSON || !strings.Contains(p.Body.Content, "ord_9981") {
		t.Fatalf("body = %#v", p.Body)
	}
	if p.Auth.Type != model.AuthBearer || p.Auth.Token != "sk-live-123" {
		t.Fatalf("auth = %#v", p.Auth)
	}
	if !p.Insecure {
		t.Fatal("expected -k to set insecure")
	}
}

func TestParseBasicAuthAndForm(t *testing.T) {
	p, err := Parse(`curl -u user:pass -F 'name=bob' -F 'avatar=@/tmp/a.png' https://x.dev/upload`)
	if err != nil {
		t.Fatal(err)
	}
	if p.Auth.Type != model.AuthBasic || p.Auth.Username != "user" || p.Auth.Password != "pass" {
		t.Fatalf("auth = %#v", p.Auth)
	}
	if p.Body.Type != model.BodyForm {
		t.Fatalf("body type = %s", p.Body.Type)
	}
	fields := ParseContentForm(p.Body.Content)
	if len(fields) != 2 || fields[1].Value != "@/tmp/a.png" {
		t.Fatalf("form = %#v", fields)
	}
}

func TestParseKeepsTemplatePlaceholders(t *testing.T) {
	p, err := Parse(`curl '{{base_url}}/v1/orders?page={{page}}' -H 'X-Key: {{api_key}}'`)
	if err != nil {
		t.Fatal(err)
	}
	if p.URL != "{{base_url}}/v1/orders" {
		t.Fatalf("url = %q", p.URL)
	}
	if strings.Contains(p.URL, "%7B") {
		t.Fatal("placeholders were percent-escaped")
	}
	if p.Query[0].Value != "{{page}}" {
		t.Fatalf("query = %#v", p.Query)
	}
	if p.Headers[0].Value != "{{api_key}}" {
		t.Fatalf("headers = %#v", p.Headers)
	}
}

func TestParseHeaderWithoutValue(t *testing.T) {
	p, err := Parse(`curl -H 'X-Empty;' https://x.dev`)
	if err != nil {
		t.Fatal(err)
	}
	if len(p.Headers) != 1 || p.Headers[0].Key != "X-Empty" || p.Headers[0].Value != "" {
		t.Fatalf("headers = %#v", p.Headers)
	}
}

func TestParseURLFlagAndPositional(t *testing.T) {
	p, err := Parse(`curl --url https://x.dev/a https://x.dev/b`)
	if err != nil {
		t.Fatal(err)
	}
	if p.URL != "https://x.dev/a" {
		t.Fatalf("url = %q", p.URL)
	}
	if len(p.Warnings) == 0 {
		t.Fatal("expected a warning about the extra argument")
	}
}

func TestParseNoURL(t *testing.T) {
	if _, err := Parse(`curl -X POST`); err == nil {
		t.Fatal("expected an error")
	}
}

func TestParseUnknownFlagDoesNotEatURL(t *testing.T) {
	p, err := Parse(`curl --some-new-flag https://x.dev/a`)
	if err != nil {
		t.Fatal(err)
	}
	if p.URL != "https://x.dev/a" {
		t.Fatalf("url = %q", p.URL)
	}
}

func TestExportRoundTrip(t *testing.T) {
	original := `curl -X POST 'https://api.example.com/v1/orders/refund?dry=1' \
  -H 'Content-Type: application/json' \
  --data-raw '{"order_id":"ord_9981"}'`
	first, err := Parse(original)
	if err != nil {
		t.Fatal(err)
	}
	exported := Export(&first.Request, ExportOptions{})
	second, err := Parse(exported)
	if err != nil {
		t.Fatalf("re-parse failed: %v\n%s", err, exported)
	}
	if second.URL != first.URL || second.Method != first.Method || second.Body.Content != first.Body.Content {
		t.Fatalf("round trip lost data:\n%s", exported)
	}
}

func TestExportEscapesSingleQuotes(t *testing.T) {
	r := &Request{
		Method: "POST",
		URL:    "https://x.dev",
		Body:   model.Body{Type: model.BodyJSON, Content: `{"name":"O'Brien"}`},
	}
	out := Export(r, ExportOptions{})
	if !strings.Contains(out, `O'\''Brien`) {
		t.Fatalf("single quote not escaped:\n%s", out)
	}
	back, err := Parse(out)
	if err != nil {
		t.Fatalf("re-parse: %v", err)
	}
	if back.Body.Content != r.Body.Content {
		t.Fatalf("body changed: %q", back.Body.Content)
	}
}

func TestExportResolvesPlaceholders(t *testing.T) {
	r := &Request{Method: "GET", URL: "{{base_url}}/v1/x", Headers: []model.KV{
		{Key: "Authorization", Value: "Bearer {{api_key}}"},
	}}
	out := Export(r, ExportOptions{Resolve: func(k string) (string, bool) {
		switch k {
		case "base_url":
			return "https://staging.dev", true
		case "api_key":
			return "sk-1", true
		}
		return "", false
	}})
	if !strings.Contains(out, "https://staging.dev/v1/x") || !strings.Contains(out, "Bearer sk-1") {
		t.Fatalf("unresolved:\n%s", out)
	}
}

func TestReplaceHardcodedValues(t *testing.T) {
	table := map[string]model.EnvVar{
		"base_url": {Value: "https://api.example.com"},
		"cdn":      {Value: "https://api.example.com/cdn"},
	}
	res := ReplaceHardcodedValues("https://api.example.com/cdn/x", table)
	if res.Value != "{{cdn}}/x" {
		t.Fatalf("value = %q", res.Value)
	}
}

func TestDetectPlaintextToken(t *testing.T) {
	headers := []model.KV{
		{Key: "Authorization", Value: "Bearer sk-live-999"},
	}
	token, idx := DetectPlaintextToken(headers)
	if token != "sk-live-999" || idx != 0 {
		t.Fatalf("token = %q idx = %d", token, idx)
	}
	if token, _ := DetectPlaintextToken([]model.KV{{Key: "Authorization", Value: "Bearer {{api_key}}"}}); token != "" {
		t.Fatalf("placeholder should not be reported as plaintext: %q", token)
	}
}
