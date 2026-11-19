package ops

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/abcdlsj/hark/internal/core/curlx"
	"github.com/abcdlsj/hark/internal/core/exec"
	"github.com/abcdlsj/hark/internal/core/model"
)

// AdhocID is the history label for one-off cURL runs.
const AdhocID = "_adhoc"

// RunParams describes one execution. API runs an editor buffer that may not be
// saved yet; its ID is only used as the history label.
type RunParams struct {
	ID        string
	API       *model.API
	Curl      string
	Env       string
	Overrides map[string]string
	Actor     string
	Timeout   time.Duration
}

// RunOutput is a result plus the history row it produced.
type RunOutput struct {
	Result *exec.Result
	LogID  int64
}

// Run executes a saved API or a one-off cURL command and records it.
func (o *Ops) Run(ctx context.Context, p RunParams) (*RunOutput, error) {
	req := &curlx.Request{}
	apiID := p.ID

	switch {
	case p.API != nil:
		req = RequestFromAPI(p.API)
		if apiID == "" {
			apiID = AdhocID
		}
	case strings.TrimSpace(p.ID) != "":
		api, err := o.Store.Load(p.ID)
		if err != nil {
			return nil, err
		}
		req = RequestFromAPI(api)
	case strings.TrimSpace(p.Curl) != "":
		parsed, err := curlx.Parse(p.Curl)
		if err != nil {
			return nil, err
		}
		req = &parsed.Request
		if apiID == "" {
			apiID = AdhocID
		}
	default:
		return nil, fmt.Errorf("nothing to run: pass an api id or --curl")
	}

	resolver, err := o.Resolver(p.Env, p.Overrides)
	if err != nil {
		return nil, err
	}
	actor := p.Actor
	if actor == "" {
		actor = o.Actor
	}
	res, err := exec.Do(ctx, exec.Options{
		Request:  req,
		Resolver: resolver,
		Timeout:  p.Timeout,
		Actor:    actor,
		APIID:    apiID,
	})
	if err != nil {
		return nil, err
	}
	id, err := o.recordRun(res)
	if err != nil {
		return nil, err
	}
	return &RunOutput{Result: res, LogID: id}, nil
}

// RequestFromAPI converts a saved API into the wire form used by the executor.
func RequestFromAPI(api *model.API) *curlx.Request {
	return &curlx.Request{
		Method: api.Method, URL: api.URL, Query: api.Query,
		Headers: api.Headers, Body: api.Body, Auth: api.Auth,
	}
}
