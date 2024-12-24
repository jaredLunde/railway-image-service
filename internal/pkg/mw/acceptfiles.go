package mw

import (
	"bytes"
	"io"
	"strings"

	"github.com/gabriel-vasile/mimetype"
	"github.com/gofiber/fiber/v3"
)

func NewAcceptFiles(allowedMimeTypes ...string) fiber.Handler {
	return func(c fiber.Ctx) error {
		body := c.Request().BodyStream()
		if body == nil {
			return c.SendStatus(fiber.StatusBadRequest)
		}

		// Create a buffer to peek at the start of the stream
		buffer := make([]byte, 512)
		n, err := body.Read(buffer)
		if err != nil && err != io.EOF {
			return c.SendStatus(fiber.StatusBadRequest)
		}

		// Create a new MultiReader combining the peeked data with the rest of the stream
		combined := io.MultiReader(
			bytes.NewReader(buffer[:n]),
			body,
		)

		// Set the combined reader as the new body stream
		c.Request().SetBodyStream(combined, c.Request().Header.ContentLength())

		mtype := mimetype.Detect(buffer[:n])
		for _, allowed := range allowedMimeTypes {
			if strings.HasPrefix(mtype.String(), allowed) {
				return c.Next()
			}
		}

		return c.SendStatus(fiber.StatusUnsupportedMediaType)
	}
}
