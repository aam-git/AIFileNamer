<script lang="ts">

  import ScanPanel from './ScanPanel.svelte';
  import ConfigPanel from './ConfigPanel.svelte';
  import LogsPanel from './LogsPanel.svelte';
  import { scannersStore, activeScannerIdStore, scannerFilesStore } from '../stores';
  import { createNewScannerConfig, copyConfigFrom, createEmptyRuntimeData } from '../scannerUtils';

  let { scannerId, onDeleted }: {
    scannerId: string,
    onDeleted: () => void
  } = $props();

  let scanner = $derived($scannersStore.configs.find(c => c.id === scannerId));

  // Setup completeness checks
  let isConfigured = $derived(!!(scanner?.model && scanner?.provider));
  let needsSetup = $derived(!isConfigured);
  let needsDir = $derived(!scanner?.selectedDir);

  let activeTab: 'scan' | 'config' | 'logs' = $state('scan');

  // ── Inline Name Editing ────────────────────────────────────────────────────
  let isEditingName = $state(false);
  let nameInputValue = $state('');

  function startEditName() {
    nameInputValue = scanner?.name ?? '';
    isEditingName = true;
  }

  function saveEditName() {
    const trimmed = nameInputValue.trim();
    if (trimmed) {
      scannersStore.update(s => ({
        ...s,
        configs: s.configs.map(c => c.id === scannerId ? { ...c, name: trimmed } : c),
      }));
    }
    isEditingName = false;
  }

  function handleNameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveEditName();
    if (e.key === 'Escape') isEditingName = false;
  }

  // ── Delete Scanner ─────────────────────────────────────────────────────────
  let showDeleteConfirm = $state(false);

  function deleteScanner() {
    scannersStore.update(s => {
      const configs = s.configs.filter(c => c.id !== scannerId);
      const runtimeData = { ...s.runtimeData };
      delete runtimeData[scannerId];
      return { configs, runtimeData };
    });
    scannerFilesStore.update(m => {
      const copy = { ...m };
      delete copy[scannerId];
      return copy;
    });
    $activeScannerIdStore = '';
    onDeleted();
  }

  function cloneScanner() {
    if (!scanner) return;
    const config = createNewScannerConfig(`${scanner.name} (copy)`);
    const copied = copyConfigFrom(scanner, config);
    copied.autoRun = false;
    copied.selectedExtensions = [];
    copied.selectedDir = scanner.selectedDir;
    
    scannersStore.update(s => ({
      configs: [...s.configs, copied],
      runtimeData: { ...s.runtimeData, [copied.id]: createEmptyRuntimeData() },
    }));
    
    $activeScannerIdStore = copied.id;
  }

  // ── Config CTA ─────────────────────────────────────────────────────────────
  function goToConfig() {
    activeTab = 'config';
  }
</script>

<div class="h-full flex flex-col">

  <!-- Workspace Header -->
  <div class="mb-5 flex items-center justify-between gap-4 flex-wrap">

    <!-- Left: Editable Name + Directory -->
    <div class="flex items-center gap-3 min-w-0 flex-1">
      {#if isEditingName}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          bind:value={nameInputValue}
          onblur={saveEditName}
          onkeydown={handleNameKeydown}
          autofocus
          class="text-2xl font-bold text-white bg-slate-800 border border-indigo-500 rounded-xl px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-64"
        />
      {:else}
        <button
          onclick={startEditName}
          class="group flex items-center gap-2 text-left"
          title="Click to rename scanner"
        >
          <h1 class="text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors duration-150 truncate max-w-xs">
            {scanner?.name ?? 'Scanner'}
          </h1>
          <svg class="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors duration-150 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      {/if}

      {#if scanner?.selectedDir}
        <span class="hidden xl:block text-xs text-slate-500 font-mono truncate max-w-xs"
          title={scanner.selectedDir}>{scanner.selectedDir}</span>
      {/if}
    </div>

    <!-- Right: Tab Bar + Delete -->
    <div class="flex items-center gap-2 flex-wrap">

      <!-- Config Required Indicator (subtle warning on tab) -->
      <div class="flex bg-slate-800/60 border border-slate-700/50 rounded-xl p-1 gap-1">
        <button
          onclick={() => activeTab = 'scan'}
          class="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 {activeTab === 'scan'
            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Scan
        </button>
        <button
          onclick={() => activeTab = 'config'}
          class="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 relative {activeTab === 'config'
            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Config
          {#if needsSetup && activeTab !== 'config'}
            <span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px] shadow-amber-400/80"></span>
          {/if}
        </button>
        <button
          onclick={() => activeTab = 'logs'}
          class="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 {activeTab === 'logs'
            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Logs
        </button>
      </div>

      <!-- Delete Scanner Button -->
      {#if showDeleteConfirm}
        <div class="flex items-center gap-2 bg-rose-950/50 border border-rose-500/30 rounded-xl px-3 py-1.5">
          <span class="text-xs text-rose-300">Delete this scanner?</span>
          <button
            onclick={deleteScanner}
            class="text-xs font-semibold bg-rose-500 hover:bg-rose-400 text-white px-2.5 py-1 rounded-lg transition-colors"
          >Yes, delete</button>
          <button
            onclick={() => showDeleteConfirm = false}
            class="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700 transition-colors"
          >Cancel</button>
        </div>
      {:else}
        <button
          onclick={cloneScanner}
          class="p-2 rounded-xl text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/30 transition-all duration-200"
          title="Clone scanner"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          onclick={() => showDeleteConfirm = true}
          class="p-2 rounded-xl text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-700/50 hover:border-rose-500/30 transition-all duration-200"
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

  <!-- ── Setup Required Banner ───────────────────────────────────────────── -->
  {#if needsSetup && activeTab === 'scan'}
    <div class="mb-4 flex items-center gap-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4">
      <div class="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
        <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-amber-300 font-semibold text-sm">Configuration Required</p>
        <p class="text-amber-400/70 text-xs mt-0.5">
          This scanner needs an AI provider and model before it can run.
          {#if !scanner?.model}No model selected.{/if}
        </p>
      </div>
      <button
        onclick={goToConfig}
        class="shrink-0 flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-amber-500/25"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Go to Config
      </button>
    </div>
  {:else if needsDir && activeTab === 'scan'}
    <div class="mb-4 flex items-center gap-4 bg-sky-500/10 border border-sky-500/30 rounded-2xl px-5 py-4">
      <div class="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0">
        <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sky-300 font-semibold text-sm">Select a Directory</p>
        <p class="text-sky-400/70 text-xs mt-0.5">
          You haven't selected a folder to scan yet. Click the "Select Directory" button below to get started.
        </p>
      </div>
    </div>
  {/if}

  <!-- Tab Panels — always mounted, CSS-toggled so scan runs in background -->
  <div class="flex-1 min-h-0 {activeTab === 'scan' ? 'flex flex-col' : 'hidden'}">
    <ScanPanel {scannerId} />
  </div>
  <div class="flex-1 min-h-0 {activeTab === 'config' ? 'block' : 'hidden'}">
    <ConfigPanel {scannerId} />
  </div>
  <div class="flex-1 min-h-0 {activeTab === 'logs' ? 'flex flex-col' : 'hidden'}">
    <LogsPanel {scannerId} />
  </div>

</div>
