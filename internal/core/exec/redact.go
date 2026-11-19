package exec

import (
	"encoding/base64"
	"net/http"
	"sort"
	"strings"

	"github.com/abcdlsj/hark/internal/core/vars"
)

func basicAuth(user, pass string) string {
	return base64.StdEncoding.EncodeToString([]byte(user + ":" + pass))
}

// redactionMarker is what a leaked secret becomes.
const redactionMarker = "[REDACTED:"

func redactString(s string, r *vars.Resolver) string {
	return string(redactBytes([]byte(s), r))
}

func redactBytes(b []byte, r *vars.Resolver) []byte {
	if r == nil {
		return b
	}
	secrets := r.UsedSecrets()
	if len(secrets) == 0 {
		return b
	}
	// Longest first so an overlapping shorter secret cannot break a longer one.
	values := make([]string, 0, len(secrets))
	for v := range secrets {
		if v != "" {
			values = append(values, v)
		}
	}
	sort.Slice(values, func(i, j int) bool { return len(values[i]) > len(values[j]) })
	out := b
	for _, v := range values {
		out = []byte(strings.ReplaceAll(string(out), v, redactionMarker+secrets[v]+"]"))
	}
	return out
}

func redactHeaders(h http.Header, r *vars.Resolver) map[string][]string {
	out := make(map[string][]string, len(h))
	for k, values := range h {
		clean := make([]string, len(values))
		for i, v := range values {
			clean[i] = redactString(v, r)
		}
		out[k] = clean
	}
	return out
}
