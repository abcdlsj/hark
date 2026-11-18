package ops

import (
	"fmt"
	"strings"

	"github.com/abcdlsj/apic/internal/core/curlx"
	"github.com/abcdlsj/apic/internal/core/model"
)

// SaveParams describes a save request. Either API or Curl is set; Curl is what
// agents normally send because it survives shell quoting.
type SaveParams struct {
	ID      string
	Name    string
	API     *model.API
	Curl    string
	AutoVar bool
	Env     string
	Actor   string
}

// SaveResult reports what changed beyond the saved document.
type SaveResult struct {
	API        *model.API `json:"api"`
	Replaced   []string   `json:"replaced,omitempty"`
	NewToken   string     `json:"new_token,omitempty"`
	TokenIndex int        `json:"token_header,omitempty"`
	Notes      []string   `json:"notes,omitempty"`
}

// Save writes an API, optionally folding hard-coded base URLs into
// placeholders.
func (o *Ops) Save(p SaveParams) (*SaveResult, error) {
	var api *model.API
	res := &SaveResult{}
	switch {
	case p.API != nil:
		copied := *p.API
		api = &copied
	case strings.TrimSpace(p.Curl) != "":
		parsed, err := curlx.Parse(p.Curl)
		if err != nil {
			return nil, err
		}
		api = &model.API{
			Method:  parsed.Method,
			URL:     parsed.URL,
			Query:   parsed.Query,
			Headers: parsed.Headers,
			Body:    parsed.Body,
			Auth:    parsed.Auth,
		}
		res.Notes = append(res.Notes, parsed.Warnings...)
	default:
		return nil, fmt.Errorf("nothing to save: pass a structured API or a cURL command")
	}

	if p.ID != "" {
		api.ID = p.ID
	}
	if api.ID == "" {
		return nil, fmt.Errorf("needs an api id, for example orders/refund")
	}
	if err := model.ValidateID(api.ID); err != nil {
		return nil, err
	}
	if p.Name != "" {
		api.Name = p.Name
	}
	if api.Name == "" {
		api.Name = api.Action()
	}
	api.Normalize()

	actor := p.Actor
	if actor == "" {
		actor = o.Actor
	}

	res.API = api
	if p.AutoVar {
		if err := o.applyAutoVar(api, p.Env, res); err != nil {
			return nil, err
		}
	}
	if token, idx := curlx.DetectPlaintextToken(api.Headers); token != "" {
		res.NewToken, res.TokenIndex = token, idx
	}

	if err := o.Store.Save(api, actor); err != nil {
		return nil, err
	}
	o.emit(EventAPISaved, map[string]any{"api": api, "actor": actor})
	return res, nil
}

// applyAutoVar rewrites literal environment values into {{placeholders}}.
func (o *Ops) applyAutoVar(api *model.API, env string, res *SaveResult) error {
	envs, err := o.Store.Envs()
	if err != nil {
		return err
	}
	table := envs.Resolve(envs.EffectiveEnv(env), nil)
	replaced := map[string]bool{}
	rewrite := func(s *string) {
		r := curlx.ReplaceHardcodedValues(*s, table)
		*s = r.Value
		for _, k := range r.Replaced {
			replaced[k] = true
		}
	}
	rewrite(&api.URL)
	for i := range api.Headers {
		rewrite(&api.Headers[i].Value)
	}
	for i := range api.Query {
		rewrite(&api.Query[i].Value)
	}
	rewrite(&api.Body.Content)
	for k := range replaced {
		res.Replaced = append(res.Replaced, k)
	}
	return nil
}
