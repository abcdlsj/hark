package curlx

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/abcdlsj/hark/internal/core/model"
)

// Request is the structured form of one HTTP call.
type Request struct {
	Method   string     `json:"method"`
	URL      string     `json:"url"` // without query string
	Query    []model.KV `json:"query,omitempty"`
	Headers  []model.KV `json:"headers,omitempty"`
	Body     model.Body `json:"body"`
	Auth     model.Auth `json:"auth"`
	Insecure bool       `json:"insecure,omitempty"`
}

// Parsed is the result of parsing a cURL command.
type Parsed struct {
	Request
	Warnings []string `json:"warnings,omitempty"`
}

// noValueFlags are cURL flags that never consume the following word.
var noValueFlags = map[string]bool{
	"-k": true, "--insecure": true,
	"-L": true, "--location": true,
	"-s": true, "--silent": true,
	"-S": true, "--show-error": true,
	"-v": true, "--verbose": true,
	"-i": true, "--include": true,
	"-I": true, "--head": true,
	"-G": true, "--get": true,
	"-f": true, "--fail": true,
	"-N": true, "--no-buffer": true,
	"-4": true, "--ipv4": true,
	"-6": true, "--ipv6": true,
	"-g": true, "--globoff": true,
	"-j": true, "--junk-session-cookies": true,
	"-O": true, "--remote-name": true,
	"-#": true, "--progress-bar": true,
	"--compressed":            true,
	"--no-progress-meter":     true,
	"--path-as-is":            true,
	"--http1.1":               true,
	"--http2":                 true,
	"--http2-prior-knowledge": true,
	"--tlsv1.2":               true,
	"--tlsv1.3":               true,
}

// valueFlags are cURL flags that consume a value.
var valueFlags = map[string]bool{
	"-X": true, "--request": true,
	"-H": true, "--header": true,
	"-d": true, "--data": true, "--data-raw": true, "--data-binary": true,
	"--data-urlencode": true, "--json": true,
	"-F": true, "--form": true,
	"-u": true, "--user": true,
	"-A": true, "--user-agent": true,
	"-e": true, "--referer": true,
	"-b": true, "--cookie": true,
	"-c": true, "--cookie-jar": true,
	"-o": true, "--output": true,
	"-m": true, "--max-time": true,
	"--connect-timeout": true,
	"-x":                true, "--proxy": true,
	"--url": true,
	"-T":    true, "--upload-file": true,
	"--resolve": true,
	"-K":        true, "--config": true,
	"--retry": true,
	"-w":      true, "--write-out": true,
	"--cert": true, "-E": true,
	"--key": true, "--cacert": true,
	"--oauth2-bearer": true,
	"-U":              true, "--proxy-user": true,
	"--interface": true, "--limit-rate": true,
	"-r": true, "--range": true,
	"-z": true, "--time-cond": true,
	"--unix-socket": true,
	"--header-file": true,
}

// Parse turns a cURL command line into a Request.
func Parse(command string) (*Parsed, error) {
	tokens, err := Tokenize(strings.TrimSpace(command))
	if err != nil {
		return nil, err
	}
	if len(tokens) == 0 {
		return nil, fmt.Errorf("empty cURL command")
	}
	if strings.EqualFold(tokens[0], "curl") {
		tokens = tokens[1:]
	} else if strings.HasPrefix(tokens[0], "curl") && strings.HasSuffix(tokens[0], "curl") {
		tokens = tokens[1:]
	}

	p := &Parsed{}
	var (
		method      string
		url         string
		dataParts   []string
		formParts   []model.KV
		hasBody     bool
		isJSON      bool
		wantGET     bool
		wantHead    bool
		contentType string
	)

	// next returns the value for a flag, supporting -XVALUE and --flag=VALUE.
	next := func(i *int, flag, inline string) (string, error) {
		if inline != "" {
			return inline, nil
		}
		if *i+1 >= len(tokens) {
			return "", fmt.Errorf("flag %s needs a value", flag)
		}
		*i++
		return tokens[*i], nil
	}

	for i := 0; i < len(tokens); i++ {
		tok := tokens[i]
		if tok == "" {
			continue
		}
		if !strings.HasPrefix(tok, "-") || tok == "-" {
			if url == "" {
				url = tok
			} else {
				p.Warnings = append(p.Warnings, fmt.Sprintf("ignored extra argument %q", tok))
			}
			continue
		}

		flag, inline := tok, ""
		if strings.HasPrefix(tok, "--") {
			if eq := strings.IndexByte(tok, '='); eq > 0 {
				flag, inline = tok[:eq], tok[eq+1:]
			}
		} else if len(tok) > 2 {
			// Short flag with attached value, e.g. -XPOST.
			flag, inline = tok[:2], tok[2:]
		}

		switch {
		case flag == "-X" || flag == "--request":
			v, err := next(&i, flag, inline)
			if err != nil {
				return nil, err
			}
			method = v
		case flag == "-H" || flag == "--header":
			v, err := next(&i, flag, inline)
			if err != nil {
				return nil, err
			}
			k, val, ok := strings.Cut(v, ":")
			if !ok {
				// cURL also accepts "Header;" meaning empty value.
				k, val, _ = strings.Cut(v, ";")
			}
			k = strings.TrimSpace(k)
			if k == "" {
				continue
			}
			lower := strings.ToLower(k)
			if lower == "content-type" {
				contentType = strings.TrimSpace(val)
			}
			if lower == "authorization" {
				if strings.HasPrefix(strings.ToLower(strings.TrimSpace(val)), "bearer ") {
					p.Auth = model.Auth{Type: model.AuthBearer, Token: strings.TrimSpace(val[7:])}
				}
			}
			p.Headers = append(p.Headers, model.KV{Key: k, Value: strings.TrimSpace(val)})
		case flag == "-d" || flag == "--data" || flag == "--data-raw" ||
			flag == "--data-binary" || flag == "--data-urlencode" || flag == "--json":
			v, err := next(&i, flag, inline)
			if err != nil {
				return nil, err
			}
			if flag == "--json" {
				isJSON = true
			}
			dataParts = append(dataParts, v)
			hasBody = true
		case flag == "-F" || flag == "--form":
			v, err := next(&i, flag, inline)
			if err != nil {
				return nil, err
			}
			k, val, ok := strings.Cut(v, "=")
			if !ok {
				return nil, fmt.Errorf("form field %q must be key=value", v)
			}
			formParts = append(formParts, model.KV{Key: k, Value: val})
			hasBody = true
		case flag == "-u" || flag == "--user":
			v, err := next(&i, flag, inline)
			if err != nil {
				return nil, err
			}
			user, pass, _ := strings.Cut(v, ":")
			p.Auth = model.Auth{Type: model.AuthBasic, Username: user, Password: pass}
		case flag == "--oauth2-bearer":
			v, err := next(&i, flag, inline)
			if err != nil {
				return nil, err
			}
			p.Auth = model.Auth{Type: model.AuthBearer, Token: v}
		case flag == "-A" || flag == "--user-agent":
			v, err := next(&i, flag, inline)
			if err != nil {
				return nil, err
			}
			p.Headers = append(p.Headers, model.KV{Key: "User-Agent", Value: v})
		case flag == "-e" || flag == "--referer":
			v, err := next(&i, flag, inline)
			if err != nil {
				return nil, err
			}
			p.Headers = append(p.Headers, model.KV{Key: "Referer", Value: v})
		case flag == "-b" || flag == "--cookie":
			v, err := next(&i, flag, inline)
			if err != nil {
				return nil, err
			}
			p.Headers = append(p.Headers, model.KV{Key: "Cookie", Value: v})
		case flag == "--url":
			v, err := next(&i, flag, inline)
			if err != nil {
				return nil, err
			}
			if url == "" {
				url = v
			}
		case flag == "-G" || flag == "--get":
			wantGET = true
		case flag == "-I" || flag == "--head":
			wantHead = true
		case flag == "-k" || flag == "--insecure":
			p.Insecure = true
		case noValueFlags[flag]:
			// Accepted and ignored: transport-level options.
		default:
			if valueFlags[flag] {
				if _, err := next(&i, flag, inline); err != nil {
					return nil, err
				}
				continue
			}
			// Unknown flag: consume a value only when it looks like one and the
			// flag was written in --flag=value form.
			if inline != "" || strings.HasPrefix(flag, "--") {
				continue
			}
			if i+1 < len(tokens) && !strings.HasPrefix(tokens[i+1], "-") && strings.HasPrefix(flag, "-") && len(flag) == 2 {
				continue
			}
		}
	}

	if url == "" {
		return nil, fmt.Errorf("cURL command has no URL")
	}

	// Query string moves into its own table so the UI can edit it as rows.
	base, query := splitQuery(url)
	p.URL, p.Query = base, query

	// Body assembly.
	switch {
	case len(formParts) > 0:
		p.Body = model.Body{Type: model.BodyForm, Content: formToContent(formParts)}
	case len(dataParts) > 0:
		content := strings.Join(dataParts, "&")
		switch {
		case isJSON || (contentType == "application/json") || json.Valid([]byte(content)) && strings.HasPrefix(strings.TrimSpace(content), "{"):
			p.Body = model.Body{Type: model.BodyJSON, Content: content}
		case looksURLEncoded(content):
			p.Body = model.Body{Type: model.BodyURLEncoded, Content: content}
		default:
			p.Body = model.Body{Type: model.BodyRaw, Content: content}
		}
	}

	// Method: explicit -X wins, then -I/-G, then cURL's body-implies-POST rule.
	switch {
	case method != "":
		p.Method = strings.ToUpper(method)
	case wantHead:
		p.Method = "HEAD"
	case wantGET:
		p.Method = "GET"
	case hasBody:
		p.Method = "POST"
	default:
		p.Method = "GET"
	}

	if len(p.Warnings) > 0 {
		// Deduplicate while keeping insertion order.
		seen := map[string]bool{}
		out := p.Warnings[:0]
		for _, w := range p.Warnings {
			if !seen[w] {
				seen[w] = true
				out = append(out, w)
			}
		}
		p.Warnings = out
	}
	return p, nil
}

// splitQuery separates the query string from the URL and protects {{var}}
// placeholders from any form of escaping.
func splitQuery(raw string) (string, []model.KV) {
	if i := strings.IndexByte(raw, '#'); i >= 0 {
		raw = raw[:i]
	}
	base, q, ok := strings.Cut(raw, "?")
	if !ok || q == "" {
		return raw, nil
	}
	var out []model.KV
	for _, part := range strings.Split(q, "&") {
		if part == "" {
			continue
		}
		k, v, _ := strings.Cut(part, "=")
		out = append(out, model.KV{Key: k, Value: v})
	}
	return base, out
}

func formToContent(fields []model.KV) string {
	var b strings.Builder
	for i, f := range fields {
		if i > 0 {
			b.WriteByte('\n')
		}
		b.WriteString(f.Key)
		b.WriteByte('=')
		b.WriteString(f.Value)
	}
	return b.String()
}

// ParseContentForm is the inverse of formToContent.
func ParseContentForm(content string) []model.KV {
	var out []model.KV
	for _, line := range strings.Split(content, "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		k, v, _ := strings.Cut(line, "=")
		out = append(out, model.KV{Key: strings.TrimSpace(k), Value: v})
	}
	return out
}

func looksURLEncoded(s string) bool {
	if !strings.Contains(s, "=") {
		return false
	}
	for _, part := range strings.Split(s, "&") {
		if !strings.Contains(part, "=") {
			return false
		}
	}
	return true
}
