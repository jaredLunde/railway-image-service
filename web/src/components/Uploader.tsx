import { useState } from "react";
import { atom, useAtomValue } from "jotai";
import {
	IMAGE_MIMES,
	useUploadFile,
	type SelectedFile,
	hashFile,
	extname,
	useDropzone,
	Provider,
	useProgress,
	usePreview,
	useAbort,
	useSelectedFile,
	useStatus,
} from "railway-image-service/react";
import { useSetAtom } from "jotai";

export function Uploader() {
	return (
		<Provider maxUploadSize={10 * 1024 * 1024} url="/upload">
			<FileDropzone />
			<UploadedFilesList />
		</Provider>
	);
}

function FileDropzone() {
	const setUploadedFiles = useSetAtom(uploadedFilesAtom);
	const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
	const uploadFile = useUploadFile();
	const dropzone = useDropzone({
		accept: IMAGE_MIMES,
		multiple: true,
		onSelect(file) {
			setSelectedFile(file);
			uploadFile(file, {
				async key(file) {
					const key = await hashFile(file);
					return `${key}${extname(file)}`;
				},
				onProgress(_, progress) {
					console.log("progress", progress);
				},
				onAbort() {
					setSelectedFile(null);
				},
				onSuccess({ key }) {
					setUploadedFiles((current) => [key, ...current]);
				},
				onError(_, e) {
					alert(e);
				},
			});
		},
	});

	return (
		<div className="max-w-xl space-y-em4 w-[360px]">
			<button
				className="relative w-full p-8 border-2 border-dashed border-gray-300 rounded-lg bg-white text-center hover:border-gray-400 data-[dropzone-active=true]:border-blue-500 transition-colors duration-200"
				{...dropzone.props}
			>
				<div className="mx-auto mb-6">
					<svg
						className="mx-auto h-12 w-12 text-gray-400"
						stroke="currentColor"
						fill="none"
						viewBox="0 0 48 48"
						aria-hidden="true"
					>
						<path
							d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</div>

				<div className="space-y-2">
					<p className="text-lg font-medium text-gray-700">
						Drop your images here
					</p>
					<p className="text-sm text-gray-500">or click to browse</p>
				</div>

				<div className="mt-4">
					<p className="text-xs text-gray-500">
						PNG, JPG, SVG, or GIF up to 10MB
					</p>
				</div>

				{selectedFile && <SelectedFile selectedFile={selectedFile} />}
			</button>
		</div>
	);
}

function SelectedFile({ selectedFile }: { selectedFile: SelectedFile }) {
	const preview = usePreview(selectedFile);
	const progress = useProgress(selectedFile);
	const abort = useAbort(selectedFile);
	const status = useStatus(selectedFile);
	const { file } = useSelectedFile(selectedFile);

	return (
		<div className="mt-8 p-4 bg-gray-50 rounded-lg">
			<div className="flex items-center">
				<div className="h-16 w-16 flex-shrink-0 rounded-lg bg-gray-200 flex items-center justify-center">
					{preview.status === "success" ? (
						<img
							src={preview.data}
							alt=""
							className="h-16 w-16 rounded-lg overflow-hidden bg-white object-cover"
						/>
					) : (
						<div>...</div>
					)}
				</div>

				<div className="ml-4 flex-1">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-gray-900">{file.name}</p>
							<p className="text-sm text-gray-500">{formatBytes(file.size)}</p>
						</div>
						{!["error", "success"].includes(status) && (
							<div
								role="button"
								className="ml-4 text-sm font-medium text-blue-600 hover:text-blue-500"
								onClick={(e) => {
									e.stopPropagation();
									abort();
								}}
							>
								Cancel
							</div>
						)}
					</div>
				</div>
			</div>

			<div className="mt-6 w-full bg-gray-200 rounded-full h-1.5">
				<div
					className="bg-blue-600 h-1.5 rounded-full"
					style={{ width: `${progress.progress * 100}%` }}
				></div>
			</div>
		</div>
	);
}

function UploadedFilesList() {
	const keys = useAtomValue(uploadedFilesAtom);
	return (
		<div className="grid grid-cols-3 justify-start items-start w-[348px] gap-8">
			{keys.map((key) => {
				return (
					<img
						key={key}
						src={`/avatars/xl/blob/${key}`}
						width={100}
						height={100}
						className="shadow rounded-xl"
					/>
				);
			})}
		</div>
	);
}

const uploadedFilesAtom = atom<string[]>([]);

function formatBytes(bytes: number) {
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	if (bytes === 0) return "0 B";
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}
