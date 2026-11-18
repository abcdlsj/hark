// Package history keeps an append-only execution log in a local SQLite file.
// The log is disposable: deleting history.db loses nothing but the trail.
package history

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/abcdlsj/apic/internal/core/exec"
	_ "modernc.org/sqlite"
)

// PreviewLimit caps the response snapshot stored per row.
const PreviewLimit = 64 << 10

// Log is one execution record.
type Log struct {
	ID              int64               `json:"id"`
	TS              time.Time           `json:"ts"`
	Actor           string              `json:"actor"`
	Env             string              `json:"env"`
	APIID           string              `json:"api_id"`
	Method          string              `json:"method"`
	URL             string              `json:"url"`
	Status          int                 `json:"status"`
	DurationMS      float64             `json:"duration_ms"`
	Size            int64               `json:"size"`
	Timings         exec.Timings        `json:"timings"`
	RequestHeaders  map[string][]string `json:"request_headers,omitempty"`
	ResponseHeaders map[string][]string `json:"response_headers,omitempty"`
	ResponsePreview string              `json:"response_preview,omitempty"`
	Error           string              `json:"error,omitempty"`
}

// DB is the execution log store.
type DB struct {
	sql *sql.DB
}

const schema = `
CREATE TABLE IF NOT EXISTS execution_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  actor TEXT NOT NULL,
  env TEXT NOT NULL DEFAULT '',
  api_id TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  status INTEGER NOT NULL DEFAULT 0,
  duration_ms REAL NOT NULL DEFAULT 0,
  size INTEGER NOT NULL DEFAULT 0,
  timings TEXT NOT NULL DEFAULT '{}',
  request_headers TEXT NOT NULL DEFAULT '{}',
  response_headers TEXT NOT NULL DEFAULT '{}',
  response_preview TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_execution_logs_ts ON execution_logs(ts);
`

// Open creates or opens history.db.
func Open(path string) (*DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", path+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, err
	}
	// SQLite has a single writer; keeping one connection avoids lock churn.
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return &DB{sql: db}, nil
}

// Append writes one record and returns its ID.
func (d *DB) Append(l *Log) (int64, error) {
	if l.TS.IsZero() {
		l.TS = time.Now()
	}
	preview := l.ResponsePreview
	if len(preview) > PreviewLimit {
		preview = preview[:PreviewLimit]
	}
	timings := mustJSON(l.Timings)
	reqH := mustJSON(l.RequestHeaders)
	resH := mustJSON(l.ResponseHeaders)
	res, err := d.sql.Exec(
		`INSERT INTO execution_logs
		 (ts, actor, env, api_id, method, url, status, duration_ms, size, timings, request_headers, response_headers, response_preview, error)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		l.TS.UTC().Format(time.RFC3339Nano), l.Actor, l.Env, l.APIID, l.Method, l.URL,
		l.Status, l.DurationMS, l.Size, timings, reqH, resH, preview, l.Error,
	)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	l.ID = id
	return id, nil
}

// Recent returns the newest records, newest first.
func (d *DB) Recent(limit int) ([]Log, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := d.sql.Query(
		`SELECT id, ts, actor, env, api_id, method, url, status, duration_ms, size, timings,
		        request_headers, response_headers, response_preview, error
		 FROM execution_logs ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scan(rows)
}

// Get loads one record by ID.
func (d *DB) Get(id int64) (*Log, error) {
	rows, err := d.sql.Query(
		`SELECT id, ts, actor, env, api_id, method, url, status, duration_ms, size, timings,
		        request_headers, response_headers, response_preview, error
		 FROM execution_logs WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	logs, err := scan(rows)
	if err != nil {
		return nil, err
	}
	if len(logs) == 0 {
		return nil, fmt.Errorf("no log %d", id)
	}
	return &logs[0], nil
}

// Prune keeps only the newest keep rows.
func (d *DB) Prune(keep int) error {
	if keep < 0 {
		return nil
	}
	if keep == 0 {
		_, err := d.sql.Exec(`DELETE FROM execution_logs`)
		return err
	}
	_, err := d.sql.Exec(
		`DELETE FROM execution_logs WHERE id NOT IN (SELECT id FROM execution_logs ORDER BY id DESC LIMIT ?)`, keep)
	return err
}

// LastStatuses maps api_id to the status code of its most recent execution.
func (d *DB) LastStatuses() (map[string]int, error) {
	rows, err := d.sql.Query(
		`SELECT api_id, status FROM execution_logs
		 WHERE id IN (SELECT MAX(id) FROM execution_logs GROUP BY api_id)`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var id string
		var status int
		if err := rows.Scan(&id, &status); err != nil {
			return nil, err
		}
		out[id] = status
	}
	return out, rows.Err()
}

// Close closes the database.
func (d *DB) Close() error { return d.sql.Close() }

func scan(rows *sql.Rows) ([]Log, error) {
	var out []Log
	for rows.Next() {
		var (
			l                             Log
			ts, timings, reqH, resH, prev string
			errText                       string
		)
		if err := rows.Scan(&l.ID, &ts, &l.Actor, &l.Env, &l.APIID, &l.Method, &l.URL,
			&l.Status, &l.DurationMS, &l.Size, &timings, &reqH, &resH, &prev, &errText); err != nil {
			return nil, err
		}
		l.TS, _ = time.Parse(time.RFC3339Nano, ts)
		_ = json.Unmarshal([]byte(timings), &l.Timings)
		_ = json.Unmarshal([]byte(reqH), &l.RequestHeaders)
		_ = json.Unmarshal([]byte(resH), &l.ResponseHeaders)
		l.ResponsePreview = prev
		l.Error = errText
		out = append(out, l)
	}
	return out, rows.Err()
}

func mustJSON(v any) string {
	if v == nil {
		return "{}"
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// Record converts an execution result into a log row.
func Record(res *exec.Result) *Log {
	return &Log{
		TS:              res.StartedAt,
		Actor:           res.Actor,
		Env:             res.Env,
		APIID:           res.APIID,
		Method:          res.Method,
		URL:             res.URL,
		Status:          res.Status,
		DurationMS:      res.DurationMS,
		Size:            res.Size,
		Timings:         res.Timings,
		RequestHeaders:  res.RequestHeaders,
		ResponseHeaders: res.ResponseHeader,
		ResponsePreview: res.BodyText,
		Error:           res.Error,
	}
}
