<script lang="ts">
  import licenseTextRaw from '../../../public/license.txt?raw';

  let { onAccept, onDecline } = $props<{ onAccept: () => void, onDecline: () => void }>();

  let licenseText = $state(licenseTextRaw);
</script>

<div class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
  <div class="bg-slate-900 border border-slate-700 shadow-2xl rounded-xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh]">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
        <svg class="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div>
        <h2 class="text-xl font-semibold text-slate-200">End User License Agreement</h2>
        <p class="text-sm text-slate-400">Please review and accept our terms to use AIFileNamer.</p>
      </div>
    </div>

    <!-- License Content -->
    <div class="flex-1 p-6 overflow-y-auto bg-slate-950/50">
      {#if licenseText}
        <pre class="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed select-text">{licenseText}</pre>
      {:else}
        <div class="flex items-center justify-center h-full text-slate-500 gap-2">
          <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading terms...
        </div>
      {/if}
    </div>

    <!-- Footer Actions -->
    <div class="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-end gap-3">
      <button 
        class="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-700"
        onclick={onDecline}
      >
        I Disagree
      </button>
      <button 
        class="px-5 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        onclick={onAccept}
      >
        I Agree
      </button>
    </div>
  </div>
</div>
