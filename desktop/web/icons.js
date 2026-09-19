'use strict';
(() => {
  const p = {
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.7-3.7"/>',
    refresh:'<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 5"/><path d="M17.9 15A7 7 0 0 1 6 18l-2-5"/>',
    alert:'<path d="M12 3 2.7 19h18.6L12 3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    sparkle:'<path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
    volume2:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6"/><path d="M18 6a8 8 0 0 1 0 12"/>',
    volumeX:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 5"/><path d="m21 9-5 5"/>',
    sliders:'<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
    x:'<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
    activity:'<path d="M3 12h4l2-7 4 14 2-7h6"/>',
    network:'<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="18" r="2.2"/><path d="m11 7-5 9"/><path d="m13 7 5 9"/><path d="M7.2 18h9.6"/>',
    brain:'<path d="M9.5 4.5A3 3 0 0 0 6 7.4 3.5 3.5 0 0 0 6.7 14a3 3 0 0 0 2.8 4.5"/><path d="M14.5 4.5A3 3 0 0 1 18 7.4a3.5 3.5 0 0 1-.7 6.6 3 3 0 0 1-2.8 4.5"/><path d="M9.5 4.5v15"/><path d="M14.5 4.5v15"/><path d="M6 9h3.5"/><path d="M14.5 9H18"/><path d="M6.7 14h2.8"/><path d="M14.5 14h2.8"/>',
    bot:'<rect x="4" y="7" width="16" height="12" rx="4"/><path d="M12 3v4"/><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M8 16h8"/>',
    boxes:'<path d="m12 2 4 2.3v4.6L12 11 8 8.9V4.3L12 2Z"/><path d="m5 13 4 2.3v4.6L5 22l-4-2.1v-4.6L5 13Z"/><path d="m19 13 4 2.3v4.6L19 22l-4-2.1v-4.6l4-2.3Z"/>',
    repo:'<path d="M4 19V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v14"/><path d="M6 17h11"/><path d="M8 7h7"/><path d="M8 11h5"/>',
    check:'<path d="M20 6 9 17l-5-5"/>',
    server:'<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01"/><path d="M7 17h.01"/>',
    settings:'<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 8.97 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
    chevronRight:'<path d="m9 18 6-6-6-6"/>',
  };
  function icon(name,size=16,extra=''){
    return `<svg class="ui-icon ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||p.sparkle}</svg>`;
  }
  function hydrate(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{if(el.dataset.iconHydrated)return;el.innerHTML=icon(el.dataset.icon,+(el.dataset.iconSize||16));el.dataset.iconHydrated='1'})}
  window.AGIcons={icon,hydrate};
})();
