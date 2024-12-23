import type { Atom, ExtractAtomValue, PrimitiveAtom } from "jotai";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { atomFamily } from "jotai/utils";
import {
	createContext,
	useContext,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";

const RailwayImagesContext = createContext<RailwayImagesContextType>({
	signEndpoint: "",
});
type RailwayImagesContextType = {
	signEndpoint: string;
};

export function Provider(
	props: RailwayImagesContextType & { children: React.ReactNode },
) {
	return (
		<RailwayImagesContext.Provider
			value={props}
		></RailwayImagesContext.Provider>
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

/**
 * A hook that returns a callback for selecting files from the browser dialog
 * and adding them to an array of pending files at a given ID.
 *
 * @param id - A unique ID that is used as a key for the files atom family
 * @param options - Select file options
 */
export function useSelectFiles(
	id: string,
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
		 * Called after the selected file atoms have been created
		 */
		onFileSelected?: (file: UploaderFileAtom) => void | Promise<void>;
	} = {},
): SelectFilesCallback {
	const storedOptions = useRef(options);
	const setFileCollection = useSetAtom(fileCollectionAtomFamily(id));
	useEffect(() => {
		storedOptions.current = options;
	});

	return useCallback(
		function selectFiles({ name, path } = {}) {
			// Create virtual input element
			const el = document.createElement("input");
			el.type = "file";
			el.multiple = storedOptions.current.multiple ?? true;

			if (storedOptions.current.accept) {
				el.accept = storedOptions.current.accept;
			}

			const onChange: EventListener = async (e) => {
				if (e.target instanceof HTMLInputElement) {
					const files: UploaderFileAtom[] = [];
					const target = e.target;

					for (const fileIndex in target.files) {
						const index = Number(fileIndex);

						if (isNaN(Number(index))) {
							continue;
						}

						const file = target.files.item(index);
						if (file === null) {
							continue;
						}

						const data = {
							id: crypto.randomUUID(),
							name: name ?? file.name,
							path: `${(path ?? "").replace(/\/$/, "")}/${file.name}`,
							file,
							source: URL.createObjectURL(file),
						};

						const bytesUploadedAtom = atom(0);
						const fileAtom = atom<UploaderFile>({
							...data,
							bytesUploaded: bytesUploadedAtom,
							progress: atom((get) => {
								return get(bytesUploadedAtom) / file.size;
							}),
							status: atom<ExtractAtomValue<UploaderFile["status"]>>("idle"),
						});

						files.push(fileAtom);
						storedOptions.current.onFileSelected?.(fileAtom);
					}
					// Set the selected files to the collection
					setFileCollection((current) => ({
						...current,
						files: [...current.files, ...files],
					}));
					// Remove event listener after operation
					el.removeEventListener("change", onChange);
					// Remove input element after operation
					el.remove();
				}
			};

			el.addEventListener("change", onChange);
			el.click();
		},
		[setFileCollection],
	);
}

/**
 * A hook that returns a callback for selecting a directory from the browser dialog
 * and adding its contents to an array of pending files at a given ID.
 *
 * @param id - A unique ID that is used as a key for the files atom family
 */
export function useSelectDirectory(
	id: string,
	options: {
		/**
		 * Called after the selected file atoms have been created
		 */
		onFileSelected?: (file: {
			atom: UploaderFileAtom;
			data: UploaderFileData;
		}) => void | Promise<void>;
	} = {},
): SelectDirectoryCallback {
	const setFileCollection = useSetAtom(fileCollectionAtomFamily(id));
	const storedOptions = useRef(options);
	useEffect(() => {
		storedOptions.current = options;
	});

	return useCallback(
		function selectDirectory({ name, path } = {}) {
			// Create virtual input element
			const el = document.createElement("input");
			el.type = "file";
			el.webkitdirectory = true;

			// eslint-disable-next-line func-style
			const onChange: EventListener = async (e) => {
				if (e.target instanceof HTMLInputElement) {
					const files: UploaderFileAtom[] = [];
					const target = e.target;

					for (const fileIndex in target.files) {
						const index = Number(fileIndex);

						if (isNaN(Number(index))) {
							continue;
						}

						// Get file object
						const file = target.files.item(index);

						if (file === null) {
							continue;
						}

						const data = {
							id: crypto.randomUUID(),
							name: name ?? file.name,
							path: `${path?.replace(/\/$/, "")}/${file.webkitRelativePath}`,
							file,
							source: URL.createObjectURL(file),
						};

						const bytesUploadedAtom = atom(0);
						const fileAtom = atom<UploaderFile>({
							...data,
							bytesUploaded: bytesUploadedAtom,
							progress: atom(
								(get) => {
									return get(bytesUploadedAtom) / file.size;
								},
								(_, set, bytes: number | ((current: number) => number)) => {
									set(
										bytesUploadedAtom,
										typeof bytes === "function"
											? bytes
											: (current) => current + bytes,
									);
								},
							),
							status: atom<ExtractAtomValue<UploaderFile["status"]>>("idle"),
						});

						files.push(fileAtom);
						storedOptions.current.onFileSelected?.({ atom: fileAtom, data });
					}
					// Set the selected files to the collection
					setFileCollection((current) => ({
						...current,
						files: [...current.files, ...files],
					}));
					// Remove event listener after operation
					el.removeEventListener("change", onChange);
					// Remove input element after operation
					el.remove();
				}
			};

			el.addEventListener("change", onChange);
			el.click();
		},
		[setFileCollection],
	);
}

/**
 * A hook that returns a callback which will start uploading a
 * provided `idle` file.
 */
export function useUploadFile(): <ResponseType>(
	options: UploadFileOptions<ResponseType>,
) => void {
	// @ts-expect-error
	return useSetAtom(uploadFileAtom);
}

/**
 * A hook that returns a callback for cancelling a file upload if
 * possible.
 *
 * @param atom - A file atom
 */
export function useCancelFileUpload(atom: UploaderFileAtom): () => void {
	const file = useAtomValue(atom);
	const setStatus = useSetAtom(file.status);

	return useCallback(() => {
		file.abortController?.abort();
		setStatus("cancelled");
	}, [setStatus, file.abortController]);
}

/**
 * A hook that returns the `name`, `size`, `source`, and `id` from a
 * file atom
 *
 * @param atom - A file atom
 */
export function useFileDataAtom(
	atom: PrimitiveAtom<UploaderFile>,
): UploaderFileData {
	const file = useAtomValue(atom);
	return useMemo(
		() => ({
			id: file.id,
			name: file.name,
			path: file.path,
			file: file.file,
			source: file.source,
		}),
		[file.id, file.name, file.path, file.file, file.source],
	);
}

/**
 * A hook that returns the status from a file atom
 *
 * @param atom - A file atom
 */
export function useFileStatus(
	atom: UploaderFileAtom,
): ExtractAtomValue<UploaderFile["status"]> {
	return useAtomValue(useAtomValue(atom).status);
}

/**
 * A hook that returns the upload progress from a file atom if bytes uploaded
 * has been set by you.
 *
 * @param atom - A file atom
 * @example
 * ```tsx
 * const progress = useProgress(fileAtom);
 * return <span>{progress * 100}% uploaded</span>
 * ```
 */
export function useProgress(atom: UploaderFileAtom): number {
	return useAtomValue(useAtomValue(atom).progress);
}

/**
 * A hook that returns an array of all of the file atoms associated with an uploader ID.
 *
 * @param id - The id of the uploader
 */
export function useSelectedFiles(
	id: string,
	status: ExtractAtomValue<UploaderFile["status"]>[] = [
		"idle",
		"uploading",
		"queued",
	],
): UploaderFileAtom[] {
	const selectedFiles = useAtomValue(filesByStatusAtomFamily({ id, status }));
	return selectedFiles;
}

/**
 * An atom family that returns an array of file atoms whose upload states are
 * being tracked throughout their entire lifetime.
 */
export const fileCollectionAtomFamily = atomFamily(
	(id: string) =>
		atom<UploaderFilesAtomValue>({
			id,
			files: [],
		}),
	(a, b) => a === b,
);

/**
 * A write-only atom for uploading a single file using a given `put` function
 */
export const uploadFileAtom = atom<null, [UploadFileOptions], void>(
	null,
	(get, set, { file, put, onCancel, onSuccess, onError }) => {
		uploadFile();

		async function uploadFile(): Promise<void> {
			const uploadingFile = get(file);

			if (get(uploadingFile.status) === "cancelled") {
				return;
			}

			// Allows the user to abort the upload gracefully
			const abortController = new AbortController();
			set(atom, (current) => ({ ...current, abortController }));
			set(uploadingFile.status, "uploading");
			// If we catch an abort make sure the upload status has been changed to
			// cancel
			const abortSignal = abortController.signal;
			// eslint-disable-next-line func-style
			const handleAbortSignal = (): void => {
				onCancel?.();
				set(uploadingFile.status, "cancelled");
				abortSignal.removeEventListener("abort", handleAbortSignal);
			};
			abortSignal.addEventListener("abort", handleAbortSignal);
			let response: Awaited<ReturnType<typeof put>>;
			const { id, name, path, file } = uploadingFile;
			const responses: Promise<typeof response>[] = [];

			// Bails out if we have aborted in the meantime
			if (
				abortController.signal.aborted ||
				get(uploadingFile.status) === "cancelled"
			) {
				return;
			}

			responses.push(
				put({
					id,
					name,
					path,
					file,
					content: uploadingFile.file,
					abortSignal: abortController.signal,
				}),
			);

			let result: Awaited<ReturnType<typeof put>>[] = [];

			try {
				result = await Promise.all(responses);
			} catch (err) {
				// Abort other requests if one fails
				abortController.abort();
				set(uploadingFile.status, "error");

				const error =
					typeof err === "string"
						? err
						: err instanceof Error
							? err.message
							: "An unknown error occurred";
				set(atom, (current) => ({ ...current, error }));
				onError?.(err);
			} finally {
				abortSignal.removeEventListener("abort", handleAbortSignal);
			}

			// We don't want to add success states to any files that have already
			// errored out or been cancelled.
			if (get(uploadingFile.status) === "uploading") {
				set(uploadingFile.status, "success");
				set(atom, (current) => ({ ...current, response }));
				onSuccess?.(result);
			}
		}
	},
);

/**
 * An atom family that returns an array of file atoms in the given statuses.
 */
export const filesByStatusAtomFamily = atomFamily(
	({
		id,
		status,
	}: {
		id: string;
		status: ExtractAtomValue<UploaderFile["status"]>[];
	}) =>
		atom((get) =>
			get(fileCollectionAtomFamily(id)).files.filter((file) =>
				status.includes(get(get(file).status)),
			),
		),
	(a, b) =>
		a.id === b.id &&
		a.status.length == b.status.length &&
		a.status.every((status) => b.status.includes(status)),
);

/**
 * An atom family that returns an array of file atoms whose upload status is "idle"
 */
export const idleFilesAtomFamily = atomFamily(
	(id: string) => filesByStatusAtomFamily({ id, status: ["idle"] }),
	(a, b) => a === b,
);

/**
 * An atom family that returns an array of file atoms whose upload status is
 * "idle", "queued", or "uploading"
 */
export const pendingFilesAtomFamily = atomFamily(
	(id: string) =>
		filesByStatusAtomFamily({ id, status: ["idle", "queued", "uploading"] }),
	(a, b) => a === b,
);

/**
 * An atom family that returns an array of file atoms whose upload status is "uploading"
 */
export const uploadingFilesAtomFamily = atomFamily(
	(id: string) => filesByStatusAtomFamily({ id, status: ["uploading"] }),
	(a, b) => a === b,
);

/**
 * An atom family that returns an array of file atoms whose upload status is "error"
 */
export const failedFilesAtomFamily = atomFamily(
	(id: string) => filesByStatusAtomFamily({ id, status: ["error"] }),
	(a, b) => a === b,
);

/**
 * An atom family that returns an array of file atoms whose upload status is "success"
 */
export const uploadedFilesAtomFamily = atomFamily(
	(id: string) => filesByStatusAtomFamily({ id, status: ["success"] }),
	(a, b) => a === b,
);

type UploadFileOptions<ResponseType = unknown> = {
	file: UploaderFile;
	/**
	 * A function that uploads the file
	 *
	 * @param options - Options
	 */
	put: PutRequest<ResponseType>;
	/**
	 * Sets the chunk size to use for uploads. Defaults to 1MB.
	 */
	chunkSize?: number;
	/**
	 * A function that is called when the upload is cancelled
	 */
	onCancel?: () => void;
	/**
	 * Called when all of the files have successfully uploaded
	 */
	onSuccess?: (responses: ResponseType[]) => Promise<void> | void;
	/**
	 * Called when there was an error uploading
	 */
	onError?: (err: unknown) => Promise<void> | void;
};

type PutRequest<ResponseType = unknown> = (data: {
	/**
	 * The unique ID of the file
	 */
	id: string;
	/**
	 * The file name
	 */
	name: string;
	/**
	 * The file path
	 */
	path: string;
	/**
	 * The file
	 */
	file: File;
	/**
	 * The content in the current chunk
	 */
	content: Blob;
	/**
	 * An abort signal that can be provided to `fetch` in order to
	 * cancel an upload that is in progress
	 */
	abortSignal: AbortSignal;
}) => Promise<ResponseType>;

export type UploaderFilesAtomValue = {
	/**
	 * The ID used to create the atom with
	 */
	id: string;
	/**
	 * The files that have progressed through this atom in its lifetime
	 */
	files: PrimitiveAtom<UploaderFile>[];
};

export type UploaderFile = {
	/**
	 * A UUID for identifying the file
	 */
	id: string;
	/**
	 * The source of the file as a string if the file is less than 15MB in size,
	 * otherwise `null`. This is useful for generating previews.
	 */
	source: null | string;
	/**
	 * The local name of the file
	 */
	name: string;
	/**
	 * The path on the server to upload the file to
	 */
	path: string;
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
	abortController?: AbortController;
};

export type UploaderFileAtom = PrimitiveAtom<UploaderFile>;

export type UploaderFileData = Pick<
	UploaderFile,
	"id" | "name" | "file" | "path" | "source"
>;

export type SelectFilesCallback = (options?: {
	/**
	 * Replaces the local file name with this one
	 */
	name?: string;
	/**
	 * The base path to upload to on the server-side. The file's name will
	 * be joined to this.
	 */
	path?: string;
}) => void;

export type SelectDirectoryCallback = SelectFilesCallback;
