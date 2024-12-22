package mw

import (
	"net"
	"net/http"
	"strings"

	"github.com/gofiber/fiber/v3"
)

var (
	cloudfrontViewerAddress = http.CanonicalHeaderKey("Cloudfront-Viewer-Address")
	cfConnectingIP          = http.CanonicalHeaderKey("CF-Connecting-IP")
	trueClientIP            = http.CanonicalHeaderKey("True-Client-IP")
	xForwardedFor           = http.CanonicalHeaderKey("X-Forwarded-For")
	forwarded               = http.CanonicalHeaderKey("Forwarded")
	xRealIP                 = http.CanonicalHeaderKey("X-Real-IP")
)

// RealIP is a middleware that sets a request's real IP address to fiber Locals.
// This is guaranteed to return the correct IP address if the request has passed
// through CloudFront or Cloudflare.
//
// This middleware should be inserted fairly early in the middleware stack to
// ensure that subsequent layers will be able to use the intended value.
//
// You should only use this middleware if you can trust the headers passed to
// you (in particular, the headers this middleware uses), for example
// because you have placed a reverse proxy like HAProxy or nginx in front of
// of the server.
func NewRealIP() func(fiber.Ctx) error {
	return func(c fiber.Ctx) error {
		if rip := realIP(c); rip != "" {
			c.Locals(RealIPKey, rip)
		} else {
			c.Locals(RealIPKey, c.IP())
		}
		return c.Next()
	}
}

func realIP(c fiber.Ctx) string {
	var ip string

	if cip := c.Get(cloudfrontViewerAddress); cip != "" {
		i := strings.Split(cip, ":")
		if len(i) > 1 {
			ip = strings.Join(i[:len(i)-1], ":")
		} else {
			ip = cip
		}
	} else if cfip := c.Get(cfConnectingIP); cfip != "" {
		ip = cfip
	} else if tcip := c.Get(trueClientIP); tcip != "" {
		ip = tcip
	} else if xrip := c.Get(xRealIP); xrip != "" {
		ip = xrip
	} else if xff := c.Get(xForwardedFor); xff != "" {
		i := strings.Index(xff, ",")
		if i == -1 {
			i = len(xff)
		}
		ip = xff[:i]
	} else if f := c.Get(forwarded); f != "" {
		i := strings.Split(f, ",")
		for _, v := range i {
			if strings.Contains(v, "for=") {
				ip = strings.Split(v, "for=")[1]
				break
			}
		}
	}

	if ip == "" || net.ParseIP(ip) == nil {
		return ""
	}

	return ip
}

// GetRealIP returns the real IP address stored in the context.
func GetRealIP(c fiber.Ctx) string {
	ip, ok := c.Locals(RealIPKey).(string)
	if !ok {
		return c.IP()
	}
	return ip
}

const (
	// RealIPKey is the key used to store the real IP in the context
	RealIPKey = "real_ip"
)

const (
	HealthCheckEndpoint = "/healthz"
)
