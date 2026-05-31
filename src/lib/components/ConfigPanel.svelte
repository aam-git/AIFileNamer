<script lang="ts">
  import { scannersStore, scannerLiveStatusStore, type ScannerConfig } from '../stores';
  import { copyConfigFrom, DEFAULT_CUSTOM_PROMPT, DEFAULT_FOLDER_PROMPT } from '../scannerUtils';
  import { defaultApiUrlForProvider, isDefaultLocalUrl } from '../aiDefaults';

  let { scannerId }: { scannerId: string } = $props();

  let scanner = $derived($scannersStore.configs.find(c => c.id === scannerId) as ScannerConfig | undefined);
  let otherScanners = $derived($scannersStore.configs.filter(c => c.id !== scannerId));

  let saveMsgTimeout: any;

  function updateConfig(patch: Partial<ScannerConfig>) {
    scannersStore.update(s => ({
      ...s,
      configs: s.configs.map(c => c.id === scannerId ? { ...c, ...patch } : c),
    }));

    // Auto-stop (pause) scanner when config changes
    scannerLiveStatusStore.update(s => {
      const live = s[scannerId];
      if (live && !live.isPaused) {
        return { ...s, [scannerId]: { ...live, isPaused: true } };
      }
      return s;
    });

    saveMsg = 'Settings auto-saved & scanner stopped';
    clearTimeout(saveMsgTimeout);
    saveMsgTimeout = setTimeout(() => (saveMsg = ''), 2000);
  }

  let isValidating = $state(false);
  let validationMsg = $state('');
  let validationError = $state(false);
  let availableModels: string[] = $state([]);
  let showDropdown = $state(false);
  let saveMsg = $state('');
  let showCopyMenu = $state(false);
  let showApiKey = $state(false);
  let showRegexHelp = $state(false);

  async function validateAndFetch() {
    if (!scanner) return;
    isValidating = true;
    validationMsg = 'Validating and fetching models…';
    validationError = false;
    availableModels = [];

    try {
      const result = await window.electronAPI.fetchModels({
        provider: scanner.provider,
        apiKey: scanner.apiKey,
        apiUrl: scanner.apiUrl,
        model: scanner.model,
      });
      if (result.success) {
        availableModels = result.models || [];
        validationMsg = `Successfully fetched ${availableModels.length} model${availableModels.length !== 1 ? 's' : ''}!`;
        if (scanner.model && !availableModels.includes(scanner.model)) {
          updateConfig({ model: '' });
          validationMsg += ' Selected model was no longer available and has been cleared.';
        }
      } else {
        validationError = true;
        validationMsg = `Error: ${result.error}`;
      }
    } catch (e) {
      validationError = true;
      validationMsg = `Unexpected error: ${e}`;
    } finally {
      isValidating = false;
    }
  }

  // Removed handleSave as it is now auto-saved

  function copyFrom(sourceId: string) {
    const source = $scannersStore.configs.find(c => c.id === sourceId);
    const target = scanner;
    if (!source || !target) return;
    scannersStore.update(s => ({
      ...s,
      configs: s.configs.map(c => c.id === scannerId ? copyConfigFrom(source, c) : c),
    }));
    availableModels = [];
    validationMsg = '';
    showCopyMenu = false;
    saveMsg = `Copied settings from "${source.name}"`;
    setTimeout(() => (saveMsg = ''), 3000);
  }

  let filteredModels = $derived(availableModels.filter(m =>
    m.toLowerCase().includes((scanner?.model ?? '').toLowerCase())
  ));
</script>

<div class="max-w-3xl mx-auto py-4 relative overflow-y-auto h-full">

  {#if saveMsg}
    <div class="fixed bottom-6 right-6 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span class="font-medium">{saveMsg}</span>
    </div>
  {/if}

  <!-- Header -->
  <div class="mb-6 flex items-center justify-between gap-4">
    <div>
      <h2 class="text-2xl font-bold text-white mb-1">Configuration</h2>
      <p class="text-slate-400 text-sm">AI provider, model, and scan settings for this scanner.</p>
    </div>

    <!-- Copy From Another Scanner -->
    {#if otherScanners.length > 0}
      <div class="relative">
        <button
          onclick={() => showCopyMenu = !showCopyMenu}
          class="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-slate-600"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy From…
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {#if showCopyMenu}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="fixed inset-0 z-40" onclick={() => showCopyMenu = false} role="presentation"></div>
          <div class="absolute right-0 top-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 min-w-[200px] overflow-hidden">
            <div class="px-3 py-2 border-b border-slate-700">
              <span class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Copy settings from:</span>
            </div>
            {#each otherScanners as other}
              <button
                class="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors flex items-center gap-3"
                onclick={() => copyFrom(other.id)}
              >
                <div class="w-2 h-2 rounded-full bg-slate-500 shrink-0"></div>
                <div>
                  <div class="font-medium">{other.name}</div>
                  {#if other.model}
                    <div class="text-xs text-slate-500">{other.provider} · {other.model}</div>
                  {:else}
                    <div class="text-xs text-slate-600">Not configured</div>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
    <div class="space-y-6">

      <!-- AI Provider -->
      <div>
        <label for="provider-{scannerId}" class="block text-sm font-medium text-slate-300 mb-2">AI Provider</label>
        <div class="relative">
          <select
            id="provider-{scannerId}"
            value={scanner?.provider ?? 'lmstudio'}
            onchange={(e) => {
              availableModels = [];
              validationMsg = '';
              const newProvider = (e.target as HTMLSelectElement).value;
              const oldProvider = scanner?.provider;

              const currentSettings = scanner?.providerSettings || {};
              if (oldProvider && oldProvider !== newProvider) {
                currentSettings[oldProvider] = {
                  apiKey: scanner?.apiKey || '',
                  apiUrl: scanner?.apiUrl || '',
                  model: scanner?.model || ''
                };
              }

              const newSettings = currentSettings[newProvider] || {};
              let newApiUrl = newSettings.apiUrl;

              if (!newApiUrl || isDefaultLocalUrl(newApiUrl)) {
                newApiUrl = defaultApiUrlForProvider(newProvider);
              }
              updateConfig({ 
                provider: newProvider, 
                providerSettings: currentSettings,
                apiKey: newSettings.apiKey || '',
                apiUrl: newApiUrl,
                model: newSettings.model || ''
              });
            }}
            class="w-full appearance-none bg-slate-900/50 border border-slate-700 text-white py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          >
            <optgroup label="Local (Recommended)">
              <option value="lmstudio">LM-Studio</option>
              <option value="llamacpp">Llama.cpp Server</option>
              <option value="jan">Jan</option>
              <option value="gpt4all">GPT4All</option>
              <option value="ollama">Ollama</option>
            </optgroup>
            <optgroup label="Cloud Providers (Less Private)">
              <option value="openai">OpenAI (ChatGPT)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="groq">Groq</option>
              <option value="deepseek">DeepSeek</option>
              <option value="aistudio">Google AI Studio</option>
              <option value="openrouter">OpenRouter</option>
            </optgroup>
          </select>
          <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <!-- API Key (non-local providers) -->
      {#if !['ollama', 'lmstudio', 'llamacpp', 'jan', 'gpt4all'].includes(scanner?.provider ?? '')}
        <div>
          <label for="apikey-{scannerId}" class="block text-sm font-medium text-slate-300 mb-2">API Key</label>
          <div class="relative">
            <input
              type={showApiKey ? "text" : "password"}
              id="apikey-{scannerId}"
              value={scanner?.apiKey ?? ''}
              onchange={(e) => updateConfig({ apiKey: (e.target as HTMLInputElement).value })}
              placeholder="Enter your API key…"
              class="w-full bg-slate-900/50 border border-slate-700 text-white py-3 px-4 pr-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-600"
            />
            <button 
              type="button"
              onclick={() => showApiKey = !showApiKey}
              class="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-white transition-colors"
            >
              {#if showApiKey}
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              {:else}
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.543 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              {/if}
            </button>
          </div>
          <p class="text-xs text-slate-500 mt-2">Your keys are stored locally.</p>
        </div>
      {/if}

      <!-- API URL (local providers) -->
      {#if ['ollama', 'lmstudio', 'llamacpp', 'jan', 'gpt4all'].includes(scanner?.provider ?? '')}
        <div>
          <label for="apiurl-{scannerId}" class="block text-sm font-medium text-slate-300 mb-2">
            API URL
          </label>
          <input
            type="text"
            id="apiurl-{scannerId}"
            value={scanner?.apiUrl ?? ''}
            onchange={(e) => updateConfig({ apiUrl: (e.target as HTMLInputElement).value })}
            placeholder={scanner?.provider === 'ollama' ? 'http://localhost:11434' : 
                         scanner?.provider === 'llamacpp' ? 'http://localhost:8080/v1' :
                         scanner?.provider === 'jan' ? 'http://localhost:1337/v1' :
                         scanner?.provider === 'gpt4all' ? 'http://localhost:4891/v1' : 'http://localhost:1234/v1'}
            class="w-full bg-slate-900/50 border border-slate-700 text-white py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-600"
          />
        </div>
      {/if}

      <!-- Validate & Fetch -->
      <div class="pt-2">
        <button
          onclick={validateAndFetch}
          disabled={isValidating}
          class="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-xl transition-colors border border-slate-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {#if isValidating}
            <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Validating…
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Validate & Fetch Models
          {/if}
        </button>
        {#if validationMsg}
          <p class="mt-3 text-sm {validationError ? 'text-red-400' : 'text-emerald-400'}">{validationMsg}</p>
        {/if}
      </div>

      <!-- Model Selection -->
      <div class="pt-4 border-t border-slate-700/50">
        <label for="model-search-{scannerId}" class="block text-sm font-medium text-slate-300 mb-2">Select Model</label>
        <div class="relative">
          <input
            type="text"
            id="model-search-{scannerId}"
            value={scanner?.model ?? ''}
            oninput={(e) => updateConfig({ model: (e.target as HTMLInputElement).value })}
            onfocus={() => (showDropdown = true)}
            onblur={() => setTimeout(() => (showDropdown = false), 200)}
            placeholder="Search or type a model name…"
            class="w-full bg-slate-900/50 border border-slate-700 text-white py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-600"
          />
          <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {#if showDropdown && filteredModels.length > 0}
            <div class="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
              {#each filteredModels as m}
                <button
                  class="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors"
                  onclick={() => { updateConfig({ model: m }); showDropdown = false; }}
                >
                  {m}
                </button>
              {/each}
            </div>
          {/if}
          {#if showDropdown && filteredModels.length === 0 && availableModels.length > 0}
            <div class="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 text-center text-slate-400 text-sm">
              No models match your search.
            </div>
          {/if}
        </div>
      </div>

      <!-- Scan Settings -->
      <div class="pt-6 border-t border-slate-700/50">
        <h3 class="text-xl font-bold text-white mb-4">Scan Settings</h3>

        <!-- Name Filter (Regex) -->
        <div class="mb-6 bg-slate-900/30 p-4 rounded-xl border border-slate-700/50">
          <div class="flex items-center justify-between mb-2">
            <label for="nameFilter-{scannerId}" class="block text-sm font-medium text-slate-300">
              Name Filter (Regex)
            </label>
            <div class="relative">
              <button
                onclick={() => showRegexHelp = !showRegexHelp}
                class="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-colors"
                title="Help with Regex"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {#if showRegexHelp}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="fixed inset-0 z-40" onclick={() => showRegexHelp = false}></div>
                <div class="absolute right-0 top-full mt-2 w-64 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 text-xs text-slate-300">
                  <p class="font-bold text-white mb-2">Common Regex Patterns</p>
                  <ul class="space-y-1.5 list-disc list-inside">
                    <li><code class="text-indigo-400 bg-indigo-500/10 px-1 rounded">IMG_</code> matches names containing "IMG_"</li>
                    <li><code class="text-indigo-400 bg-indigo-500/10 px-1 rounded">^2024</code> matches names starting with "2024"</li>
                    <li><code class="text-indigo-400 bg-indigo-500/10 px-1 rounded">screenshot$</code> matches names ending with "screenshot"</li>
                    <li><code class="text-indigo-400 bg-indigo-500/10 px-1 rounded">copy\s\(\d+\)</code> matches "copy (1)", "copy (2)", etc.</li>
                  </ul>
                  <p class="mt-2 text-slate-500 italic">Leave empty to not filter by name.</p>
                </div>
              {/if}
            </div>
          </div>
          <input
            type="text"
            id="nameFilter-{scannerId}"
            value={scanner?.nameFilter ?? ''}
            oninput={(e) => updateConfig({ nameFilter: (e.target as HTMLInputElement).value })}
            placeholder="e.g. ^IMG_ (leave empty for no filter)"
            class="w-full bg-slate-900/50 border border-slate-700 text-white py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-600 font-mono text-sm"
          />
          {#if (scanner?.nameFilter ?? '').length > 0}
            <div class="mt-3 flex items-center gap-2">
              <span class="text-xs text-slate-500">Flags:</span>
              <button
                onclick={() => {
                  const currentFlags = scanner?.nameFilterFlags ?? [];
                  const newFlags = currentFlags.includes('i') ? currentFlags.filter(f => f !== 'i') : [...currentFlags, 'i'];
                  updateConfig({ nameFilterFlags: newFlags });
                }}
                class="px-2.5 py-1 text-xs rounded-full border transition-colors { (scanner?.nameFilterFlags ?? []).includes('i') ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}"
              >
                Case Insensitive
              </button>
            </div>
          {/if}
        </div>

        <!-- Suggest Folders -->
        <div class="flex items-center justify-between mb-4">
          <div>
            <h4 class="text-white font-medium">Suggest Folders</h4>
            <p class="text-slate-400 text-sm">Allow AI to classify files into subdirectories.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox"
              checked={scanner?.suggestFolders ?? false}
              onchange={(e) => updateConfig({ suggestFolders: (e.target as HTMLInputElement).checked })}
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
          </label>
        </div>

        <!-- Processing Delay -->
        <div class="flex items-center justify-between mb-4">
          <div>
            <h4 class="text-white font-medium">Processing Delay</h4>
            <p class="text-slate-400 text-sm">Seconds between AI calls (e.g. to let GPU cool down).</p>
          </div>
          <input
            type="number"
            value={scanner?.processingDelay ?? 2}
            onchange={(e) => updateConfig({ processingDelay: parseFloat((e.target as HTMLInputElement).value) || 0 })}
            min="0"
            step="0.5"
            class="w-20 bg-slate-900/50 border border-slate-700 text-white py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        <!-- Prompt Customisation -->
        <div class="mb-8 p-6 bg-slate-900/50 rounded-2xl border border-slate-700/50">
          <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
            <h4 class="text-white font-medium">AI Prompt Customisation</h4>
            <button
              onclick={() => updateConfig({ customPrompt: DEFAULT_CUSTOM_PROMPT, customFolderPrompt: DEFAULT_FOLDER_PROMPT })}
              class="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition-colors"
            >
              Reset to Defaults
            </button>
          </div>

          {#if !(scanner?.suggestFolders)}
            <div>
              <label for="customPrompt-{scannerId}" class="block text-sm font-medium text-slate-300 mb-2">Standard AI Prompt</label>
              <textarea
                id="customPrompt-{scannerId}"
                value={scanner?.customPrompt ?? DEFAULT_CUSTOM_PROMPT}
                onchange={(e) => updateConfig({ customPrompt: (e.target as HTMLTextAreaElement).value })}
                rows="3"
                class="w-full bg-slate-900/50 border border-slate-700 text-white py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-mono"
              ></textarea>
            </div>
          {:else}
            <div>
              <label for="customFolderPrompt-{scannerId}" class="block text-sm font-medium text-slate-300 mb-2">Folder Classification AI Prompt</label>
              <p class="text-xs text-slate-400 mb-2">
                Use <code class="text-indigo-400 bg-indigo-500/10 px-1 rounded">{'{'+'baseFolder'+'}'}</code>
                — this will automatically resolve to <span class="text-emerald-400">images</span> or <span class="text-emerald-400">documents</span> based on the file content.
              </p>
              <textarea
                id="customFolderPrompt-{scannerId}"
                value={scanner?.customFolderPrompt ?? DEFAULT_FOLDER_PROMPT}
                onchange={(e) => updateConfig({ customFolderPrompt: (e.target as HTMLTextAreaElement).value })}
                rows="4"
                class="w-full bg-slate-900/50 border border-slate-700 text-white py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-mono"
              ></textarea>
            </div>
          {/if}
        </div>
      </div>

    </div>
  </div>
</div>
