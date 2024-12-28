import { describe, it, expect, beforeEach, vi } from "vitest";
import { ImageServiceClient, imageUrlBuilder, sign, signUrl } from "./server";

describe("sign", () => {
	it("signs a key with secret", () => {
		const signature = sign("test.jpg", "secret");
		// Base64-encoded HMAC-SHA256 of "test.jpg" with key "secret"
		expect(signature).toBe("HqclqWcEibRp4SvI22S61tngoLJlpGfHgdyYjOaQ770");
	});

	it("trims leading slash", () => {
		const withSlash = sign("/test.jpg", "secret");
		const withoutSlash = sign("test.jpg", "secret");
		expect(withSlash).toBe(withoutSlash);
	});
});

describe("signUrl", () => {
	it("signs serve URL", () => {
		const url = new URL("http://example.com/serve/test.jpg");
		const signed = signUrl(url, "secret");
		const parsed = new URL(signed);
		expect(parsed.pathname).toBe("/serve/test.jpg");
		expect(parsed.searchParams.get("x-signature")).toBeTruthy();
	});

	it("signs files URL with expiration", () => {
		const url = new URL("http://example.com/blob/test.jpg");
		const signed = signUrl(url, "secret");
		const parsed = new URL(signed);
		expect(parsed.pathname).toBe("/blob/test.jpg");
		expect(parsed.searchParams.get("x-signature")).toBeTruthy();
		expect(parsed.searchParams.get("x-expire")).toBeTruthy();
	});

	it("throws on invalid path", () => {
		const url = new URL("http://example.com/invalid/test.jpg");
		expect(() => signUrl(url, "secret")).toThrow("invalid path");
	});
});

describe("ImageServiceClient", () => {
	it("constructor validates URL", () => {
		expect(() => new ImageServiceClient({ url: "", secretKey: "key" })).toThrow(
			"URL is required",
		);
	});

	it("signs URLs locally when signatureSecretKey provided", async () => {
		const client = new ImageServiceClient({
			url: "http://example.com",
			secretKey: "key",
			signatureSecretKey: "signing-key",
		});

		const signed = await client.sign("/blob/test.jpg");
		expect(signed).toContain("x-signature=");
	});

	it("uses server signing when no signatureSecretKey", async () => {
		const client = new ImageServiceClient({
			url: "http://example.com",
			secretKey: "key",
		});

		// Mock fetch
		global.fetch = vi
			.fn()
			.mockImplementation((url: string, init?: RequestInit) => {
				expect(url).toContain("/sign/");
				// @ts-expect-error
				expect(init?.headers?.["x-api-key"]).toBe("key");
				return Promise.resolve(new Response("signed-url"));
			});

		const signed = await client.sign("test.jpg");
		expect(signed).toBe("signed-url");
	});

	it("list constructs correct query params", async () => {
		const client = new ImageServiceClient({
			url: "http://example.com",
			secretKey: "key",
		});

		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url);
			expect(parsed.searchParams.get("limit")).toBe("10");
			expect(parsed.searchParams.get("starting_at")).toBe("start");
			expect(parsed.searchParams.get("unlinked")).toBe("true");
			return Promise.resolve(
				new Response(
					JSON.stringify({
						keys: ["test.jpg"],
						hasMore: false,
					}),
				),
			);
		});

		const result = await client.list({
			limit: 10,
			startingAt: "start",
			unlinked: true,
		});

		expect(result.keys).toEqual(["test.jpg"]);
		expect(result.hasMore).toBe(false);
	});
});

describe("ImageUrlBuilder", () => {
	let mockClient: ImageServiceClient;

	beforeEach(() => {
		mockClient = {
			sign: vi
				.fn()
				.mockImplementation((path) => Promise.resolve(`/signed/${path}`)),
		} as any;
	});

	it("should build basic image URL with key", async () => {
		const url = await imageUrlBuilder(mockClient).key("test-image.jpg");

		expect(url).toBe("/signed/blob/test-image.jpg");
	});

	it("should build basic image URL with external URL", async () => {
		const url = await imageUrlBuilder(mockClient).url(
			"https://example.com/image.jpg",
		);

		expect(url).toBe("/signed/url/https%3A%2F%2Fexample.com%2Fimage.jpg");
	});

	it("should handle resize operations", async () => {
		const url = await imageUrlBuilder(mockClient)
			.key("test.jpg")
			.size(300, 200);

		expect(url).toBe("/signed/300x200/blob/test.jpg");
	});

	it("should handle fit modes", async () => {
		const url = await imageUrlBuilder(mockClient)
			.key("test.jpg")
			.size(300, 200)
			.fit("contain");

		expect(url).toBe("/signed/fit-in/300x200/center/middle/blob/test.jpg");
	});

	it("should handle complex transformations", async () => {
		const url = await imageUrlBuilder(mockClient)
			.key("test.jpg")
			.size(300, 200)
			.fit("contain")
			.trim()
			.smart(true)
			.align("left", "top");

		expect(url).toBe(
			"/signed/trim/fit-in/300x200/left/top/smart/blob/test.jpg",
		);
	});

	it("should handle crop operations", async () => {
		const url = await imageUrlBuilder(mockClient)
			.key("test.jpg")
			.crop(10, 20, 100, 100);

		expect(url).toBe("/signed/10x20:110x120/blob/test.jpg");
	});

	it("should handle percentage-based crop operations", async () => {
		const url = await imageUrlBuilder(mockClient)
			.key("test.jpg")
			.crop("10%", "20%", "50%", "30%");

		expect(url).toBe("/signed/10%x20%:60%x50%/blob/test.jpg");
	});

	it("should handle mixed percentage and pixel crop operations for x coordinates", async () => {
		const url = await imageUrlBuilder(mockClient)
			.key("test.jpg")
			.crop("10%", 20, "50%", 100);

		expect(url).toBe("/signed/10%x20:60%x120/blob/test.jpg");
	});

	it("should handle mixed percentage and pixel crop operations for y coordinates", async () => {
		const url = await imageUrlBuilder(mockClient)
			.key("test.jpg")
			.crop(10, "20%", 100, "30%");

		expect(url).toBe("/signed/10x20%:110x50%/blob/test.jpg");
	});

	it("should handle percentage in width only", async () => {
		const url = await imageUrlBuilder(mockClient)
			.key("test.jpg")
			.crop(10, 20, "50%", 100);

		expect(url).toBe("/signed/10x20:60%x120/blob/test.jpg");
	});

	it("should handle percentage in height only", async () => {
		const url = await imageUrlBuilder(mockClient)
			.key("test.jpg")
			.crop(10, 20, 100, "30%");

		expect(url).toBe("/signed/10x20:110x50%/blob/test.jpg");
	});

	it("should handle mixed pixel and percentage crop operations", async () => {
		const url = await imageUrlBuilder(mockClient)
			.key("test.jpg")
			.crop("10%", 20, "50%", 100);

		expect(url).toBe("/signed/10%x20:60%x120/blob/test.jpg");
	});

	it("should handle flip operations", async () => {
		const url = await imageUrlBuilder(mockClient)
			.key("test.jpg")
			.size(300, 200)
			.flip("both");

		expect(url).toBe("/signed/-300x-200/blob/test.jpg");
	});

	it("should handle padding operations", async () => {
		const url = await imageUrlBuilder(mockClient)
			.key("test.jpg")
			.padding(10, 20, 30, 40);

		expect(url).toBe("/signed/10x20:30x40/center/middle/blob/test.jpg");
	});

	it("should handle filters", async () => {
		const url = await imageUrlBuilder(mockClient)
			.key("test.jpg")
			.filter({
				quality: 80,
				brightness: 10,
				contrast: 20,
				rgb: [100, -50, 25],
				round_corner: { rx: 10, ry: 10, color: "fff" },
			});

		expect(url).toBe(
			"/signed/filters:quality(80):brightness(10):contrast(20):rgb(100,-50,25):round_corner(10,10,fff)/blob/test.jpg",
		);
	});

	it("should throw error when no image source is specified", async () => {
		await expect(imageUrlBuilder(mockClient).build()).rejects.toThrow(
			"Image source (key or url) must be specified",
		);
	});

	it("should handle promise-like behavior", async () => {
		const builder = imageUrlBuilder(mockClient).key("test.jpg");
		const url = await builder;

		expect(url).toBe("/signed/blob/test.jpg");
	});

	it("should handle error cases with promise methods", async () => {
		mockClient.sign = vi.fn().mockRejectedValue(new Error("Signing failed"));

		const builder = imageUrlBuilder(mockClient).key("test.jpg");
		await expect(builder).rejects.toThrow("Signing failed");
	});

	it("should handle special characters in URLs", async () => {
		const url = await imageUrlBuilder(mockClient).url(
			"https://example.com/image with spaces.jpg?param=value",
		);

		expect(url).toBe(
			"/signed/url/https%3A%2F%2Fexample.com%2Fimage%20with%20spaces.jpg%3Fparam%3Dvalue",
		);
	});
});
