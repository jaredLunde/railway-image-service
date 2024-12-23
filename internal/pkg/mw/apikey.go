package mw

import (
	"crypto/subtle"

	"github.com/gofiber/fiber/v3"
)

func NewVerifyAPIKey(secretKey string) func(c fiber.Ctx) error {
	return func(c fiber.Ctx) error {
		apiKey := c.Get("x-api-key")
		if subtle.ConstantTimeCompare([]byte(apiKey), []byte(secretKey)) != 1 {
			return c.Status(fiber.StatusUnauthorized).SendString("unauthorized")
		}
		return c.Next()
	}
}
