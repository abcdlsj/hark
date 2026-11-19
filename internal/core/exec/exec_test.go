package exec

import (
	"context"
	"crypto/tls"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/abcdlsj/hark/internal/core/curlx"
	"github.com/abcdlsj/hark/internal/core/model"
	"github.com/abcdlsj/hark/internal/core/vars"
)

type fakeSecrets map[string]string

func (f fakeSecrets) Get(scope, key string) (string, error) {
	v, ok := f[scope+"/"+key]
	if !ok {
		return "", io.EOF
	}
	return v, nil
}

func resolver(t *testing.T, envs *model.Envs, overrides map[string]string, secrets vars.SecretStore) *vars.Resolver {
	t.Helper()
	return vars.New(envs, "test", overrides, secrets)
}

func TestDoSendsRequestAndTimes(t *testing.T) {
	var gotHeader, gotBody, gotQuery string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		gotHeader = r.Header.Get("X-Token")
		gotQuery = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(201)
		io.WriteString(w, `{"ok":true}`)
	}))
	defer srv.Close()

	envs := &model.Envs{
		Current: "test",
		Global: map[string]model.EnvVar{
			"base_url": {Value: srv.URL},
			"token":    {Secret: true},
		},
	}
	req := &curlx.Request{
		Method:  "POST",
		URL:     "{{base_url}}/orders",
		Query:   []model.KV{{Key: "dry", Value: "1"}},
		Headers: []model.KV{{Key: "X-Token", Value: "{{token}}"}},
		Body:    model.Body{Type: model.BodyJSON, Content: `{"a":1}`},
	}
	res, err := Do(context.Background(), Options{
		Request:  req,
		Resolver: resolver(t, envs, nil, fakeSecrets{"global/token": "sk-secret"}),
		Actor:    "agent",
		APIID:    "orders/create",
		Timeout:  5 * time.Second,
	})
	if err != nil {
		t.Fatal(err)
	}
	if gotHeader != "sk-secret" {
		t.Fatalf("server saw token %q", gotHeader)
	}
	if gotBody != `{"a":1}` {
		t.Fatalf("body = %q", gotBody)
	}
	if gotQuery != "dry=1" {
		t.Fatalf("query = %q", gotQuery)
	}
	if res.Status != 201 || res.StatusText != "Created" {
		t.Fatalf("status = %d %q", res.Status, res.StatusText)
	}
	if !strings.Contains(res.BodyText, `"ok":true`) {
		t.Fatalf("body = %q", res.BodyText)
	}
	if res.DurationMS <= 0 || res.Timings.TTFB < 0 {
		t.Fatalf("timings = %#v", res.Timings)
	}
	if res.Method != "POST" || res.APIID != "orders/create" || res.Actor != "agent" {
		t.Fatalf("result = %#v", res)
	}
}

func TestSecretIsRedactedEverywhere(t *testing.T) {
	const secret = "sk-live-very-secret"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Echo", secret)
		io.WriteString(w, `{"error":"bad token `+secret+`"}`)
	}))
	defer srv.Close()

	envs := &model.Envs{
		Current: "test",
		Global:  map[string]model.EnvVar{"api_key": {Secret: true}},
	}
	req := &curlx.Request{
		Method:  "GET",
		URL:     srv.URL,
		Headers: []model.KV{{Key: "Authorization", Value: "Bearer {{api_key}}"}},
	}
	res, err := Do(context.Background(), Options{
		Request:  req,
		Resolver: resolver(t, envs, nil, fakeSecrets{"global/api_key": secret}),
		Timeout:  5 * time.Second,
	})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(res.BodyText, secret) {
		t.Fatalf("body leaked the secret: %s", res.BodyText)
	}
	for k, v := range res.ResponseHeader {
		for _, s := range v {
			if strings.Contains(s, secret) {
				t.Fatalf("header %s leaked the secret", k)
			}
		}
	}
	for k, v := range res.RequestHeaders {
		for _, s := range v {
			if strings.Contains(s, secret) {
				t.Fatalf("request header %s leaked the secret", k)
			}
		}
	}
	if !strings.Contains(res.BodyText, "[REDACTED:api_key]") {
		t.Fatalf("expected a redaction marker: %s", res.BodyText)
	}
}

func TestMissingVariableFails(t *testing.T) {
	req := &curlx.Request{Method: "GET", URL: "{{base_url}}/x"}
	_, err := Do(context.Background(), Options{
		Request:  req,
		Resolver: resolver(t, &model.Envs{Current: "test"}, nil, nil),
	})
	if err == nil || !strings.Contains(err.Error(), "base_url") {
		t.Fatalf("err = %v", err)
	}
}

func TestTransportErrorIsReturned(t *testing.T) {
	req := &curlx.Request{Method: "GET", URL: "http://127.0.0.1:1/nothing"}
	_, err := Do(context.Background(), Options{
		Request:  req,
		Resolver: resolver(t, &model.Envs{Current: "test"}, nil, nil),
		Timeout:  2 * time.Second,
	})
	if err == nil {
		t.Fatal("expected a transport error")
	}
}

func TestFormBody(t *testing.T) {
	var contentType, body string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		contentType = r.Header.Get("Content-Type")
		body = string(b)
	}))
	defer srv.Close()

	req := &curlx.Request{
		Method: "POST",
		URL:    srv.URL,
		Body:   model.Body{Type: model.BodyForm, Content: "name=bob\nrole=admin"},
	}
	if _, err := Do(context.Background(), Options{
		Request:  req,
		Resolver: resolver(t, &model.Envs{Current: "test"}, nil, nil),
		Timeout:  5 * time.Second,
	}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(contentType, "multipart/form-data") {
		t.Fatalf("content type = %q", contentType)
	}
	if !strings.Contains(body, `name="name"`) || !strings.Contains(body, "bob") {
		t.Fatalf("multipart body = %q", body)
	}
}

func TestInsecureTLS(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, "ok")
	}))
	defer srv.Close()

	r := resolver(t, &model.Envs{Current: "test"}, nil, nil)
	if _, err := Do(context.Background(), Options{
		Request: &curlx.Request{Method: "GET", URL: srv.URL}, Resolver: r, Timeout: 5 * time.Second,
	}); err == nil {
		t.Fatal("expected a certificate error without -k")
	}
	res, err := Do(context.Background(), Options{
		Request: &curlx.Request{Method: "GET", URL: srv.URL, Insecure: true}, Resolver: r, Timeout: 5 * time.Second,
	})
	if err != nil {
		t.Fatalf("insecure request failed: %v", err)
	}
	if res.BodyText != "ok" {
		t.Fatalf("body = %q", res.BodyText)
	}
	_ = tls.VersionTLS12
}

func TestQueryEscapingKeepsTemplatesResolved(t *testing.T) {
	var rawQuery string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawQuery = r.URL.RawQuery
	}))
	defer srv.Close()
	req := &curlx.Request{
		Method: "GET",
		URL:    srv.URL,
		Query:  []model.KV{{Key: "q", Value: "hello world"}, {Key: "page", Value: "2"}},
	}
	if _, err := Do(context.Background(), Options{
		Request:  req,
		Resolver: resolver(t, &model.Envs{Current: "test"}, nil, nil),
		Timeout:  5 * time.Second,
	}); err != nil {
		t.Fatal(err)
	}
	if rawQuery != "q=hello+world&page=2" {
		t.Fatalf("raw query = %q", rawQuery)
	}
}
