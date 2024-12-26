import type { APIRoute } from "astro";
import { ImageServiceClient } from "./server";

const meta = import.meta;
let env: Record<string, string> = {};
if ("env" in meta && meta.env && typeof meta.env === "object") {
	env = meta.env as Record<string, string>;
}

export const defaultClient = new ImageServiceClient({
	url: env.IMAGE_SERVICE_URL,
	secretKey: env.IMAGE_SERVICE_SECRET_KEY,
	signatureSecretKey: env.IMAGE_SERVICE_SIGNATURE_SECRET_KEY,
});

export function create(
	client: ImageServiceClient = defaultClient,
): Record<"GET" | "PUT" | "DELETE", APIRoute> {
	return {
		async GET() {
			return new Response();
		},
		async PUT() {
			return new Response();
		},
		async DELETE() {
			return new Response();
		},
	};
}
