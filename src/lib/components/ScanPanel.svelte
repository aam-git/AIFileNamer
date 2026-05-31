<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    scannersStore,
    scannerFilesStore,
    scannerDelayingStore,
    scannerLiveStatusStore,
    type ScannerConfig,
    type ScannerRuntimeData,
  } from '../stores';
  import { createEmptyRuntimeData } from '../scannerUtils';

  let { scannerId }: { scannerId: string } = $props();

  // ── Derived reactive reads ──────────────────────────────────────────────────
  let scanner = $derived($scannersStore.configs.find(c => c.id === scannerId) as ScannerConfig | undefined);
  let runtime = $derived(($scannersStore.runtimeData[scannerId] ?? createEmptyRuntimeData()) as ScannerRuntimeData);
  let files = $derived($scannerFilesStore[scannerId] ?? []);

  // Helper: resolve newName from history entry (supports old string format)
  function getHistoryName(entry: any): string | null {
    if (!entry) return null;
    if (typeof entry === 'string') return entry;
    return entry.newName || null;
  }

  // ── Store Updaters ──────────────────────────────────────────────────────────
  function updateConfig(patch: Partial<ScannerConfig>) {
    scannersStore.update(s => ({
      ...s,
      configs: s.configs.map(c => c.id === scannerId ? { ...c, ...patch } : c),
    }));
  }

  function updateRuntime(patch: Partial<ScannerRuntimeData>) {
    scannersStore.update(s => ({
      ...s,
      runtimeData: {
        ...s.runtimeData,
        [scannerId]: { ...createEmptyRuntimeData(), ...s.runtimeData[scannerId], ...patch },
      },
    }));
  }

  function setFiles(newFiles: any[]) {
    scannerFilesStore.update(m => ({ ...m, [scannerId]: newFiles }));
  }

  function patchFile(index: number, patch: any) {
    const current = $scannerFilesStore[scannerId] ?? [];
    const updated = [...current];
    updated[index] = { ...updated[index], ...patch };
    setFiles(updated);
  }

  // ── Live Status (for Sidebar / Overview) ───────────────────────────────────
  function pushStatus() {
    scannerLiveStatusStore.update(m => ({
      ...m,
      [scannerId]: { isScanning, isProcessing, isDelaying: $scannerDelayingStore[scannerId] ?? false, isWaiting, countdown, isPaused },
    }));
  }

  // ── Local Runtime State ────────────────────────────────────────────────────
  let isScanning = $state(false);
  let processingTasks = $state(0);
  let isProcessing = $derived(processingTasks > 0);
  let isDelaying = $derived($scannerDelayingStore[scannerId] ?? false);
  
  let isPaused = $state(false);
  let pendingCount = $derived(files.filter(f => f.status !== 'already_renamed' && f.status !== 'permanent_error' && f.status !== 'renamed').length);
  let isWaiting = $derived(!!(scanner?.autoRun && !isPaused && pendingCount === 0 && !isScanning && !isProcessing));

  let isAborting = $state(false);
  let isInitialBoot = $state(false);
  let mounted = $state(false);
  let isApplying = $state(false);

  let countdown = $state(0);
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let syncTimer: ReturnType<typeof setInterval> | null = null;
  let toastMessage = $state('');
  let globalError = $state('');

  // Push status whenever relevant vars change
  $effect(() => { isScanning; isProcessing; isDelaying; isWaiting; countdown; isPaused; pushStatus(); });

  // ── File Limit Watcher ─────────────────────────────────────────────────────
  let lastLimit = $state(-1);
  $effect(() => {
    if (mounted && scanner && scanner.fileLimit !== lastLimit && lastLimit !== -1 && scanner.selectedDir && !isScanning && !isProcessing) {
      lastLimit = scanner.fileLimit;
      performScan(scanner.selectedDir);
    }
  });
  $effect(() => {
    if (scanner && lastLimit === -1) lastLimit = scanner.fileLimit ?? 10;
  });

  // ── Provider Auto-Delay ────────────────────────────────────────────────────
  const LOCAL_PROVIDERS = new Set(['ollama', 'lmstudio']);
  let lastProvider = $state('');
  $effect(() => {
    if (mounted && scanner && scanner.provider !== lastProvider && lastProvider !== '') {
      lastProvider = scanner.provider;
      updateConfig({ processingDelay: LOCAL_PROVIDERS.has(scanner.provider) ? 2 : 1 });
    }
  });
  $effect(() => {
    if (scanner && lastProvider === '') lastProvider = scanner.provider ?? 'lmstudio';
  });

  // ── AI Settings Change Watcher ─────────────────────────────────────────────
  let settingsKey = $derived(JSON.stringify({
    provider: scanner?.provider,
    apiUrl: scanner?.apiUrl,
    model: scanner?.model,
    suggestFolders: scanner?.suggestFolders,
    customPrompt: scanner?.customPrompt,
    customFolderPrompt: scanner?.customFolderPrompt,
    selectedExtensions: [...(scanner?.selectedExtensions ?? [])].sort(),
    nameFilter: scanner?.nameFilter,
    nameFilterFlags: [...(scanner?.nameFilterFlags ?? [])].sort(),
  }));
  let lastSettingsKey = $state('');
  $effect(() => {
    if (mounted && settingsKey !== lastSettingsKey && lastSettingsKey !== '' && scanner?.selectedDir && !isScanning && !isProcessing) {
      lastSettingsKey = settingsKey;
      performScan(scanner.selectedDir);
    }
  });
  $effect(() => {
    if (!mounted && settingsKey) lastSettingsKey = settingsKey;
  });

  // ── Conflict Detection ─────────────────────────────────────────────────────
  let conflictingScanner = $derived($scannersStore.configs.find(c => {
    if (c.id === scannerId) return false;
    if (!c.selectedDir || !scanner?.selectedDir) return false;
    if (c.selectedDir !== scanner.selectedDir) return false;

    const myExts = scanner.selectedExtensions || [];
    const theirExts = c.selectedExtensions || [];
    if (myExts.length === 0 || theirExts.length === 0) return false;

    return myExts.some(ext => theirExts.includes(ext));
  }));
  let hasConflict = $derived(!!conflictingScanner);

  // ── Pagination ─────────────────────────────────────────────────────────────
  let currentPage = $state(1);
  let itemsPerPage = $derived(Math.max(1, scanner?.fileLimit ?? 10));
  let visibleFiles = $derived(files.filter(f => f.status !== 'already_renamed' && f.status !== 'renamed'));
  let totalPages = $derived(Math.max(1, Math.ceil(visibleFiles.length / itemsPerPage)));
  let paginatedFiles = $derived(visibleFiles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(async () => {
    mounted = true;
    lastSettingsKey = settingsKey;

    if (scanner?.selectedDir) {
      isInitialBoot = true;
      await performScan(scanner.selectedDir);
      isInitialBoot = false;
    }

    syncTimer = setInterval(() => {
      if (scanner?.selectedDir && !isScanning && !isProcessing && !isAborting && !hasConflict) {
        backgroundSync(scanner.selectedDir);
      }
    }, 5000);
  });

  onDestroy(() => {
    if (syncTimer) clearInterval(syncTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    scannerLiveStatusStore.update(m => {
      const copy = { ...m };
      delete copy[scannerId];
      return copy;
    });
  });

  // ── File Validation ─────────────────────────────────────────────────────────
  async function validateActiveFiles(fileList: any[]) {
    if (!window.electronAPI || isScanning || isProcessing || !scanner?.selectedDir) return;
    const paths = fileList.map(f => f.path);
    try {
      const existing = await window.electronAPI.checkFilesExist(paths, scanner.selectedDir);
      const existingSet = new Set(existing);
      let changed = false;
      const current = $scannerFilesStore[scannerId] ?? [];
      const filtered = current.filter(f => {
        if (paths.includes(f.path) && !existingSet.has(f.path)) { changed = true; return false; }
        return true;
      });
      if (changed) setFiles(filtered);
    } catch (e) {
      console.error("Failed to validate active files:", e);
    }
  }

  $effect(() => {
    if (paginatedFiles.length > 0 && !isScanning && !isProcessing) {
      validateActiveFiles(paginatedFiles);
    }
  });

  // ── Background Sync ─────────────────────────────────────────────────────────
  async function backgroundSync(dir: string) {
    if (!scanner) return;
    try {
      const scanned = await window.electronAPI.scanDirectory(dir, 999999, scanner.selectedExtensions ?? [], scanner.nameFilter, scanner.nameFilterFlags);
      const current = $scannerFilesStore[scannerId] ?? [];
      const currentPaths = new Set(current.map(f => f.path));
      const scannedPaths = new Set(scanned.map((f: any) => f.path));

      let hasChanges = currentPaths.size !== scannedPaths.size;
      if (!hasChanges) {
        for (const p of scannedPaths) { if (!currentPaths.has(p)) { hasChanges = true; break; } }
      }

      if (hasChanges) {
        const rt = $scannersStore.runtimeData[scannerId] ?? createEmptyRuntimeData();
        let normal: any[] = [], errors: any[] = [];
        scanned.forEach((f: any) => {
          const existing = current.find(ex => ex.path === f.path);
          if (existing) {
            (existing.status === 'error' || rt.errorHistory[f.path]) ? errors.push(existing) : normal.push(existing);
          } else {
            const processed = getHistoryName(rt.processedHistory[f.path]);
            const errCount = rt.errorHistory[f.path] || 0;
            if (processed) normal.push({ ...f, selected: false, status: 'already_renamed', proposedName: processed });
            else if (errCount >= 2) errors.push({ ...f, selected: false, status: 'permanent_error', error: 'Permanently failed AI scan' });
            else if (errCount === 1) errors.push({ ...f, selected: false, status: 'error', error: 'Previously failed AI scan (will retry)' });
            else normal.push({ ...f, selected: false });
          }
        });
        setFiles([...normal, ...errors]);

        const pending = [...normal, ...errors].filter(f => f.status !== 'already_renamed' && f.status !== 'permanent_error').length;
        if (scanner.autoRun && pending > 0 && scanner.model && !isPaused && !isProcessing) {
          runScan();
        }
      }
    } catch (e) {
      console.error("Background sync failed:", e);
    }
  }

  // ── Countdown ──────────────────────────────────────────────────────────────
  function startCountdown() {
    countdown = 15;
    countdownTimer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = null;
        runScan();
      }
    }, 1000);
  }

  function stopScan() {
    isPaused = true;
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      countdown = 0;
    } else if (isProcessing) {
      isAborting = true;
    }
  }

  function showToast(msg: string) {
    toastMessage = msg;
    setTimeout(() => (toastMessage = ''), 3000);
  }

  // ── Pagination Controls ────────────────────────────────────────────────────
  function nextPage() { if (currentPage < totalPages) currentPage++; }
  function prevPage() { if (currentPage > 1) currentPage--; }

  function toggleSelectAllOnPage(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    const current = $scannerFilesStore[scannerId] ?? [];
    setFiles(current.map(f => {
      if (f.status === 'already_renamed') return f;
      if (paginatedFiles.some(pf => pf.path === f.path)) return { ...f, selected: checked };
      return f;
    }));
  }

  let allOnPageSelected = $derived(
    paginatedFiles.length > 0 &&
    paginatedFiles.filter(f => f.status !== 'already_renamed').every(f => f.selected)
  );

  function resetFileError(path: string) {
    const rt = $scannersStore.runtimeData[scannerId] ?? createEmptyRuntimeData();
    const newErrors = { ...rt.errorHistory };
    delete newErrors[path];
    updateRuntime({ errorHistory: newErrors });
    const current = $scannerFilesStore[scannerId] ?? [];
    const idx = current.findIndex(f => f.path === path);
    if (idx !== -1) {
      const updated = [...current];
      updated[idx] = { ...updated[idx], status: 'pending', error: undefined };
      setFiles(updated);
    }
  }

  // ── Directory Selection ────────────────────────────────────────────────────
  async function handleSelectDirectory() {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectDirectory();
    if (result) {
      updateConfig({ selectedDir: result });
      await performScan(result);
    }
  }

  // ── Scan ───────────────────────────────────────────────────────────────────
  async function performScan(dir: string) {
    if (!scanner || hasConflict) return;
    setFiles([]);
    currentPage = 1;
    isScanning = true;
    try {
      const scanned = await window.electronAPI.scanDirectory(dir, 999999, scanner.selectedExtensions ?? [], scanner.nameFilter, scanner.nameFilterFlags);
      const rt = $scannersStore.runtimeData[scannerId] ?? createEmptyRuntimeData();
      let normal: any[] = [], errors: any[] = [];
      scanned.forEach((f: any) => {
        const historyItem = rt.processedHistory[f.path];
        const processed = getHistoryName(historyItem);
        const isResult = typeof historyItem === 'object' && historyItem !== null && 'isResult' in historyItem ? historyItem.isResult : false;
        const errCount = rt.errorHistory[f.path] || 0;

        if (processed || isResult) normal.push({ ...f, selected: false, status: 'already_renamed', proposedName: processed || f.name });
        else if (errCount >= 2) errors.push({ ...f, selected: false, status: 'permanent_error', error: 'Permanently failed AI scan' });
        else if (errCount === 1) errors.push({ ...f, selected: false, status: 'error', error: 'Previously failed AI scan (will retry)' });
        else normal.push({ ...f, selected: false });
      });
      setFiles([...normal, ...errors]);

      const pendingCount = [...normal, ...errors].filter(f => f.status !== 'already_renamed' && f.status !== 'permanent_error').length;
      if (scanner.autoRun && pendingCount > 0 && scanner.model && !isPaused) {
        isInitialBoot ? startCountdown() : setTimeout(runScan, 50);
      }
    } catch (e) {
      console.error(e);
      showToast('Error during directory scan');
    } finally {
      isScanning = false;
    }
  }

  async function runScan() {
    if (!scanner || hasConflict || isProcessing) return;
    isPaused = false;
    globalError = '';
    const currentFiles = $scannerFilesStore[scannerId] ?? [];
    if (!scanner.selectedDir || !window.electronAPI || currentFiles.length === 0) return;

    try {
      const providerConfig = {
        provider: scanner.provider,
        apiKey: scanner.apiKey,
        apiUrl: scanner.apiUrl,
        model: scanner.model,
      };
      const check = await window.electronAPI.fetchModels(providerConfig);
      if (!check.success) { 
        globalError = `API Offline: ${check.error}`;
        stopScan();
        return; 
      }
      if (check.models && !check.models.includes(scanner.model)) {
        globalError = `API Error: Model '${scanner.model}' is not available.`;
        stopScan();
        return;
      }
    } catch (e) {
      globalError = 'API connection check failed.';
      stopScan();
      return;
    }

    processingTasks++;
    isAborting = false;

    try {
      let processedCount = 0;
      const limit = scanner.fileLimit;
      const latestFiles = () => $scannerFilesStore[scannerId] ?? [];



      for (let i = 0; i < latestFiles().length; i++) {
        if (isAborting) { showToast('AI Scan stopped by user.'); break; }
        if (processedCount >= limit) break;

        const fileList = latestFiles();
        const file = fileList[i];
        if (!file || file.status === 'ready' || file.status === 'renamed' || file.status === 'already_renamed' || file.status === 'permanent_error') continue;

        processedCount++;
        patchFile(i, { status: 'processing' });

        const providerConfig = { provider: scanner.provider, apiKey: scanner.apiKey, apiUrl: scanner.apiUrl, model: scanner.model };
        const appSettings = {
          suggestFolders: scanner.suggestFolders,
          customPrompt: scanner.customPrompt,
          customFolderPrompt: scanner.customFolderPrompt,
          fileLimit: scanner.fileLimit,
          processingDelay: scanner.processingDelay,
          selectedExtensions: scanner.selectedExtensions,
        };

        const res = await window.electronAPI.processFile(file, providerConfig, appSettings, scanner.selectedDir);

        if (res.aiLog) {
          const rt = $scannersStore.runtimeData[scannerId] ?? createEmptyRuntimeData();
          updateRuntime({ aiLogs: [{ timestamp: Date.now(), file: file.name, ...res.aiLog }, ...rt.aiLogs].slice(0, 50) });
        }

        if (res.success) {
          patchFile(i, { proposedName: res.proposedName + file.extension, status: 'ready', selected: true });
        } else {
          // Check if this is a global configuration/API error rather than a file-specific parsing issue
          const errStr = (res.error || '').toLowerCase();
          const globalErrorKeywords = ['failed to resolve model', 'invalid api key', 'could not connect', 'econnrefused', 'fetch failed', 'unauthorized', 'invalid response format', 'unknown provider'];
          const isGlobalError = globalErrorKeywords.some(kw => errStr.includes(kw));

          if (isGlobalError) {
            patchFile(i, { status: undefined, error: undefined, selected: false });
            globalError = `Critical API Error: ${res.error}`;
            stopScan();
            break;
          }

          const rt = $scannersStore.runtimeData[scannerId] ?? createEmptyRuntimeData();
          const errCount = (rt.errorHistory[file.path] || 0) + 1;
          updateRuntime({ errorHistory: { ...rt.errorHistory, [file.path]: errCount } });
          patchFile(i, { selected: false, status: errCount >= 2 ? 'permanent_error' : 'error', error: res.error });
        }

        const updatedFiles = latestFiles();
        if (scanner.processingDelay > 0 && i < updatedFiles.length - 1 && processedCount < limit) {
          scannerDelayingStore.update(m => ({ ...m, [scannerId]: true }));
          await new Promise(r => setTimeout(r, scanner!.processingDelay * 1000));
          scannerDelayingStore.update(m => ({ ...m, [scannerId]: false }));
        }
      }

      if (scanner.autoRun && !isAborting) {
        const currentList = latestFiles();
        if (currentList.some(f => f.status === 'ready')) await applyChanges();
        else await performScan(scanner.selectedDir);
      } else if (!isAborting) {
        showToast('AI Generation Complete!');
      }
    } catch (e) {
      console.error(e);
      showToast('Error during AI generation');
    } finally {
      processingTasks = Math.max(0, processingTasks - 1);
    }
  }

  async function applyChanges() {
    if (!window.electronAPI || !scanner || isApplying) return;
    isApplying = true;
    processingTasks++;
    const currentFiles = $scannerFilesStore[scannerId] ?? [];
    const filesToRename = currentFiles.filter(f => f.selected && f.status === 'ready' && f.proposedName);

    try {
      let successCount = 0;
      for (const file of filesToRename) {
        const results = await window.electronAPI.renameFiles([file], scanner!.selectedDir);
        const res = results[0];
        if (!res) continue;

        const latest = $scannerFilesStore[scannerId] ?? [];
        const index = latest.findIndex(f => f.path === res.path || f.path === file.path);
        if (index !== -1) {
          const updated = [...latest];
          updated[index] = { ...updated[index], status: res.status, error: res.error };
          if (res.status === 'renamed') {
            successCount++;
            updated[index].selected = false;
            updated[index].name = res.proposedName;
            const rt = $scannersStore.runtimeData[scannerId] ?? createEmptyRuntimeData();
            updateRuntime({
              processedHistory: {
                ...rt.processedHistory,
                [file.path]: { newName: res.proposedName, timestamp: Date.now() },
              },
            });
          }
          setFiles(updated);
        }
      }

      if (successCount > 0) {
        showToast(`Successfully renamed ${successCount} file${successCount !== 1 ? 's' : ''}!`);
        await performScan(scanner.selectedDir);
      }
    } catch (e) {
      console.error(e);
      showToast('Error applying changes');
    } finally {
      isApplying = false;
      processingTasks = Math.max(0, processingTasks - 1);
    }
  }

  const ALL_EXTENSIONS = ['.txt', '.csv', '.md', '.json', '.js', '.html', '.css', '.xml', '.yml', '.yaml', '.log', '.pdf', '.docx', '.pptx', '.xlsx', '.odt', '.odp', '.ods', '.rtf', '.doc', '.ppt', '.xls', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.heic', '.avif', '.svg', '.ics', '.ical', '.psd'];
</script>

<div class="h-full flex flex-col">

  <!-- Toolbar -->
  <div class="mb-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
    <div class="flex flex-wrap items-center gap-2 bg-slate-800/40 p-2 rounded-xl border border-slate-700/50 backdrop-blur-sm w-full xl:w-auto">
      <div class="flex items-center gap-2 px-2">
        <label for="autorun-{scannerId}" class="text-sm text-slate-400 {hasConflict ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} flex items-center gap-2 whitespace-nowrap">
          Auto-Run
          <input
            type="checkbox"
            id="autorun-{scannerId}"
            checked={scanner?.autoRun ?? false}
            disabled={hasConflict}
            onchange={(e) => updateConfig({ autoRun: (e.target as HTMLInputElement).checked })}
            class="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>
      </div>
      <div class="h-6 w-px bg-slate-700"></div>
      <div class="flex items-center gap-2 px-2">
        <label for="limit-{scannerId}" class="text-sm text-slate-400 whitespace-nowrap">Batch</label>
        <input
          type="number"
          id="limit-{scannerId}"
          value={scanner?.fileLimit ?? 10}
          onchange={(e) => updateConfig({ fileLimit: parseInt((e.target as HTMLInputElement).value) || 10 })}
          class="w-16 bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {#if countdown > 0}
        <button
          onclick={stopScan}
          class="ml-auto bg-rose-500 hover:bg-rose-400 text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-lg flex items-center gap-2 whitespace-nowrap"
        >
          Starting in {countdown}s… (Cancel)
        </button>
      {:else if isProcessing}
        <button
          onclick={stopScan}
          disabled={isAborting}
          class="ml-auto bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-lg flex items-center gap-2 whitespace-nowrap"
        >
          {#if isAborting}
            Stopping…
          {:else}
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" />
            </svg>
            Stop Scan
          {/if}
        </button>
      {:else if isWaiting}
        <button
          onclick={stopScan}
          class="ml-auto bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2 rounded-lg font-medium transition-colors shadow-lg flex items-center gap-2 whitespace-nowrap"
        >
          <svg class="w-4 h-4 animate-spin opacity-70" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Waiting for new files… (Cancel)
        </button>
      {:else}
        <button
          onclick={runScan}
          disabled={hasConflict || !scanner?.selectedDir || files.length === 0 || isScanning || !scanner?.model}
          class="ml-auto bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-lg flex items-center gap-2 whitespace-nowrap"
        >
          Start Scan
        </button>
      {/if}
    </div>
  </div>

  <!-- Toast -->
  {#if toastMessage}
    <div class="fixed bottom-6 right-6 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-fade-in-up">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span class="font-medium">{toastMessage}</span>
    </div>
  {/if}

  <!-- Global Error Banner -->
  {#if globalError}
    <div class="mb-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl px-5 py-4 animate-fade-in-up shadow-lg">
      <div class="flex items-center gap-4">
        <div class="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
          <svg class="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-rose-300 font-semibold text-sm">Critical API Error</p>
          <p class="text-rose-400/70 text-xs mt-0.5">{globalError}</p>
        </div>
      </div>
      <button onclick={() => globalError = ''} class="text-xs text-rose-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-rose-500/20 transition-colors">Dismiss</button>
    </div>
  {/if}

  <!-- Conflict Banner -->
  {#if hasConflict && conflictingScanner}
    <div class="mb-4 flex items-center gap-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl px-5 py-4 animate-fade-in-up">
      <div class="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
        <svg class="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-rose-300 font-semibold text-sm">Directory Conflict Detected</p>
        <p class="text-rose-400/70 text-xs mt-0.5">
          Scanner <strong>'{conflictingScanner.name || 'Unknown'}'</strong> is already scanning this directory with overlapping extensions.
          Please change the directory or extensions to prevent conflicts.
        </p>
      </div>
    </div>
  {/if}

  <!-- Directory Row -->
  <div class="mb-4">
    <div class="flex items-center gap-3 w-full">
      <button
        onclick={handleSelectDirectory}
        disabled={isScanning || isProcessing}
        class="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-600 text-white px-4 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 shrink-0"
      >
        {#if isScanning}
          <div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
        {/if}
        Select Directory
      </button>
      <div class="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 truncate text-slate-300 text-sm">
        {scanner?.selectedDir || 'No directory selected…'}
      </div>
      <button
        onclick={() => scanner?.selectedDir && performScan(scanner.selectedDir)}
        disabled={isScanning || isProcessing || !scanner?.selectedDir}
        class="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-600 text-slate-300 px-3 py-3 rounded-xl font-medium transition-colors shrink-0"
        title="Refresh Directory"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <!-- Extension Toggles -->
    <div class="flex items-center gap-1.5 mt-3 pl-1 flex-wrap">
      {#each ALL_EXTENSIONS as ext}
        <button
          onclick={() => {
            const current = scanner?.selectedExtensions ?? [];
            updateConfig({
              selectedExtensions: current.includes(ext)
                ? current.filter(e => e !== ext)
                : [...current, ext],
            });
          }}
          disabled={isProcessing || isScanning}
          class="px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-1
            {(scanner?.selectedExtensions ?? []).includes(ext)
              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
              : 'bg-slate-800 text-slate-500 border-slate-700'}"
        >
          {ext}
        </button>
      {/each}
    </div>
  </div>

  <!-- File Table -->
  <div class="flex-1 bg-slate-800/20 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col min-h-0">
    <div class="overflow-x-auto flex-1">
      <table class="w-full text-left border-collapse">
        <thead class="sticky top-0 z-10 bg-slate-800 shadow">
          <tr class="border-b border-slate-700/50">
            <th class="py-1.5 px-3 w-12 text-center">
              <input type="checkbox" checked={allOnPageSelected} onchange={toggleSelectAllOnPage}
                class="rounded bg-slate-900 border-slate-600 text-indigo-500 focus:ring-indigo-500/50" />
            </th>
            <th class="py-1.5 px-3 font-medium text-slate-400 text-xs">Original Name</th>
            <th class="py-1.5 px-3 font-medium text-slate-400 text-xs w-8"></th>
            <th class="py-1.5 px-3 font-medium text-indigo-300 text-xs">Proposed Name</th>
            <th class="py-1.5 px-3 font-medium text-slate-400 text-xs text-right">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-700/30">
          {#each paginatedFiles as file (file.path)}
            <tr class="hover:bg-slate-800/30 transition-colors">
              <td class="py-1.5 px-3 text-center">
                {#if file.status !== 'already_renamed' && file.status !== 'permanent_error'}
                  <input type="checkbox" bind:checked={file.selected}
                    class="rounded bg-slate-900 border-slate-600 text-indigo-500 focus:ring-indigo-500/50" />
                {/if}
              </td>
              <td class="py-1.5 px-3 text-slate-300 font-mono text-xs max-w-[200px] truncate" title={file.name}>{file.name}</td>
              <td class="py-1.5 px-3 text-slate-500 text-xs">➜</td>
              <td class="py-1.5 px-3">
                {#if file.proposedName}
                  {#if file.status === 'already_renamed' || file.status === 'renamed'}
                    <span class="text-emerald-500 font-mono text-xs">{file.proposedName}</span>
                  {:else}
                    <input type="text" bind:value={file.proposedName}
                      class="w-full bg-slate-900/50 border border-slate-600 rounded px-2 py-0.5 text-emerald-400 font-mono text-xs focus:outline-none focus:border-indigo-500" />
                  {/if}
                {:else if file.status === 'error'}
                  <span class="text-red-400 italic text-xs truncate max-w-xs block" title={file.error}>{file.error}</span>
                {:else}
                  <span class="text-slate-500 italic text-xs">Waiting for AI…</span>
                {/if}
              </td>
              <td class="py-1.5 px-3 text-right whitespace-nowrap">
                {#if file.status === 'processing'}
                  <span class="text-indigo-400 text-[10px] font-medium uppercase tracking-wider">Processing</span>
                {:else if file.status === 'ready'}
                  <span class="text-emerald-400 text-[10px] font-medium uppercase tracking-wider">Ready</span>
                {:else if file.status === 'error'}
                  <span class="text-red-400 text-[10px] font-medium uppercase tracking-wider" title={file.error}>Failed (Retry)</span>
                {:else if file.status === 'permanent_error'}
                  <span class="text-rose-600 text-[10px] font-medium uppercase tracking-wider" title={file.error}>Perm. Failed</span>
                  <button class="ml-1 text-slate-500 hover:text-slate-300 normal-case tracking-normal text-[10px] lowercase cursor-pointer"
                    onclick={() => resetFileError(file.path)}>(reset)</button>
                {:else if file.status === 'renamed'}
                  <span class="text-blue-400 text-[10px] font-medium uppercase tracking-wider">Renamed</span>
                {:else if file.status === 'already_renamed'}
                  <span class="text-slate-600 text-[10px] font-medium flex items-center justify-end gap-1 uppercase tracking-wider">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Finished
                  </span>
                {:else}
                  <span class="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Pending</span>
                {/if}
              </td>
            </tr>
          {/each}

          {#if files.length === 0}
            <tr>
              <td colspan="5" class="py-12 text-center text-slate-500">
                <div class="flex flex-col items-center gap-2">
                  <svg class="w-12 h-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p>No files scanned yet. Select a directory to populate the list.</p>
                </div>
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>

    {#if files.length > 0}
      <!-- Pagination -->
      <div class="p-3 border-t border-slate-700/50 bg-slate-800/60 flex items-center justify-between">
        <div class="text-sm text-slate-400">
          Showing <span class="text-slate-300 font-medium">{visibleFiles.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to
          <span class="text-slate-300 font-medium">{Math.min(currentPage * itemsPerPage, visibleFiles.length)}</span> of
          <span class="text-slate-300 font-medium">{visibleFiles.length}</span> files
        </div>
        <div class="flex items-center gap-2">
          <button onclick={prevPage} disabled={currentPage === 1} aria-label="Previous Page"
            class="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="text-sm text-slate-400 mx-2">
            Page <span class="text-white font-medium">{currentPage}</span> of {totalPages}
          </span>
          <button onclick={nextPage} disabled={currentPage === totalPages} aria-label="Next Page"
            class="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Apply Changes Bar -->
      <div class="p-4 border-t border-slate-700/50 bg-slate-800 flex justify-between items-center">
        <span class="text-sm text-slate-400">{files.filter(f => f.selected).length} files selected across all pages</span>
        <button
          onclick={applyChanges}
          disabled={isProcessing}
          class="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-500/20"
        >
          {isProcessing ? 'Applying…' : 'Apply Changes'}
        </button>
      </div>
    {/if}
  </div>
</div>
