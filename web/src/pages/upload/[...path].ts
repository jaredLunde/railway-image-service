import type { APIRoute } from "astro";
import { imageUrlBuilder } from "railway-image-service/server";
import { ImageServiceClient } from "railway-image-service/server";

export const prerender = false;

const client = new ImageServiceClient({
  url: import.meta.env.IMAGE_SERVICE_URL,
  secretKey: import.meta.env.IMAGE_SERVICE_SECRET_KEY,
  signatureSecretKey: import.meta.env.IMAGE_SERVICE_SIGNATURE_SECRET_KEY,
});

export const PUT: APIRoute = async ({ params }) => {
  if (!params.path) {
    return new Response("Missing path", { status: 400 });
  }

  return new Response(null, {
    status: 301,
    headers: {
      Method: "PUT",
      Location: await client.sign(`blob/${params.path}`),
      "Cache-Control": "private, max-age=0, s-maxage=0", // Never cache these because they have expiring URLs
    },
  });
};
