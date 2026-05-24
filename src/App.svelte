<script lang="ts">
  import Sidebar from './lib/components/Sidebar.svelte';
  import ScannersOverview from './lib/components/ScannersOverview.svelte';
  import ScannerWorkspace from './lib/components/ScannerWorkspace.svelte';
  import About from './lib/components/About.svelte';
  import GlobalSettings from './lib/components/GlobalSettings.svelte';
  import EulaModal from './lib/components/EulaModal.svelte';
  import { scannersStore, activeScannerIdStore, isDbReadyStore } from './lib/stores';
  import { onMount } from 'svelte';

  let topView: 'scanners' | 'scanner-detail' | 'about' | 'global-settings' = $state('scanners');
  let eulaAccepted = $state(true);

  async function acceptEula() {
    if (window.electronAPI) {
      await window.electronAPI.saveGlobalSettings({ eulaAccepted: true });
    } else {
      localStorage.setItem('eulaAccepted', 'true');
    }
    eulaAccepted = true;
  }

  function declineEula() {
    if (window.electronAPI) {
      window.electronAPI.closeWindow();
    }
  }

  function openScanner(id: string) {
    if ($scannersStore.configs.some(c => c.id === id)) {
      $activeScannerIdStore = id;
      topView = 'scanner-detail';
    }
  }

  function navScanners() {
    topView = 'scanners';
  }

  onMount(async () => {
    if (window.electronAPI) {
      const settings = await window.electronAPI.getGlobalSettings();
      if (settings.eulaAccepted !== true) {
        eulaAccepted = false;
      }
    } else {
      if (localStorage.getItem('eulaAccepted') !== 'true') {
        eulaAccepted = false;
      }
    }

    if (window.electronAPI && window.electronAPI.onTrayAction) {
      window.electronAPI.onTrayAction((action: string) => {
        if (action === 'nav-scanners') navScanners();
        if (action === 'nav-about') topView = 'about';
      });
    }

    // If there's a remembered active scanner, restore the view
    if ($activeScannerIdStore && $scannersStore.configs.some(c => c.id === $activeScannerIdStore)) {
      topView = 'scanner-detail';
    }
  });
</script>

<div class="flex flex-col h-screen w-full bg-slate-950 overflow-hidden font-sans">
  <!-- Custom Title Bar -->
  <div class="h-9 w-full bg-[#0f172a] border-b border-slate-800/80 flex items-center justify-between px-3 select-none z-50 shrink-0" style="-webkit-app-region: drag;">
    <div class="flex items-center gap-2 text-slate-400 text-xs font-semibold tracking-wide ml-1">
      <svg class="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      AIFileNamer
    </div>
    <div class="flex items-center gap-1" style="-webkit-app-region: no-drag;">
      <!-- Ko-fi Link -->
      <button onclick={() => window.electronAPI.openExternal('https://ko-fi.com/aamservices')} aria-label="Support on Ko-fi" class="w-7 h-7 rounded flex items-center justify-center hover:bg-slate-700 text-[#FF5E5B] hover:brightness-110 transition-all outline-none mr-1" title="Support on Ko-fi">
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.144 2.055-.046 3.846-.462 4.498-1.634.651-1.17 1.151-5.07-1.849-5.872zm-19.006-1.56c1.111-1.151 4.757-1.072 5.649-.028.679.797.108 2.583-.455 3.033-1.516 1.209-5.143 4.254-5.143 4.254s-3.627-3.045-5.143-4.254c-.563-.45-.989-2.236-.309-3.005zm14.417 5.253c-.503 1.258-1.546 1.258-1.546 1.258s-2.028.026-4.674.026c2.812-3.152 4.14-5.376 4.14-5.376s.466-1.134 1.546-1.134c1.08 0 2.227 1.259 2.227 1.259s1.393 2.198-.445 4.093h-1.248z"/></svg>
      </button>

      <!-- GitHub Link -->
      <button onclick={() => window.electronAPI.openExternal('https://github.com/aam-git/AIFileNamer')} aria-label="GitHub Repository" class="w-7 h-7 rounded flex items-center justify-center hover:bg-slate-700 text-slate-400 hover:text-white transition-colors outline-none mr-2" title="GitHub Repository">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
      </button>

      <button onclick={() => topView = 'global-settings'} aria-label="Global Settings" class="w-7 h-7 rounded flex items-center justify-center hover:bg-slate-700 text-slate-400 hover:text-white transition-colors outline-none mr-2">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </button>
      <button onclick={() => window.electronAPI.minimizeWindow()} aria-label="Minimize Window" class="w-7 h-7 rounded flex items-center justify-center hover:bg-slate-700 text-slate-400 hover:text-white transition-colors outline-none">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" /></svg>
      </button>
      <button onclick={() => window.electronAPI.maximizeWindow()} aria-label="Maximize Window" class="w-7 h-7 rounded flex items-center justify-center hover:bg-slate-700 text-slate-400 hover:text-white transition-colors outline-none">
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
      </button>
      <button onclick={() => window.electronAPI.closeWindow()} aria-label="Close Window" class="w-7 h-7 rounded flex items-center justify-center hover:bg-rose-500 text-slate-400 hover:text-white transition-colors outline-none">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  </div>

  <main class="flex flex-1 w-full overflow-hidden relative">
    {#if $isDbReadyStore}
      <Sidebar
        {topView}
        onNavScanners={navScanners}
        onNavAbout={() => topView = 'about'}
        onOpenScanner={(id) => openScanner(id)}
        onScannerCreated={(id) => openScanner(id)}
      />

    <div class="flex-1 overflow-y-auto relative bg-gradient-to-br from-slate-900 to-slate-950">
      <!-- Ambient Background Glow -->
      <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div class="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px]"></div>
        <div class="absolute bottom-[10%] -right-[10%] w-[40%] h-[60%] rounded-full bg-emerald-500/5 blur-[120px]"></div>
      </div>

      <div class="p-8 h-full">
        <!-- Scanners Dashboard -->
        <div class="h-full {topView === 'scanners' ? 'block' : 'hidden'}">
          <ScannersOverview
            onOpenScanner={(id) => openScanner(id)}
            onScannerCreated={(id) => openScanner(id)}
          />
        </div>

        <!-- About Page -->
        <div class="h-full {topView === 'about' ? 'block' : 'hidden'}">
          <About />
        </div>

        <!-- Global Settings Page -->
        <div class="h-full {topView === 'global-settings' ? 'block' : 'hidden'}">
          <GlobalSettings />
        </div>

        <!--
          All scanner workspaces are ALWAYS mounted (not destroyed) so their
          background sync timers and in-progress scans keep running even when
          the user is viewing a different scanner or the dashboard.
          Only the active one is visible via CSS.
        -->
        {#each $scannersStore.configs as scanner (scanner.id)}
          <div class="h-full {topView === 'scanner-detail' && $activeScannerIdStore === scanner.id ? 'block' : 'hidden'}">
            <ScannerWorkspace scannerId={scanner.id} onDeleted={navScanners} />
          </div>
        {/each}
      </div>
    </div>
    {:else}
      <div class="flex-1 flex items-center justify-center bg-slate-900 text-slate-400">
        <div class="flex flex-col items-center gap-4">
          <svg class="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-sm font-medium">Loading Database...</span>
        </div>
      </div>
    {/if}
  </main>

  {#if !eulaAccepted}
    <EulaModal onAccept={acceptEula} onDecline={declineEula} />
  {/if}
</div>
