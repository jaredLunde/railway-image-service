"use client";

import type { Atom, ExtractAtomValue, PrimitiveAtom } from "jotai";
import { createStore, atom, useAtomValue, useSetAtom } from "jotai";
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
	/**
	 * The maximum size of an image that can be uploaded in bytes.
	 */
	maxUploadSize?: number;
	/**
	 * The API base URL
	 */
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

/**
 * Provides configuration to its child hooks and components.
 */
export function Provider({
	children,
	...props
}: RailwayImagesContextType & { children: React.ReactNode }) {
	return (
		<RailwayImagesContext.Provider value={props}>
			{children}
		</RailwayImagesContext.Provider>
	);
}

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
	const [isActive, setIsActive] = useState(false);
	const storedOptions = useRef(options);
	useEffect(() => {
		storedOptions.current = options;
	});
	const props = useMemo<React.HTMLAttributes<HTMLElement>>(
		() => ({
			onDragEnter(e) {
				e.preventDefault();
				setIsActive(true);
			},
			onDragOver(e) {
				e.preventDefault();
				setIsActive(true);
			},
			onDragLeave(e) {
				e.preventDefault();
				setIsActive(false);
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

				setIsActive(false);
			},
			"data-dropzone-active": isActive,
		}),
		[isActive],
	);

	return { props, isActive };
}

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
 * A hook that returns the status from a selected file
 *
 * @param selectedFile - A file atom
 */
export function useStatus(
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
			const { onProgress, onAbort, onSuccess, onError } = options;
			const { get, set } = filesStore;
			const f = get(file);
			const key = await Promise.resolve(
				typeof options.key === "function"
					? options.key(f.file)
					: options.key ?? f.key,
			);

			if (ctx.maxUploadSize && f.file.size > ctx.maxUploadSize) {
				set(f.status, "error");
				const error = new Error(
					`File is too large. Max size is ${ctx.maxUploadSize} bytes.`,
				);
				set(file, (current) => ({ ...current, error: error.message }));
				onError?.({ key, file: f.file }, error);
				return;
			}

			const uploadingFile = get(file);
			if (get(uploadingFile.status) === "aborted") {
				return;
			}

			set(uploadingFile.status, "uploading");
			// If we catch an abort make sure the upload status has been changed to
			// cancel
			const abortSignal = f.abortController.signal;
			// eslint-disable-next-line func-style
			const handleAbortSignal = (): void => {
				onAbort?.({ key, file: f.file });
				set(uploadingFile.status, "aborted");
				abortSignal.removeEventListener("abort", handleAbortSignal);
			};
			abortSignal.addEventListener("abort", handleAbortSignal);
			let response: Response;

			// Bails out if we have aborted in the meantime
			if (
				f.abortController.signal.aborted ||
				get(uploadingFile.status) === "aborted"
			) {
				return;
			}

			try {
				response = await new Promise((resolve, reject) => {
					const xhr = new XMLHttpRequest();
					xhr.withCredentials = options.withCredentials ?? false;
					for (const name in options.headers ?? {}) {
						xhr.setRequestHeader(name, options.headers![name]);
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
								{ key, file: f.file },
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
				// Ignore abort signals
				if (err instanceof DOMException && err.name === "AbortError") {
					return;
				}

				set(uploadingFile.status, "error");
				const error =
					typeof err === "string"
						? err
						: err instanceof Error
							? err.message
							: "An unknown error occurred";
				set(file, (current) => ({ ...current, error }));
				onError?.({ key, file: f.file }, err);
			} finally {
				abortSignal.removeEventListener("abort", handleAbortSignal);
			}

			if (get(uploadingFile.status) === "uploading") {
				set(uploadingFile.status, "success");
				set(file, (current) => ({ ...current, response }));
				onSuccess?.({ key, file: f.file }, response!);
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
					const f = filesStore.get(file);
					const status = filesStore.get(f.status);
					if (status === "aborted" || f.abortController.signal.aborted) {
						return acc;
					}
					filesStore.set(f.status, "queued");
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
 * A hook that returns the raw file `File` object from a selected file and the key.
 * @param selectedFile - A selected file
 */
export function useSelectedFile(
	selectedFile: SelectedFile,
): Pick<SelectedFileData, "key" | "file"> {
	const file = useAtomValue(selectedFile, { store: filesStore });
	return useMemo(
		() => ({
			key: file.key,
			file: file.file,
		}),
		[file.file, file.key],
	);
}

/**
 * A hook that returns a callback for cancelling a file upload if
 * possible.
 *
 * @param selectedFile - A selected file
 */
export function useAbort(selectedFile: SelectedFile): () => void {
	const file = useAtomValue(selectedFile, { store: filesStore });
	const setStatus = useSetAtom(file.status, { store: filesStore });
	return useCallback(() => {
		const status = filesStore.get(file.status);
		if (status !== "success" && status !== "error") {
			file.abortController.abort();
			setStatus("aborted");
		}
	}, [setStatus, file.status, file.abortController]);
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
 * A hook that generates a preview URL for an image file.
 * @param file - A selected file

 * @example
 * ```tsx
 * const { url, status, error } = usePreview(selectedFile);
 * return (
 *   <div>
 *     {status === 'loading' && <Spinner />}
 *     {status === 'error' && <Error>{error}</Error>}
 *     {status === 'success' && <img src={url} alt="Preview" />}
 *   </div>
 * );
 * ```
 */
export function usePreview(file: SelectedFile) {
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

		setState((prev) => ({ status: "loading", error: null, data: null }));

		// Validate file type
		if (!f.file.type.startsWith("image/")) {
			setState({
				data: null,
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
				setState({ data: e.target.result, error: null, status: "success" });
			}
		};

		reader.onerror = () => {
			setState({ data: null, error: "Error reading file", status: "error" });
		};

		reader.readAsDataURL(f.file);
		return () => {
			reader.abort();
			clearPreview();
		};
	}, [file, clearPreview]);

	useEffect(() => {
		return () => {
			if (state.data?.startsWith("blob:")) {
				URL.revokeObjectURL(state.data);
			}
		};
	}, [state.data]);

	return state;
}

const initialPreviewState: PreviewState = {
	data: null,
	error: null,
	status: "idle",
};
type PreviewState =
	| {
			data: null;
			error: null;
			status: Exclude<PreviewStatus, "success" | "error">;
	  }
	| {
			data: string;
			error: null;
			status: Exclude<PreviewStatus, "idle" | "loading" | "error">;
	  }
	| {
			data: null;
			error: string;
			status: Exclude<PreviewStatus, "idle" | "loading" | "success">;
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
	 * A function that is called when the upload is aborted
	 */
	onAbort?: (selectedFileData: Pick<SelectedFileData, "key" | "file">) => void;
	/**
	 * Called when all of the files have successfully uploaded
	 */
	onSuccess?: (
		selectedFileData: Pick<SelectedFileData, "key" | "file">,
		response: Response,
	) => Promise<void> | void;
	/**
	 * Called when there is a progress event
	 */
	onProgress?: (
		selectedFileData: Pick<SelectedFileData, "key" | "file">,
		progress: ProgressData,
	) => Promise<void> | void;
	/**
	 * Called when there was an error uploading
	 */
	onError?: (
		selectedFileData: Pick<SelectedFileData, "key" | "file">,
		err: unknown,
	) => Promise<void> | void;
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
	 * - `"aborted"`: the file upload was aborted by the user before it completed
	 * - `"success"`: the file has been successfully uploaded
	 * - `"error"`: an error occurred during the upload and it did not finish
	 */
	status: PrimitiveAtom<SelectedFileStatus>;
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

export type SelectedFileStatus =
	| "idle"
	| "queued"
	| "uploading"
	| "aborted"
	| "success"
	| "error";

export type SelectDirectoryCallback = SelectFilesCallback;

export type OnSelect = (file: SelectedFile) => void | Promise<void>;

export type Key = string | ((file: File) => string | Promise<string>);

export type ProgressSample = { time: number; loaded: number };
