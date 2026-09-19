package main

import (
	"context"
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type httpDoer interface {
	Do(*http.Request) (*http.Response, error)
}

type retryPolicy struct {
	Attempts int
	BaseWait time.Duration
	MaxWait  time.Duration
}

func retryableGETStatus(code int) bool {
	return code == http.StatusTooManyRequests || code == http.StatusBadGateway || code == http.StatusServiceUnavailable || code == http.StatusGatewayTimeout
}

func retryableNetworkError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	var ne net.Error
	return errors.As(err, &ne)
}

func retryDelay(resp *http.Response, attempt int, p retryPolicy) time.Duration {
	if resp != nil {
		if raw := strings.TrimSpace(resp.Header.Get("Retry-After")); raw != "" {
			if sec, err := strconv.Atoi(raw); err == nil && sec >= 0 {
				d := time.Duration(sec) * time.Second
				if p.MaxWait > 0 && d > p.MaxWait {
					return p.MaxWait
				}
				return d
			}
		}
	}
	d := p.BaseWait
	if d <= 0 {
		d = 150 * time.Millisecond
	}
	for i := 0; i < attempt; i++ {
		d *= 2
	}
	if p.MaxWait > 0 && d > p.MaxWait {
		d = p.MaxWait
	}
	return d
}

func waitForRetry(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}
