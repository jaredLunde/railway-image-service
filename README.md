# Image Processing Service for Railway

> A self-hosted alternative to services like Cloudinary, Imgix, and others.

Upload, serve, and process images on Railway. Includes on-the-fly image resizing, cropping, automatic AVIF/WebP, and more.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/MF8Rcp?referralCode=5hTSOZ)

## Features

- [x] On-the-fly image processing (resize, crop, etc.) from any allowlisted domain or Railway volume
- [x] Automatic AVIF/WebP conversion
- [x] S3-ish key/value storage (PUT, GET, DELETE), protected by an API key
- [x] Use [libvips](https://libvips.github.io/libvips/) for fast image processing
- [x] Secure image URLs with signed paths and allowlist domains

## API

### Key-value API

To access the key-value API, you must provide an `x-api-key` header with the value of the `SECRET_KEY` environment variable.
Alternatively, you can use a signed URL to access the key-value API. The `/sign/` endpoint always requires the `x-api-key` header.

| Method   | Path               | Description                                        |
| -------- | ------------------ | -------------------------------------------------- |
| `PUT`    | `/files/:key`      | Upload a file                                      |
| `GET`    | `/files/:key`      | Get a file                                         |
| `DELETE` | `/files/:key`      | Delete a file                                      |
| `GET`    | `/files`           | List files with `limit`, `starting_at` parameters. |
| `GET`    | `/sign/files/:key` | Create a signed URL for a key value operation      |

### Image processing API

| Method | Path                              | Description                                                        |
| ------ | --------------------------------- | ------------------------------------------------------------------ |
| `GET`  | `/serve/:operations?/:image`      | Process an image on the fly                                        |
| `GET`  | `/serve/meta/:operations?/:image` | Get the metadata of an image, e.g. dimensions, format, orientation |
| `GET`  | `/sign/serve/:operations?/:image` | Create a signed URL for an image processing operation              |

---

## Configuration

| Environment Variable         | Description                                                                                                                                                                         | Default           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `MAX_UPLOAD_SIZE`            | The maximum size of an uploaded file in bytes                                                                                                                                       | `10485760` (10MB) |
| `UPLOAD_PATH`                | The path to store uploaded files                                                                                                                                                    | `/data/uploads`   |
| `LEVELDB_PATH`               | The path to store the key/value store                                                                                                                                               | `/data/db`        |
| `SECRET_KEY`                 | The secret key used to for accessing the key/value API                                                                                                                              | `password`        |
| `SIGNATURE_SECRET_KEY`       | The secret key used to sign URLs                                                                                                                                                    |                   |
| `SERVE_ALLOWED_HTTP_SOURCES` | A comma-separated list of allowed URL sources for image processing, e.g. `*.foobar.com,my.foobar.com,mybucket.s3.amazonaws.com`. Set to an empty string to disable the HTTP loader. | `*`               |
| `SERVE_AUTO_WEBP`            | Automatically convert images to WebP if compatible with the requester unless another format is specified.                                                                           | `true`            |
| `SERVE_AUTO_AVIF`            | Automatically convert images to AVIF if compatible with the requester unless another format is specified.                                                                           | `true`            |
| `SERVE_CONCURRENCY`          | The max number of images to process concurrently.                                                                                                                                   | `20`              |
| `SERVE_RESULT_CACHE_TTL`     | The TTL for the image processor result cache as a Go duration.                                                                                                                      | `24h`             |
| `SERVE_CACHE_CONTROL_TTL`    | The TTL for the cache-control header as a Go duration.                                                                                                                              | `8760h` (1 year)  |
| `SERVE_CACHE_CONTROL_SWR`    | The stale-while-revalidate value for the cache-control header as a Go duration.                                                                                                     | `24h` (1 day)     |
| `ENVIRONMENT`                | The environment the server is running in. Either`production`or`development`.                                                                                                        | `production`      |

### Server configuration

| Environment Variable   | Description                                                                                 | Default |
| ---------------------- | ------------------------------------------------------------------------------------------- | ------- |
| `HOST`                 | The host the server listens on                                                              | `[::]`  |
| `PORT`                 | The port the server listens on                                                              | `3000`  |
| `REQUEST_TIMEOUT`      | The timeout for requests formatted as a Go duration                                         | `30s`   |
| `CORS_ALLOWED_ORIGINS` | A comma-separated list of allowed origins for CORS requests, e.g. `https://your-domain.com` | `*`     |
| `LOG_LEVEL`            | The log level for the server: `debug`, `info`, `warn`, and `error`.                         | `info`  |

---

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
# => http://localhost:3000/files/gopher.png?signature=...&expires=...

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
# => http://localhost:3000/files/gopher.png?signature=...&expires=...

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
# => http://localhost:3000/files/gopher.png?signature=...&expires=...

# Delete the image
curl -X DELETE "http://localhost:3000/files/gopher.png?signature=...&expires=..."
```

---

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
curl http://localhost:3000/sign/serve/300x300/files/gopher.png \
  -H "x-api-key: $API_KEY"
# => http://localhost:3000/serve/300x300/files/gopher.png?signature=...

# Process the image on the fly
curl http://localhost:3000/serve/300x300/files/gopher.png?signature=...
```

### Crop and resize an image from a URL

```bash
# Create a signed URL
curl http://localhost:3000/sign/serve/300x300/github.com/railwayapp.png \
  -H "x-api-key: $API_KEY"
# => http://localhost:3000/serve/300x300/google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png?signature=...

# Process the image on the fly
curl http://localhost:3000/serve/300x300/github.com/railwayapp.png?signature=...
```
