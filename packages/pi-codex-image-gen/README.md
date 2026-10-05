# pi-codex-image-gen

**English** | [한국어](README.ko.md)

Generate and edit images in Pi with the Codex-compatible `image_gen` tool and the bundled `imagegen` skill. Image requests use Pi's `openai-codex` ChatGPT subscription login while your current chat provider and model stay unchanged.

## Requirements

- Node.js 22.19 or later.
- Pi 0.99.1 or later.
- A ChatGPT Plus/Pro account signed in through Pi's `openai-codex` provider. Image availability depends on the account and backend response.

## Install and sign in

```sh
pi install npm:@buyong/pi-codex-image-gen
pi list
pi
```

In Pi, sign in with your ChatGPT account:

```text
/login openai-codex
```

When that login is missing, the extension hides `image_gen` and its bundled skill from the model. If the extension hid the tool, it enables it again before the next user prompt after login. A tool you disabled yourself stays disabled.

## Generate and edit images

Ask Pi to create an image, for example:

```text
Use image_gen to create a watercolor illustration of a small cafe on a rainy street.
```

For edits, attach an image to the conversation or provide an absolute path to a local image:

```text
Use image_gen to edit /absolute/path/to/product.png. Remove the background and keep the product unchanged with a transparent background.
```

The tool supports up to five reference images. The bundled skill guides the model through prompt composition and the choice of reference images.

| Argument | Behavior |
| --- | --- |
| `prompt` | Required description of the image or requested changes |
| `transparent_background` | Request transparency; defaults to `false` |
| `referenced_image_paths` | Up to five absolute local image paths; `~/` is expanded |
| `num_last_images_to_include` | Use the most recent 1–5 images from the current model-visible conversation |

Use only one reference option per call. Omit both reference options to generate a new image.

The generated image is returned to Pi as image content. The extension also attempts to save a PNG under `<agentDir>/generated_images/<sessionId>/<toolCallId>.png`, where `agentDir` is Pi's agent data directory. Session and tool-call names are sanitized for filenames. If saving fails, the image is still returned to Pi.

## Troubleshooting

If `image_gen` is unavailable or reports missing subscription credentials, run `/login openai-codex` and sign in again. An OpenAI API key alone does not supply the ChatGPT subscription credentials this extension uses. Your current chat model can stay selected.

For an unreadable reference image, check its absolute path and that Pi can read and decode the file. For a recent-image edit, keep the required images in the current conversation context or pass their local paths instead.

## License

[Apache-2.0](LICENSE). The adapted OpenAI Codex skill has its own [license](skills/imagegen/LICENSE.txt) and [attribution notice](skills/imagegen/NOTICE).
