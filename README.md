# Image Processing Service for Railway

A self-hosted alternative to services like Cloudinary, Imgix, and others that helps you
move faster and pay less when you need to manage image content.

Upload, serve, and process images on Railways. Includes on-the-fly image resizing, cropping, automatic AVIF/WebP, and more.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/MF8Rcp?referralCode=5hTSOZ)

## Features

- [x] On-the-fly image processing (resize, crop, etc.) from any allowlisted domain or Railway volume
- [x] Automatic AVIF/WebP conversion
- [x] Uses [libvips](https://libvips.github.io/libvips/) for fast image processing
- [x] S3-ish blob storage (PUT, GET, DELETE) protected by an API key
- [x] Secure image serving with URLs protected by SHA256-HMAC signatures
- [x] [React components, Node.js client](js/README.md), and [Go client](client/README.md) for easy integration

## API

### Authentication

To authenticate with your `SECRET_KEY`, use the `x-api-key` header:

```sh
curl http://localhost:3000/blob/gopher.png \
  -H "x-api-key: $IMAGE_SERVICE_SECRET_KEY"
```

To authenticate with signed URLs, first create a signed URL with your `SECRET_KEY` then
use the signed URL directly. This is extremely useful for allowing users to upload directly
to your blob storage and to protect against attacks on your image processing endpoint.

To create the signed URL, prefix the URL you want to allow access to with `/sign/`.

```sh
curl http://localhost:3000/sign/blob/gopher.png \
  -H "x-api-key: $IMAGE_SERVICE_SECRET_KEY"
# -> http://localhost:3000/blob/gopher.png?x-signature=...&x-expires=...

curl http://localhost:3000/blob/gopher.png?x-signature=...&x-expires=...
```

The [Node](js/README.md) and [Go](client/README.md) clients do this for you and the signature
can be created locally if you provide the clients your `SIGNATURE_SECRET_KEY`. Again, take
extra care _not to leak_ this key. For example, keep it and the Node.js client out of your
frontend bundle.

### Blob storage API

This is an API for putting, getting, and deleting images in blob storage. You can let users
directly `PUT` objects via this API, but you should do so with signed URLs and keep your API key
absolutely secret.

| Method   | Path              | Description                                        |
| -------- | ----------------- | -------------------------------------------------- |
| `PUT`    | `/blob/:key`      | Upload a file                                      |
| `GET`    | `/blob/:key`      | Get a file                                         |
| `DELETE` | `/blob/:key`      | Delete a file                                      |
| `GET`    | `/blob`           | List files with `limit`, `starting_at` parameters. |
| `GET`    | `/sign/blob/:key` | Get a signed URL for a blob storage operation      |

### Image processing API

This is your "public" API that processes and serves images from either blob storage or the Internet.

| Method | Path                                 | Description                                                                        |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `GET`  | `/serve/:operations?/blob/:key`      | Process an image in blob storage on the fly                                        |
| `GET`  | `/serve/:operations?/url/:url`       | Process an image via HTTP on the fly                                               |
| `GET`  | `/serve/meta/:operations?/blob/:key` | Get the metadata of an image in blob storage, e.g. dimensions, format, orientation |
| `GET`  | `/serve/meta/:operations?/url/:url`  | Get the metadata of an image via HTTP, e.g. dimensions, format, orientation        |
| `GET`  | `/sign/serve/:operations?/blob/:key` | Get a signed URL of an image in blob storage for an image processing operation     |
| `GET`  | `/sign/serve/:operations?/url/:url`  | Get a signed URL of an image via HTTP for an image processing operation            |

---

## Configuration

The service can be configured by setting the environment variables below.

| Environment Variable         | Description                                                                                                                                                                         | Default           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `MAX_UPLOAD_SIZE`            | The maximum size of an uploaded file in bytes                                                                                                                                       | `10485760` (10MB) |
| `UPLOAD_PATH`                | The path to store uploaded files                                                                                                                                                    | `/data/uploads`   |
| `LEVELDB_PATH`               | The path to store the key/value database                                                                                                                                            | `/data/db`        |
| `SECRET_KEY`                 | The secret key used to for accessing the blob storage API                                                                                                                           | `password`        |
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

## Blob storage API examples

### Upload an image

```bash
curl -X PUT -T tmp/gopher.png http://localhost:3000/blob/gopher.png \
  -H "x-api-key: $API_KEY"
```

### Upload an image using a signed URL

```bash
# Create a signed URL
curl http://localhost:3000/sign/blob/gopher.png \
  -H "x-api-key: $API_KEY"
# => http://localhost:3000/blob/gopher.png?x-signature=...&x-expires==...

# Upload the image
curl -X PUT -T tmp/gopher.png "http://localhost:3000/blob/gopher.png?x-signature=...&x-expires==..."
```

### Get an image

```bash
curl http://localhost:3000/blob/gopher.png \
  -H "x-api-key: $API_KEY"
```

### Get an image using a signed URL

```bash
# Create a signed URL
curl http://localhost:3000/sign/blob/gopher.png \
  -H "x-api-key: $API_KEY"
# => http://localhost:3000/blob/gopher.png?x-signature=...&x-expires==...

# Get the image
curl "http://localhost:3000/blob/gopher.png?x-signature=...&x-expires==..."
```

### Delete an image

```bash
curl -X DELETE http://localhost:3000/blob/gopher.png \
  -H "x-api-key: $API_KEY"
```

### Delete an image using a signed URL

```bash
# Create a signed URL
curl http://localhost:3000/sign/blob/gopher.png \
  -H "x-api-key: $API_KEY"
# => http://localhost:3000/blob/gopher.png?x-signature=...&x-expires==...

# Delete the image
curl -X DELETE "http://localhost:3000/blob/gopher.png?x-signature=...&x-expires==..."
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

### Crop and resize an image from blob storage

```bash
# Create a signed URL
curl http://localhost:3000/sign/serve/300x300/blob/gopher.png \
  -H "x-api-key: $API_KEY"
# => http://localhost:3000/serve/300x300/blob/gopher.png?x-signature=...

# Process the image on the fly
curl http://localhost:3000/serve/300x300/blob/gopher.png?x-signature=...
```

### Crop and resize an image from a URL

```bash
# Create a signed URL
curl http://localhost:3000/sign/serve/300x300/url/github.com/railwayapp.png \
  -H "x-api-key: $API_KEY"
# => http://localhost:3000/serve/300x300/url/github.com/railwayapp.png?x-signature=...

# Process the image on the fly
curl http://localhost:3000/serve/300x300/url/github.com/railwayapp.png?x-signature=...
```
