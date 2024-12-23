package signature

import (
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/jaredLunde/railway-images/client/sign"
	"github.com/valyala/fasthttp"
)

func New(secret string) *Signature {
	return &Signature{secret}
}

type Signature struct {
	secret string
}

func (s *Signature) ServeHTTP(c fiber.Ctx) error {
	nextURI := fasthttp.AcquireURI()
	c.Request().URI().CopyTo(nextURI)
	path := string(nextURI.Path())
	p := strings.TrimPrefix(path, "/sign")
	var signature string
	if !strings.HasPrefix(p, "/files") && !strings.HasPrefix(p, "/format") {
		return c.Status(fiber.StatusBadRequest).SendString("invalid request")
	}
	if strings.HasPrefix(p, "/format") {
		signature = sign.Sign(strings.TrimPrefix(p, "/format"), s.secret)
	}
	if strings.HasPrefix(p, "/files") {
		expireAt := time.Now().Add(time.Hour).UnixMilli()
		nextURI.QueryArgs().Set("x-expire", fmt.Sprintf("%d", expireAt))
		signature = sign.Sign(fmt.Sprintf("%s:%d", p, expireAt), s.secret)

	}
	nextURI.SetPath(p)
	nextURI.QueryArgs().Set("x-signature", signature)
	return c.Send(nextURI.FullURI())
}
