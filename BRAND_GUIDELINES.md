# AIFileNamer - Brand Guidelines

## 🎨 Visual Identity

The AIFileNamer brand conveys a sense of high-tech efficiency, sleek modernity, and calm organisation. We want users to feel relieved and empowered when they open the application—as if they are stepping out of their messy desktop environment into a serene, highly-capable control centre.

### Core Color Palette

Our interface relies heavily on deep, glassmorphic dark-modes accented by vibrant, energetic tech colors to denote statuses and actions.

- **Primary Backgrounds (The Canvas):** Deep Slates (`#0f172a`, `#020617`). These incredibly dark blues provide a rich, endless depth that reduces eye strain and makes colorful accents pop.
- **Brand Accent (The Engine):** Vibrant Indigo (`#6366f1`). Used for primary actions, selections, and to denote active AI processing. It represents intelligence, synthetic thought, and power.
- **Success State (The Relief):** Bright Emerald (`#10b981`). Used heavily in the UI to signify finished tasks, successfully renamed files, and positive toast notifications. It represents completion, safety, and organisation.
- **Warning/Error State (The Guardrail):** Rose/Red (`#f43f5e`, `#ef4444`). Used for aborting sequences, stopping the AI, or denoting permanent file-read failures. It represents finality and stopping power.

## 🖋️ Typography

- **Primary Font:** Inter (or similar modern geometric sans-serifs like Roboto). We prioritise legibility, precise tracking, and a highly polished "app-like" feel.
- **Secondary/Monospace Font:** A clean monospace font for displaying actual filenames, file paths, and JSON payloads. This grounds the sleek design in its technical roots and ensures character legibility (differentiating `O` vs `0`).

## 🗣️ Tone of Voice

### 1. Competent and Reassuring
We handle people's potentially precious or sensitive files. The language in the app should never be "wacky" or overly informal. It should be exact, reassuring, and highly transparent about what it is doing.

### 2. Status-Driven
Because the app performs long-running, autonomous background tasks, the language should be highly communicative of *state*. Use verbs actively.
- *Good:* "Scanning directory...", "Processing...", "Starting in 15s..."
- *Bad:* "Please wait", "Loading"

### 3. Clear and Concise
The UI should remain uncluttered. Explanations in the Configuration panel should be direct.
- *Example:* "Wait time in seconds between each AI file processing (e.g., to let GPU cool down)."

## 📐 Design Principles

- **Glassmorphism & Depth:** Utilising subtle backdrop blurs, semi-transparent panels (`bg-slate-800/40`), and ambient glowing background orbs (`bg-indigo-500/5 blur-[120px]`) to create a "layered" OS feel.
- **Micro-Interactions:** Everything should have a subtle CSS transition (`transition-colors`, `hover:bg-slate-700`). Buttons should feel responsive.
- **Unintrusive Feedback:** Rely heavily on transient "toast" notifications in the bottom corner rather than blocking modal popups. The user's workflow should never be halted unless absolutely necessary.
