ARG VERSION=1.23.1
ARG BUILDPLATFORM=linux/amd64
ARG BUILDER=docker.io/library/golang
FROM --platform=${BUILDPLATFORM} ${BUILDER}:${VERSION} AS base

FROM base AS deps
WORKDIR /go/src/app
COPY go.mod* go.sum* ./
RUN go mod download && go mod tidy

FROM deps AS build
WORKDIR /go/src/app
ARG VIPS_VERSION=8.16.0
ARG TARGETOS=linux
ARG TARGETARCH=amd64
ENV PKG_CONFIG_PATH=/usr/local/lib/pkgconfig

RUN DEBIAN_FRONTEND=noninteractive \
  apt-get update && \
  apt-get install --no-install-recommends -y \
  ca-certificates \
  automake build-essential curl \
  meson ninja-build pkg-config \
  gobject-introspection gtk-doc-tools libglib2.0-dev libjpeg62-turbo-dev libpng-dev \
  libwebp-dev libtiff-dev libexif-dev libxml2-dev libpoppler-glib-dev \
  swig libpango1.0-dev libmatio-dev libopenslide-dev libcfitsio-dev libopenjp2-7-dev liblcms2-dev \
  libgsf-1-dev libfftw3-dev liborc-0.4-dev librsvg2-dev libimagequant-dev libaom-dev \
  libheif-dev libspng-dev libcgif-dev && \
  cd /tmp && \
  curl -fsSLO https://github.com/libvips/libvips/releases/download/v${VIPS_VERSION}/vips-${VIPS_VERSION}.tar.xz && \
  tar xf vips-${VIPS_VERSION}.tar.xz && \
  cd vips-${VIPS_VERSION} && \
  meson setup _build \
  --buildtype=release \
  --strip \
  --prefix=/usr/local \
  --libdir=lib \
  -Dgtk_doc=false \
  -Dmagick=disabled \
  -Dintrospection=disabled && \
  ninja -C _build && \
  ninja -C _build install && \
  ldconfig && \
  rm -rf /usr/local/lib/libvips-cpp.* && \
  rm -rf /usr/local/lib/*.a && \
  rm -rf /usr/local/lib/*.la

COPY . .
RUN GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -ldflags="-s -w" -o /go/bin/app ./cmd/server

FROM debian:stable-slim
WORKDIR /app
LABEL maintainer="jared.lunde@gmail.com"
COPY --from=build /usr/local/lib /usr/local/lib

RUN DEBIAN_FRONTEND=noninteractive \
  apt-get update && \
  apt-get install --no-install-recommends -y \
  ca-certificates procps libglib2.0-0 libjpeg62-turbo libpng16-16 libopenexr-3-1-30 \
  libwebp7 libwebpmux3 libwebpdemux2 libtiff6 libexif12 libxml2 libpoppler-glib8 \
  libpango1.0-0 libmatio11 libopenslide0 libopenjp2-7 libjemalloc2 \
  libgsf-1-114 libfftw3-bin liborc-0.4-0 librsvg2-2 libcfitsio10 libimagequant0 libaom3 libheif1 \
  libspng0 libcgif0 && \
  ln -s /usr/lib/$(uname -m)-linux-gnu/libjemalloc.so.2 /usr/local/lib/libjemalloc.so && \
  apt-get autoremove -y && \
  apt-get autoclean && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
RUN update-ca-certificates 2>/dev/null || true

COPY --chown=nonroot:nonroot --from=build /go/bin/app .
RUN addgroup --system nonroot && adduser --system --ingroup nonroot nonroot
RUN chown -R nonroot:nonroot /app

ENV VIPS_WARNING=0
ENV MALLOC_ARENA_MAX=2
ENV LD_PRELOAD=/usr/local/lib/libjemalloc.so

ENV PORT=8080
EXPOSE ${PORT}
USER nonroot:nonroot

ENTRYPOINT ["/app/app"]
