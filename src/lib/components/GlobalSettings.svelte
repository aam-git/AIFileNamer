<script lang="ts">
  import { onMount } from 'svelte';

  let version = $state('');
  let osInfo = $state('');
  let startMinimized = $state(false);
  let isLoaded = $state(false);
  let saveMsg = $state('');

  onMount(async () => {
    if (window.electronAPI) {
      const sysInfo = await window.electronAPI.getSystemInfo();
      version = sysInfo.version;
      osInfo = sysInfo.os;

      const settings = await window.electronAPI.getGlobalSettings();
      startMinimized = settings.startMinimized;
      
      isLoaded = true;
    }
  });

  async function toggleStartMinimized() {
    startMinimized = !startMinimized;
    if (window.electronAPI) {
      const result = await window.electronAPI.saveGlobalSettings({ startMinimized });
      if (result.success) {
        saveMsg = 'Settings saved';
        setTimeout(() => saveMsg = '', 2000);
      } else {
        saveMsg = 'Failed to save settings: ' + result.error;
        setTimeout(() => saveMsg = '', 3000);
      }
    }
  }
</script>

<div class="max-w-3xl mx-auto h-full overflow-y-auto pb-12 animate-fade-in">
  <div class="mb-10">
    <h1 class="text-3xl font-bold text-white mb-2">Global Settings</h1>
    <p class="text-slate-400 text-lg">
      Configure app-wide preferences and view system details.
    </p>
  </div>

  {#if !isLoaded}
    <div class="flex items-center justify-center p-12">
      <svg class="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  {:else}
    <div class="space-y-6">
      
      <!-- General Preferences -->
      <div class="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <svg class="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Preferences
        </h3>

        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-white font-medium text-lg">Start App Minimised</h4>
            <p class="text-slate-400 text-sm mt-1">When launched, the app will start silently in the system tray.</p>
          </div>
          <button 
            class="relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 {startMinimized ? 'bg-indigo-500' : 'bg-slate-700'}"
            onclick={toggleStartMinimized}
          >
            <span class="sr-only">Toggle Start Minimised</span>
            <span 
              class="inline-block h-5 w-5 transform rounded-full bg-white transition-transform {startMinimized ? 'translate-x-8' : 'translate-x-1'}"
            ></span>
          </button>
        </div>
        
        {#if saveMsg}
          <p class="text-sm text-emerald-400 mt-4 text-right animate-fade-in-up">{saveMsg}</p>
        {/if}
      </div>

      <!-- System Information -->
      <div class="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          System Information
        </h3>

        <div class="space-y-4">
          <div class="flex items-center justify-between py-3 border-b border-slate-700/50">
            <span class="text-slate-400">AIFileNamer Version</span>
            <span class="text-white font-mono font-medium tracking-wide">v{version}</span>
          </div>
          <div class="flex items-center justify-between py-3">
            <span class="text-slate-400">Operating System</span>
            <span class="text-white font-mono font-medium tracking-wide">{osInfo}</span>
          </div>
        </div>
      </div>
      
    </div>
  {/if}
</div>
