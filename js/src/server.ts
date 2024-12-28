import { URL } from "node:url";
import { createHmac } from "node:crypto";

export type ClientOptions = {
	/** The URL of your service */
	url: string;
	/** Your service API key */
	secretKey: string;
	/** If provided, URLs will be signed locally instead of via server */
	signatureSecretKey?: string;
};

export class ImageServiceClient {
	baseURL: URL;
	secretKey: string;
	signatureSecretKey?: string;

	constructor(options: ClientOptions) {
		if (!options.url) {
			throw new Error("URL is required");
		}
		this.baseURL = new URL(options.url);
		this.secretKey = options.secretKey;
		this.signatureSecretKey = options.signatureSecretKey;
	}

	private async fetch(path: string, init?: RequestInit) {
		const url = new URL(path, this.baseURL);
		const headers: HeadersInit = {
			...init?.headers,
			"x-api-key": this.secretKey,
		};

		return fetch(url.toString(), { ...init, headers });
	}

	/**
	 * Get a signed URL for a path.
	 * @param path - The path to get a signed URL for
	 */
	async sign(path: string): Promise<string> {
		if (this.signatureSecretKey) {
			const url = new URL(path, this.baseURL);
			return signUrl(url, this.signatureSecretKey);
		}

		const response = await this.fetch(`/sign/${path}`);
		return response.text();
	}

	/**
	 * Get a file from blob storage.
	 * @param key - The key to get from blob storage
	 */
	async get(key: string): Promise<Response> {
		const response = await this.fetch(`/blob/${key}`);
		if (response.status !== 200) {
			throw new Error(`${response.status}: ${response.statusText}`);
		}
		return response;
	}

	/**
	 * Put a file into blob storage.
	 * @param key - The key to use in blob storage.
	 * @param content - The content of the file.
	 */
	async put(
		key: string,
		content: ReadableStream | Buffer | ArrayBuffer,
	): Promise<Response> {
		return this.fetch(`/blob/${key}`, {
			method: "PUT",
			body: content,
		});
	}

	/**
	 * Delete a file in blob storage.
	 * @param key - The key to delete in blob storage.
	 */
	async delete(key: string): Promise<Response> {
		return this.fetch(`/blob/${key}`, { method: "DELETE" });
	}

	/**
	 * List keys in blob storage.
	 * @param options - List options
	 */
	async list(options: ListOptions = {}): Promise<ListResult> {
		const params = new URLSearchParams();

		if (options.limit) {
			params.set("limit", options.limit.toString());
		}
		if (options.prefix) {
			params.set("prefix", options.prefix);
		}
		if (options.startingAt) {
			params.set("starting_at", options.startingAt);
		}
		if (options.unlinked) {
			params.set("unlinked", "true");
		}

		const response = await this.fetch(`/blob?${params.toString()}`);
		return response.json();
	}
}

export type ListOptions = {
	/** The maximum number of keys to return */
	limit?: number;
	/** A prefix to filter keys by */
	prefix?: string;
	/** The key to start listing from */
	startingAt?: string;
	/** If true, list unlinked (soft deleted) files */
	unlinked?: boolean;
};

export type ListResult = {
	/** The keys of the files */
	keys: string[];
	/** A URL to the next page of results */
	nextPage?: string;
	/** Whether or not there are more results */
	hasMore: boolean;
};

export function sign(key: string, secret: string): string {
	key = key.replace(/^\//, ""); // TrimPrefix equivalent
	const hmac = createHmac("sha256", secret);
	hmac.update(key);
	return hmac.digest("base64url"); // base64url is the URL-safe version
}

export function signUrl(url: URL, secret: string): string {
	const nextURI = new URL(url.toString());
	const path = nextURI.pathname;
	const p = decodeURIComponent(path.replace(/^\/sign/, ""));
	if (!p.startsWith("/blob") && !p.startsWith("/serve")) {
		throw new Error("invalid path");
	}

	let signature = "";
	const query = new URLSearchParams(nextURI.search);

	if (p.startsWith("/serve")) {
		signature = sign(p.replace(/^\/serve/, ""), secret);
	}

	if (p.startsWith("/blob")) {
		const expireAt = Date.now() + 60 * 60 * 1000; // 1 hour in milliseconds
		query.set("x-expire", expireAt.toString());
		nextURI.search = query.toString();
		signature = sign(`${p}:${expireAt}`, secret);
	}

	nextURI.pathname = p;
	query.set("x-signature", signature);
	nextURI.search = query.toString();
	return nextURI.toString();
}

/**
 * A builder class for generating image processing URLs using the thumbor syntax.
 * Enables chaining of image transformations and filters for dynamic image manipulation.
 */
class ImageUrlBuilder {
	private client: ImageServiceClient;
	private imageSource?:
		| { type: "key"; value: string }
		| { type: "url"; value: string };
	private dimensions?: { width?: number; height?: number };
	private fitMode?: ImageFit;
	private transforms: {
		flip?: "horizontal" | "vertical" | "both";
		crop?: {
			x: number | string;
			y: number | string;
			width: number | string;
			height: number | string;
		};
		padding?: {
			left: number;
			top: number;
			right: number;
			bottom: number;
		};
		trim?: boolean;
		smart?: boolean;
		align?: {
			horizontal?: "left" | "center" | "right";
			vertical?: "top" | "middle" | "bottom";
		};
	} = {};
	private imageFilters: Partial<ImageFilters> = {};

	constructor(client: ImageServiceClient) {
		this.client = client;
	}

	/**
	 * Sets the image source using a storage key.
	 * @param blobKey - The storage key identifying the image
	 * @returns The builder instance for chaining
	 */
	key(blobKey: string): this {
		this.imageSource = { type: "key", value: blobKey };
		return this;
	}

	/**
	 * Sets the image source using a URL.
	 * @param value - The URL of the source image
	 * @returns The builder instance for chaining
	 */
	url(httpUrl: string): this {
		this.imageSource = { type: "url", value: httpUrl };
		return this;
	}

	/**
	 * Sets the target width of the output image.
	 * @param value - Width in pixels
	 * @returns The builder instance for chaining
	 */
	width(value: number): this {
		this.dimensions = { ...this.dimensions, width: value };
		return this;
	}

	/**
	 * Sets the target height of the output image.
	 * @param value - Height in pixels
	 * @returns The builder instance for chaining
	 */
	height(value: number): this {
		this.dimensions = { ...this.dimensions, height: value };
		return this;
	}

	/**
	 * Sets both width and height of the output image.
	 * @param width - Width in pixels
	 * @param height - Height in pixels
	 * @returns The builder instance for chaining
	 */
	size(width: number, height?: number): this {
		this.dimensions = { width, height: height ?? width };
		return this;
	}

	/**
	 * Sets the fit mode for image resizing.
	 * - 'cover': Scales to fill the entire box, cropping if necessary
	 * - 'contain': Scales to fit within the box while maintaining aspect ratio
	 * - 'stretch': Stretches or compresses to exactly fill the box
	 * - 'contain-stretch': Combines contain and stretch modes
	 * @param value - The fit mode to use
	 * @returns The builder instance for chaining
	 */
	fit(value: ImageFit): this {
		this.fitMode = value;
		return this;
	}

	/**
	 * Flips the image horizontally, vertically, or both.
	 * @param direction - The direction to flip the image
	 * @returns The builder instance for chaining
	 */
	flip(direction: "horizontal" | "vertical" | "both"): this {
		this.transforms.flip = direction;
		return this;
	}

	/**
	 * Crops the image to a specified region.
	 * @param x - Left coordinate (pixels or percentage with '%')
	 * @param y - Top coordinate (pixels or percentage with '%')
	 * @param width - Width of crop (pixels or percentage with '%')
	 * @param height - Height of crop (pixels or percentage with '%')
	 * @returns The builder instance for chaining
	 */
	crop(
		x: number | string,
		y: number | string,
		width: number | string,
		height: number | string,
	): this {
		this.transforms.crop = { x, y, width, height };
		return this;
	}

	/**
	 * Adds padding around the image.
	 * @param left - Left padding in pixels
	 * @param top - Top padding in pixels
	 * @param right - Right padding in pixels
	 * @param bottom - Bottom padding in pixels
	 * @returns The builder instance for chaining
	 */
	padding(left: number, top: number, right: number, bottom: number): this {
		this.transforms.padding = { left, top, right, bottom };
		return this;
	}

	/**
	 * Enables trim mode to remove surrounding space.
	 * Uses the top-left pixel color as reference.
	 * @param enable - Whether to enable trim mode
	 * @returns The builder instance for chaining
	 */
	trim(enable = true): this {
		this.transforms.trim = enable;
		return this;
	}

	/**
	 * Enables smart detection of focal points for cropping.
	 * @param enable - Whether to enable smart detection
	 * @returns The builder instance for chaining
	 */
	smart(enable = true): this {
		this.transforms.smart = enable;
		return this;
	}

	/**
	 * Sets the alignment for cropping and fitting operations.
	 * @param horizontal - Horizontal alignment ('left', 'center', 'right')
	 * @param vertical - Vertical alignment ('top', 'middle', 'bottom')
	 * @returns The builder instance for chaining
	 */
	align(
		horizontal?: "left" | "center" | "right",
		vertical?: "top" | "middle" | "bottom",
	): this {
		this.transforms.align = { horizontal, vertical };
		return this;
	}

	/**
	 * Applies image filters like blur, brightness, contrast, etc.
	 * @param filters - Object containing filter settings
	 * @returns The builder instance for chaining
	 */
	filter(filters: Partial<ImageFilters>): this {
		this.imageFilters = { ...this.imageFilters, ...filters };
		return this;
	}

	/**
	 * Applies image filters to optimize for avatars.
	 * @param size - The target size of the avatar
	 * @param filters - Additional filter settings
	 * @returns The builder instance for chaining
	 */
	avatar(size: number, filters?: Partial<ImageFilters>): this {
		return this.fit("cover")
			.size(size)
			.smart()
			.filter({
				upscale: true,
				quality: 80,
				strip_exif: true,
				strip_metadata: true,
				strip_icc: true,
				...filters,
			});
	}

	/**
	 * Builds the filter string portion of the URL.
	 * Converts the filter settings into the appropriate URL format.
	 * @private
	 * @returns The formatted filter string
	 */
	private buildFilterString(): string {
		const parts: string[] = [];

		for (const [key, value] of Object.entries(this.imageFilters)) {
			if (value === undefined) continue;

			switch (key) {
				case "round_corner": {
					const corner = value as ImageFilters["round_corner"];
					if (!corner) break;
					parts.push(
						`round_corner(${[corner.rx, corner.ry, corner.color]
							.filter(Boolean)
							.join(",")})`,
					);
					break;
				}

				case "rgb": {
					const [r, g, b] = value as [number, number, number];
					parts.push(`rgb(${r},${g},${b})`);
					break;
				}

				case "focal":
					parts.push(`focal(${value})`);
					break;

				default:
					if (value === true) {
						parts.push(`${key}()`);
					} else {
						parts.push(`${key}(${value})`);
					}
			}
		}

		return parts.join(":");
	}

	/**
	 * Helper function to add two values that may be numbers or percentage strings.
	 * @private
	 * @param a - First value
	 * @param b - Second value
	 * @returns The sum, maintaining percentage notation if applicable
	 */
	private add(a: number | string, b: number | string): number | string {
		if (typeof a === "number" && typeof b === "number") {
			return a + b;
		}
		const aStr = String(a);
		const bStr = String(b);
		const aIsPercent = aStr.includes("%");
		const bIsPercent = bStr.includes("%");

		const aVal = Number(aStr.replace("%", ""));
		const bVal = Number(bStr.replace("%", ""));

		if (aIsPercent && !bIsPercent) {
			return `${aVal + bVal}%`;
		} else if (!aIsPercent && bIsPercent) {
			return `${aVal + bVal}%`;
		} else if (aIsPercent && bIsPercent) {
			return `${aVal + bVal}%`;
		}
		return aVal + bVal;
	}

	/**
	 * Builds the complete URL path for the image transformation.
	 * @private
	 * @returns The formatted URL path
	 * @throws Error if no image source is specified
	 */
	private buildPath(): string {
		const segments: string[] = ["serve"];

		// Add transformations
		if (
			Object.keys(this.transforms).length > 0 ||
			this.dimensions?.width ||
			this.dimensions?.height
		) {
			if (this.transforms.trim) {
				segments.push("trim");
			}

			// Add crop coordinates
			if (this.transforms.crop) {
				const { x, y, width, height } = this.transforms.crop;
				segments.push(`${x}x${y}:${this.add(x, width)}x${this.add(y, height)}`);
			}

			// Add fit mode
			if (this.fitMode === "contain" || this.fitMode === "contain-stretch") {
				segments.push("fit-in");
			}
			if (this.fitMode === "stretch" || this.fitMode === "contain-stretch") {
				segments.push("stretch");
			}

			// Add dimensions
			if (this.dimensions?.width || this.dimensions?.height) {
				const w = this.dimensions.width
					? `${this.transforms.flip === "horizontal" || this.transforms.flip === "both" ? "-" : ""}${
							this.dimensions.width ?? 0
						}`
					: this.dimensions.width ?? 0;
				const h = this.dimensions.height
					? `${this.transforms.flip === "vertical" || this.transforms.flip === "both" ? "-" : ""}${
							this.dimensions.height ?? 0
						}`
					: this.dimensions.height ?? 0;
				segments.push(`${w}x${h}`);
			}

			// Add padding
			if (this.transforms.padding) {
				const { left, top, right, bottom } = this.transforms.padding;
				segments.push(`${left}x${top}:${right}x${bottom}`);
			}

			// Add alignment only for specific transforms
			const needsAlignment =
				this.fitMode === "contain" ||
				this.transforms.trim ||
				this.transforms.padding ||
				this.transforms.smart;

			if (needsAlignment) {
				segments.push(this.transforms.align?.horizontal || "center");
				segments.push(this.transforms.align?.vertical || "middle");
			}

			if (this.transforms.smart) {
				segments.push("smart");
			}
		}

		// Add filters
		if (Object.keys(this.imageFilters).length > 0) {
			segments.push(`filters:${this.buildFilterString()}`);
		}

		// Add image source
		if (!this.imageSource) {
			throw new Error("Image source (key or url) must be specified");
		}

		if (this.imageSource.type === "key") {
			const key = `blob/${this.imageSource.value}`;
			const encodedKey = key.includes("?") ? encodeURIComponent(key) : key;
			segments.push(encodedKey);
		} else {
			segments.push(`url/${encodeURIComponent(this.imageSource.value)}`);
		}

		return segments.join("/");
	}

	/**
	 * Builds and signs the final URL for the image transformation.
	 * @returns A promise that resolves to the signed URL
	 * @throws Error if no image source is specified
	 */
	async buildRemote(): Promise<string> {
		if (!this.imageSource) {
			throw new Error("Image source (key or url) must be specified");
		}

		const path = this.buildPath();
		return this.client.sign(path);
	}

	/**
	 * Builds and signs the URL locally without making a request to the server.
	 * This negates the need for a promise and can be used directly in the server
	 * components for frameworks like Astro.
	 */
	build(): string {
		if (!this.imageSource) {
			throw new Error("Image source (key or url) must be specified");
		}

		if (!this.client.signatureSecretKey) {
			throw new Error(
				"`signatureSecretKey` is required in your client for local signing",
			);
		}

		const path = this.buildPath();
		return signUrl(
			new URL(path, this.client.baseURL),
			this.client.signatureSecretKey,
		);
	}

	toString(): string {
		return this.build();
	}

	/**
	 * Implements the Promise interface to allow direct await of the builder.
	 */
	then<TResult1 = string, TResult2 = never>(
		onfulfilled?: ((value: string) => TResult1 | PromiseLike<TResult1>) | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
	): Promise<TResult1 | TResult2> {
		return this.buildRemote().then(onfulfilled, onrejected);
	}

	/**
	 * Implements the Promise catch method.
	 */
	catch<TResult = never>(
		onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
	): Promise<string | TResult> {
		return this.buildRemote().catch(onrejected);
	}

	/**
	 * Implements the Promise finally method.
	 */
	finally(onfinally?: (() => void) | null): Promise<string> {
		return this.buildRemote().finally(onfinally);
	}
}

/**
 * Creates a new `ImageUrlBuilder` instance.
 * @param client - The image service client for signing URLs
 * @returns A new ImageUrlBuilder instance
 * @example
 * ```typescript
 * // Create a builder instance
 * const builder = imageUrlBuilder(client);
 *
 * // Basic image resize
 * const url = await builder
 *   .url('https://example.com/image.jpg')
 *   .size(800, 600);
 *
 * // More complex transformation
 * const url = await builder
 *   .key('my-image-key')
 *   .size(1200, 800)
 *   .fit('contain')
 *   .trim()
 *   .filter({
 *     quality: 85,
 *     brightness: 10,
 *     format: 'webp'
 *   });
 *
 * // Using smart cropping with focal point
 * const url = await builder
 *   .url('https://example.com/portrait.jpg')
 *   .size(400, 400)
 *   .smart()
 *   .filter({
 *     focal: '300,400',
 *     format: 'jpeg',
 *     quality: 90
 *   });
 * ```
 */
export function imageUrlBuilder(client: ImageServiceClient): ImageUrlBuilder {
	return new ImageUrlBuilder(client);
}

/**
 * Specifies how the image should be resized to fit the target dimensions.
 */
type ImageFit = "cover" | "contain" | "stretch" | "contain-stretch";

/**
 * Color specification, either as a named color or hex code without '#'.
 */
type Color = string & {};

/**
 * Percentage value between -100 and 100.
 */
type Percentage = number;

/**
 * Quality value between 0 and 100.
 */
type Quality = number;

/**
 * Valid rotation angles in degrees.
 */
type Angle = 0 | 90 | 180 | 270;

/**
 * Supported output image formats.
 */
type ImageFormat = "jpeg" | "png" | "gif" | "webp" | "tiff" | "avif" | "jp2";

/**
 * Configuration options for various image filters and transformations.
 */
type ImageFilters = {
	/** Sets background color for transparent images */
	background_color?: Color;
	/** Applies Gaussian blur (sigma value) */
	blur?: number;
	/** Adjusts image brightness (-100 to 100) */
	brightness?: Percentage;
	/** Adjusts image contrast (-100 to 100) */
	contrast?: Percentage;
	/** Fills transparent areas with color/blur/auto */
	fill?: Color | "blur" | "auto" | "none";
	/** Sets output format */
	format?: ImageFormat;
	/** Converts to grayscale */
	grayscale?: boolean;
	/** Rotates the hue (0-360 degrees) */
	hue?: number;
	/** Sets image orientation */
	orient?: Angle;
	/** Scales image by percentage */
	proportion?: Percentage;
	/** Sets JPEG quality (0-100) */
	quality?: Quality;
	/** Adjusts RGB channels (-100 to 100 each) */
	rgb?: [number, number, number];
	/** Rotates image by fixed angles */
	rotate?: Angle;
	/** Adjusts color saturation (-100 to 100) */
	saturation?: Percentage;
	/** Applies sharpening effect */
	sharpen?: number;
	/** Sets focal point/region for cropping */
	focal?: `${number}x${number}:${number}x${number}` | `${number},${number}`;
	/** Adds rounded corners */
	round_corner?: {
		rx: number;
		ry?: number;
		color?: Color;
	};
	/** Limits output file size */
	max_bytes?: number;
	/** Limits animation frames */
	max_frames?: number;
	/** Selects specific page/frame */
	page?: number;
	/** Sets DPI for vector formats */
	dpi?: number;
	/** Removes EXIF metadata */
	strip_exif?: boolean;
	/** Removes ICC profile */
	strip_icc?: boolean;
	/** Removes all metadata */
	strip_metadata?: boolean;
	/** Allows upscaling with fit-in */
	upscale?: boolean;
	/** Sets download filename */
	attachment?: string;
	/** Sets content expiration */
	expire?: number;
	/** Skips result storage */
	preview?: boolean;
	/** Returns unprocessed image */
	raw?: boolean;
};
