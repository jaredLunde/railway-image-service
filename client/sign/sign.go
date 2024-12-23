package sign

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/url"
	"strings"
	"time"
)

func Sign(key, secret string) string {
	key = strings.TrimPrefix(key, "/")
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(key))
	return base64.URLEncoding.EncodeToString(h.Sum(nil))
}

func SignURL(url *url.URL, secret string) (*string, error) {
	nextURI := *url
	path := nextURI.Path
	p := strings.TrimPrefix(path, "/sign")
	var signature string
	if !strings.HasPrefix(p, "/files") && !strings.HasPrefix(p, "/serve") {
		return nil, fmt.Errorf("invalid path")
	}
	if strings.HasPrefix(p, "/serve") {
		signature = Sign(strings.TrimPrefix(p, "/serve"), secret)
	}

	query := nextURI.Query()
	if strings.HasPrefix(p, "/files") {
		expireAt := time.Now().Add(time.Hour).UnixMilli()
		query := nextURI.Query()
		query.Set("x-signature", signature)
		query.Set("x-expire", fmt.Sprintf("%d", expireAt))
		nextURI.RawQuery = query.Encode()
		signature = Sign(fmt.Sprintf("%s:%d", p, expireAt), secret)
	}

	nextURI.Path = p
	query.Set("x-signature", signature)
	nextURI.RawQuery = query.Encode()
	nextFullURI := nextURI.String()
	return &nextFullURI, nil
}
