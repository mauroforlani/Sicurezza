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
    statTotal: document.getElementById("stat-total"),
    feedNote: document.getElementById("feed-note"),
    btnUpdate: document.getElementById("btn-update"),
    updateStatus: document.getElementById("update-status"),
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
    return [
      {
        id: "mi-2026-09-12-centrale",
        category: "furto",
        description: "Un uomo è stato sorpreso mentre sottraeva il portafoglio a un passeggero con la tecnica del borseggio, alle spalle della vittima; bloccato dagli agenti in borghese, la refurtiva è stata recuperata.",
        lat: 45.4861,
        lng: 9.2036,
        time: new Date("2026-09-12T10:37:00").getTime(),
        source: "https://www.ansa.it/lombardia/notizie/2026/09/12/ruba-portafogli-a-un-passeggero-alla-stazione-centrale-di-milano-arrestato_373e10d7-5e1f-43f9-b2b1-250761fe5368.html",
        sourceLabel: "ANSA — Stazione Centrale",
      },
      {
        id: "mi-2026-09-10-lima",
        category: "furto",
        description: "Due persone hanno provato ad approfittare di un anziano in difficoltà con due valigie sulle scale della metropolitana per sottrargli il portafoglio; sono stati bloccati sul fatto dagli agenti della Polizia Locale.",
        lat: 45.4776,
        lng: 9.2027,
        time: new Date("2026-09-10T18:00:00").getTime(),
        source: "https://www.radiolombardia.it/2026/09/11/milano-borseggiano-un-ultraottantenne-con-due-valigie-alla-metro-lima-la-polizia-locale-li-arresta-in-flagrante/",
        sourceLabel: "Radio Lombardia — Metro Lima",
      },
      {
        id: "mi-2026-09-12-venezia",
        category: "furto",
        description: "Scippo del portafoglio ai danni di un passante colto di sorpresa mentre era affaticato; i responsabili si sono allontanati rapidamente nella zona.",
        lat: 45.4794,
        lng: 9.2078,
        time: new Date("2026-09-12T12:00:00").getTime(),
        source: "https://www.milanotoday.it/cronaca/",
        sourceLabel: "MilanoToday — Porta Venezia",
      },
      {
        id: "mi-2026-09-13-caracciolo",
        category: "incidente",
        description: "Scontro tra due auto in un incrocio senza semaforo, poco prima dell'alba: coinvolte sei persone, tutte trasportate in ospedale con ferite non gravi.",
        lat: 45.4919,
        lng: 9.1332,
        time: new Date("2026-09-13T05:15:00").getTime(),
        source: "https://www.ansa.it/lombardia/notizie/2026/09/13/incidente-stradale-per-daniel-maldini-a-milano-in-ospedale-per-accertamenti_b1037c51-2be2-40ca-a188-a78c5f8a8d72.html",
        sourceLabel: "ANSA — via Caracciolo",
      },
      {
        id: "mi-2026-09-06-lavater",
        category: "sospetto",
        description: "Un uomo ha infastidito ripetutamente passanti nei pressi di un'area cani, per poi spostarsi poco dopo verso un locale della zona continuando ad importunare i presenti; sono intervenute le forze dell'ordine.",
        lat: 45.4781,
        lng: 9.2110,
        time: new Date("2026-09-06T20:00:00").getTime(),
        source: "https://www.ilgiorno.it/milano/cronaca/le-molestie-e-i-tentativi-6f2f436a",
        sourceLabel: "Il Giorno — Piazzale Lavater",
      },
      {
        id: "mi-2026-09-11-navigli",
        category: "rissa",
        description: "Un gruppo di persone incappucciate ha aggredito con delle coltellate un tifoso straniero in zona Navigli, nella notte prima di una partita di calcio internazionale in città.",
        lat: 45.4517,
        lng: 9.1739,
        time: new Date("2026-09-11T23:30:00").getTime(),
        source: "https://it.soccerway.com/news/calcio-champions-league-accoltellamento-in-centro-a-milano-prima-del-match-di-champions-un-tifoso-in-ospedale/AT5RMZb5",
        sourceLabel: "Soccerway — Navigli",
      },
    ];
  }

  // ---------- Mappa ----------
  const map = L.map(els.map, { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
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
    const sourceHtml = r.source
      ? `<br><a href="${r.source}" target="_blank" rel="noopener">Fonte: ${escapeHtml(r.sourceLabel || "articolo")}</a>`
      : "";
    marker.bindPopup(
      `<strong>${CATEGORY_LABELS[r.category]}</strong><br>${escapeHtml(r.description)}${sourceHtml}`
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
    if (els.statTotal) els.statTotal.textContent = String(reports.length);
    if (els.feedNote) {
      els.feedNote.textContent = reports.length
        ? `Ultimo aggiornamento ${relativeTime(getVisibleReports()[0]?.time ?? reports[reports.length - 1].time)}. Le segnalazioni restano solo su questo dispositivo.`
        : "Le segnalazioni restano solo su questo dispositivo: non vengono inviate a nessun server.";
    }

    visible.forEach((r) => {
      const li = document.createElement("li");
      li.className = `report-entry cat-${r.category}`;
      li.innerHTML = `
        <span class="report-marker"></span>
        <div class="report-top">
          <span class="report-cat">${CATEGORY_LABELS[r.category]}</span>
          <span class="report-time">${relativeTime(r.time)}</span>
        </div>
        <p class="report-desc">${escapeHtml(r.description)}</p>
        <div class="report-foot">
          <span class="report-loc">${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}</span>
          ${r.source ? `<a class="report-source" href="${r.source}" target="_blank" rel="noopener">Fonte</a>` : ""}
          <button class="report-delete" title="Rimuovi questa segnalazione" aria-label="Rimuovi">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="M4 5h12M8 5V3.5A1.5 1.5 0 019.5 2h1A1.5 1.5 0 0112 3.5V5m-6.5 0l.7 11a1.5 1.5 0 001.5 1.4h3.6a1.5 1.5 0 001.5-1.4l.7-11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
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

  // ---------- Aggiornamento dati (data.json) ----------
  function showUpdateStatus(text, isError) {
    if (!els.updateStatus) return;
    els.updateStatus.textContent = text;
    els.updateStatus.hidden = false;
    els.updateStatus.classList.toggle("is-error", Boolean(isError));
  }

  async function checkForUpdates() {
    if (!els.btnUpdate) return;
    els.btnUpdate.disabled = true;
    const originalLabel = els.btnUpdate.textContent;
    els.btnUpdate.textContent = "Aggiornamento…";
    showUpdateStatus("Controllo di nuove segnalazioni…", false);

    try {
      // Cache-busting: forza il browser a non usare una copia vecchia di data.json
      const res = await fetch(`data.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Risposta non valida (" + res.status + ")");
      const incoming = await res.json();
      if (!Array.isArray(incoming)) throw new Error("Formato dati non valido");

      const existingIds = new Set(reports.map((r) => r.id));
      let added = 0;
      incoming.forEach((item) => {
        if (!item || !item.id || existingIds.has(item.id)) return;
        const time = typeof item.time === "string" ? new Date(item.time).getTime() : item.time;
        if (!item.category || !item.description || !Number.isFinite(item.lat) || !Number.isFinite(item.lng) || !Number.isFinite(time)) {
          return; // scarta voci malformate invece di far fallire tutto l'aggiornamento
        }
        reports.push({
          id: item.id,
          category: item.category,
          description: item.description,
          lat: item.lat,
          lng: item.lng,
          time,
          source: item.source || null,
          sourceLabel: item.sourceLabel || null,
        });
        existingIds.add(item.id);
        added++;
      });

      if (added > 0) {
        saveReports();
        renderFeed();
        renderAllMarkers();
        showUpdateStatus(`Aggiunte ${added} nuove segnalazioni.`, false);
      } else {
        showUpdateStatus("Nessuna nuova segnalazione disponibile al momento.", false);
      }
    } catch (err) {
      console.warn("Aggiornamento non riuscito", err);
      showUpdateStatus("Aggiornamento non riuscito. Riprova più tardi.", true);
    } finally {
      els.btnUpdate.disabled = false;
      els.btnUpdate.textContent = originalLabel;
    }
  }

  if (els.btnUpdate) {
    els.btnUpdate.addEventListener("click", checkForUpdates);
  }

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
