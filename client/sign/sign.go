package sign

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strings"
)

func Sign(key, secret string) string {
	key = strings.TrimPrefix(key, "/")
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(key))
	return base64.URLEncoding.EncodeToString(h.Sum(nil))
}
