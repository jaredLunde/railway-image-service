package mw

import (
	"crypto/subtle"
	"fmt"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/jaredLunde/railway-images/client/sign"
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

func NewVerifyAccess(secretKey, signSecret string) func(c fiber.Ctx) error {
	return func(c fiber.Ctx) error {
		apiKey := c.Get("x-api-key")
		hasValidAPIKey := subtle.ConstantTimeCompare([]byte(apiKey), []byte(secretKey)) == 1
		signature := c.Query("x-signature")
		expireAt := c.Query("x-expire")
		hasValidSignature := false
		if signature != "" && expireAt != "" {
			expireAtMillis, err := strconv.ParseInt(expireAt, 10, 64)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).SendString("invalid expire time")
			}
			if time.Now().UnixMilli() > expireAtMillis {
				return c.Status(fiber.StatusUnauthorized).SendString("signature expired")
			}
			signatureB := sign.Sign(fmt.Sprintf("%s:%s", c.Path(), expireAt), signSecret)
			hasValidSignature = subtle.ConstantTimeCompare([]byte(signature), []byte(signatureB)) == 1
		}
		if !hasValidAPIKey && !hasValidSignature {
			return c.Status(fiber.StatusUnauthorized).SendString("unauthorized")
		}
		return c.Next()
	}
}
