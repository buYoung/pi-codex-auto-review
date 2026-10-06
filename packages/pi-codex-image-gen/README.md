# @buyong/pi-codex-image-gen

**English** | [한국어](README.ko.md)

Generate and edit images in Pi with the Codex-compatible `image_gen` tool and bundled `imagegen` skill. Image requests use Pi's `openai-codex` ChatGPT subscription login; your conversation provider and model stay unchanged.

## Requirements

- Node.js 22.19 or later and Pi 0.99.1 or later.
- A usable ChatGPT Plus/Pro subscription login through Pi's `openai-codex` provider. Account eligibility and actual image-model availability depend on the backend response.
- For edits, readable local reference images or images still present in the model-visible conversation.

An OpenAI API key alone does not provide the subscription credentials this extension uses. Prompts and reference images are sent to the image backend; use only data you are authorized to send.

## Install, sign in, and generate an image

Install a published release, then start Pi:

```sh
pi install npm:@buyong/pi-codex-image-gen
pi list
pi
```

Do not also enable this extension through `@buyong/pi-codex`. Inside Pi, sign in:

```text
/login openai-codex
```

Ask for a new image:

```text
Use image_gen to create a watercolor illustration of a small cafe on a rainy street.
```

The result includes the generated image. The extension also attempts to save it locally; see [output and storage](#output-and-storage).

Without subscription login, the extension hides `image_gen` and its bundled skill from the model. A tool hidden by the extension is restored before the next user prompt after login. A tool you disabled yourself stays disabled. You do not need to switch the conversation model to `openai-codex`.

## Edit an image

Attach an image to the conversation, or provide its absolute local path. For example:

```text
Use image_gen to edit /absolute/path/to/product.png. Remove the background and keep the product unchanged with a transparent background.
```

Replace the example path with your file. Ask explicitly for transparency when needed. Up to five reference images can be used in one edit.

| Tool argument | Behavior |
| --- | --- |
| `prompt` | Required description of the new image or edits |
| `transparent_background` | Boolean; defaults to `false` |
| `referenced_image_paths` | Up to five absolute local paths; `~/` expands to the home directory |
| `num_last_images_to_include` | Use the latest 1–5 images from the current model-visible conversation |

Use only one reference mechanism per call. Omit both for a new image. Unknown argument fields, invalid types, out-of-range counts, and conflicting reference choices are rejected before a request is sent.

Local PNG/JPEG/WebP references retain their source bytes after decode validation. Other formats are converted to PNG if Pi can decode them. Recent conversation images are sent in chronological order as recorded. If fewer requested images remain in context, the call reports an error rather than selecting unrelated files.

## Select an image model

Run `/codex-imagen` to select **`gpt-image-2.5`** (default) or **`gpt-image-2`**. Cancelling the picker keeps the current choice. Explicit arguments also work without a UI:

```text
/codex-imagen gpt-image-2.5
/codex-imagen gpt-image-2
```

Settings live at `<agentDir>/codex-image-gen/settings.json`. `agentDir` honors `PI_CODING_AGENT_DIR` and normally is `~/.pi/agent`.

```json
{
  "model": "gpt-image-2.5"
}
```

The choice is saved and applies to subsequent generation/editing requests, including after restarting Pi. Every request rereads the file, so manual edits apply without `/reload`. A missing file or missing `model` uses the default. Invalid or unreadable settings return an error; the extension does not silently select another model. Commands preserve unrelated settings keys when saving.

These model names are sent to the subscription backend. Their presence in the selector is not proof that the account/backend supports them.

## Output and storage

The tool returns the first image from the backend response as PNG image content and attempts to save it at:

```text
<agentDir>/generated_images/<sessionId>/<toolCallId>.png
```

Session/tool-call names are sanitized for filenames. The result's `details.savedPath` is present when saving succeeds; a save failure does not discard the returned image. Keep a copy of a saved image if you need to edit it after it leaves conversation context.

An error is returned when authentication cannot be resolved, a reference cannot be loaded, settings are invalid, the backend fails, or no image data is returned. The caller's cancellation signal is passed to image requests; cancellation does not establish whether a remote service already performed work.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Tool hidden or missing subscription credentials | Run `/login openai-codex` again. Keep your conversation model selected. If you disabled the tool manually, re-enable it yourself. |
| Invalid image-model setting | Set `model` to `gpt-image-2.5` or `gpt-image-2` in the named settings file; the next request rereads it. |
| Local reference cannot be read/decoded | Check the absolute path, file permissions, and supported image decoding. |
| Requested recent images are unavailable | Attach them again or use their saved local paths; images outside the current model-visible context are not recovered automatically. |
| Backend rejects the model or account | Check your account access and the returned error. The extension does not substitute another model or use an API key as a subscription fallback. |

## Build and load from source

Run from the repository root:

```sh
npm ci --ignore-scripts
npm run build -- --filter=@buyong/pi-codex-image-gen
node_modules/.bin/pi -ne -e ./packages/pi-codex-image-gen/dist/index.js --skill ./packages/pi-codex-image-gen/skills
```

The explicit skill path loads the bundled guidance for this temporary invocation. `-ne` disables automatic extension discovery. Rebuild after source changes. Source runs still need Pi's subscription login; building does not generate an image or verify live account access.

See the [publishing guide](https://github.com/buYoung/pi-codex-auto-review/blob/master/docs/publishing.md) for package preparation.

## License

Code: [Apache-2.0](https://github.com/buYoung/pi-codex-auto-review/blob/master/LICENSE), included as `LICENSE` in the archive. The adapted Codex skill also includes its [license](skills/imagegen/LICENSE.txt) and [attribution notice](skills/imagegen/NOTICE).
