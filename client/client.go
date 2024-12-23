package railwayimages

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

type Options struct {
	URL       string
	SecretKey string
}

func NewClient(opt Options) (*Client, error) {
	if opt.URL == "" {
		return nil, fmt.Errorf("URL is required")
	}

	u, err := url.Parse(opt.URL)
	if err != nil {
		return nil, err
	}

	transport := http.DefaultTransport
	if opt.SecretKey != "" {
		transport = &SigningTransport{transport: transport, SecretKey: opt.SecretKey}
	}

	return &Client{
		URL: u,
	}, nil
}

type SigningTransport struct {
	URL       *url.URL
	transport http.RoundTripper
	SecretKey string
}

func (t *SigningTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Set("x-api-key", t.SecretKey)
	return t.transport.RoundTrip(req)
}

type Client struct {
	URL       *url.URL
	transport http.RoundTripper
}

func (c *Client) Sign(path string) (string, error) {
	u := *c.URL
	signPath, err := url.JoinPath("/sign", path)
	if err != nil {
		return "", err
	}

	u.Path = signPath
	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return "", err
	}
	res, err := c.transport.RoundTrip(req)
	if err != nil {
		return "", err
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}

func (c *Client) Get(key string) (io.ReadCloser, error) {
	u := *c.URL
	u.Path = key
	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}

	res, err := c.transport.RoundTrip(req)
	if err != nil {
		return nil, err
	}

	return res.Body, nil
}

func (c *Client) Put(key string, r io.Reader) error {
	u := *c.URL
	u.Path = key
	req, err := http.NewRequest(http.MethodPut, u.String(), r)
	if err != nil {
		return err
	}

	res, err := c.transport.RoundTrip(req)
	if err != nil {
		return err
	}

	if res.StatusCode != http.StatusCreated {
		return fmt.Errorf("unexpected status code: %d", res.StatusCode)
	}

	return nil
}

func (c *Client) Delete(key string) error {
	u := *c.URL
	u.Path = key
	req, err := http.NewRequest(http.MethodDelete, u.String(), nil)
	if err != nil {
		return err
	}

	res, err := c.transport.RoundTrip(req)
	if err != nil {
		return err
	}

	if res.StatusCode != http.StatusNoContent {
		return fmt.Errorf("unexpected status code: %d", res.StatusCode)
	}

	return nil
}

type ListResult struct {
	Keys     []string `json:"keys"`
	NextPage string   `json:"next_page,omitempty"`
	HasMore  bool     `json:"has_more"`
}

func (c *Client) List(prefix string, limit int, start string, unlinked bool) (*ListResult, error) {
	u := *c.URL
	u.Path = "/files"
	q := u.Query()
	q.Set("prefix", prefix)
	if limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", limit))
	}
	if start != "" {
		q.Set("start", start)
	}
	if unlinked {
		q.Set("unlinked", "true")
	}
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}

	res, err := c.transport.RoundTrip(req)
	if err != nil {
		return nil, err
	}

	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", res.StatusCode)
	}

	var result ListResult
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}
