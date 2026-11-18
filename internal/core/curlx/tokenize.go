// Package curlx converts between cURL command lines and structured requests.
//
// Parsing is a two-stage pipeline: a shlex-style tokenizer that understands
// POSIX quoting and backslash line continuations, then a small flag state
// machine that follows cURL's own semantics (notably: any body flag without an
// explicit -X implies POST).
package curlx

import (
	"fmt"
	"strings"
)

// Tokenize splits a shell command line into words the way a POSIX shell would
// for the subset of syntax cURL commands use: single quotes, double quotes,
// backslash escapes, `$'...'` quoting, and backslash-newline continuations.
func Tokenize(s string) ([]string, error) {
	var (
		tokens []string
		cur    strings.Builder
		hasTok bool
	)
	flush := func() {
		if hasTok {
			tokens = append(tokens, cur.String())
			cur.Reset()
			hasTok = false
		}
	}
	for i := 0; i < len(s); {
		c := s[i]
		switch c {
		case ' ', '\t', '\r', '\n':
			flush()
			i++
		case '\\':
			// Line continuation, possibly CRLF.
			if i+1 < len(s) && s[i+1] == '\n' {
				i += 2
				continue
			}
			if i+2 < len(s) && s[i+1] == '\r' && s[i+2] == '\n' {
				i += 3
				continue
			}
			if i+1 < len(s) {
				cur.WriteByte(s[i+1])
				hasTok = true
				i += 2
				continue
			}
			i++
		case '\'':
			end := strings.IndexByte(s[i+1:], '\'')
			if end < 0 {
				return nil, fmt.Errorf("unterminated single quote in cURL command")
			}
			cur.WriteString(s[i+1 : i+1+end])
			hasTok = true
			i += end + 2
		case '"':
			i++
			for {
				if i >= len(s) {
					return nil, fmt.Errorf("unterminated double quote in cURL command")
				}
				if s[i] == '\\' && i+1 < len(s) {
					n := s[i+1]
					switch n {
					case '\n':
						i += 2
						continue
					case '"', '\\', '$', '`':
						cur.WriteByte(n)
						i += 2
						continue
					}
					cur.WriteByte('\\')
					i++
					continue
				}
				if s[i] == '"' {
					i++
					break
				}
				cur.WriteByte(s[i])
				i++
			}
			hasTok = true
		case '$':
			if i+1 < len(s) && s[i+1] == '\'' {
				val, next, err := readANSICQuote(s, i+2)
				if err != nil {
					return nil, err
				}
				cur.WriteString(val)
				hasTok = true
				i = next
				continue
			}
			cur.WriteByte(c)
			hasTok = true
			i++
		default:
			cur.WriteByte(c)
			hasTok = true
			i++
		}
	}
	flush()
	return tokens, nil
}

func readANSICQuote(s string, i int) (string, int, error) {
	var b strings.Builder
	for i < len(s) {
		c := s[i]
		if c == '\'' {
			return b.String(), i + 1, nil
		}
		if c != '\\' || i+1 >= len(s) {
			b.WriteByte(c)
			i++
			continue
		}
		n := s[i+1]
		i += 2
		switch n {
		case 'n':
			b.WriteByte('\n')
		case 't':
			b.WriteByte('\t')
		case 'r':
			b.WriteByte('\r')
		case '\\', '\'', '"', '?':
			b.WriteByte(n)
		case 'x':
			if i+1 < len(s) {
				var v int
				if _, err := fmt.Sscanf(s[i:i+2], "%02x", &v); err == nil {
					b.WriteByte(byte(v))
					i += 2
					continue
				}
			}
			b.WriteByte('x')
		default:
			b.WriteByte(n)
		}
	}
	return "", i, fmt.Errorf("unterminated $'...' quote in cURL command")
}
