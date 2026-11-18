package curlx

import (
	"reflect"
	"testing"
)

func TestTokenize(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want []string
	}{
		{
			name: "multi-line with continuations",
			in:   "curl -X POST \\\n  -H 'Content-Type: application/json' \\\n  --data-raw '{\"a\":1}' \\\n  https://example.com/x",
			want: []string{"curl", "-X", "POST", "-H", "Content-Type: application/json", "--data-raw", `{"a":1}`, "https://example.com/x"},
		},
		{
			name: "double quotes with escaped quotes",
			in:   `curl -H "X-Note: say \"hi\"" --data-raw "{\"k\":\"v\"}" https://x.dev`,
			want: []string{"curl", "-H", `X-Note: say "hi"`, "--data-raw", `{"k":"v"}`, "https://x.dev"},
		},
		{
			name: "single quotes keep everything",
			in:   `curl -H 'X: a b $c' u`,
			want: []string{"curl", "-H", "X: a b $c", "u"},
		},
		{
			name: "empty argument survives",
			in:   `curl -d '' u`,
			want: []string{"curl", "-d", "", "u"},
		},
		{
			name: "ansi-c quoting",
			in:   `curl -d $'line1\nline2' u`,
			want: []string{"curl", "-d", "line1\nline2", "u"},
		},
		{
			name: "adjacent quoted segments concatenate",
			in:   `curl 'a'"b"c`,
			want: []string{"curl", "abc"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := Tokenize(tc.in)
			if err != nil {
				t.Fatalf("tokenize: %v", err)
			}
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got %q\nwant %q", got, tc.want)
			}
		})
	}
}

func TestTokenizeUnterminated(t *testing.T) {
	for _, in := range []string{`curl -d 'oops`, `curl -d "oops`} {
		if _, err := Tokenize(in); err == nil {
			t.Fatalf("expected an error for %q", in)
		}
	}
}
