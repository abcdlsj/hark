// Package exec turns a structured request into a real HTTP call, timing each
// phase, and redacts any secret that was injected before the result leaves this
// package.
package exec

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptrace"
	"net/textproto"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/abcdlsj/apic/internal/core/curlx"
	"github.com/abcdlsj/apic/internal/core/model"
	"github.com/abcdlsj/apic/internal/core/vars"
)

// MaxBody caps how much of a response body is kept in memory.
const MaxBody = 8 << 20

// Timings holds per-phase milliseconds. Zero means the phase did not happen
// (for example TLS on plain HTTP).
type Timings struct {
	DNS      float64 `json:"dns_ms"`
	TCP      float64 `json:"tcp_ms"`
	TLS      float64 `json:"tls_ms"`
	TTFB     float64 `json:"ttfb_ms"`
	Download float64 `json:"download_ms"`
}

// Result is one completed execution.
type Result struct {
	Method         string              `json:"method"`
	URL            string              `json:"url"`
	Env            string              `json:"env"`
	Actor          string              `json:"actor"`
	APIID          string              `json:"api_id"`
	Status         int                 `json:"status"`
	StatusText     string              `json:"status_text"`
	DurationMS     float64             `json:"duration_ms"`
	Size           int64               `json:"size"`
	Timings        Timings             `json:"timings"`
	RequestHeaders map[string][]string `json:"request_headers"`
	ResponseHeader map[string][]string `json:"response_headers"`
	Body           []byte              `json:"-"`
	BodyText       string              `json:"body"`
	Truncated      bool                `json:"truncated"`
	StartedAt      time.Time           `json:"started_at"`
	Error          string              `json:"error,omitempty"`
}

// Options configures one execution.
type Options struct {
	Request  *curlx.Request
	Resolver *vars.Resolver
	Timeout  time.Duration
	Actor    string
	APIID    string
}

// Do executes the request. A transport error is returned as an error; an HTTP
// error status is a successful result.
func Do(ctx context.Context, opts Options) (*Result, error) {
	req := opts.Request
	if req == nil {
		return nil, fmt.Errorf("no request")
	}
	if opts.Resolver == nil {
		return nil, fmt.Errorf("no variable resolver")
	}
	if opts.Timeout == 0 {
		opts.Timeout = 60 * time.Second
	}

	resolve := func(s string) (string, error) {
		out, missing := opts.Resolver.Render(s)
		if len(missing) > 0 {
			return "", fmt.Errorf("undefined variable(s): %s", strings.Join(missing, ", "))
		}
		return out, nil
	}

	rawURL, err := resolve(req.URL)
	if err != nil {
		return nil, err
	}
	if !strings.Contains(rawURL, "://") {
		return nil, fmt.Errorf("url %q needs a scheme (try {{base_url}})", rawURL)
	}
	if q := queryString(req.Query, resolve); q != "" {
		rawURL += "?" + q
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("bad url: %w", err)
	}

	bodyReader, contentType, err := buildBody(req, resolve)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, strings.ToUpper(req.Method), u.String(), bodyReader)
	if err != nil {
		return nil, err
	}

	sentHeaders := map[string][]string{}
	for _, kv := range req.Headers {
		if !kv.IsEnabled() || kv.Key == "" {
			continue
		}
		val, err := resolve(kv.Value)
		if err != nil {
			return nil, err
		}
		httpReq.Header.Add(kv.Key, val)
	}
	if auth, ok := authorization(req.Auth, resolve); ok && httpReq.Header.Get("Authorization") == "" {
		httpReq.Header.Set("Authorization", auth)
	}
	if contentType != "" && httpReq.Header.Get("Content-Type") == "" {
		httpReq.Header.Set("Content-Type", contentType)
	}
	if httpReq.Header.Get("Accept") == "" {
		httpReq.Header.Set("Accept", "*/*")
	}

	t := http.DefaultTransport.(*http.Transport).Clone()
	t.ForceAttemptHTTP2 = true
	if req.Insecure {
		t.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}
	client := &http.Client{Transport: t, Timeout: opts.Timeout}

	var (
		start               = time.Now()
		dnsStart, dnsDone   time.Time
		connStart, connDone time.Time
		tlsStart, tlsDone   time.Time
		firstByte           time.Time
	)
	trace := &httptrace.ClientTrace{
		DNSStart:             func(httptrace.DNSStartInfo) { dnsStart = time.Now() },
		DNSDone:              func(httptrace.DNSDoneInfo) { dnsDone = time.Now() },
		ConnectStart:         func(string, string) { connStart = time.Now() },
		ConnectDone:          func(string, string, error) { connDone = time.Now() },
		TLSHandshakeStart:    func() { tlsStart = time.Now() },
		TLSHandshakeDone:     func(tls.ConnectionState, error) { tlsDone = time.Now() },
		GotFirstResponseByte: func() { firstByte = time.Now() },
	}
	httpReq = httpReq.WithContext(httptrace.WithClientTrace(httpReq.Context(), trace))

	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	limit := io.LimitReader(resp.Body, MaxBody+1)
	body, readErr := io.ReadAll(limit)
	total := time.Since(start)
	truncated := false
	if int64(len(body)) > MaxBody {
		body = body[:MaxBody]
		truncated = true
	}

	for k, v := range resp.Request.Header {
		sentHeaders[k] = v
	}

	res := &Result{
		Method:         strings.ToUpper(req.Method),
		URL:            redactString(resp.Request.URL.String(), opts.Resolver),
		Env:            opts.Resolver.Env(),
		Actor:          opts.Actor,
		APIID:          opts.APIID,
		Status:         resp.StatusCode,
		StatusText:     strings.TrimSpace(strings.TrimPrefix(resp.Status, fmt.Sprintf("%d", resp.StatusCode))),
		DurationMS:     ms(total),
		Size:           int64(len(body)),
		RequestHeaders: redactHeaders(sentHeaders, opts.Resolver),
		ResponseHeader: redactHeaders(resp.Header, opts.Resolver),
		Body:           redactBytes(body, opts.Resolver),
		Truncated:      truncated,
		StartedAt:      start,
		Timings: Timings{
			DNS:      span(dnsStart, dnsDone),
			TCP:      span(connStart, connDone),
			TLS:      span(tlsStart, tlsDone),
			TTFB:     span(start, firstByte),
			Download: ms(total) - span(start, firstByte),
		},
	}
	res.BodyText = string(res.Body)
	if readErr != nil {
		res.Error = readErr.Error()
	}
	return res, nil
}

func buildBody(req *curlx.Request, resolve func(string) (string, error)) (io.Reader, string, error) {
	switch req.Body.Type {
	case "", model.BodyNone:
		return nil, "", nil
	case model.BodyJSON:
		content, err := resolve(req.Body.Content)
		if err != nil {
			return nil, "", err
		}
		return strings.NewReader(content), "application/json", nil
	case model.BodyURLEncoded:
		content, err := resolve(req.Body.Content)
		if err != nil {
			return nil, "", err
		}
		return strings.NewReader(content), "application/x-www-form-urlencoded", nil
	case model.BodyRaw:
		content, err := resolve(req.Body.Content)
		if err != nil {
			return nil, "", err
		}
		return strings.NewReader(content), "", nil
	case model.BodyForm:
		fields := curlx.ParseContentForm(req.Body.Content)
		var buf bytes.Buffer
		w := multipart.NewWriter(&buf)
		for _, f := range fields {
			val, err := resolve(f.Value)
			if err != nil {
				return nil, "", err
			}
			if strings.HasPrefix(val, "@") {
				path := strings.TrimPrefix(val, "@")
				data, err := os.ReadFile(path)
				if err != nil {
					return nil, "", fmt.Errorf("form file %s: %w", path, err)
				}
				h := make(textproto.MIMEHeader)
				h.Set("Content-Disposition",
					fmt.Sprintf(`form-data; name=%q; filename=%q`, f.Key, filepath.Base(path)))
				h.Set("Content-Type", "application/octet-stream")
				part, err := w.CreatePart(h)
				if err != nil {
					return nil, "", err
				}
				if _, err := part.Write(data); err != nil {
					return nil, "", err
				}
				continue
			}
			if err := w.WriteField(f.Key, val); err != nil {
				return nil, "", err
			}
		}
		if err := w.Close(); err != nil {
			return nil, "", err
		}
		return &buf, w.FormDataContentType(), nil
	}
	return nil, "", fmt.Errorf("unknown body type %q", req.Body.Type)
}

func queryString(query []model.KV, resolve func(string) (string, error)) string {
	var parts []string
	for _, kv := range query {
		if !kv.IsEnabled() || kv.Key == "" {
			continue
		}
		k, err := resolve(kv.Key)
		if err != nil {
			k = kv.Key
		}
		v, err := resolve(kv.Value)
		if err != nil {
			v = kv.Value
		}
		if v == "" {
			parts = append(parts, url.QueryEscape(k))
			continue
		}
		parts = append(parts, url.QueryEscape(k)+"="+url.QueryEscape(v))
	}
	return strings.Join(parts, "&")
}

func authorization(a model.Auth, resolve func(string) (string, error)) (string, bool) {
	switch a.Type {
	case model.AuthBearer:
		token, err := resolve(a.Token)
		if err != nil || strings.TrimSpace(token) == "" {
			return "", false
		}
		return "Bearer " + token, true
	case model.AuthBasic:
		user, err := resolve(a.Username)
		if err != nil {
			return "", false
		}
		pass, err := resolve(a.Password)
		if err != nil {
			return "", false
		}
		return "Basic " + basicAuth(user, pass), true
	}
	return "", false
}

func span(from, to time.Time) float64 {
	if from.IsZero() || to.IsZero() || to.Before(from) {
		return 0
	}
	return ms(to.Sub(from))
}

func ms(d time.Duration) float64 {
	return float64(d.Microseconds()) / 1000
}
