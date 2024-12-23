# Global Image Processing Service for [Railway](https://railway.com)

> A self-hosted alternative to services like Cloudinary, Imgix, and others.

Upload, serve, and process images globally using railway.com. Includes on-the-fly image resizing, cropping, automatic AVIF/WebP, and more.

## Features

- [x] On-the-fly image processing (resize, crop, etc.) from any domain, S3 bucket, Google Cloud Storage, or Railway volume
- [x] Automatic AVIF/WebP conversion
- [x] S3-ish image storage (PUT, GET, DELETE)
- [x] Use [libvips](https://libvips.github.io/libvips/) for fast image processing
- [x] Secure image URLs with signed paths and allowlist domains
- [x] Use it with multi-region Railway deploys for global image processing

## TODO

- [ ] Add config for:
  - [ ] cache control
  - [ ] result storage expiration
  - [ ] allowed URL sources
  - [ ] S3/GCS loaders
  - [ ] automatic AVIF/WebP conversion
  - [ ] base URL paths
- [ ] Verify signed URLs in the key value storage
- [ ] Create demo
- [ ] Create `railway-images` npm package
  - [ ] `railway-images/node` client
  - [ ] `railway-images/react` hooks/components
- [ ] Go client
