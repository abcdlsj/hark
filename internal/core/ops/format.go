package ops

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/abcdlsj/hark/internal/core/exec"
	"github.com/abcdlsj/hark/internal/core/model"
)

// FormatList renders list rows one per line, token-frugal by design:
//
//	orders/refund  POST  {{base_url}}/v1/orders/refund  [last: 200]
func FormatList(items []ListItem) string {
	if len(items) == 0 {
		return "no apis\n"
	}
	var b strings.Builder
	width := 0
	for _, it := range items {
		if len(it.ID) > width {
			width = len(it.ID)
		}
	}
	for _, it := range items {
		fmt.Fprintf(&b, "%-*s  %-6s  %s", width, it.ID, it.Method, it.URL)
		if it.LastStatus != 0 {
			fmt.Fprintf(&b, "  [last: %d]", it.LastStatus)
		}
		b.WriteByte('\n')
	}
	return b.String()
}

// FormatShow renders one API as a compact summary.
func FormatShow(api *model.API) string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s  %s\n", api.ID, strings.ToUpper(api.Method))
	fmt.Fprintf(&b, "name: %s\n", api.Name)
	fmt.Fprintf(&b, "url: %s\n", api.URL)
	if q := enabledPairs(api.Query); len(q) > 0 {
		fmt.Fprintf(&b, "query: %s\n", strings.Join(q, "&"))
	}
	hasAuthHeader := false
	for _, kv := range api.Headers {
		if kv.IsEnabled() && strings.EqualFold(kv.Key, "Authorization") {
			hasAuthHeader = true
		}
	}
	if h := enabledPairs(api.Headers); len(h) > 0 {
		b.WriteString("headers:\n")
		for _, kv := range api.Headers {
			if kv.IsEnabled() {
				fmt.Fprintf(&b, "  %s: %s\n", kv.Key, kv.Value)
			}
		}
	}
	if api.Auth.Type != model.AuthNone && !hasAuthHeader {
		fmt.Fprintf(&b, "auth: %s", api.Auth.Type)
		if api.Auth.Type == model.AuthBearer {
			fmt.Fprintf(&b, " (%s)", api.Auth.Token)
		}
		b.WriteByte('\n')
	}
	if api.Body.Type != model.BodyNone {
		fmt.Fprintf(&b, "body: %s (%d B)\n", api.Body.Type, len(api.Body.Content))
	}
	if api.Meta.UpdatedBy != "" {
		fmt.Fprintf(&b, "updated: %s by %s\n", api.Meta.UpdatedAt, api.Meta.UpdatedBy)
	}
	return b.String()
}

// RunSummary is the text form of a completed execution.
func RunSummary(res *exec.Result) string {
	var b strings.Builder
	status := fmt.Sprintf("%d %s", res.Status, res.StatusText)
	fmt.Fprintf(&b, "%s  ·  %s  ·  %s  ·  %s\n",
		status, humanMS(res.DurationMS), humanBytes(res.Size), res.Env)
	b.WriteString(strings.TrimRight(res.BodyText, "\n"))
	b.WriteByte('\n')
	if res.Truncated {
		b.WriteString("(body truncated at 8MB)\n")
	}
	return b.String()
}

// RunJSON is the structured form printed by `hark run --json`. The body is
// capped so a large response cannot flood an agent's context.
func RunJSON(res *exec.Result, fullBodyPath string, truncated bool) ([]byte, error) {
	const previewLimit = 4 << 10
	body := res.BodyText
	previewTruncated := false
	if len(body) > previewLimit {
		body = body[:previewLimit]
		previewTruncated = true
	}
	out := map[string]any{
		"api_id":       res.APIID,
		"status":       res.Status,
		"status_text":  res.StatusText,
		"duration_ms":  round2(res.DurationMS),
		"env":          res.Env,
		"size":         res.Size,
		"headers":      pickHeaders(res.ResponseHeader),
		"body_preview": body,
		"truncated":    truncated || previewTruncated,
		"timings":      res.Timings,
	}
	if fullBodyPath != "" {
		out["body_file"] = fullBodyPath
	}
	if res.Error != "" {
		out["error"] = res.Error
	}
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", " ")
	if err := enc.Encode(out); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// pickHeaders keeps the headers agents actually reason about.
func pickHeaders(h map[string][]string) map[string]string {
	want := []string{"Content-Type", "Content-Length", "Location", "X-Request-Id", "Retry-After", "Date", "Server"}
	out := map[string]string{}
	for _, k := range want {
		for hk, hv := range h {
			if strings.EqualFold(hk, k) && len(hv) > 0 {
				out[k] = hv[0]
			}
		}
	}
	return out
}

func enabledPairs(rows []model.KV) []string {
	var out []string
	for _, kv := range rows {
		if kv.IsEnabled() && kv.Key != "" {
			if kv.Value == "" {
				out = append(out, kv.Key)
				continue
			}
			out = append(out, kv.Key+"="+kv.Value)
		}
	}
	return out
}

func humanMS(v float64) string {
	if v >= 1000 {
		return fmt.Sprintf("%.2fs", v/1000)
	}
	return fmt.Sprintf("%.0fms", v)
}

func humanBytes(n int64) string {
	switch {
	case n >= 1<<20:
		return fmt.Sprintf("%.2f MB", float64(n)/(1<<20))
	case n >= 1<<10:
		return fmt.Sprintf("%.2f KB", float64(n)/(1<<10))
	default:
		return fmt.Sprintf("%d B", n)
	}
}

func round2(v float64) float64 {
	return float64(int64(v*100+0.5)) / 100
}
