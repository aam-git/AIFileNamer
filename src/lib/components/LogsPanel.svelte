<script lang="ts">
  import { scannersStore } from '../stores';
  import { createEmptyRuntimeData } from '../scannerUtils';

  let { scannerId }: { scannerId: string } = $props();

  let runtime = $derived($scannersStore.runtimeData[scannerId] ?? createEmptyRuntimeData());
  let processedHistory = $derived(runtime.processedHistory);
  let aiLogs = $derived(runtime.aiLogs);

  let activeTab: 'file_history' | 'ai_requests' = $state('file_history');
  let searchTerm = $state('');
  let selectedEntries: Record<string, boolean> = $state({});

  function getEntryName(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return val.newName || '';
  }
  function getEntryTimestamp(val: any): number {
    if (!val || typeof val === 'string') return 0;
    return val.timestamp || 0;
  }

  let historyEntries = $derived(Object.entries(processedHistory)
    .map(([originalPath, val]) => ({
      originalPath,
      newName: getEntryName(val),
      timestamp: getEntryTimestamp(val),
      selected: !!selectedEntries[originalPath],
    }))
    .sort((a, b) => b.timestamp - a.timestamp));

  let filteredEntries = $derived(historyEntries.filter(
    entry =>
      entry.originalPath.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.newName.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  let allSelected = $derived(
    filteredEntries.length > 0 && filteredEntries.every(e => e.selected)
  );

  function toggleSelectAll(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    filteredEntries.forEach(entry => {
      selectedEntries[entry.originalPath] = checked;
    });
    selectedEntries = { ...selectedEntries };
  }

  function toggleSelection(originalPath: string) {
    selectedEntries[originalPath] = !selectedEntries[originalPath];
    selectedEntries = { ...selectedEntries };
  }

  function updateRuntime(patch: Partial<typeof runtime>) {
    scannersStore.update(s => ({
      ...s,
      runtimeData: {
        ...s.runtimeData,
        [scannerId]: { ...createEmptyRuntimeData(), ...s.runtimeData[scannerId], ...patch },
      },
    }));
  }

  function clearHistory() {
    if (confirm('Clear rename history? Previously renamed files will be scanned again.')) {
      updateRuntime({ processedHistory: {} });
    }
  }

  function clearAILogs() {
    if (confirm('Clear AI Request Logs?')) {
      updateRuntime({ aiLogs: [] });
    }
  }

  let isUndoing = $state(false);
  let toastMessage = $state('');

  function showToast(msg: string) {
    toastMessage = msg;
    setTimeout(() => (toastMessage = ''), 3000);
  }

  async function undoSelected() {
    const toUndo = filteredEntries
      .filter(e => e.selected)
      .map(e => ({ originalPath: e.originalPath, proposedName: e.newName }));

    if (toUndo.length === 0) return;

    isUndoing = true;
    try {
      const results = await window.electronAPI.undoRenames(toUndo);
      let successCount = 0;
      const rt = $scannersStore.runtimeData[scannerId] ?? createEmptyRuntimeData();
      const newHistory = { ...rt.processedHistory };
      const newSelected = { ...selectedEntries };

      for (const res of results) {
        if (res.status === 'undone') {
          successCount++;
          delete newHistory[res.originalPath];
          delete newSelected[res.originalPath];
        }
      }

      updateRuntime({ processedHistory: newHistory });
      selectedEntries = newSelected;

      if (successCount > 0) {
        showToast(`Successfully undid ${successCount} rename${successCount !== 1 ? 's' : ''}!`);
      }
    } catch (e) {
      showToast('Error undoing renames');
    } finally {
      isUndoing = false;
    }
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString();
  }
</script>

<div class="h-full flex flex-col">
  <div class="mb-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
    <h2 class="text-2xl font-bold text-white">Logs &amp; History</h2>

    {#if toastMessage}
      <div class="fixed bottom-6 right-6 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span class="font-medium">{toastMessage}</span>
      </div>
    {/if}

    <div class="flex bg-slate-800/40 border border-slate-700/50 rounded-xl p-1">
      <button
        onclick={() => (activeTab = 'file_history')}
        class="px-4 py-2 rounded-lg font-medium transition-colors text-sm {activeTab === 'file_history' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}"
      >
        File History
      </button>
      <button
        onclick={() => (activeTab = 'ai_requests')}
        class="px-4 py-2 rounded-lg font-medium transition-colors text-sm {activeTab === 'ai_requests' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}"
      >
        AI Requests
      </button>
    </div>
  </div>

  {#if activeTab === 'file_history'}
    <div class="mb-4 flex flex-wrap items-center gap-2 md:gap-4 w-full">
      <div class="relative flex-1">
        <input
          type="text"
          bind:value={searchTerm}
          placeholder="Search history…"
          class="w-full bg-slate-800/40 border border-slate-700/50 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
        />
        <svg class="absolute right-3 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <button
        onclick={clearHistory}
        disabled={historyEntries.length === 0 || isUndoing}
        class="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-xl font-medium transition-colors whitespace-nowrap"
      >
        Clear History
      </button>
      <button
        onclick={undoSelected}
        disabled={Object.values(selectedEntries).filter(v => v).length === 0 || isUndoing}
        class="bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-xl font-medium transition-colors shadow-lg flex items-center gap-2 whitespace-nowrap"
      >
        {#if isUndoing}
          <div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
        {/if}
        Undo Selected
      </button>
    </div>

    <div class="flex-1 bg-slate-800/20 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col min-h-0">
      <div class="overflow-y-auto flex-1 p-4">
        {#if historyEntries.length === 0}
          <div class="h-full flex flex-col items-center justify-center text-slate-500">
            <svg class="w-16 h-16 mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-lg font-medium">No rename history yet</p>
            <p class="text-sm mt-1">Files you rename will appear here.</p>
          </div>
        {:else if filteredEntries.length === 0}
          <div class="text-center py-12 text-slate-500">No matches for "{searchTerm}"</div>
        {:else}
          <div class="mb-4 px-2">
            <label class="flex items-center gap-3 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={allSelected} onchange={toggleSelectAll}
                class="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer" />
              <span class="font-medium">Select All</span>
            </label>
          </div>
          <div class="space-y-3">
            {#each filteredEntries as entry}
              <div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between gap-4 {entry.selected ? 'border-indigo-500/50 bg-indigo-500/10' : ''}">
                <div class="flex-shrink-0">
                  <input type="checkbox" checked={entry.selected}
                    onchange={() => toggleSelection(entry.originalPath)}
                    class="w-4 h-4 rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Original Path</div>
                  <div class="text-slate-300 font-mono text-sm truncate" title={entry.originalPath}>{entry.originalPath}</div>
                </div>
                <div class="flex-shrink-0 text-slate-500 px-2">
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-emerald-500/70 mb-1 uppercase tracking-wider font-semibold">New Name / Path</div>
                  <div class="text-emerald-400 font-mono text-sm truncate font-medium" title={entry.newName}>{entry.newName}</div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if activeTab === 'ai_requests'}
    <div class="mb-4 flex justify-end">
      <button
        onclick={clearAILogs}
        disabled={aiLogs.length === 0}
        class="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-xl font-medium transition-colors whitespace-nowrap"
      >
        Clear AI Logs
      </button>
    </div>

    <div class="flex-1 bg-slate-800/20 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col min-h-0">
      <div class="overflow-y-auto flex-1 p-4">
        {#if aiLogs.length === 0}
          <div class="h-full flex flex-col items-center justify-center text-slate-500">
            <svg class="w-16 h-16 mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <p class="text-lg font-medium">No AI requests logged yet</p>
            <p class="text-sm mt-1">Start a scan to see detailed API logs here.</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each aiLogs as log}
              <div class="bg-slate-900/80 border border-slate-700 rounded-xl overflow-hidden">
                <div class="px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2 {log.error ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/5'}">
                  <div class="flex items-center gap-3">
                    <span class="px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider {log.error ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}">
                      {log.error ? 'Failed' : 'Success'}
                    </span>
                    <span class="text-slate-300 font-medium">{log.file}</span>
                  </div>
                  <div class="flex items-center gap-3 text-xs text-slate-400">
                    <span>{log.provider}</span>
                    <span>•</span>
                    <span>{formatDate(log.timestamp)}</span>
                  </div>
                </div>
                <div class="p-4 space-y-4">
                  {#if log.error}
                    <div>
                      <div class="text-xs text-rose-400/80 mb-1 uppercase tracking-wider font-semibold">Error Message</div>
                      <div class="bg-rose-950/50 text-rose-300 text-sm p-3 rounded-lg border border-rose-900/50 font-mono whitespace-pre-wrap break-words">{log.error}</div>
                    </div>
                  {/if}
                  {#if log.events && log.events.length > 0}
                    <div>
                      <div class="text-xs text-indigo-400/80 mb-1 uppercase tracking-wider font-semibold">System Pre-Processing</div>
                      <div class="bg-indigo-950/20 text-indigo-300 text-sm p-3 rounded-lg border border-indigo-900/30 font-mono space-y-1">
                        {#each log.events as event}
                          <div class="flex gap-2 items-start">
                            <span class="text-indigo-500 mt-0.5">▶</span>
                            <span>{event}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  <div>
                    <div class="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Request Payload (JSON)</div>
                    <div class="bg-slate-950 text-slate-300 text-xs p-3 rounded-lg border border-slate-800 font-mono overflow-x-auto whitespace-pre">
                      {JSON.stringify(log.request, null, 2)}
                    </div>
                  </div>
                  {#if log.response}
                    <div>
                      <div class="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Response (JSON)</div>
                      <div class="bg-slate-950 text-slate-400 text-xs p-3 rounded-lg border border-slate-800 font-mono overflow-x-auto whitespace-pre">
                        {JSON.stringify(log.response, null, 2)}
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
