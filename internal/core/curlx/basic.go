package curlx

import (
	"encoding/base64"
	"strings"

	"github.com/abcdlsj/hark/internal/core/model"
)

func basicToken(userPass string) string {
	return base64.StdEncoding.EncodeToString([]byte(userPass))
}

// AutoVarResult reports what ReplaceHardcodedValues changed.
type AutoVarResult struct {
	Value    string
	Replaced []string // placeholder keys that were substituted in
}

// ReplaceHardcodedValues swaps literal values of URL-shaped variables for their
// {{placeholder}}, longest value first, so a staging host wins over its own
// parent domain.
func ReplaceHardcodedValues(s string, vars map[string]model.EnvVar) AutoVarResult {
	type pair struct {
		key string
		val string
	}
	var pairs []pair
	for k, v := range vars {
		if v.Secret || !strings.Contains(v.Value, "://") || v.Value == "" {
			continue
		}
		pairs = append(pairs, pair{k, v.Value})
	}
	// Insertion sort by descending value length: tiny lists, no import needed.
	for i := 1; i < len(pairs); i++ {
		for j := i; j > 0 && len(pairs[j].val) > len(pairs[j-1].val); j-- {
			pairs[j], pairs[j-1] = pairs[j-1], pairs[j]
		}
	}
	out := s
	seen := map[string]bool{}
	for _, p := range pairs {
		if strings.Contains(out, p.val) {
			out = strings.ReplaceAll(out, p.val, "{{"+p.key+"}}")
			seen[p.key] = true
		}
	}
	var keys []string
	for k := range seen {
		keys = append(keys, k)
	}
	return AutoVarResult{Value: out, Replaced: keys}
}

// DetectPlaintextToken looks for a hard-coded bearer token in headers. It
// returns the token and the header index, or an empty token when none exists.
func DetectPlaintextToken(headers []model.KV) (string, int) {
	for i, kv := range headers {
		if !strings.EqualFold(kv.Key, "Authorization") {
			continue
		}
		val := strings.TrimSpace(kv.Value)
		lower := strings.ToLower(val)
		if !strings.HasPrefix(lower, "bearer ") {
			continue
		}
		token := strings.TrimSpace(val[len("bearer "):])
		if token == "" || strings.Contains(token, "{{") {
			continue
		}
		return token, i
	}
	return "", -1
}
