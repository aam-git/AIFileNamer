<script lang="ts">
  import { scannersStore, activeScannerIdStore, scannerFilesStore, scannerLiveStatusStore } from '../stores';
  import { createNewScannerConfig, createEmptyRuntimeData } from '../scannerUtils';

  let { topView, onNavScanners, onNavAbout, onOpenScanner, onScannerCreated }: {
    topView: 'scanners' | 'scanner-detail' | 'about' | 'global-settings',
    onNavScanners: () => void,
    onNavAbout: () => void,
    onOpenScanner: (id: string) => void,
    onScannerCreated: (id: string) => void
  } = $props();

  let scannersExpanded = $state(true);

  // Aggregate status for sidebar widget
  let activeCount = $derived(Object.values($scannerLiveStatusStore).filter(s => s.isProcessing || s.isScanning || s.isWaiting).length);
  let busyCount = $derived(Object.values($scannerLiveStatusStore).filter(s => s.isProcessing || s.isScanning).length);
  let totalCount = $derived($scannersStore.configs.length);
  
  $effect(() => {
    if (window.electronAPI && window.electronAPI.setAppStatus) {
      window.electronAPI.setAppStatus(busyCount > 0 ? 'scanning' : 'idle');
    }
  });

  function getStatusDot(scannerId: string): { color: string; pulse: boolean; label: string } {
    const live = $scannerLiveStatusStore[scannerId];
    const files = $scannerFilesStore[scannerId] ?? [];
    const scanner = $scannersStore.configs.find(c => c.id === scannerId);

    if (!scanner?.model) return { color: 'bg-amber-400', pulse: false, label: 'Setup Required' };
    if (!scanner?.selectedDir) return { color: 'bg-slate-500', pulse: false, label: 'No Directory' };
    if (live?.isScanning) return { color: 'bg-blue-400', pulse: true, label: 'Scanning…' };
    if (live?.countdown > 0) return { color: 'bg-emerald-400', pulse: true, label: `Starting in ${live.countdown}s` };
    if (live?.isProcessing) return { color: 'bg-emerald-400', pulse: true, label: 'Processing…' };
    if (live?.isDelaying) return { color: 'bg-emerald-400', pulse: true, label: 'Delaying…' };
    if (files.some(f => f.status === 'ready' && f.selected)) return { color: 'bg-indigo-400', pulse: true, label: 'Awaiting Approval' };
    if (live?.isWaiting) return { color: 'bg-yellow-400', pulse: true, label: 'Awaiting Files…' };
    return { color: 'bg-slate-500', pulse: false, label: 'Idle' };
  }

  function createScanner() {
    const config = createNewScannerConfig(`Scanner ${$scannersStore.configs.length + 1}`);
    scannersStore.update(s => ({
      configs: [...s.configs, config],
      runtimeData: { ...s.runtimeData, [config.id]: createEmptyRuntimeData() },
    }));
    $activeScannerIdStore = config.id;
    onScannerCreated(config.id);
  }

</script>

<aside class="w-72 h-full bg-slate-900 border-r border-slate-800 flex flex-col relative z-10 shadow-2xl">

  <!-- Logo -->
  <div class="p-6 pb-4 flex items-center justify-center">
    <img src="./logo_horizontal_384x96.png" alt="AIFileNamer Logo" class="h-10 object-contain" />
  </div>

  <!-- Nav -->
  <nav class="flex-1 px-3 py-2 overflow-y-auto space-y-0.5 min-h-0">

    <!-- Scanners top-level item -->
    <div class="flex items-center gap-1">
      <button
        class="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 {topView === 'scanners'
          ? 'bg-indigo-500/10 text-indigo-400 font-medium'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}"
        onclick={() => onNavScanners()}
      >
        <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <span class="flex-1 text-left text-sm">Scanners</span>
        {#if totalCount > 0}
          <span class="text-[10px] font-semibold bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">{totalCount}</span>
        {/if}
      </button>
      <!-- Collapse Toggle -->
      <button
        class="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        onclick={() => scannersExpanded = !scannersExpanded}
        title="{scannersExpanded ? 'Collapse' : 'Expand'} scanner list"
      >
        <svg class="w-4 h-4 transition-transform duration-200 {scannersExpanded ? '' : '-rotate-90'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>

    <!-- Scanner List (collapsible) -->
    {#if scannersExpanded}
      <div class="pl-4 space-y-0.5 pt-0.5">
        {#each $scannersStore.configs as scanner (scanner.id)}
          {@const dot = getStatusDot(scanner.id)}
          <button
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 group {topView === 'scanner-detail' && $activeScannerIdStore === scanner.id
              ? 'bg-slate-700/80 text-white shadow-inner border border-slate-600/50'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-transparent'}"
            onclick={() => { $activeScannerIdStore = scanner.id; onOpenScanner(scanner.id); }}
          >
            <!-- Status dot -->
            <span
              class="w-2 h-2 rounded-full shrink-0 {dot.color} {dot.pulse ? 'animate-pulse' : ''}"
              title={dot.label}
            ></span>
            <span class="flex-1 text-left text-sm truncate">{scanner.name}</span>
            {#if topView === 'scanner-detail' && $activeScannerIdStore === scanner.id}
              <span class="w-1 h-4 bg-indigo-400 rounded-full shrink-0"></span>
            {/if}
          </button>
        {/each}

        {#if $scannersStore.configs.length === 0}
          <p class="px-3 py-2 text-xs text-slate-600 italic">No scanners yet.</p>
        {/if}

        <!-- New Scanner Button -->
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all duration-200 border border-dashed border-slate-700 hover:border-indigo-500/40 mt-1"
          onclick={createScanner}
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span class="text-sm">New Scanner</span>
        </button>
      </div>
    {/if}

  </nav>

  <!-- About Link -->
  <div class="px-3 pb-3">
    <button
      class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 {topView === 'about'
        ? 'bg-indigo-500/10 text-indigo-400 font-medium'
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}"
      onclick={() => onNavAbout()}
    >
      <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span class="text-sm">About App & Developer</span>
    </button>
  </div>

  <!-- Status Widget -->
  <div class="p-3 border-t border-slate-800">
    <div class="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-sm">
      <div class="flex items-center gap-2 mb-1">
        <div class="w-2 h-2 rounded-full {activeCount > 0 ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px] shadow-emerald-400/80' : 'bg-slate-600'}"></div>
        <span class="text-slate-300 font-medium text-xs">
          {#if activeCount > 0}
            {activeCount} of {totalCount} scanner{activeCount !== 1 ? 's' : ''} active
          {:else if totalCount === 0}
            No scanners created
          {:else}
            All scanners idle
          {/if}
        </span>
      </div>
      {#if totalCount > 0}
        <p class="text-slate-600 text-[10px]">
          {$scannersStore.configs.filter(c => c.model).length} configured · {$scannersStore.configs.filter(c => c.selectedDir).length} with directory
        </p>
      {/if}
    </div>
  </div>

</aside>
