# Railway Image Service

Integrating with your image service is easier than ever with these React components, hooks,
and Node.js client.

## Installation

```sh
npm install jotai railway-image-service
```

## Examples

- **Astro site**

- **Next.js site**

---

## Node SDK

### `ImageServiceClient`

A constructor that creates a Node client for your image service.

**Options**

| Name                 | Type     | Required? | Description                                                                                                                |
| -------------------- | -------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `url`                | `string` | Yes       | The base URL of your image service.                                                                                        |
| `secretKey`          | `string` | Yes       | The `SECRET_KEY` of your image service.                                                                                    |
| `signatureSecretKey` | `string` | No        | The `SIGNATURE_SECRET_KEY` of your image service. If provided URLs can be signed locally without making a network request. |

#### `ImageServiceClient.put()`

Create or overwrite a file in blob storage.

**Arguments**

| Name      | Type                                      | Required? | Description                                      |
| --------- | ----------------------------------------- | --------- | ------------------------------------------------ |
| `key`     | `string`                                  | Yes       | The key to use in blob storage.                  |
| `content` | `ReadableStream \| Buffer \| ArrayBuffer` | Yes       | The contents of the file to put in blob storage. |

**Returns**

A `Response` object.

#### `ImageServiceClient.get()`

Get a file from blob storage.

**Arguments**

| Name  | Type     | Required? | Description                       |
| ----- | -------- | --------- | --------------------------------- |
| `key` | `string` | Yes       | The key to get from blob storage. |

**Returns**

A `Response` object.

#### `ImageServiceClient.delete()`

Delete a file in blob storage.

**Arguments**

| Name  | Type     | Required? | Description                          |
| ----- | -------- | --------- | ------------------------------------ |
| `key` | `string` | Yes       | The key to delete from blob storage. |

**Returns**

A `Response` object.

#### `ImageServiceClient.list()`

List keys in blob storage.

**Options**

| Name         | Type     | Required? | Description                                         |
| ------------ | -------- | --------- | --------------------------------------------------- |
| `prefix`     | `string` | No        | A prefix to filter keys by e.g. `path/to/`.         |
| `limit`      | `number` | No        | The maximum number of keys to return.               |
| `startingAt` | `string` | No        | The key to start listing from. Used for pagination. |

**Returns**

A list result object

```ts
export type ListResult = {
	/** The keys of the files */
	keys: string[];
	/** A URL to the next page of results */
	nextPage?: string;
	/** Whether or not there are more results */
	hasMore: boolean;
};
```

#### `ImageServiceClient.sign()`

Get a signed URL for a path.

**Arguments**

| Name   | Type     | Required? | Description                       |
| ------ | -------- | --------- | --------------------------------- |
| `path` | `string` | Yes       | The path to get a signed URL for. |

**Returns**

A signed URL for the given path.

---

## React API

### Components

#### `<Provider>`

Provides configuration to its child hooks and components.

**Props**

| Name            | Type                                   | Required? | Description                                                                                                                   |
| --------------- | -------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `url`           | `string \| {get: string; put: string}` | Yes       | The base URL where blob storage (PUT) and serve (GET) requests will be sent. Your file blob `key` will be joined to this URL. |
| `maxUploadSize` | `number`                               | No        | The maximum size of an image that can be uploaded in bytes.                                                                   |

#### `<Image>`

A React component that generates an image URL using the Thumbor URL specification and
creates an `img` element with the generated URL.

The URL is constructed in the following order:
`/trim/AxB:CxD/fit-in/stretch/-Ex-F/GxH:IxJ/HALIGN/VALIGN/smart/filters/IMAGE`

**Example**

```tsx
<Image
	srcKey="image.jpg"
	width={400}
	height={300}
	fit="contain"
	transform={{
		smart: true,
		flip: "horizontal",
	}}
/>;
```

**Props**

See the [Imagor documentation](https://github.com/cshum/imagor/blob/e8b9c7c731a1ce65368f20745f5064d3f1083ac1/README.md#image-endpoint) for
filter and transform-specific documentation.

| Name        | Type             | Required? | Description                                                                                      |
| ----------- | ---------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `src`       | `string`         | No        | An image URL from the Internet to process and serve (e.g. https://github.com/jaredLunde.png)     |
| `srcKey`    | `string`         | No        | A key from blob storage to process and serve (e.g. your-image.png)                               |
| `fit`       | `ImageFit`       | No        | How image should fit within target dimensions (`cover`, `contain`, `stretch`, `contain-stretch`) |
| `transform` | `ImageTransform` | No        | Apply image transformations                                                                      |
| `filters`   | `ImageFilters`   | No        | Apply filters to the image                                                                       |

#### `<Avatar>`

### Hooks

#### `useDropzone()`

A hook that creates a clickable dropzone for files. This is a convenience
wrapper around [`useSelectFiles`](#useselectfiles) and [`useDropFiles`](#usedropfiles).

**Options**

| Name       | Type       | Required? | Description                                                                                                                        |
| ---------- | ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `accept`   | `string`   | No        | A comma-separated list of content types your users are allowed to select in the browser dialog, e.g. [`IMAGE_MIMES`](#image_mimes) |
| `multiple` | `boolean`  | No        | Set to `true` if you want to allow multiple files to be selected at once.                                                          |
| `key`      | `Key`      | No        | Set the key that will be stored in blob storage for the file. Defaults to the file name.                                           |
| `onSelect` | `OnSelect` | No        | Called each time a file is selected.                                                                                               |

**Returns**

```ts
type ReturnType = {
	/**
	 * Props that can directly added to a dropzone container.
	 */
	props: React.HTMLAttributes<HTMLElement>;
	/**
	 * Whether or not the dropzone is actively being dragged voer.
	 */
	isActive: dropFiles.isActive;
};
```

#### `useSelectFiles()`

A hook that returns a callback which opens a browser dialog for
selecting files when called.

**Options**

| Name       | Type       | Required? | Description                                                                                                                        |
| ---------- | ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `accept`   | `string`   | No        | A comma-separated list of content types your users are allowed to select in the browser dialog, e.g. [`IMAGE_MIMES`](#image_mimes) |
| `multiple` | `boolean`  | No        | Set to `true` if you want to allow multiple files to be selected at once.                                                          |
| `onSelect` | `OnSelect` | No        | Called each time a file is selected.                                                                                               |

**Returns**

```ts
export type SelectFilesCallback = (options?: {
	/**
	 * The key that will be stored in blob storage for the file.
	 */
	key?: Key;
}) => void;
```

#### `useDropFiles()`

A hook that handles drag-n-drop file uploads.

**Options**

| Name       | Type       | Required? | Description                                                                                                                        |
| ---------- | ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `accept`   | `string`   | No        | A comma-separated list of content types your users are allowed to select in the browser dialog, e.g. [`IMAGE_MIMES`](#image_mimes) |
| `multiple` | `boolean`  | No        | Set to `true` if you want to allow multiple files to be selected at once.                                                          |
| `key`      | `Key`      | No        | Set the key that will be stored in blob storage for the file. Defaults to the file name.                                           |
| `onSelect` | `OnSelect` | No        | Called each time a file is selected.                                                                                               |

**Returns**

```ts
type ReturnType = {
	/**
	 * Props that can directly added to a dropzone container.
	 */
	props: React.HTMLAttributes<HTMLElement>;
	/**
	 * Whether or not the dropzone is actively being dragged voer.
	 */
	isActive: dropFiles.isActive;
};
```

#### `useSelectDirectory()`

A hook that returns a callback that opens a browser dialog for selecting files from an
entire directory when called.

**Options**

| Name       | Type       | Required? | Description                          |
| ---------- | ---------- | --------- | ------------------------------------ |
| `onSelect` | `OnSelect` | No        | Called each time a file is selected. |

**Returns**

```ts
export type SelectFilesCallback = (options?: {
	/**
	 * The key that will be stored in blob storage for the file.
	 */
	key?: Key;
}) => void;
```

#### `useSelectedFile()`

A hook that returns the raw file `File` object from a selected file and the key.

**Arguments**

| Name           | Type           | Required? | Description                                                                                                              |
| -------------- | -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `selectedFile` | `SelectedFile` | No        | A file that was selected with any of the `useDropzone`, `useSelectFiles`, `useDropFiles`, or `useSelectDirectory` hooks. |

**Returns**

```ts
type ReturnType = {
	/**
	 * The key that will be added via the blob storage API
	 */
	key: file.key;
	/**
	 * The raw `File` object created by the browser
	 */
	file: file.file;
};
```

#### `useUploadFile()`

A hook that returns a callback for uploading a file to the server.

**Returns**

A callback used to upload a single file to blob storage.

```ts
async function uploadFile(
	file: SelectedFile,
	options: UploadFileOptions = {},
): Promise<void>;

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
	onAbort?: () => void;
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
```

#### `useUploadFiles()`

A hook that returns a function for uploading multiple files concurrently
with a configurable concurrency limit.

**Returns**

A callback used to upload multiple files to blob storage.

```ts
async function uploadFiles(
	selectedFiles: Array<SelectedFile>,
	options: {
		/**
		 * Maximum number of concurrent uploads
		 * @default 3
		 */
		concurrency?: number;
	} & UploadFileOptions = {},
): Promise<void>;
```

#### `useProgress()`

A hook that returns detailed progress information for a file upload. This includes
the upload rate, estimated time remaining, and other upload statistics.

**Arguments**

| Name           | Type           | Required? | Description                                                                                                              |
| -------------- | -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `selectedFile` | `SelectedFile` | No        | A file that was selected with any of the `useDropzone`, `useSelectFiles`, `useDropFiles`, or `useSelectDirectory` hooks. |

**Returns**

Progress information including:

- `total` - Total file size in bytes
- `loaded` - Number of bytes uploaded
- `progress` - Upload progress as a fraction between 0-1
- `rate` - Upload speed in bytes per second
- `estimatedTimeRemaining` - Estimated milliseconds until completion, or null if not started
- `timeElapsed` - Milliseconds since upload started

#### `useStatus()`

A hook that returns the status from a selected file.

#### `usePreview()`

**Arguments**

| Name           | Type           | Required? | Description                                                                                                              |
| -------------- | -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `selectedFile` | `SelectedFile` | No        | A file that was selected with any of the `useDropzone`, `useSelectFiles`, `useDropFiles`, or `useSelectDirectory` hooks. |

**Returns**

The file status

```ts
export type SelectedFileStatus =
	| "idle"
	| "queued"
	| "uploading"
	| "aborted"
	| "success"
	| "error";
```

#### `useAbort()`

A hook that returns a callback for cancelling a file upload if possible.

**Arguments**

| Name           | Type           | Required? | Description                                                                                                              |
| -------------- | -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `selectedFile` | `SelectedFile` | No        | A file that was selected with any of the `useDropzone`, `useSelectFiles`, `useDropFiles`, or `useSelectDirectory` hooks. |

**Returns**

A callback that signals the abort controller for the file and sets its status to `cancelled` when the
file isn't in a eterminal state (success/error).

### Utility functions

#### `hashFile()`

Get the SHA-256 hash of a file's contents

**Arguments**

| Name   | Type   | Required? | Description      |
| ------ | ------ | --------- | ---------------- |
| `file` | `File` | Yes       | The file to hash |

**Returns**

A promise that resolves with the SHA-256 hash of the file's contents

```ts
async function hashFile(file: File): Promise<string>;
```

#### `extname()`

Get the file extension of a file

**Arguments**

| Name   | Type   | Required? | Description      |
| ------ | ------ | --------- | ---------------- |
| `file` | `File` | Yes       | The file to hash |

**Returns**

The file extension

```ts
function extname(file: File): string;
```

### Constants

#### `IMAGE_MIMES`

MIME types for images. Can be used with the `accept` option in `useSelectFiles` to restrict
which files can be selected in the browser dialog.
