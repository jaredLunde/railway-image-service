import type { APIRoute } from "astro";
import {
	imageUrlBuilder,
	ImageServiceClient,
} from "railway-image-service/server";

export const prerender = false;

const client = new ImageServiceClient({
	url: import.meta.env.IMAGE_SERVICE_URL,
	secretKey: import.meta.env.IMAGE_SERVICE_SECRET_KEY,
	signatureSecretKey: import.meta.env.IMAGE_SERVICE_SIGNATURE_SECRET_KEY,
});

const builder = imageUrlBuilder(client);

const sizes: Record<string, number> = {
	xs: 16,
	sm: 24,
	md: 48,
	lg: 64,
	xl: 128,
};

export const GET: APIRoute = async ({ params }) => {
	if (!params.size || !sizes[params.size]) {
		return new Response("Missing size", { status: 400 });
	}

	let imageUrl = builder.avatar(sizes[params.size]);
	if (params.path?.startsWith("url/")) {
		imageUrl = imageUrl.url(params.path.slice(4));
	} else if (params.path?.startsWith("blob/")) {
		imageUrl = imageUrl.key(params.path.slice(5));
	} else {
		return new Response("Invalid path", { status: 400 });
	}

	return new Response(null, {
		status: 301,
		headers: {
			Location: await imageUrl,
			"Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable", // Cache the redirect for 1 year
		},
	});
};
