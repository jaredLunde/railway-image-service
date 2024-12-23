package railwayimages

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"testing"
)

func TestNewClient(t *testing.T) {
	tests := []struct {
		name    string
		opt     Options
		wantErr bool
	}{
		{
			name:    "empty URL",
			opt:     Options{},
			wantErr: true,
		},
		{
			name: "invalid URL",
			opt: Options{
				URL: "://invalid",
			},
			wantErr: true,
		},
		{
			name: "valid URL",
			opt: Options{
				URL: "http://example.com",
			},
			wantErr: false,
		},
		{
			name: "valid URL with secret key",
			opt: Options{
				URL:       "http://example.com",
				SecretKey: "secret",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewClient(tt.opt)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewClient() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && client == nil {
				t.Error("NewClient() returned nil client without error")
			}
		})
	}
}

func TestSigningTransport(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if key := r.Header.Get("x-api-key"); subtle.ConstantTimeCompare([]byte(key), []byte("test-secret")) != 1 {
			t.Errorf("expected x-api-key header to be test-secret, got %s", key)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	transport := &SigningTransport{
		transport: http.DefaultTransport,
		SecretKey: "test-secret",
	}

	req, err := http.NewRequest("GET", server.URL, nil)
	if err != nil {
		t.Fatal(err)
	}

	_, err = transport.RoundTrip(req)
	if err != nil {
		t.Fatal(err)
	}
}

func TestClient_Sign(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET request, got %s", r.Method)
		}
		if r.URL.Path != "/sign/test.jpg" {
			t.Errorf("expected path /sign/test.jpg, got %s", r.URL.Path)
		}
		w.Write([]byte("signed-url"))
	}))
	defer server.Close()

	serverURL, _ := url.Parse(server.URL)
	client := &Client{
		URL:       serverURL,
		transport: http.DefaultTransport,
	}

	signedURL, err := client.Sign("/test.jpg")
	if err != nil {
		t.Fatal(err)
	}

	if signedURL != "signed-url" {
		t.Errorf("expected signed-url, got %s", signedURL)
	}
}

func TestClient_Get(t *testing.T) {
	expectedContent := []byte("test content")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET request, got %s", r.Method)
		}
		if r.URL.Path != "/test.jpg" {
			t.Errorf("expected path /test.jpg, got %s", r.URL.Path)
		}
		w.Write(expectedContent)
	}))
	defer server.Close()

	serverURL, _ := url.Parse(server.URL)
	client := &Client{
		URL:       serverURL,
		transport: http.DefaultTransport,
	}

	body, err := client.Get("/test.jpg")
	if err != nil {
		t.Fatal(err)
	}
	defer body.Close()

	content, err := io.ReadAll(body)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(content, expectedContent) {
		t.Errorf("expected %s, got %s", expectedContent, content)
	}
}

func TestClient_Put(t *testing.T) {
	content := []byte("test content")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			t.Errorf("expected PUT request, got %s", r.Method)
		}
		if r.URL.Path != "/test.jpg" {
			t.Errorf("expected path /test.jpg, got %s", r.URL.Path)
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(body, content) {
			t.Errorf("expected body %s, got %s", content, body)
		}
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	serverURL, _ := url.Parse(server.URL)
	client := &Client{
		URL:       serverURL,
		transport: http.DefaultTransport,
	}

	err := client.Put("/test.jpg", bytes.NewReader(content))
	if err != nil {
		t.Fatal(err)
	}
}

func TestClient_Delete(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("expected DELETE request, got %s", r.Method)
		}
		if r.URL.Path != "/test.jpg" {
			t.Errorf("expected path /test.jpg, got %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	serverURL, _ := url.Parse(server.URL)
	client := &Client{
		URL:       serverURL,
		transport: http.DefaultTransport,
	}

	err := client.Delete("/test.jpg")
	if err != nil {
		t.Fatal(err)
	}
}

func TestClient_List(t *testing.T) {
	expectedResult := &ListResult{
		Keys:     []string{"test1.jpg", "test2.jpg"},
		NextPage: "next",
		HasMore:  true,
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET request, got %s", r.Method)
		}
		if r.URL.Path != "/files" {
			t.Errorf("expected path /files, got %s", r.URL.Path)
		}

		q := r.URL.Query()
		if prefix := q.Get("prefix"); prefix != "test" {
			t.Errorf("expected prefix=test, got %s", prefix)
		}
		if limit := q.Get("limit"); limit != "10" {
			t.Errorf("expected limit=10, got %s", limit)
		}
		if start := q.Get("start"); start != "start" {
			t.Errorf("expected start=start, got %s", start)
		}
		if unlinked := q.Get("unlinked"); unlinked != "true" {
			t.Errorf("expected unlinked=true, got %s", unlinked)
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(expectedResult)
	}))
	defer server.Close()

	serverURL, _ := url.Parse(server.URL)
	client := &Client{
		URL:       serverURL,
		transport: http.DefaultTransport,
	}

	result, err := client.List("test", 10, "start", true)
	if err != nil {
		t.Fatal(err)
	}

	if !reflect.DeepEqual(result, expectedResult) {
		t.Errorf("expected %+v, got %+v", expectedResult, result)
	}
}
