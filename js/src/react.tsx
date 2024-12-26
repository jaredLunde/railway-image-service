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

const RailwayImagesContext = createContext<RailwayImagesContextType>({});
type RailwayImagesContextType = {
	maxUploadSize?: number;
	endpoints?: {
		get?: string;
		put?: string;
		sign?: string;
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

export function Image(props: ImageProps) {
	const ctx = useContext(RailwayImagesContext);
}

type ImageProps = {
	format?: ImageFormat;
	size?: number | { width: number; height: number };
};

type ImageFormat = "jpeg" | "png" | "webp" | "avif";

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

				for (const fileIndex in target.files) {
					const index = Number(fileIndex);
					if (isNaN(index)) {
						continue;
					}

					const file = target.files.item(index);
					if (file === null) {
						continue;
					}

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

				for (const fileIndex in target.files) {
					const index = Number(fileIndex);
					if (isNaN(index)) {
						continue;
					}
					// Get file object
					const file = target.files.item(index);
					if (file === null) {
						continue;
					}

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
		 * Called after files have been selected
		 */
		onSelect?: OnSelect;
	} = {},
): {
	props: React.HTMLAttributes<HTMLElement>;
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

				for (const file of e.dataTransfer.files) {
					storedOptions.current.onSelect?.(await createSelectedFile(file, key));
				}

				setIsOver(false);
			},
		}),
		[],
	);

	return useMemo(() => {
		return {
			props,
			isActive,
		};
	}, [props, isActive]);
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
	atom: SelectedFile,
): ExtractAtomValue<SelectedFileData["status"]> {
	return useAtomValue(useAtomValue(atom, { store: filesStore }).status, {
		store: filesStore,
	});
}

/**
 * A hook that returns the upload progress from a file atom if bytes uploaded
 * has been set by you.
 *
 * @param atom - A file atom
 * @example
 * ```tsx
 * const progress = useProgress(selectedFile);
 * return <span>{progress * 100}% uploaded</span>
 * ```
 */
export function useProgress(atom: SelectedFile): number {
	return useAtomValue(useAtomValue(atom, { store: filesStore }).progress, {
		store: filesStore,
	});
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
					abortSignal.addEventListener("abort", () => {
						xhr.abort();
						reject(new DOMException("Aborted", "AbortError"));
					});
					xhr.upload.addEventListener("progress", (e) => {
						if (e.lengthComputable) {
							set(f.bytesUploaded, e.loaded);
							onProgress?.(get(f.progress));
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
					xhr.open("PUT", joinPath(ctx.endpoints?.put ?? "", key));
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
		[ctx.maxUploadSize, ctx.endpoints?.put, ctx.endpoints?.sign],
	);
}

/**
 * A hook that returns a callback for cancelling a file upload if
 * possible.
 *
 * @param atom - A file atom
 */
export function useCancelUploadFile(atom: SelectedFile): () => void {
	const file = useAtomValue(atom, { store: filesStore });
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

export function usePreviewUrl(file: SelectedFile) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<PreviewStatus>("idle");
	const clearPreview = useCallback(() => {
		setPreviewUrl(null);
		setError(null);
		setStatus("idle");
	}, []);

	useEffect(() => {
		const f = filesStore.get(file);

		if (!f.file) {
			clearPreview();
			return;
		}

		setStatus("loading");
		setError(null);

		// Validate file type
		if (!f.file.type.startsWith("image/")) {
			setError("Selected file is not an image");
			setPreviewUrl(null);
			setStatus("error");
			return;
		}

		const reader = new FileReader();

		reader.onload = (e) => {
			if (
				e.target instanceof FileReader &&
				typeof e.target.result === "string"
			) {
				setPreviewUrl(e.target.result);
				setError(null);
				setStatus("success");
			}
		};

		reader.onerror = () => {
			setError("Error reading file");
			setPreviewUrl(null);
			setStatus("error");
		};

		reader.readAsDataURL(f.file);
		return () => {
			reader.abort();
			clearPreview();
		};
	}, [file, clearPreview]);

	return [
		previewUrl,
		useMemo(() => {
			return {
				error,
				status,
				clear: clearPreview,
			};
		}, [error, status, clearPreview]),
	] as const;
}

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
	const name = file.name;
	const lastDot = name.lastIndexOf(".");
	if (lastDot <= 0 || lastDot === name.length - 1) return "";
	return name.slice(lastDot).toLowerCase();
}

type PreviewStatus = "idle" | "loading" | "success" | "error";

type UploadFileOptions = {
	/**
	 * The key that will be stored in the key/value store for the file.
	 */
	key?: Key;
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
	onProgress?: (progress: number) => Promise<void> | void;
	/**
	 * Called when there was an error uploading
	 */
	onError?: (err: unknown) => Promise<void> | void;
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
