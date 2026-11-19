package curlx

import (
	"strings"

	"github.com/abcdlsj/hark/internal/core/model"
)

// ExportOptions controls how a Request becomes a cURL command.
type ExportOptions struct {
	// Resolve substitutes {{var}} placeholders. When nil, placeholders are kept
	// verbatim, which is what "copy as cURL" does by default.
	Resolve func(key string) (string, bool)
}

// Export renders a Request as a multi-line, shell-safe cURL command.
func Export(r *Request, opts ExportOptions) string {
	resolve := func(s string) string {
		if opts.Resolve == nil {
			return s
		}
		return RenderVars(s, opts.Resolve)
	}

	url := r.URL
	var qs []string
	for _, kv := range r.Query {
		if !kv.IsEnabled() || kv.Key == "" {
			continue
		}
		if kv.Value == "" {
			qs = append(qs, kv.Key)
			continue
		}
		qs = append(qs, kv.Key+"="+kv.Value)
	}
	if len(qs) > 0 {
		url += "?" + strings.Join(qs, "&")
	}

	var lines []string
	lines = append(lines, "curl -X "+strings.ToUpper(r.Method)+" "+quote(resolve(url)))

	headers := r.Headers
	body := r.Body
	hasAuthHeader := false
	for _, kv := range headers {
		if kv.IsEnabled() && strings.EqualFold(kv.Key, "Authorization") && strings.TrimSpace(kv.Value) != "" {
			hasAuthHeader = true
		}
	}
	for _, kv := range headers {
		if !kv.IsEnabled() || kv.Key == "" {
			continue
		}
		lines = append(lines, "  -H "+quote(resolve(kv.Key+": "+kv.Value)))
	}
	if kv, ok := authHeader(r.Auth, resolve); ok && !hasAuthHeader {
		lines = append(lines, "  -H "+quote(kv))
	}
	if r.Insecure {
		lines = append(lines, "  --insecure")
	}

	switch {
	case body.Type == model.BodyForm:
		for _, f := range ParseContentForm(body.Content) {
			lines = append(lines, "  -F "+quote(resolve(f.Key+"="+f.Value)))
		}
	case body.Type != "" && body.Type != model.BodyNone && strings.TrimSpace(body.Content) != "":
		content := resolve(body.Content)
		if strings.Contains(content, "\n") {
			lines = append(lines, "  --data-raw "+quote(content))
		} else {
			lines = append(lines, "  --data-raw "+quote(content))
		}
	}
	return strings.Join(lines, " \\\n")
}

// authHeader builds the Authorization header implied by Auth, unless the
// header table already carries one.
func authHeader(a model.Auth, resolve func(string) string) (string, bool) {
	switch a.Type {
	case model.AuthBearer:
		if strings.TrimSpace(a.Token) == "" {
			return "", false
		}
		return "Authorization: Bearer " + resolve(a.Token), true
	case model.AuthBasic:
		if a.Username == "" && a.Password == "" {
			return "", false
		}
		return "Authorization: Basic " + basicToken(resolve(a.Username)+":"+resolve(a.Password)), true
	}
	return "", false
}

// quote wraps a value in single quotes for POSIX shells, escaping embedded
// single quotes as '\” .
func quote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

// RenderVars replaces {{key}} placeholders when resolve reports a value.
func RenderVars(s string, resolve func(key string) (string, bool)) string {
	var b strings.Builder
	for {
		start := strings.Index(s, "{{")
		if start < 0 {
			b.WriteString(s)
			break
		}
		end := strings.Index(s[start+2:], "}}")
		if end < 0 {
			b.WriteString(s)
			break
		}
		end += start + 2
		b.WriteString(s[:start])
		key := strings.TrimSpace(s[start+2 : end])
		if v, ok := resolve(key); ok {
			b.WriteString(v)
		} else {
			b.WriteString(s[start : end+2])
		}
		s = s[end+2:]
	}
	return b.String()
}
