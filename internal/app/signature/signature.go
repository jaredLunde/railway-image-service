package signature

import (
	"net/url"

	"github.com/gofiber/fiber/v3"
	"github.com/jaredLunde/railway-images/client/sign"
)

func New(secret string) *Signature {
	return &Signature{secret}
}

type Signature struct {
	secret string
}

func (s *Signature) ServeHTTP(c fiber.Ctx) error {
	u, err := url.Parse(string(c.Request().URI().FullURI()))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("invalid request")
	}

	uri, err := sign.SignURL(u, s.secret)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("invalid request")
	}
	return c.SendString(*uri)
}
