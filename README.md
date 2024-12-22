# Global Image Processing Service for [Railway](https://railway.com)

> A self-hosted alternative to services like Cloudinary, Imgix, and others.

Upload, serve, and process images globally using railway.com. Includes on-the-fly image resizing, cropping, automatic AVIF/WebP, and more.

## Features

- [x] S3-compatible image storage
- [x] On-the-fly image processing (resize, crop, etc.) from any domain, S3 bucket, Google Cloud Storage, or Railway volume
- [x] Automatic AVIF/WebP conversion
- [x] Use [libvips](https://libvips.github.io/libvips/) for fast image processing
- [x] Secure image URLs with signed paths and allowlist domains
- [x] Use it with multi-region Railway deploys for global image processing
