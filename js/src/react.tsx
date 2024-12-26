"use client";

import type { Atom, ExtractAtomValue, PrimitiveAtom } from "jotai";
import { createStore } from "jotai";
import {
	atom,
	useAtomValue,
	useSetAtom,
	Provider as JotaiProvider,
} from "jotai";
import {
	createContext,
	useContext,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

const RailwayImagesContext = createContext<RailwayImagesContextType>({
	url: "",
});

type RailwayImagesContextType = {
	maxUploadSize?: number;
	url:
		| string
		| {
				/**
				 * An API path or URL that can be used to create an image `src` attribute.
				 */
				get: string;
				/**
				 * An API path or URL that redirects to the signed URL for an image key.
				 */
				put: string;
		  };
};

/**
 * A Jotai store used exclusively by Railway Image Service React components.
 */
const filesStore = createStore();

export function Provider({
	children,
	...props
}: RailwayImagesContextType & { children: React.ReactNode }) {
	return (
		<RailwayImagesContext.Provider value={props}>
			<JotaiProvider store={filesStore}>{children}</JotaiProvider>
		</RailwayImagesContext.Provider>
	);
}

export function Image({
	srcKey,
	transform,
	filters,
	className,
	alt = "",
	...props
}: ImageProps) {
	const ctx = useContext(RailwayImagesContext);
	const segments: string[] = [];

	if (transform || props.width || props.height) {
		// 2. Add trim if specified
		if (transform?.trim) {
			segments.push("trim");
		}

		// 3. Add manual crop coordinates if specified (AxB:CxD)
		function add(a: number | string, b: number | string): number | string {
			if (typeof a === "number" && typeof b === "number") {
				return a + b;
			}
			// For percentages, return the sum as a string
			return `${Number(String(a).replace("%", "")) + Number(String(b).replace("%", ""))}`;
		}
		if (transform?.crop) {
			const { x, y, width, height } = transform.crop;
			segments.push(`${x}x${y}:${add(x, width)}x${add(y, height)}`);
		}

		// 4 & 5. Add fit-in and stretch flags based on fit mode
		if (props.fit === "contain" || props.fit === "contain-stretch") {
			segments.push("fit-in");
		}
		if (props.fit === "stretch" || props.fit === "contain-stretch") {
			segments.push("stretch");
		}

		// 6. Add dimensions with flip flags (-Ex-F)
		if (props.width || props.height) {
			const w = props.width
				? `${transform?.flip === "horizontal" || transform?.flip === "both" ? "-" : ""}${props.width}`
				: props.width;
			const h = props.height
				? `${transform?.flip === "vertical" || transform?.flip === "both" ? "-" : ""}${props.height}`
				: props.height;
			segments.push(`${w}x${h}`);
		}

		// 7. Add padding if specified (GxH:IxJ)
		if (transform?.padding) {
			const { left, top, right, bottom } = transform.padding;
			segments.push(`${left}x${top}:${right}x${bottom}`);
		}

		// 8 & 9. Add alignment if any transformations are applied
		if (
			transform?.trim ||
			transform?.crop ||
			transform?.fit ||
			transform?.padding ||
			transform?.smart
		) {
			segments.push(transform?.align?.horizontal || "center");
			segments.push(transform?.align?.vertical || "middle");
		}

		// 10. Add smart flag
		if (transform?.smart) {
			segments.push("smart");
		}
	}

	// 11. Add filters if any
	if (filters && Object.keys(filters).length > 0) {
		segments.push(`filters:${buildFilterString(filters)}`);
	}

	// 12. Finally add the image key (encoded if it contains query params)
	srcKey = `files/${srcKey}`;
	const encodedKey = srcKey.includes("?") ? encodeURIComponent(srcKey) : srcKey;
	segments.push(encodedKey);

	// Construct final URL
	const baseUrl = typeof ctx.url === "string" ? ctx.url : ctx.url.get;

	return (
		<img
			src={joinPath(baseUrl, segments.join("/"))}
			alt={alt}
			className={className}
			{...props}
		/>
	);
}

type Color = string; // Color name or hex without #
type Percentage = number; // -100 to 100
type Quality = number; // 0 to 100
type Alpha = number; // 0 to 100
type Angle = 0 | 90 | 180 | 270;
type Position =
	| number
	| `${number}p`
	| "left"
	| "right"
	| "center"
	| "top"
	| "bottom"
	| "repeat";
type ImageFormat = "jpeg" | "png" | "gif" | "webp" | "tiff" | "avif" | "jp2";

/**
 * All supported Thumbor filters and their configurations
 */
export type ImageFilters = {
	// Image adjustments
	background_color?: Color;
	blur?: number;
	brightness?: Percentage;
	contrast?: Percentage;
	fill?: Color | "blur" | "auto" | "none";
	format?: ImageFormat;
	grayscale?: true;
	hue?: number;
	orient?: Angle;
	proportion?: Percentage;
	quality?: Quality;
	rgb?: [number, number, number];
	rotate?: Angle;
	saturation?: Percentage;
	sharpen?: number;

	// Focal point
	focal?: `${number}x${number}:${number}x${number}` | `${number},${number}`;

	// Text and watermarks
	label?: {
		text: string;
		x: Position;
		y: Position;
		size: number;
		color: Color;
		alpha?: Alpha;
		font?: string;
	};
	watermark?: {
		image: string;
		x: Position;
		y: Position;
		alpha: Alpha;
		w_ratio?: number;
		h_ratio?: number;
	};

	// Shape modifications
	round_corner?: {
		rx: number;
		ry?: number;
		color?: Color;
	};

	// Size and frame limits
	max_bytes?: number;
	max_frames?: number;

	// Document handling
	page?: number;
	dpi?: number;

	// Metadata handling
	strip_exif?: true;
	strip_icc?: true;
	strip_metadata?: true;

	// Sizing behavior
	upscale?: true;

	// Utility filters
	attachment?: string;
	expire?: number;
	preview?: true;
	raw?: true;
};

function buildFilterString(filters: Partial<ImageFilters>): string {
	const parts: string[] = [];

	for (const [key, value] of Object.entries(filters)) {
		if (value === undefined) continue;

		switch (key) {
			case "label":
				const label = value as ImageFilters["label"];
				if (!label) break;
				parts.push(
					`label(${[
						encodeURIComponent(label.text),
						label.x,
						label.y,
						label.size,
						label.color,
						label.alpha,
						label.font,
					]
						.filter(Boolean)
						.join(",")})`,
				);
				break;

			case "watermark":
				const watermark = value as ImageFilters["watermark"];
				if (!watermark) break;
				parts.push(
					`watermark(${[
						watermark.image,
						watermark.x,
						watermark.y,
						watermark.alpha,
						watermark.w_ratio,
						watermark.h_ratio,
					]
						.filter(Boolean)
						.join(",")})`,
				);
				break;

			case "round_corner":
				const corner = value as ImageFilters["round_corner"];
				if (!corner) break;
				parts.push(
					`round_corner(${[corner.rx, corner.ry, corner.color]
						.filter(Boolean)
						.join(",")})`,
				);
				break;

			case "rgb":
				const [r, g, b] = value as [number, number, number];
				parts.push(`rgb(${r},${g},${b})`);
				break;

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
 * Fit modes determine how the image fits within its target dimensions
 */
export type Fit =
	| "cover" // Default - resize and crop to fill dimensions
	| "contain" // Resize to fit within dimensions (fit-in)
	| "stretch" // Stretch to fill dimensions ignoring aspect ratio
	| "contain-stretch"; // Both fit-in and stretch flags

/**
 * Transform options for the image
 */
export type Transform = {
	/**
	 * Image flipping
	 */
	flip?: "horizontal" | "vertical" | "both";
	/**
	 * Manual crop region using pixels or percentages (0-1)
	 */
	crop?: {
		x: number | string;
		y: number | string;
		width: number | string;
		height: number | string;
	};
	/**
	 * Padding to add (in pixels)
	 */
	padding?: {
		left: number;
		top: number;
		right: number;
		bottom: number;
	};
	/**
	 * Remove surrounding space using top-left pixel color
	 */
	trim?: boolean;
	/**
	 * Use smart detection for focal points
	 */
	smart?: boolean;
	/**
	 * Position alignment
	 */
	align?: {
		horizontal?: "left" | "center" | "right";
		vertical?: "top" | "middle" | "bottom";
	};
};

export type ImageProps = {
	srcKey: string;
	width?: number;
	height?: number;
	/**
	 * How image should fit within target dimensions
	 */
	fit?: Fit;
	/**
	 * Apply image transformations
	 */
	transform?: Transform;
	/**
	 * Apply filters to the image
	 */
	filters?: Partial<ImageFilters>;
} & Omit<
	React.ImgHTMLAttributes<HTMLImageElement>,
	"src" | "width" | "height" | "key"
>;

/**
 * The MIME types for images. Can be used with `accept` in `useSelectFiles`.
 */
export const IMAGE_MIMES = "image/*";

/**
 * A hook that returns a callback for selecting files from the browser dialog.
 *
 * @param options - Select file options
 */
export function useSelectFiles(
	options: {
		/**
		 * Sets or retrieves a comma-separated list of content types.
		 */
		accept?: string;
		/**
		 * Sets or retrieves the `Boolean` value indicating whether multiple items
		 * can be selected from a list.
		 */
		multiple?: boolean;
		/**
		 * Called after files have been selected
		 */
		onSelect?: OnSelect;
	} = {},
): SelectFilesCallback {
	const storedOptions = useRef(options);
	useEffect(() => {
		storedOptions.current = options;
	});

	return useCallback(function selectFiles({ key } = {}) {
		// Create virtual input element
		const el = document.createElement("input");
		el.type = "file";
		el.multiple = storedOptions.current.multiple ?? true;

		if (storedOptions.current.accept) {
			el.accept = storedOptions.current.accept;
		}

		const onChange: EventListener = async (e) => {
			if (e.target instanceof HTMLInputElement) {
				const target = e.target;

				for (const file of target.files ?? []) {
					storedOptions.current.onSelect?.(await createSelectedFile(file, key));
				}
				// Remove event listener after operation
				el.removeEventListener("change", onChange);
				// Remove input element after operation
				el.remove();
			}
		};

		el.addEventListener("change", onChange);
		el.click();
	}, []);
}

/**
 * A hook that returns a callback for selecting a directory from the browser dialog.
 */
export function useSelectDirectory(
	options: {
		/**
		 * Called after files have been selected
		 */
		onSelect?: OnSelect;
	} = {},
): SelectDirectoryCallback {
	const storedOptions = useRef(options);
	useEffect(() => {
		storedOptions.current = options;
	});

	return useCallback(function selectDirectory({ key } = {}) {
		// Create virtual input element
		const el = document.createElement("input");
		el.type = "file";
		el.webkitdirectory = true;

		// eslint-disable-next-line func-style
		const onChange: EventListener = async (e) => {
			if (e.target instanceof HTMLInputElement) {
				const target = e.target;

				for (const file of target.files ?? []) {
					storedOptions.current.onSelect?.(await createSelectedFile(file, key));
				}

				// Remove event listener after operation
				el.removeEventListener("change", onChange);
				// Remove input element after operation
				el.remove();
			}
		};

		el.addEventListener("change", onChange);
		el.click();
	}, []);
}

/**
 * A hook that handles drag-n-drop file uploads
 */
export function useDropFiles(
	options: {
		/**
		 * The key that will be stored in the key/value store for the file.
		 */
		key?: Key;
		/**
		 * Sets or retrieves a comma-separated list of content types.
		 */
		accept?: string;
		/**
		 * If `false`, only one file can be dropped at a time
		 */
		multiple?: boolean;
		/**
		 * Called after files have been selected
		 */
		onSelect?: OnSelect;
	} = {},
): {
	props: React.HTMLAttributes<HTMLElement>;
	/**
	 * `true` if a user is currently dragging a file over the drop area
	 */
	isActive: boolean;
} {
	const [isActive, setIsOver] = useState(false);
	const storedOptions = useRef(options);
	useEffect(() => {
		storedOptions.current = options;
	});
	const props = useMemo<React.HTMLAttributes<HTMLElement>>(
		() => ({
			onDragEnter(e) {
				e.preventDefault();
				setIsOver(true);
			},
			onDragOver(e) {
				e.preventDefault();
				setIsOver(true);
			},
			onDragLeave(e) {
				e.preventDefault();
				setIsOver(false);
			},
			async onDrop(e) {
				e.preventDefault();
				const key = storedOptions.current.key;
				const accepts = storedOptions.current.accept
					?.split(",")
					.map((s) => s.trim());
				for (const file of e.dataTransfer.files) {
					let accepted = !accepts?.length; // true if no filters
					if (file.type && accepts?.length) {
						for (const accept of accepts) {
							if (
								// Handle exact mime types
								file.type === accept ||
								// Handle mime types with wildcards
								(accept.includes("/*") &&
									file.type.startsWith(accept.replace("/*", "/"))) ||
								// Handle file extensions
								(accept.startsWith(".") &&
									file.name.toLowerCase().endsWith(accept.toLowerCase()))
							) {
								accepted = true;
								break;
							}
						}
					}

					if (!accepted) {
						continue;
					}

					storedOptions.current.onSelect?.(await createSelectedFile(file, key));
					if (!storedOptions.current.multiple) {
						break;
					}
				}

				setIsOver(false);
			},
		}),
		[],
	);

	return { props, isActive };
}

/**
 * A hook that creates a clickable dropzone for files. This is a convenience
 * wrapper around `useSelectFiles` and `useDropFiles`.
 */
/**
 * A hook that creates a clickable dropzone for files. This is a convenience
 * wrapper around `useSelectFiles` and `useDropFiles`.
 */
export function useDropzone(options: {
	/**
	 * Sets or retrieves a comma-separated list of content types.
	 */
	accept?: string;
	/**
	 * Sets or retrieves the `Boolean` value indicating whether multiple items
	 * can be selected from a list.
	 */
	multiple?: boolean;
	/**
	 * The key that will be stored in the key/value store for the file.
	 */
	key?: Key;
	/**
	 * Called after files have been selected
	 */
	onSelect?: OnSelect;
}) {
	const selectFiles = useSelectFiles(options);
	const dropFiles = useDropFiles(options);
	const props = useMemo<React.HTMLAttributes<HTMLElement>>(
		() => ({
			...dropFiles.props,
			onClick(e) {
				e.preventDefault();
				selectFiles({ key: options.key });
			},
		}),
		[dropFiles.props, selectFiles, options.key],
	);

	return {
		props,
		isActive: dropFiles.isActive,
	};
}

async function createSelectedFile(file: File, key?: Key) {
	const k = await Promise.resolve(typeof key === "function" ? key(file) : key);
	const data = {
		key: `${(k ?? (file.webkitRelativePath || file.name)).replace(/^\//, "")}`,
		file,
		source: URL.createObjectURL(file),
	};

	const bytesUploaded = atom(0);
	return atom<SelectedFileData>({
		...data,
		bytesUploaded,
		progress: atom((get) => {
			return get(bytesUploaded) / file.size;
		}),
		startTime: atom<number | null>(null),
		progressSamples: atom<Array<ProgressSample>>([]),
		status: atom<ExtractAtomValue<SelectedFileData["status"]>>("idle"),
		abortController: new AbortController(),
	});
}

/**
 * A hook that returns the status from a file atom
 *
 * @param atom - A file atom
 */
export function useFileStatus(
	selectedFile: SelectedFile,
): ExtractAtomValue<SelectedFileData["status"]> {
	return useAtomValue(
		useAtomValue(selectedFile, { store: filesStore }).status,
		{
			store: filesStore,
		},
	);
}

/**
 * Calculate progress information from upload state
 */
function calculateProgress(
	loaded: number,
	total: number,
	startTime: number | null,
	samples: Array<ProgressSample> = [],
): ProgressData {
	const now = Date.now();
	const timeElapsed = now - (startTime ?? now);
	let rate = 0;
	if (samples.length > 1) {
		const oldest = samples[0];
		const timeDiff = (now - oldest.time) / 1000; // to seconds
		const bytesDiff = loaded - oldest.loaded;
		rate = bytesDiff / timeDiff;
	}
	const estimatedTimeRemaining =
		rate > 0
			? ((total - loaded) / rate) * 1000 // to ms
			: null;
	const progress = loaded / total;
	return {
		loaded,
		total,
		progress,
		rate,
		estimatedTimeRemaining: progress === 1 ? 0 : estimatedTimeRemaining,
		timeElapsed,
	};
}

/**
 * A hook that returns detailed progress information for a file upload. This includes
 * the upload speed, estimated time remaining, and other upload statistics.
 *
 * @param selectedFile - A file atom created by `createSelectedFile`
 * @returns Progress information including:
 *  - `loaded` - Number of bytes uploaded
 *  - `total` - Total file size in bytes
 *  - `progress` - Upload progress as a fraction between 0-1
 *  - `rate` - Upload speed in bytes per second
 *  - `estimatedTimeRemaining` - Estimated milliseconds until completion, or null if not started
 *  - `timeElapsed` - Milliseconds since upload started
 *
 * @example
 * ```tsx
 * const progress = useProgress(selectedFile);
 * return (
 *   <div>
 *     {Math.round(progress.progress * 100)}% uploaded
 *     ({formatBytes(progress.rate)}/s)
 *     {progress.estimatedTimeRemaining &&
 *       `${formatTime(progress.estimatedTimeRemaining)} remaining`
 *     }
 *   </div>
 * );
 * ```
 */
export function useProgress(selectedFile: SelectedFile): ProgressData {
	const file = useAtomValue(selectedFile, { store: filesStore });
	const bytesUploaded = useAtomValue(file.bytesUploaded, { store: filesStore });
	const startTime = useAtomValue(file.startTime, { store: filesStore });
	const samples = useAtomValue(file.progressSamples, { store: filesStore });
	return useMemo(() => {
		return calculateProgress(bytesUploaded, file.file.size, startTime, samples);
	}, [bytesUploaded, file.file.size, startTime, samples]);
}

/**
 * A hook that returns a callback for uploading a file to the server
 *
 * @example
 * ```tsx
 *  const uploadFile = useUploadFile();
 *  ...
 *  uploadFile(file)
 * ```
 */
export function useUploadFile() {
	const ctx = useContext(RailwayImagesContext);
	return useCallback(
		async function uploadFile(
			file: SelectedFile,
			options: UploadFileOptions = {},
		) {
			const { onProgress, onCancel, onSuccess, onError } = options;
			const { get, set } = filesStore;
			const f = get(file);
			if (ctx.maxUploadSize && f.file.size > ctx.maxUploadSize) {
				set(f.status, "error");
				const error = new Error(
					`File is too large. Max size is ${ctx.maxUploadSize} bytes.`,
				);
				set(file, (current) => ({ ...current, error: error.message }));
				onError?.(error);
				return;
			}

			const uploadingFile = get(file);
			if (get(uploadingFile.status) === "cancelled") {
				return;
			}

			set(uploadingFile.status, "uploading");
			// If we catch an abort make sure the upload status has been changed to
			// cancel
			const abortSignal = f.abortController.signal;
			// eslint-disable-next-line func-style
			const handleAbortSignal = (): void => {
				onCancel?.();
				set(uploadingFile.status, "cancelled");
				abortSignal.removeEventListener("abort", handleAbortSignal);
			};
			abortSignal.addEventListener("abort", handleAbortSignal);
			let response: Response;

			// Bails out if we have aborted in the meantime
			if (
				f.abortController.signal.aborted ||
				get(uploadingFile.status) === "cancelled"
			) {
				return;
			}

			const key = await Promise.resolve(
				typeof options.key === "function"
					? options.key(f.file)
					: options.key ?? f.key,
			);

			try {
				response = await new Promise((resolve, reject) => {
					const xhr = new XMLHttpRequest();
					xhr.withCredentials = options.withCredentials ?? false;
					for (const key in options.headers ?? {}) {
						xhr.setRequestHeader(key, options.headers![key]);
					}
					abortSignal.addEventListener("abort", () => {
						xhr.abort();
						reject(new DOMException("Aborted", "AbortError"));
					});
					set(f.startTime, Date.now());
					set(uploadingFile.progressSamples, []);
					xhr.upload.addEventListener("progress", (e) => {
						if (e.lengthComputable) {
							set(f.bytesUploaded, e.loaded);
							set(f.progressSamples, (current) => {
								return [
									...current,
									{ time: Date.now(), loaded: e.loaded },
								].slice(-10);
							});
							onProgress?.(
								calculateProgress(
									e.loaded,
									e.total,
									get(f.startTime),
									get(f.progressSamples),
								),
							);
						}
					});
					xhr.addEventListener("load", () => {
						resolve(
							new Response(xhr.response, {
								status: xhr.status,
								statusText: xhr.statusText,
								headers: parseHeaders(xhr.getAllResponseHeaders()),
							}),
						);
					});
					xhr.addEventListener("error", () =>
						reject(new Error("Upload failed")),
					);
					xhr.open(
						"PUT",
						joinPath(typeof ctx.url === "string" ? ctx.url : ctx.url.put, key),
					);
					xhr.send(f.file);
				});

				if (!response.ok) {
					try {
						const responseText = await response.text();
						throw responseText;
					} catch (e) {
						throw `${response.status}: ${response.statusText}`;
					}
				}
			} catch (err) {
				set(uploadingFile.status, "error");
				const error =
					typeof err === "string"
						? err
						: err instanceof Error
							? err.message
							: "An unknown error occurred";
				set(file, (current) => ({ ...current, error }));
				onError?.(err);
			} finally {
				abortSignal.removeEventListener("abort", handleAbortSignal);
			}

			if (get(uploadingFile.status) === "uploading") {
				set(uploadingFile.status, "success");
				set(file, (current) => ({ ...current, response }));
				onSuccess?.(response!);
			}
		},
		[ctx.maxUploadSize, ctx.url],
	);
}

/**
 * A hook that returns a function for uploading multiple files concurrently
 * with a configurable concurrency limit.
 *
 * @example
 * ```tsx
 * const uploadFiles = useUploadFiles();
 *
 * // Later...
 * await uploadFiles([file1, file2], {
 *   concurrency: 2,
 *   onProgress: (p) => console.log(`${p * 100}%`)
 * });
 * ```
 */
export function useUploadFiles() {
	const upload = useUploadFile();

	return useCallback(
		async function uploadFiles(
			selectedFiles: Array<SelectedFile>,
			options: {
				/**
				 * Maximum number of concurrent uploads
				 * @default 3
				 */
				concurrency?: number;
			} & UploadFileOptions = {},
		) {
			const concurrency = options.concurrency ?? 3;
			const chunks = selectedFiles.reduce<Array<SelectedFile[]>>(
				(acc, file, i) => {
					const chunkIndex = Math.floor(i / concurrency);
					if (!acc[chunkIndex]) acc[chunkIndex] = [];
					acc[chunkIndex].push(file);
					return acc;
				},
				[],
			);

			for (const chunk of chunks) {
				await Promise.all(chunk.map((file) => upload(file, options)));
			}
		},
		[upload],
	);
}

/**
 * A hook that returns a callback for cancelling a file upload if
 * possible.
 *
 * @param selectedFile - A selected file
 */
export function useCancelUploadFile(selectedFile: SelectedFile): () => void {
	const file = useAtomValue(selectedFile, { store: filesStore });
	const setStatus = useSetAtom(file.status, { store: filesStore });
	return useCallback(() => {
		file.abortController.abort();
		setStatus("cancelled");
	}, [setStatus, file.abortController]);
}

function joinPath(base: string, path: string) {
	if (!base) return path;
	if (!path) return base;

	try {
		// Try parsing base as a full URL first
		const baseUrl = new URL(base);
		baseUrl.pathname = `${baseUrl.pathname}/${path}`.replace(/\/{2,}/g, "/");
		return baseUrl.toString();
	} catch {
		// If base isn't a valid URL, treat it as a path
		const u = new URL(
			typeof window === "undefined" ? "http://localhost" : window.location.href,
		);
		u.pathname = `${base}/${path}`.replace(/\/{2,}/g, "/");
		return u.pathname; // Return just the path portion
	}
}

function parseHeaders(headerStr: string) {
	const headers = new Headers();
	if (!headerStr) return headers;

	// Split into lines and filter out empty ones
	const headerPairs = headerStr.trim().split(/[\r\n]+/);

	headerPairs.forEach((line) => {
		const parts = line.split(": ");
		const key = parts.shift();
		const value = parts.join(": "); // Rejoin in case value contained ': '
		if (key && value) {
			headers.append(key.trim(), value.trim());
		}
	});

	return headers;
}

/**
 * A hook that generates a preview URL for an image file. Returns a tuple containing
 * the preview URL and metadata about the preview state.
 *
 * @param file - A file atom created by `createSelectedFile`
 * @returns A tuple containing:
 *  - The preview URL as a string, or null if not available
 *  - An object containing:
 *    - `error`: Error message if preview generation failed, null otherwise
 *    - `status`: Current status of the preview ("idle" | "loading" | "success" | "error")
 *    - `clear`: Function to clear the preview state
 *
 * @example
 * ```tsx
 * const [previewUrl, { status, error }] = usePreviewUrl(selectedFile);
 * return (
 *   <div>
 *     {status === 'loading' && <Spinner />}
 *     {status === 'error' && <Error>{error}</Error>}
 *     {status === 'success' && <img src={previewUrl} alt="Preview" />}
 *   </div>
 * );
 * ```
 */
export function usePreviewUrl(file: SelectedFile) {
	const [state, setState] = useState<PreviewState>(initialPreviewState);
	const clearPreview = useCallback(() => {
		setState(initialPreviewState);
	}, []);

	useEffect(() => {
		const f = filesStore.get(file);

		if (!f.file) {
			clearPreview();
			return;
		}

		setState((prev) => ({ ...prev, status: "loading", error: null }));

		// Validate file type
		if (!f.file.type.startsWith("image/")) {
			setState({
				url: null,
				error: "Selected file is not an image",
				status: "error",
			});
			return;
		}

		const reader = new FileReader();

		reader.onload = (e) => {
			if (
				e.target instanceof FileReader &&
				typeof e.target.result === "string"
			) {
				setState({ url: e.target.result, error: null, status: "success" });
			}
		};

		reader.onerror = () => {
			setState({ url: null, error: "Error reading file", status: "error" });
		};

		reader.readAsDataURL(f.file);
		return () => {
			reader.abort();
			clearPreview();
		};
	}, [file, clearPreview]);

	useEffect(() => {
		return () => {
			if (state.url?.startsWith("blob:")) {
				URL.revokeObjectURL(state.url);
			}
		};
	}, [state.url]);

	return [
		state.url,
		useMemo(() => {
			return {
				error: state.error,
				status: state.status,
				clear: clearPreview,
			};
		}, [state.error, state.status, clearPreview]),
	] as const;
}

const initialPreviewState: PreviewState = {
	url: null,
	error: null,
	status: "idle",
};
type PreviewState = {
	url: string | null;
	error: string | null;
	status: PreviewStatus;
};
type PreviewStatus = "idle" | "loading" | "success" | "error";

function bufferToHex(buffer: ArrayBuffer) {
	return Array.from(new Uint8Array(buffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Get the SHA-256 hash of a file
 * @param file - The file to hash
 * @returns The SHA-256 hash of the file
 */
export async function hashFile(file: File) {
	const buffer = await file.arrayBuffer();
	const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
	return bufferToHex(hashBuffer);
}

/**
 * Get the extension of a file
 * @param file
 * @returns The extension of the file
 */
export function extname(file: File) {
	if (!file?.name) return "";
	const name = file.name.trim();
	const lastDot = name.lastIndexOf(".");
	// Handle dotfiles and empty extensions
	if (lastDot <= 0 || lastDot === name.length - 1) return "";
	return name.slice(lastDot).toLowerCase();
}

type UploadFileOptions = {
	/**
	 * The key that will be stored in the key/value store for the file.
	 */
	key?: Key;
	/**
	 * Additional headers to send with the upload request
	 */
	headers?: Record<string, string>;
	/**
	 * Whether or not to send cookies with the upload request
	 */
	withCredentials?: boolean;
	/**
	 * A function that is called when the upload is cancelled
	 */
	onCancel?: () => void;
	/**
	 * Called when all of the files have successfully uploaded
	 */
	onSuccess?: (responses: Response) => Promise<void> | void;
	/**
	 * Called when there is a progress event
	 */
	onProgress?: (progress: ProgressData) => Promise<void> | void;
	/**
	 * Called when there was an error uploading
	 */
	onError?: (err: unknown) => Promise<void> | void;
};

export type ProgressData = {
	/**
	 * Bytes uploaded so far
	 */
	loaded: number;
	/**
	 * Total bytes to upload
	 */
	total: number;
	/**
	 * Progress as a fraction between 0 and 1
	 */
	progress: number;
	/**
	 * Upload speed in bytes per second
	 */
	rate: number;
	/**
	 * Estimated time remaining in milliseconds
	 */
	estimatedTimeRemaining: number | null;
	/**
	 * Time elapsed since upload started in milliseconds
	 */
	timeElapsed: number;
};

export type SelectedFileData = {
	/**
	 * The source of the file as a string if the file is less than 15MB in size,
	 * otherwise `null`. This is useful for generating previews.
	 */
	source: null | string;
	/**
	 * The path on the server to upload the file to
	 */
	key: string;
	/**
	 * The file
	 */
	file: File;
	/**
	 * A writable atom that contains the number of bytes that have been uploaded
	 * already (if updated by you, the developer)
	 */
	bytesUploaded: PrimitiveAtom<number>;
	/**
	 * A readonly atom containing the progress of the file upload if `bytesUploaded`
	 * has been set.
	 */
	progress: Atom<number>;
	/**
	 * An atom that stores the current status of the file:
	 * - `"idle"`: the file has not started uploading
	 * - `"queued"`: the file has been acknowledged and is waiting in a queue to upload
	 * - `"uploading"`: the file is uploading
	 * - `"cancelled"`: the file upload was cancelled by the user before it completed
	 * - `"success"`: the file has been successfully uploaded
	 * - `"error"`: an error occurred during the upload and it did not finish
	 */
	status: PrimitiveAtom<
		"idle" | "queued" | "uploading" | "cancelled" | "success" | "error"
	>;
	/**
	 * Timestamp when the upload started
	 */
	startTime: PrimitiveAtom<number | null>;
	/**
	 * Array of recent progress samples
	 */
	progressSamples: PrimitiveAtom<Array<ProgressSample>>;
	/**
	 * An error message if the status is in an error state
	 */
	error?: string;
	/**
	 * An abort controller signal that can be used to cancel the file upload
	 */
	abortController: AbortController;
};

export type SelectedFile = PrimitiveAtom<SelectedFileData>;

export type SelectFilesCallback = (options?: {
	/**
	 * The key that will be stored in the key/value store for the file.
	 */
	key?: Key;
}) => void;

export type SelectDirectoryCallback = SelectFilesCallback;

export type OnSelect = (file: SelectedFile) => void | Promise<void>;

export type Key = string | ((file: File) => string | Promise<string>);

export type ProgressSample = { time: number; loaded: number };
