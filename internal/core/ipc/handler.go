package ipc

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/abcdlsj/apic/internal/core/ops"
)

// Handler builds the command dispatcher shared by the desktop socket server and
// the CLI's offline fallback.
func NewHandler(o *ops.Ops) Handler {
	return func(req Request) Response {
		resp, err := dispatch(o, req)
		if err != nil {
			return Response{Error: err.Error()}
		}
		return resp
	}
}

func dispatch(o *ops.Ops, req Request) (Response, error) {
	switch req.Cmd {
	case CmdGuide:
		text, err := o.Guide()
		if err != nil {
			return Response{}, err
		}
		return Response{Text: text}, nil

	case CmdLs:
		var a LsArgs
		if err := decode(req.Args, &a); err != nil {
			return Response{}, err
		}
		items, err := o.List(a.Prefix)
		if err != nil {
			return Response{}, err
		}
		payload, _ := json.Marshal(items)
		return Response{Text: ops.FormatList(items), JSON: payload}, nil

	case CmdShow:
		var a ShowArgs
		if err := decode(req.Args, &a); err != nil {
			return Response{}, err
		}
		api, err := o.Show(a.ID)
		if err != nil {
			return Response{}, err
		}
		payload, _ := json.Marshal(api)
		if a.Curl {
			curl, err := o.ExportCurl(api, "", false)
			if err != nil {
				return Response{}, err
			}
			return Response{Text: curl + "\n", JSON: payload}, nil
		}
		return Response{Text: ops.FormatShow(api), JSON: payload}, nil

	case CmdSave:
		var a SaveArgs
		if err := decode(req.Args, &a); err != nil {
			return Response{}, err
		}
		res, err := o.Save(ops.SaveParams{
			ID: a.ID, Name: a.Name, Curl: a.Curl, API: a.API,
			AutoVar: a.AutoVar, Env: a.Env,
		})
		if err != nil {
			return Response{}, err
		}
		var b strings.Builder
		fmt.Fprintf(&b, "saved %s  %s  %s\n", res.API.ID, res.API.Method, res.API.URL)
		if len(res.Replaced) > 0 {
			fmt.Fprintf(&b, "auto-var: %s\n", strings.Join(res.Replaced, ", "))
		}
		if res.NewToken != "" {
			fmt.Fprintf(&b, "warning: plaintext bearer token; run `apic var set api_key=<token> --secret` then use {{api_key}}\n")
		}
		for _, n := range res.Notes {
			fmt.Fprintf(&b, "note: %s\n", n)
		}
		payload, _ := json.Marshal(res)
		return Response{Text: b.String(), JSON: payload}, nil

	case CmdRun:
		var a RunArgs
		if err := decode(req.Args, &a); err != nil {
			return Response{}, err
		}
		out, err := o.Run(context.Background(), ops.RunParams{
			ID: a.ID, Curl: a.Curl, Env: a.Env, Overrides: a.Overrides,
		})
		if err != nil {
			return Response{}, err
		}
		text := ops.RunSummary(out.Result)
		var payload []byte
		if a.JSON {
			bodyPath := ""
			const limit = 4 << 10
			if len(out.Result.BodyText) > limit {
				bodyPath = spillBody(out.Result.APIID, out.Result.Body)
			}
			payload, err = ops.RunJSON(out.Result, bodyPath, out.Result.Truncated)
			if err != nil {
				return Response{}, err
			}
		}
		return Response{Text: text, JSON: payload}, nil

	case CmdVarLs:
		var a VarLsArgs
		if err := decode(req.Args, &a); err != nil {
			return Response{}, err
		}
		items, err := o.Vars(a.Env)
		if err != nil {
			return Response{}, err
		}
		var b strings.Builder
		for _, v := range items {
			extra := v.Scope
			if v.Secret {
				extra += ", keychain"
			}
			fmt.Fprintf(&b, "%s = %s  (%s)\n", v.Key, v.Value, extra)
		}
		payload, _ := json.Marshal(items)
		return Response{Text: b.String(), JSON: payload}, nil

	case CmdVarSet:
		var a VarSetArgs
		if err := decode(req.Args, &a); err != nil {
			return Response{}, err
		}
		if err := o.SetVar(a.Scope, a.Key, a.Value, a.Secret); err != nil {
			return Response{}, err
		}
		scope := a.Scope
		if scope == "" {
			scope = "global"
		}
		text := fmt.Sprintf("set %s in %s\n", a.Key, scope)
		payload, _ := json.Marshal(map[string]string{"key": a.Key, "scope": scope})
		return Response{Text: text, JSON: payload}, nil

	case CmdEnvLs:
		current, names, err := o.EnvNames()
		if err != nil {
			return Response{}, err
		}
		var b strings.Builder
		for _, n := range names {
			mark := "  "
			if n == current {
				mark = "* "
			}
			fmt.Fprintf(&b, "%s%s\n", mark, n)
		}
		payload, _ := json.Marshal(map[string]any{"current": current, "environments": names})
		return Response{Text: b.String(), JSON: payload}, nil

	case CmdEnvUse:
		var a EnvUseArgs
		if err := decode(req.Args, &a); err != nil {
			return Response{}, err
		}
		if err := o.SetEnv(a.Name); err != nil {
			return Response{}, err
		}
		return Response{Text: "env: " + a.Name + "\n"}, nil
	}
	return Response{}, fmt.Errorf("unknown command %q", req.Cmd)
}

func decode(raw json.RawMessage, v any) error {
	if len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, v)
}

// spillBody writes a large response body to a temp file so an agent can read it
// in slices instead of pulling it into context.
func spillBody(apiID string, body []byte) string {
	name := strings.ReplaceAll(apiID, "/", "-")
	if name == "" || name == "_adhoc" {
		name = "response"
	}
	path := filepath.Join(os.TempDir(), fmt.Sprintf("apic-%s-%d.body", name, time.Now().UnixNano()))
	if err := os.WriteFile(path, body, 0o600); err != nil {
		return ""
	}
	return path
}
