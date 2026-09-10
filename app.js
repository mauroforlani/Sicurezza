/* =========================================================
   VEDETTA — logica applicativa
   Tutto è locale: le segnalazioni vivono in localStorage,
   nessuna chiamata di rete verso un server proprio.
========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "vedetta_reports_v1";
  const DEFAULT_CENTER = [45.4642, 9.1900]; // Milano, punto di partenza se la geolocalizzazione non è disponibile
  const DEFAULT_ZOOM = 13;

  const CATEGORY_LABELS = {
    furto: "Furto",
    sospetto: "Persona sospetta",
    incidente: "Incidente",
    rissa: "Rissa",
  };

  const CATEGORY_ICONS = {
    furto: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M7 8V6a5 5 0 0110 0v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="4" y="8" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/></svg>',
    sospetto: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8"/></svg>',
    incidente: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 3l10 18H2L12 3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17" r=".9" fill="currentColor"/></svg>',
    rissa: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M5 15l3-3-3-3M19 15l-3-3 3-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 20l3-3 3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  // ---------- Stato ----------
  let reports = loadReports();
  let currentFilter = "all";
  let placingMode = false;
  let tempMarker = null;
  let tempLatLng = null;
  let markers = {}; // id -> leaflet marker

  // ---------- Elementi DOM ----------
  const els = {
    map: document.getElementById("map"),
    placingBanner: document.getElementById("placing-banner"),
    cancelPlacing: document.getElementById("btn-cancel-placing"),
    btnReport: document.getElementById("btn-report"),
    btnLocate: document.getElementById("btn-locate"),
    filters: document.getElementById("filters"),
    feedList: document.getElementById("feed-list"),
    emptyState: document.getElementById("empty-state"),
    btnClear: document.getElementById("btn-clear"),
    feedTitle: document.getElementById("feed-title"),

    overlay: document.getElementById("sheet-overlay"),
    sheet: document.getElementById("report-sheet"),
    categoryGrid: document.getElementById("category-grid"),
    desc: document.getElementById("desc"),
    charCount: document.getElementById("char-count"),
    locationPreview: document.getElementById("location-preview"),
    btnUseGps: document.getElementById("btn-use-gps"),
    btnSheetCancel: document.getElementById("btn-sheet-cancel"),
    btnSheetSubmit: document.getElementById("btn-sheet-submit"),
  };

  let selectedCategory = null;

  // ---------- Storage ----------
  function loadReports() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Impossibile leggere le segnalazioni salvate", e);
    }
    return seedReports();
  }

  function saveReports() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    } catch (e) {
      console.warn("Impossibile salvare le segnalazioni", e);
    }
  }

  function seedReports() {
    const now = Date.now();
    return [
      {
        id: "seed-1",
        category: "furto",
        description: "Esempio: bicicletta rubata davanti al portone, catena tagliata.",
        lat: DEFAULT_CENTER[0] + 0.004,
        lng: DEFAULT_CENTER[1] + 0.006,
        time: now - 1000 * 60 * 42,
      },
      {
        id: "seed-2",
        category: "sospetto",
        description: "Esempio: persona ferma da tempo vicino ai portoni, controlla le maniglie delle auto.",
        lat: DEFAULT_CENTER[0] - 0.003,
        lng: DEFAULT_CENTER[1] + 0.002,
        time: now - 1000 * 60 * 60 * 3,
      },
      {
        id: "seed-3",
        category: "incidente",
        description: "Esempio: tamponamento tra due auto all'incrocio, traffico rallentato.",
        lat: DEFAULT_CENTER[0] + 0.002,
        lng: DEFAULT_CENTER[1] - 0.005,
        time: now - 1000 * 60 * 60 * 20,
      },
    ];
  }

  // ---------- Mappa ----------
  const map = L.map(els.map, { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

  function pinIcon(category, temp) {
    if (temp) {
      return L.divIcon({
        className: "",
        html: `<div class="pin pin-temp"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });
    }
    const icon = CATEGORY_ICONS[category] || "";
    return L.divIcon({
      className: "",
      html: `<div class="pin pin-${category}">${icon}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28],
    });
  }

  function addMarkerForReport(r) {
    const marker = L.marker([r.lat, r.lng], { icon: pinIcon(r.category, false) }).addTo(map);
    marker.bindPopup(
      `<strong>${CATEGORY_LABELS[r.category]}</strong><br>${escapeHtml(r.description)}`
    );
    markers[r.id] = marker;
  }

  function renderAllMarkers() {
    Object.values(markers).forEach((m) => map.removeLayer(m));
    markers = {};
    getVisibleReports().forEach(addMarkerForReport);
  }

  // Tap sulla mappa in modalità "segnalazione"
  map.on("click", function (e) {
    if (!placingMode) return;
    tempLatLng = e.latlng;
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker(e.latlng, { icon: pinIcon(null, true) }).addTo(map);
    updateLocationPreview();
    openSheet();
  });

  function flyToUser() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 15, { duration: 0.8 });
      },
      () => {
        /* posizione negata o non disponibile: resta sulla vista di default */
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }

  // Alla partenza, prova a centrare sulla posizione dell'utente senza forzare il permesso in modo invadente
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 14),
      () => {},
      { enableHighAccuracy: true, timeout: 4000 }
    );
  }

  els.btnLocate.addEventListener("click", flyToUser);

  // ---------- Filtri ----------
  els.filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    [...els.filters.children].forEach((c) => c.classList.toggle("active", c === btn));
    renderFeed();
    renderAllMarkers();
  });

  function getVisibleReports() {
    const list = currentFilter === "all" ? reports : reports.filter((r) => r.category === currentFilter);
    return [...list].sort((a, b) => b.time - a.time);
  }

  // ---------- Feed ----------
  function renderFeed() {
    const visible = getVisibleReports();
    els.feedList.innerHTML = "";
    els.emptyState.hidden = visible.length > 0;
    els.feedTitle.textContent = `Bacheca locale (${reports.length})`;

    visible.forEach((r) => {
      const li = document.createElement("li");
      li.className = `report-card cat-${r.category}`;
      li.innerHTML = `
        <div class="report-icon">${CATEGORY_ICONS[r.category] || ""}</div>
        <div class="report-body">
          <div class="report-top">
            <span class="report-cat">${CATEGORY_LABELS[r.category]}</span>
            <span class="report-time">${relativeTime(r.time)}</span>
          </div>
          <p class="report-desc">${escapeHtml(r.description)}</p>
          <p class="report-loc">${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}</p>
        </div>
        <button class="report-delete" title="Rimuovi questa segnalazione" aria-label="Rimuovi">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="M4 5h12M8 5V3.5A1.5 1.5 0 019.5 2h1A1.5 1.5 0 0112 3.5V5m-6.5 0l.7 11a1.5 1.5 0 001.5 1.4h3.6a1.5 1.5 0 001.5-1.4l.7-11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      `;
      li.querySelector(".report-delete").addEventListener("click", () => deleteReport(r.id));
      els.feedList.appendChild(li);
    });
  }

  function deleteReport(id) {
    reports = reports.filter((r) => r.id !== id);
    saveReports();
    renderFeed();
    renderAllMarkers();
  }

  els.btnClear.addEventListener("click", () => {
    if (reports.length === 0) return;
    if (confirm("Svuotare completamente la bacheca locale? L'azione non è reversibile.")) {
      reports = [];
      saveReports();
      renderFeed();
      renderAllMarkers();
    }
  });

  // ---------- Bottom sheet: nuova segnalazione ----------
  function enterPlacingMode() {
    placingMode = true;
    els.placingBanner.hidden = false;
    document.body.style.cursor = "crosshair";
  }

  function exitPlacingMode() {
    placingMode = false;
    els.placingBanner.hidden = true;
    document.body.style.cursor = "";
  }

  els.btnReport.addEventListener("click", () => {
    if (!tempLatLng) {
      enterPlacingMode();
    } else {
      openSheet();
    }
  });

  els.cancelPlacing.addEventListener("click", exitPlacingMode);

  function openSheet() {
    exitPlacingMode();
    els.overlay.hidden = false;
    els.sheet.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeSheet(resetPin) {
    els.overlay.hidden = true;
    els.sheet.hidden = true;
    document.body.style.overflow = "";
    if (resetPin && tempMarker) {
      map.removeLayer(tempMarker);
      tempMarker = null;
      tempLatLng = null;
    }
    resetSheetForm();
  }

  function resetSheetForm() {
    selectedCategory = null;
    [...els.categoryGrid.children].forEach((b) => b.classList.remove("selected"));
    els.desc.value = "";
    els.charCount.textContent = "0";
    updateSubmitState();
  }

  els.overlay.addEventListener("click", () => closeSheet(true));
  els.btnSheetCancel.addEventListener("click", () => closeSheet(true));

  els.categoryGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".cat-btn");
    if (!btn) return;
    selectedCategory = btn.dataset.cat;
    [...els.categoryGrid.children].forEach((b) => b.classList.toggle("selected", b === btn));
    updateSubmitState();
  });

  els.desc.addEventListener("input", () => {
    els.charCount.textContent = String(els.desc.value.length);
    updateSubmitState();
  });

  els.btnUseGps.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("La geolocalizzazione non è disponibile su questo dispositivo o browser.");
      return;
    }
    els.btnUseGps.textContent = "Individuazione…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        tempLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);
        if (tempMarker) map.removeLayer(tempMarker);
        tempMarker = L.marker(tempLatLng, { icon: pinIcon(null, true) }).addTo(map);
        map.panTo(tempLatLng);
        updateLocationPreview();
        els.btnUseGps.textContent = "Usa la mia posizione";
        updateSubmitState();
      },
      () => {
        alert("Non è stato possibile ottenere la posizione. Puoi comunque toccare un punto sulla mappa.");
        els.btnUseGps.textContent = "Usa la mia posizione";
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  });

  function updateLocationPreview() {
    if (tempLatLng) {
      els.locationPreview.textContent = `Punto selezionato: ${tempLatLng.lat.toFixed(4)}, ${tempLatLng.lng.toFixed(4)}`;
      els.locationPreview.classList.add("set");
    } else {
      els.locationPreview.textContent = "Tocca sulla mappa per indicare il punto";
      els.locationPreview.classList.remove("set");
    }
    updateSubmitState();
  }

  function updateSubmitState() {
    const ok = Boolean(selectedCategory) && els.desc.value.trim().length >= 5 && Boolean(tempLatLng);
    els.btnSheetSubmit.disabled = !ok;
  }

  els.sheet.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selectedCategory || !tempLatLng || els.desc.value.trim().length < 5) return;

    const report = {
      id: "r-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      category: selectedCategory,
      description: els.desc.value.trim(),
      lat: tempLatLng.lat,
      lng: tempLatLng.lng,
      time: Date.now(),
    };
    reports.push(report);
    saveReports();

    if (tempMarker) {
      map.removeLayer(tempMarker);
      tempMarker = null;
    }
    tempLatLng = null;

    closeSheet(false);
    renderFeed();
    renderAllMarkers();
  });

  // ---------- Utility ----------
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function relativeTime(ts) {
    const diffMs = Date.now() - ts;
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return "adesso";
    if (min < 60) return `${min} min fa`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} ${h === 1 ? "ora" : "ore"} fa`;
    const d = Math.floor(h / 24);
    return `${d} ${d === 1 ? "giorno" : "giorni"} fa`;
  }

  // ---------- Avvio ----------
  saveReports(); // persiste eventuali dati seed generati al primo avvio
  renderFeed();
  renderAllMarkers();
})();
