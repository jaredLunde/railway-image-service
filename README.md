# Global Image Processing Service for [Railway](https://railway.com)

> A self-hosted alternative to services like Cloudinary, Imgix, and others.

Upload, serve, and process images globally using railway.com. Includes on-the-fly image resizing, cropping, automatic AVIF/WebP, and more.

## Features

- [x] On-the-fly image processing (resize, crop, etc.) from any allowlisted domain or Railway volume
- [x] Automatic AVIF/WebP conversion
- [x] S3-ish key/value storage (PUT, GET, DELETE), protected by an API key
- [x] Use [libvips](https://libvips.github.io/libvips/) for fast image processing
- [x] Secure image URLs with signed paths and allowlist domains
- [x] Use it with multi-region Railway deploys for global image processing

## TODO

- [ ] Add config for:
  - [ ] cache control
  - [ ] result storage expiration
  - [ ] allowed URL sources
  - [ ] automatic AVIF/WebP conversion
  - [ ] base URL paths
- [x] Verify API keys in the key value storage
- [x] Create signature verification w/ expiration for storage API ops
- [ ] Create demo
- [ ] Create `railway-images` npm package
  - [ ] `railway-images/node` client
  - [ ] `railway-images/react` hooks/components
- [x] Go client

## Key value API examples

### Upload an image

```bash
curl -X PUT -T tmp/gopher.png http://localhost:3000/files/gopher.png \
  -H "x-api-key: $API_KEY"
```

### Upload an image using a signed URL

```bash
# Create a signed URL
curl http://localhost:3000/sign/files/gopher.png \
  -H "x-api-key: $API_KEY"
# => {"url":"http://localhost:3000/files/gopher.png?signature=...&expires=..."}

# Upload the image
curl -X PUT -T tmp/gopher.png "http://localhost:3000/files/gopher.png?signature=...&expires=..."
```

### Get an image

```bash
curl http://localhost:3000/files/gopher.png \
  -H "x-api-key: $API_KEY"
```

### Get an image using a signed URL

```bash
# Create a signed URL
curl http://localhost:3000/sign/files/gopher.png \
  -H "x-api-key: $API_KEY"
# => {"url":"http://localhost:3000/files/gopher.png?signature=...&expires=..."}

# Get the image
curl "http://localhost:3000/files/gopher.png?signature=...&expires=..."
```

### Delete an image

```bash
curl -X DELETE http://localhost:3000/files/gopher.png \
  -H "x-api-key: $API_KEY"
```

### Delete an image using a signed URL

```bash
# Create a signed URL
curl http://localhost:3000/sign/files/gopher.png \
  -H "x-api-key: $API_KEY"
# => {"url":"http://localhost:3000/files/gopher.png?signature=...&expires=..."}

# Delete the image
curl -X DELETE "http://localhost:3000/files/gopher.png?signature=...&expires=..."
```

## Image processing API examples

The image processing API uses [thumbor](https://thumbor.readthedocs.io/en/latest/usage.html#image-endpoint) URL syntax.
The endpoint is a series of URL parts that define the processing operations to be performed on the image.

```
/HASH|unsafe/trim/AxB:CxD/fit-in/stretch/-Ex-F/GxH:IxJ/HALIGN/VALIGN/smart/filters:NAME(ARGS):NAME(ARGS):.../IMAGE
```

See the [imagor documentation](https://github.com/cshum/imagor/blob/e8b9c7c731a1ce65368f20745f5064d3f1083ac1/README.md#image-endpoint) for
a comprehensive list of examples.

### Crop and resize an uploaded image

```bash
# Create a signed URL
curl http://localhost:3000/sign/format/300x300/files/gopher.png \
  -H "x-api-key: $API_KEY"
# => {"url":"http://localhost:3000/format/300x300/files/gopher.png?signature=..."}

# Process the image on the fly
curl http://localhost:3000/format/300x300/files/gopher.png?signature=...
```

### Crop and resize an image from a URL

```bash
# Create a signed URL
curl http://localhost:3000/sign/format/300x300/github.com/railwayapp.png \
  -H "x-api-key: $API_KEY"
# => {"url":"http://localhost:3000/format/300x300/google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png?signature=..."}

# Process the image on the fly
curl http://localhost:3000/format/format/300x300/github.com/railwayapp.png?signature=...
```
