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

### `imageUrlBuilder()`

Creates a fluent builder for constructing image transformation URLs. Supports chaining of operations for resizing, cropping, filtering, and other image manipulations.

**Arguments**

| Name     | Type                 | Required? | Description                                          |
| -------- | -------------------- | --------- | ---------------------------------------------------- |
| `client` | `ImageServiceClient` | Yes       | The image service client instance used to sign URLs. |

**Returns**

An `ImageUrlBuilder` instance that supports method chaining.

**Examples**

```ts
import {
	ImageServiceClient,
	imageUrlBuilder,
} from "railway-image-service/server";

const client = new ImageServiceClient({
	url: process.env.IMAGE_SERVICE_URL,
	secretKey: process.env.IMAGE_SERVICE_SECRET_KEY,
	signatureSecretKey: process.env.IMAGE_SERVICE_SIGNATURE_SECRET_KEY,
});

const builder = imageUrlBuilder(client);

// Basic image resize
const url = builder.url("https://github.com/railwayapp.png").size(48).build();

// Avatar generation
const url = builder.avatar(48, { quality: 90 }).build();

// Complex transformation
const url = builder
	.key("my-image-key.jpg")
	.size(1200, 800)
	.fit("cover")
	.trim()
	.filter({
		quality: 85,
		brightness: 10,
		format: "webp",
	})
	.build();

// Smart cropping with focal point
const url = builder
	.url("https://example.com/portrait.jpg")
	.size(400, 400)
	.smart()
	.filter({
		focal: "300,400",
		format: "jpeg",
		quality: 90,
	})
	.build();

// Sign the URL remotely
const url = await builder
	.key("my-image-key.jpg")
	.size(1200, 800)
	.fit("cover")
	.trim()
	.filter({
		quality: 85,
		brightness: 10,
		format: "webp",
	});
```

### Image Source Methods

#### `.key(blobKey)`

Sets the image source using a blob storage key.

| Name      | Type     | Required? | Description                            |
| --------- | -------- | --------- | -------------------------------------- |
| `blobKey` | `string` | Yes       | The storage key identifying the image. |

#### `.url(httpUrl)`

Sets the image source using a URL.

| Name      | Type     | Required? | Description                  |
| --------- | -------- | --------- | ---------------------------- |
| `httpUrl` | `string` | Yes       | The URL of the source image. |

### Avatar generation

#### `.avatar(size, filters)`

Applies optimized image filters and transformations for avatar images. Automatically enables smart cropping, cover fitting, and metadata stripping.

| Name      | Type           | Required? | Description                                   |
| --------- | -------------- | --------- | --------------------------------------------- |
| `size`    | `number`       | Yes       | Target size for the avatar (width and height) |
| `filters` | `ImageFilters` | Yes       | Additional filter settings to apply           |

**Default Settings**

- `fit`: `"cover"`
- `smart`: `true`
- `upscale`: `true`
- `quality`: `80`
- `strip_exif`: `true`
- `strip_metadata`: `true`
- `strip_icc`: `true`

### Dimension Methods

#### `.width(value)`

Sets the target width of the output image.

| Name    | Type     | Required? | Description      |
| ------- | -------- | --------- | ---------------- |
| `value` | `number` | Yes       | Width in pixels. |

#### `.height(value)`

Sets the target height of the output image.

| Name    | Type     | Required? | Description       |
| ------- | -------- | --------- | ----------------- |
| `value` | `number` | Yes       | Height in pixels. |

#### `.size(width, height?)`

Sets both width and height of the output image.

| Name     | Type     | Required? | Description                                     |
| -------- | -------- | --------- | ----------------------------------------------- |
| `width`  | `number` | Yes       | Width in pixels.                                |
| `height` | `number` | No        | Height in pixels. Defaults to width if omitted. |

### Transform Methods

#### `.fit(value)`

Sets the fit mode for image resizing.

| Name    | Type       | Required? | Description          |
| ------- | ---------- | --------- | -------------------- |
| `value` | `ImageFit` | Yes       | The fit mode to use. |

**ImageFit Options**

- `"cover"`: Scales to fill the entire box, cropping if necessary
- `"contain"`: Scales to fit within the box while maintaining aspect ratio
- `"stretch"`: Stretches or compresses to exactly fill the box
- `"contain-stretch"`: Combines contain and stretch modes

#### `.flip(direction)`

Flips the image horizontally, vertically, or both.

| Name        | Type                                   | Required? | Description            |
| ----------- | -------------------------------------- | --------- | ---------------------- |
| `direction` | `"horizontal" \| "vertical" \| "both"` | Yes       | The direction to flip. |

#### `.crop(x, y, width, height)`

Crops the image to a specified region.

| Name     | Type               | Required? | Description                                     |
| -------- | ------------------ | --------- | ----------------------------------------------- |
| `x`      | `number \| string` | Yes       | Left coordinate (pixels or percentage with '%') |
| `y`      | `number \| string` | Yes       | Top coordinate (pixels or percentage with '%')  |
| `width`  | `number \| string` | Yes       | Width of crop (pixels or percentage with '%')   |
| `height` | `number \| string` | Yes       | Height of crop (pixels or percentage with '%')  |

#### `.padding(left, top, right, bottom)`

Adds padding around the image.

| Name     | Type     | Required? | Description              |
| -------- | -------- | --------- | ------------------------ |
| `left`   | `number` | Yes       | Left padding in pixels   |
| `top`    | `number` | Yes       | Top padding in pixels    |
| `right`  | `number` | Yes       | Right padding in pixels  |
| `bottom` | `number` | Yes       | Bottom padding in pixels |

#### `.trim(enable?)`

Enables trim mode to remove surrounding space.

| Name     | Type      | Required? | Description                           |
| -------- | --------- | --------- | ------------------------------------- |
| `enable` | `boolean` | No        | Whether to enable trim. Default: true |

#### `.smart(enable?)`

Enables smart detection of focal points for cropping.

| Name     | Type      | Required? | Description                                      |
| -------- | --------- | --------- | ------------------------------------------------ |
| `enable` | `boolean` | No        | Whether to enable smart detection. Default: true |

#### `.align(horizontal?, vertical?)`

Sets the alignment for cropping and fitting operations.

| Name         | Type                            | Required? | Description          |
| ------------ | ------------------------------- | --------- | -------------------- |
| `horizontal` | `"left" \| "center" \| "right"` | No        | Horizontal alignment |
| `vertical`   | `"top" \| "middle" \| "bottom"` | No        | Vertical alignment   |

### Filter Methods

#### `.filter(filters)`

Applies image filters like blur, brightness, contrast, etc.

| Name      | Type           | Required? | Description                       |
| --------- | -------------- | --------- | --------------------------------- |
| `filters` | `ImageFilters` | Yes       | Object containing filter settings |

**ImageFilters Options**

| Name               | Type                       | Description                                    |
| ------------------ | -------------------------- | ---------------------------------------------- |
| `background_color` | `string`                   | Sets background color for transparent images   |
| `blur`             | `number`                   | Applies Gaussian blur (sigma value)            |
| `brightness`       | `number`                   | Adjusts brightness (-100 to 100)               |
| `contrast`         | `number`                   | Adjusts contrast (-100 to 100)                 |
| `fill`             | `string`                   | Fills transparent areas (color/blur/auto/none) |
| `format`           | `ImageFormat`              | Sets output format                             |
| `grayscale`        | `boolean`                  | Converts to grayscale                          |
| `hue`              | `number`                   | Rotates the hue (0-360 degrees)                |
| `orient`           | `Angle`                    | Sets image orientation                         |
| `proportion`       | `number`                   | Scales image by percentage                     |
| `quality`          | `number`                   | Sets JPEG quality (0-100)                      |
| `rgb`              | `[number, number, number]` | Adjusts RGB channels (-100 to 100 each)        |
| `rotate`           | `Angle`                    | Rotates image by fixed angles                  |
| `saturation`       | `number`                   | Adjusts color saturation (-100 to 100)         |
| `sharpen`          | `number`                   | Applies sharpening effect                      |
| `focal`            | `string`                   | Sets focal point for cropping                  |
| `round_corner`     | `object`                   | Adds rounded corners                           |
| `max_bytes`        | `number`                   | Limits output file size                        |
| `max_frames`       | `number`                   | Limits animation frames                        |
| `page`             | `number`                   | Selects specific page/frame                    |
| `dpi`              | `number`                   | Sets DPI for vector formats                    |
| `strip_exif`       | `boolean`                  | Removes EXIF metadata                          |
| `strip_icc`        | `boolean`                  | Removes ICC profile                            |
| `strip_metadata`   | `boolean`                  | Removes all metadata                           |
| `upscale`          | `boolean`                  | Allows upscaling with fit-in                   |
| `attachment`       | `string`                   | Sets download filename                         |
| `expire`           | `number`                   | Sets content expiration                        |
| `preview`          | `boolean`                  | Skips result storage                           |
| `raw`              | `boolean`                  | Returns unprocessed image                      |

### Build Methods

#### `.buildRemote()`

Builds and signs the final URL for the image transformation using the image service client API.

**Returns**

A promise that resolves to the signed URL string.

#### `.build()`

Builds and signs the final URL for the image transformation locally.

**Returns**

A signed URL string.

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
