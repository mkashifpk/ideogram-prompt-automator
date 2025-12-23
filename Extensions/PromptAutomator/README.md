# Prompt Automator (Chrome Extension)

Chrome extension that queues Ideogram prompts from a text list, types them into the prompt field, and clicks Generate automatically with speed controls.

## Installation

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the folder: `Extensions/PromptAutomator`.

## Usage

1. Open the target website in a tab (e.g., Ideogram).
2. Click the extension icon to open the popup.
3. Provide prompts:
   - Upload a `.txt` file (comma or newline separated), or
   - Paste prompts into the textarea (comma or newline separated).
4. (Optional) Set selectors if auto-detect fails:
   - **Input selector**: CSS selector for the prompt input field.
   - **Generate button selector**: CSS selector for the Generate button.
5. Set speed controls:
   - **Typing speed (ms per char)**: Higher value = slower typing.
   - **Delay between prompts (ms)**: Higher value = longer wait before the next prompt.
6. Click **Start**.

## Controls

- **Start**: Begin the queue (or resume if paused).
- **Stop**: Pause after the current action.
- **Cancel**: Stop and reset progress to 0.

## Tips

- If the extension cannot find the input/button, use DevTools to copy CSS selectors.
- For slow typing and maximum wait: increase both sliders.
- For instant typing: set Typing speed to `0`.

## Troubleshooting

- **"Input not found"**: Provide a valid Input selector.
- **"Generate button not found"**: Provide a valid Button selector.
- If the popup shows **"No access"**, reload the page and reopen the popup.

## Contact / Suggestions

M Kashif  
mkashifiqbalpk@gmail.com

## Support

Buy me a coffee: https://buymeacoffee.com/devkashif
