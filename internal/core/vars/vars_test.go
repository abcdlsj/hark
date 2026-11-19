package vars

import (
	"errors"
	"reflect"
	"testing"

	"github.com/abcdlsj/hark/internal/core/model"
)

type fakeSecrets map[string]string

func (f fakeSecrets) Get(scope, key string) (string, error) {
	v, ok := f[scope+"/"+key]
	if !ok {
		return "", errors.New("not found")
	}
	return v, nil
}

func testEnvs() *model.Envs {
	return &model.Envs{
		Current: "staging",
		Global: map[string]model.EnvVar{
			"base_url": {Value: "https://api.dev"},
			"api_key":  {Secret: true},
		},
		Environments: map[string]map[string]model.EnvVar{
			"staging": {"base_url": {Value: "https://staging.dev"}},
			"prod":    {"base_url": {Value: "https://api.prod"}},
		},
	}
}

func TestPrecedence(t *testing.T) {
	r := New(testEnvs(), "staging", map[string]string{"base_url": "http://cli.local"}, fakeSecrets{"global/api_key": "sk-1"})
	got, missing := r.Render("{{base_url}}/v1/{{api_key}}")
	if len(missing) != 0 {
		t.Fatalf("missing = %v", missing)
	}
	if got != "http://cli.local/v1/sk-1" {
		t.Fatalf("got %q", got)
	}
	if len(r.UsedSecrets()) != 1 {
		t.Fatalf("secret was not recorded for redaction: %v", r.UsedSecrets())
	}
}

func TestEnvOverridesGlobal(t *testing.T) {
	r := New(testEnvs(), "prod", nil, nil)
	got, _ := r.Render("{{base_url}}")
	if got != "https://api.prod" {
		t.Fatalf("got %q", got)
	}
}

func TestMissingKeepsPlaceholder(t *testing.T) {
	r := New(testEnvs(), "staging", nil, fakeSecrets{})
	got, missing := r.Render("{{base_url}}{{nope}}")
	if got != "https://staging.dev{{nope}}" {
		t.Fatalf("got %q", got)
	}
	if !reflect.DeepEqual(missing, []string{"nope"}) {
		t.Fatalf("missing = %v", missing)
	}
}

func TestSecretWithoutStoreIsMissing(t *testing.T) {
	r := New(testEnvs(), "staging", nil, nil)
	if v, ok := r.Lookup("api_key"); ok {
		t.Fatalf("expected the secret to be unresolved, got %q", v)
	}
}

func TestRefs(t *testing.T) {
	got := Refs("{{a}}/x/{{ b }}/{{a}}")
	if !reflect.DeepEqual(got, []string{"a", "b"}) {
		t.Fatalf("refs = %v", got)
	}
}

func TestMasked(t *testing.T) {
	r := New(testEnvs(), "staging", nil, nil)
	if r.Masked("api_key") != "[KEYCHAIN_SECRET]" {
		t.Fatal("secret should be masked")
	}
	if r.Masked("base_url") != "https://staging.dev" {
		t.Fatal("plain value should be visible")
	}
}
