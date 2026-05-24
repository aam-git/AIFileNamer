<script lang="ts">

  import {
    scannersStore,
    activeScannerIdStore,
    scannerFilesStore,
    scannerLiveStatusStore,
  } from '../stores';
  import { createNewScannerConfig, createEmptyRuntimeData, copyConfigFrom } from '../scannerUtils';

  let { onOpenScanner, onScannerCreated }: {
    onOpenScanner: (id: string) => void,
    onScannerCreated: (id: string) => void
  } = $props();

  let deletingId: string | null = $state(null);
  let editingNameId: string | null = $state(null);
  let editingNameValue = $state('');

  function createScanner() {
    const config = createNewScannerConfig(`Scanner ${$scannersStore.configs.length + 1}`);
    scannersStore.update(s => ({
      configs: [...s.configs, config],
      runtimeData: { ...s.runtimeData, [config.id]: createEmptyRuntimeData() },
    }));
    $activeScannerIdStore = config.id;
    onScannerCreated(config.id);
  }

  function openScanner(id: string) {
    $activeScannerIdStore = id;
    onOpenScanner(id);
  }

  function confirmDelete(id: string) {
    deletingId = id;
  }

  function cancelDelete() {
    deletingId = null;
  }

  function deleteScanner(id: string) {
    scannersStore.update(s => {
      const configs = s.configs.filter(c => c.id !== id);
      const runtimeData = { ...s.runtimeData };
      delete runtimeData[id];
      return { configs, runtimeData };
    });
    scannerFilesStore.update(m => {
      const copy = { ...m };
      delete copy[id];
      return copy;
    });
    if ($activeScannerIdStore === id) $activeScannerIdStore = '';
    deletingId = null;
  }

  function cloneScanner(source: any) {
    const config = createNewScannerConfig(`${source.name} (copy)`);
    const copied = copyConfigFrom(source, config);
    copied.autoRun = false;
    copied.selectedExtensions = [];
    copied.selectedDir = source.selectedDir;
    
    scannersStore.update(s => ({
      configs: [...s.configs, copied],
      runtimeData: { ...s.runtimeData, [copied.id]: createEmptyRuntimeData() },
    }));
    
    // Automatically open the cloned scanner
    openScanner(copied.id);
  }

  function startEditName(id: string, currentName: string) {
    editingNameId = id;
    editingNameValue = currentName;
  }

  function saveEditName() {
    if (!editingNameId) return;
    const id = editingNameId;
    const name = editingNameValue.trim() || 'Scanner';
    scannersStore.update(s => ({
      ...s,
      configs: s.configs.map(c => c.id === id ? { ...c, name } : c),
    }));
    editingNameId = null;
  }

  function handleNameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveEditName();
    if (e.key === 'Escape') editingNameId = null;
  }

  function getStatusInfo(id: string) {
    const live = $scannerLiveStatusStore[id];
    const scanner = $scannersStore.configs.find(c => c.id === id);
    const files = $scannerFilesStore[id] ?? [];

    if (!scanner?.model) return { label: 'Setup Required', color: 'text-amber-400', dot: 'bg-amber-400', pulse: false };
    if (!scanner?.selectedDir) return { label: 'No Directory', color: 'text-slate-500', dot: 'bg-slate-600', pulse: false };
    if (live?.isScanning) return { label: 'Scanning…', color: 'text-blue-400', dot: 'bg-blue-400', pulse: true };
    if (live?.countdown > 0) return { label: `Starting in ${live.countdown}s`, color: 'text-emerald-400', dot: 'bg-emerald-400', pulse: true };
    if (live?.isProcessing) return { label: 'Processing', color: 'text-emerald-400', dot: 'bg-emerald-400', pulse: true };
    if (live?.isWaiting) return { label: 'Waiting for files', color: 'text-amber-400', dot: 'bg-amber-400', pulse: true };
    if (live?.isDelaying) return { label: 'Delaying', color: 'text-emerald-400', dot: 'bg-emerald-400', pulse: true };
    if (files.some(f => f.status === 'ready' && f.selected)) return { label: 'Awaiting Approval', color: 'text-indigo-400', dot: 'bg-indigo-400', pulse: true };
    if (live?.isPaused) return { label: 'Paused', color: 'text-rose-400', dot: 'bg-rose-400', pulse: false };
    return { label: 'Idle', color: 'text-slate-500', dot: 'bg-slate-600', pulse: false };
  }

  function getFileCounts(id: string) {
    const files = $scannerFilesStore[id] ?? [];
    const pending = files.filter(f => f.status === 'pending' || f.status === 'error').length;
    const ready = files.filter(f => f.status === 'ready').length;
    const renamed = files.filter(f => f.status === 'already_renamed' || f.status === 'renamed').length;
    const processing = files.filter(f => f.status === 'processing').length;
    return { pending, ready, renamed, processing, total: files.length };
  }

  function formatDir(dir: string) {
    if (!dir) return null;
    const parts = dir.replace(/\\/g, '/').split('/');
    if (parts.length <= 3) return dir;
    return '…/' + parts.slice(-2).join('/');
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ── Global Conflict Detection ──────────────────────────────────────────────
  let conflictingScanners = $derived($scannersStore.configs.filter(scanner => {
    return $scannersStore.configs.some(c => {
      if (c.id === scanner.id) return false;
      if (!c.selectedDir || !scanner.selectedDir) return false;
      if (c.selectedDir !== scanner.selectedDir) return false;
      
      const myExts = scanner.selectedExtensions || [];
      const theirExts = c.selectedExtensions || [];
      if (myExts.length === 0 || theirExts.length === 0) return false;
      
      return myExts.some(ext => theirExts.includes(ext));
    });
  }));
  
  let hasGlobalConflict = $derived(conflictingScanners.length > 0);
</script>

<div class="h-full flex flex-col">

  <!-- Header -->
  <div class="mb-8 flex items-end justify-between">
    <div>
      <h1 class="text-3xl font-bold text-white mb-1">Scanners</h1>
      <p class="text-slate-400 text-sm">
        {$scannersStore.configs.length === 0
          ? 'Create your first scanner to get started.'
          : `${$scannersStore.configs.length} scanner${$scannersStore.configs.length !== 1 ? 's' : ''} configured. Each runs independently.`}
      </p>
    </div>
    <button
      onclick={createScanner}
      class="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      New Scanner
    </button>
  </div>

  <!-- Global Conflict Warning -->
  {#if hasGlobalConflict}
    <div class="mb-6 flex items-center gap-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl px-5 py-4 animate-fade-in-up">
      <div class="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
        <svg class="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-rose-300 font-semibold text-sm">Action Required: Scanner Conflicts Detected</p>
        <p class="text-rose-400/70 text-xs mt-0.5">
          Some scanners are configured to scan the same directory with overlapping extensions.
          Affected scanners: <strong class="text-rose-300">{conflictingScanners.map(s => s.name).join(', ')}</strong>.
          They have been paused until the conflicts are resolved.
        </p>
      </div>
    </div>
  {/if}

  <!-- Empty state -->
  {#if $scannersStore.configs.length === 0}
    <div class="flex-1 flex flex-col items-center justify-center">
      <div class="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-16 flex flex-col items-center gap-6 max-w-lg text-center backdrop-blur-sm">
        <div class="w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <svg class="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <div>
          <h2 class="text-xl font-bold text-white mb-2">No Scanners Yet</h2>
          <p class="text-slate-400 text-sm leading-relaxed">
            Each scanner watches a directory, uses its own AI provider and settings, and can run fully independently in the background.
          </p>
        </div>
        <button
          onclick={createScanner}
          class="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-indigo-500/25"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create First Scanner
        </button>
      </div>
    </div>

  {:else}

    <!-- Scanner Cards Grid -->
    <div class="flex-1 overflow-y-auto min-h-0">
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {#each $scannersStore.configs as scanner (scanner.id)}
          {@const status = getStatusInfo(scanner.id)}
          {@const counts = getFileCounts(scanner.id)}
          {@const live = $scannerLiveStatusStore[scanner.id]}

          <div class="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-4 hover:border-slate-600/70 transition-all duration-200 group backdrop-blur-sm relative overflow-hidden">

            <!-- Subtle top accent line based on status -->
            <div class="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl {status.dot} opacity-40 {status.pulse ? 'animate-pulse' : ''}"></div>

            <!-- Scanner Header -->
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="w-2 h-2 rounded-full shrink-0 mt-1 {status.dot} {status.pulse ? 'animate-pulse' : ''}"></div>
                <div class="flex-1 min-w-0">
                  {#if editingNameId === scanner.id}
                    <!-- svelte-ignore a11y_autofocus -->
                    <input
                      type="text"
                      bind:value={editingNameValue}
                      onblur={saveEditName}
                      onkeydown={handleNameKeydown}
                      class="bg-slate-900 border border-indigo-500 rounded-lg px-2 py-0.5 text-white font-semibold w-full text-sm focus:outline-none"
                      autofocus
                    />
                  {:else}
                    <button
                      class="text-white font-semibold text-base hover:text-indigo-300 transition-colors text-left truncate block w-full"
                      onclick={() => startEditName(scanner.id, scanner.name)}
                      title="Click to rename"
                    >
                      {scanner.name}
                    </button>
                  {/if}
                  <p class="text-xs text-slate-500 mt-0.5">Created {formatDate(scanner.createdAt)}</p>
                </div>
              </div>
              <!-- Status badge -->
              <span class="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0 {
                conflictingScanners.some(c => c.id === scanner.id) ? 'bg-rose-500/15 text-rose-400' :
                status.label === 'Idle' ? 'bg-slate-700/60 text-slate-400' :
                status.label === 'Setup Required' ? 'bg-amber-500/15 text-amber-400' :
                status.label === 'Waiting for files' ? 'bg-amber-500/15 text-amber-400' :
                status.label === 'No Directory' ? 'bg-slate-700/60 text-slate-500' :
                status.label === 'Awaiting Approval' ? 'bg-indigo-500/15 text-indigo-400' :
                'bg-emerald-500/15 text-emerald-400'
              }">
                {conflictingScanners.some(c => c.id === scanner.id) ? 'Conflicted' : status.label}
              </span>
            </div>

            <!-- Info Row -->
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div class="bg-slate-900/50 rounded-xl p-3">
                <div class="text-slate-500 mb-1 uppercase tracking-wider text-[10px] font-semibold">Directory</div>
                <div class="text-slate-300 truncate font-mono" title={scanner.selectedDir}>
                  {#if formatDir(scanner.selectedDir)}
                    {formatDir(scanner.selectedDir)}
                  {:else}
                    <span class="text-slate-600 italic">Not set</span>
                  {/if}
                </div>
              </div>
              <div class="bg-slate-900/50 rounded-xl p-3">
                <div class="text-slate-500 mb-1 uppercase tracking-wider text-[10px] font-semibold">AI Model</div>
                <div class="text-slate-300 truncate" title={scanner.model || 'Not configured'}>
                  {#if scanner.model}
                    {scanner.model}
                  {:else}
                    <span class="text-slate-600 italic">Not configured</span>
                  {/if}
                </div>
              </div>
            </div>

            <!-- File Counts -->
            {#if counts.total > 0}
              <div class="flex items-center gap-3 text-xs">
                <div class="flex-1 bg-slate-900/30 rounded-lg h-1.5 overflow-hidden">
                  <div
                    class="h-full bg-emerald-500 rounded-lg transition-all duration-500"
                    style="width: {counts.total > 0 ? Math.round((counts.renamed / counts.total) * 100) : 0}%"
                  ></div>
                </div>
                <span class="text-slate-500 shrink-0">
                  {counts.renamed}/{counts.total} done
                </span>
                {#if counts.ready > 0}
                  <span class="text-indigo-400 shrink-0">{counts.ready} ready</span>
                {/if}
                {#if counts.processing > 0}
                  <span class="text-emerald-400 shrink-0 flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {counts.processing}
                  </span>
                {/if}
              </div>
            {/if}

            <!-- Actions -->
            <div class="flex items-center gap-2 pt-1 border-t border-slate-700/40">
              <button
                onclick={() => openScanner(scanner.id)}
                class="flex-1 flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
              >
                Open
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {#if deletingId === scanner.id}
                <div class="flex items-center gap-2 flex-1">
                  <span class="text-xs text-slate-400 flex-1">Delete scanner?</span>
                  <button
                    onclick={() => deleteScanner(scanner.id)}
                    class="bg-rose-500 hover:bg-rose-400 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >Yes, delete</button>
                  <button
                    onclick={cancelDelete}
                    class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >Cancel</button>
                </div>
              {:else}
                <button
                  onclick={() => cloneScanner(scanner)}
                  class="p-2 rounded-xl text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all duration-200"
                  title="Clone scanner"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onclick={() => confirmDelete(scanner.id)}
                  class="p-2 rounded-xl text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
                  title="Delete scanner"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              {/if}
            </div>

          </div>
        {/each}
      </div>
    </div>
  {/if}

</div>
