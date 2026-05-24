# AIFileNamer 🧠📁

> An intelligent, fully autonomous file organisation and renaming desktop application powered by local and cloud AI models.

AIFileNamer reads the content of your files—whether they are text, code, or images—and uses state-of-the-art AI models to automatically generate clean, descriptive filenames and categorise them into logical folder structures.

## ✨ Features

- **Content-Aware Renaming:** Analyses file contents (text, code, or images) to generate accurate and highly descriptive filenames.
- **Intelligent Folder Sorting:** Optionally allows the AI to suggest relative folder structures to automatically sort and categorise your massive directories.
- **Bring Your Own AI:** Plug-and-play support for major cloud AI providers (OpenAI, Anthropic, Groq, DeepSeek, Google AI Studio, OpenRouter) or **100% private local inference** via LM-Studio, Llama.cpp, Jan, GPT4All, and Ollama!
- **Multi-Scanner Workspaces:** Create multiple independent scanner profiles, each watching a different directory with its own specific AI provider, custom prompts, and rate limits, all running concurrently.
- **Infinite Background Syncing:** Watch directories effortlessly. Drop new files into your target folder using your OS file explorer, and AIFileNamer instantly picks them up in the UI.
- **Fully Autonomous Mode:** Enable Auto-Run and watch the app iterate through thousands of files, processing AI requests, organising, and saving everything completely hands-free.
- **Extensive File Support:** Natively supports extracting text, images, and metadata from **Text/Code** (`.txt`, `.csv`, `.md`, `.json`, `.js`, `.ts`, `.html`, `.css`, etc.), **Images** (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.avif`, `.heic`, `.tiff`, `.bmp`, `.psd`), and **Documents** (`.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.odt`, `.ods`, `.odp`, `.rtf`).
- **Smart Rate Limiting & Cooling:** Fully configurable AI batch limits and processing delays to protect your API credits or let your local GPU cool down between inferences.
- **Built-in Error Recovery:** Gracefully handles AI timeout or unreadable files with automatic retries and permanent fail states to prevent endless loops.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm
- (Optional) LM-Studio, Llama.cpp, Jan, GPT4All, or Ollama running locally for private, offline AI capabilities.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/AIFileNamer.git
   cd AIFileNamer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application in development mode:
   ```bash
   npm run start
   ```

### Building for Production
To package the app as an executable for your operating system:
```bash
npm run build
```

## ⚙️ Configuration

1. Open the **Config** tab inside the app.
2. Select your preferred AI Provider.
3. Enter your API Key (or Local URL for Ollama/LM-Studio).
4. Click **Validate & Fetch Models** and select the model you wish to use from the dropdown.
5. Customise your AI prompting instructions, batch limits, and processing delays to tailor the app exactly to your workflow.

## 🛠️ Technology Stack

- **Framework:** Electron (Desktop Integration) + Svelte (Frontend UI)
- **Styling:** TailwindCSS
- **Build Tool:** Vite
- **IPC Communication:** Secure, context-isolated Electron IPC channels for bridging the sleek Svelte UI with native filesystem operations.

## 📄 License

This project is licensed under the MIT License.
