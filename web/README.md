# Railway Image Service demo

This is a demo of the Railway Image Service. It's a simple service that allows you to upload images and view them in a gallery.

## Where to look

- [src/pages/\[size\]/\[...path\].ts](src/pages/%5Bsize%5D/%5B...path%5D.ts) - An endpoint that resizes images on the fly
- [src/pages/upload/\[...path\].ts](src/pages/upload/%5B...path%5D.ts) - An endpoint that allows users to upload images with signed URLs
- [src/components/Uploader.tsx](src/components/Uploader.tsx) - A React component that allows users to upload images
- [src/pages/index.astro](src/pages/index.astro) - The gallery page which demonstrates generating image URLs with the image URL builder in an Astro component
