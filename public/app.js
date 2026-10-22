// ==========================================================================
// KOLKATA NIGHT RIDERS — HIGH-INTERACTIVITY FRONTEND CONTROLLER
// ==========================================================================

let appState = {
  tripName: "Kolkata Night Riders 🚖🌙",
  currency: "₹",
  members: [],
  expenses: [],
  analytics: {
    totalSpent: 0,
    memberStats: [],
    settlements: [],
    categoryTotals: {}
  }
};

let currentCategory = "ALL";
let searchQuery = "";
let isPolling = true;
let editingMemberId = null;
let activeUpiPayment = null;

const CATEGORY_MAP = {
  Food: { icon: "🍲", label: "Food & Drinks" },
  Travel: { icon: "🚕", label: "Yellow Cab" },
  Stay: { icon: "🏨", label: "Hotel & Stay" },
  Chai: { icon: "☕", label: "Kulhad Chai" },
  Sightseeing: { icon: "🏛️", label: "Sightseeing" },
  General: { icon: "🎟️", label: "Misc / Other" }
};

// ======================== INITIALIZATION ========================
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  fetchTripData();
  setupTabs();
  setupModals();
  setupFormListeners();
  setupPresets();
  setupSearch();
  setupWhatsApp();

  // Real-time synchronization polling (every 4 seconds, paused when editing or modal is open)
  setInterval(() => {
    const isAnyModalOpen = document.querySelector(".modal-overlay.open") !== null;
    if (isPolling && !isAnyModalOpen && editingMemberId === null) {
      fetchTripData(true);
    }
  }, 4000);
});

// ======================== THEME MANAGEMENT ========================
function initTheme() {
  const savedTheme = localStorage.getItem("knr_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);

  document.getElementById("btn-theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("knr_theme", next);
    updateThemeIcon(next);
  });
}

function updateThemeIcon(theme) {
  const icon = document.querySelector(".theme-icon");
  if (icon) icon.textContent = theme === "dark" ? "🌙" : "☀️";
}

// ======================== DATA FETCHING ========================
async function fetchTripData(silent = false) {
  try {
    const res = await fetch("/api/data");
    if (!res.ok) throw new Error("Could not fetch trip data");
    const data = await res.json();
    appState = data;
    renderAll();
  } catch (err) {
    if (!silent) showToast("Network sync error", true);
  }
}

// ======================== MASTER RENDER ========================
function renderAll() {
  const { currency, members, expenses, analytics, storageMode } = appState;
  const totalSpent = analytics.totalSpent || 0;
  const memberCount = members.length;
  const avg = memberCount > 0 ? Math.round(totalSpent / memberCount) : 0;

  // Storage Mode Pill in Nav
  const storagePill = document.getElementById("storage-pill");
  const storageText = document.getElementById("storage-status-text");
  if (storagePill && storageText) {
    if (storageMode === "mongodb") {
      storagePill.classList.add("mongodb-active");
      storageText.textContent = "MongoDB Cloud";
      storagePill.title = "Connected to MongoDB Atlas. Data permanently saved in cloud!";
    } else {
      storagePill.classList.remove("mongodb-active");
      storageText.textContent = "Local Storage";
      storagePill.title = "Running locally. Set MONGODB_URI in Render for cloud sync.";
    }
  }

  // Hero Numbers
  document.getElementById("stat-total-spent").textContent = `${currency}${totalSpent.toLocaleString("en-IN")}`;
  document.getElementById("stat-avg-spend").textContent = `${currency}${avg.toLocaleString("en-IN")}`;
  document.getElementById("stat-total-bills").textContent = expenses.length;
  document.getElementById("stat-squad-size").textContent = memberCount;

  // Tab Counters
  document.getElementById("tab-counter-settlements").textContent = analytics.settlements.length;
  document.getElementById("tab-counter-expenses").textContent = expenses.length;

  // Views
  renderSettlements();
  renderSettledHistory();
  renderExpensesFeed();
  renderLeaderboard();
  renderExpenseModalFields();
  renderSquadManageList();
}

// ======================== TAB 1: SETTLEMENTS ========================
function renderSettlements() {
  const container = document.getElementById("settlements-container");
  const { settlements, totalSpent } = appState.analytics;
  const { currency, members } = appState;

  if (members.length < 2) {
    container.innerHTML = `
      <div class="empty-view-state">
        <div class="empty-state-emoji">👥</div>
        <h4 class="empty-state-title">Add Your Squad First</h4>
        <p class="empty-state-hint">Tap "Squad Members" above to add your 6 Kolkata travel buddies.</p>
      </div>
    `;
    return;
  }

  if (totalSpent === 0 || settlements.length === 0) {
    container.innerHTML = `
      <div class="empty-view-state">
        <div class="empty-state-emoji">✨</div>
        <h4 class="empty-state-title">All Settled Up!</h4>
        <p class="empty-state-hint">Zero pending debts. Add an expense to start tracking splits.</p>
      </div>
    `;
    return;
  }

  const memberMap = new Map(members.map(m => [m.id, m]));

  container.innerHTML = settlements.map(s => {
    const fromMember = memberMap.get(s.fromId) || { name: s.fromName, color: "#F43F5E" };
    const toMember = memberMap.get(s.toId) || { name: s.toName, color: "#10B981" };

    return `
      <div class="settlement-flow-card">
        <div class="flow-members-wrap">
          <!-- Debtor (Payer) -->
          <div class="member-entity">
            <div class="avatar-badge" style="background-color: ${fromMember.color || '#F43F5E'}">
              ${escapeHtml(fromMember.name.charAt(0).toUpperCase())}
            </div>
            <div class="entity-info">
              <span class="entity-name">${escapeHtml(fromMember.name)}</span>
              <span class="entity-tag tag-payer">Transfers</span>
            </div>
          </div>

          <!-- Flow Connector -->
          <div class="flow-connector">
            <span class="flow-arrow-icon">➔</span>
            <span class="flow-hint">OWES</span>
          </div>

          <!-- Creditor (Receiver) -->
          <div class="member-entity">
            <div class="avatar-badge" style="background-color: ${toMember.color || '#10B981'}">
              ${escapeHtml(toMember.name.charAt(0).toUpperCase())}
            </div>
            <div class="entity-info">
              <span class="entity-name">${escapeHtml(toMember.name)}</span>
              <span class="entity-tag tag-receiver">Receives</span>
            </div>
          </div>
        </div>

        <div class="settlement-actions-wrap">
          <div class="settlement-amount-display">
            <div class="settlement-val">${currency}${s.amount.toLocaleString("en-IN")}</div>
            <div class="settlement-sub">Direct Transfer</div>
          </div>

          <button class="btn-upi-pay" onclick="openUpiPaymentModal('${s.fromId}', '${s.toId}', ${s.amount})" title="Pay via UPI or Scan QR">
            <span>⚡</span> Pay via UPI
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// Render Completed Settlements History
function renderSettledHistory() {
  const container = document.getElementById("settled-history-container");
  const section = document.getElementById("settled-history-section");
  const history = appState.settlementsHistory || [];
  const currency = appState.currency || "₹";

  if (!container || !section) return;

  if (history.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  container.innerHTML = history.map(item => `
    <div class="settled-history-card">
      <div class="settled-history-left">
        <span class="settled-check-badge">✓</span>
        <div>
          <div class="settled-history-title">
            <strong>${escapeHtml(item.fromName)}</strong> paid <strong>${escapeHtml(item.toName)}</strong>
          </div>
          <div class="settled-history-date">${item.date || "Completed"}</div>
        </div>
      </div>
      <div class="settled-history-right">
        <span class="settled-history-amt">${currency}${item.amount.toLocaleString("en-IN")}</span>
        <button class="btn-trash-icon" onclick="deleteSettlementHistory('${item.id}')" title="Undo completed settlement">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  `).join("");
}

// Open UPI QR & Action Modal
function openUpiPaymentModal(fromId, toId, amount) {
  const fromMember = appState.members.find(m => m.id === fromId) || { name: "Squad Member" };
  const toMember = appState.members.find(m => m.id === toId) || { name: "Squad Member", upi: "" };
  const currency = appState.currency || "₹";

  activeUpiPayment = { fromId, toId, fromName: fromMember.name, toName: toMember.name, amount };

  document.getElementById("upi-modal-title").textContent = `Pay ${toMember.name}`;
  document.getElementById("upi-modal-recipient").textContent = `${toMember.name}${toMember.upi ? ` • UPI ID: ${toMember.upi}` : ' • (No UPI ID added in Squad)'}`;
  document.getElementById("upi-modal-amount").textContent = `${currency}${amount.toLocaleString("en-IN")}`;

  const upiId = toMember.upi || "";
  const upiUri = upiId 
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(toMember.name)}&am=${encodeURIComponent(amount)}&cu=INR&tn=Kolkata%20Trip%20Split`
    : `upi://pay?pn=${encodeURIComponent(toMember.name)}&am=${encodeURIComponent(amount)}&cu=INR&tn=Kolkata%20Trip%20Split`;

  // QR Code generated dynamically
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=8&data=${encodeURIComponent(upiUri)}`;
  document.getElementById("upi-qr-img").src = qrUrl;

  const launchBtn = document.getElementById("upi-modal-launch-btn");
  launchBtn.href = upiUri;
  if (!upiId) {
    launchBtn.onclick = () => {
      alert(`Note: ${toMember.name} hasn't added a UPI ID yet. You can add it anytime in "Squad Members"!`);
    };
  } else {
    launchBtn.onclick = null;
  }

  document.getElementById("modal-upi-qr").classList.add("open");
}

async function markActivePaymentSettled() {
  if (!activeUpiPayment) return;
  const { fromId, toId, fromName, toName, amount } = activeUpiPayment;

  try {
    const res = await fetch("/api/settlements/mark-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromId, toId, amount })
    });

    if (!res.ok) throw new Error("Could not record settlement");

    document.getElementById("modal-upi-qr").classList.remove("open");
    activeUpiPayment = null;

    if (typeof confetti === "function") {
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#10B981", "#6366F1", "#F59E0B"]
      });
    }

    showToast(`Marked: ${fromName} paid ${toName} ₹${amount}! 🎉`);
    fetchTripData();
  } catch (err) {
    showToast("Error: " + err.message, true);
  }
}

async function deleteSettlementHistory(id) {
  if (!confirm("Undo this completed payment?")) return;
  try {
    const res = await fetch(`/api/settlements/history/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to undo");
    showToast("Payment undone");
    fetchTripData();
  } catch (err) {
    showToast("Error undoing settlement", true);
  }
}

// ======================== TAB 2: EXPENSES FEED ========================
function renderExpensesFeed() {
  const container = document.getElementById("expenses-feed-container");
  const { expenses, currency, members } = appState;

  let filtered = expenses;

  // Category Filter
  if (currentCategory !== "ALL") {
    filtered = filtered.filter(e => e.category === currentCategory);
  }

  // Keyword Search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(e => e.title.toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-view-state">
        <div class="empty-state-emoji">🧾</div>
        <h4 class="empty-state-title">No expenses found</h4>
        <p class="empty-state-hint">${expenses.length === 0 ? "Hit 'Add Expense' above to log your first bill!" : "Try searching something else or clearing filters."}</p>
      </div>
    `;
    return;
  }

  const memberMap = new Map(members.map(m => [m.id, m]));

  container.innerHTML = filtered.map(exp => {
    const payer = memberMap.get(exp.paidBy) || { name: "Squad", color: "#6366F1" };
    const catInfo = CATEGORY_MAP[exp.category] || { icon: "🎟️", label: exp.category };
    const splitCount = exp.splitBetween ? exp.splitBetween.length : members.length;
    const splitSummary = (exp.splitBetween || [])
      .map(id => memberMap.get(id)?.name || "Member")
      .slice(0, 3)
      .join(", ") + (splitCount > 3 ? ` +${splitCount - 3} others` : "");

    return `
      <div class="expense-row-card">
        <div class="expense-left-cluster">
          <div class="cat-icon-badge">${catInfo.icon}</div>
          <div class="expense-info-block">
            <span class="expense-item-name">${escapeHtml(exp.title)}</span>
            <div class="expense-item-meta">
              <span>Paid by <span class="payer-highlight-span">${escapeHtml(payer.name)}</span></span>
              <span>•</span>
              <span>For: ${escapeHtml(splitSummary)}</span>
              <span>•</span>
              <span>${exp.date || "Kolkata Trip"}</span>
            </div>
          </div>
        </div>

        <div class="expense-right-cluster">
          <div class="expense-amount-column">
            <div class="expense-item-amt">${currency}${Number(exp.amount).toLocaleString("en-IN")}</div>
            <div class="expense-item-share">${currency}${Math.round(exp.amount / (splitCount || 1))}/person</div>
          </div>

          <button class="btn-trash-icon" onclick="deleteExpense('${exp.id}')" title="Delete expense">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// ======================== TAB 3: LEADERBOARD ========================
function renderLeaderboard() {
  const container = document.getElementById("leaderboard-container");
  const { memberStats, totalSpent } = appState.analytics;
  const { currency } = appState;

  if (!memberStats || memberStats.length === 0) {
    container.innerHTML = `<div class="empty-view-state"><p>No members registered yet.</p></div>`;
    return;
  }

  // Rank by highest paid first
  const sorted = [...memberStats].sort((a, b) => b.paid - a.paid);

  const medals = ["👑", "🥈", "🥉"];

  container.innerHTML = sorted.map((m, index) => {
    const medal = index < 3 ? medals[index] : `#${index + 1}`;
    const pct = totalSpent > 0 ? Math.min(Math.round((m.paid / totalSpent) * 100), 100) : 0;

    let badgeClass = "settled";
    let badgeText = "All Settled";
    if (m.balance > 0.01) {
      badgeClass = "positive";
      badgeText = `Gets Back ${currency}${m.balance.toLocaleString("en-IN")}`;
    } else if (m.balance < -0.01) {
      badgeClass = "negative";
      badgeText = `Owes ${currency}${Math.abs(m.balance).toLocaleString("en-IN")}`;
    }

    return `
      <div class="leaderboard-card">
        <div class="leaderboard-card-header">
          <div class="user-identity">
            <div class="avatar-badge" style="background-color: ${m.color || '#6366F1'}">
              ${escapeHtml(m.name.charAt(0).toUpperCase())}
            </div>
            <div class="user-title-wrap">
              <span class="user-display-name">${escapeHtml(m.name)}</span>
              <span class="user-upi-tag">${m.upi ? escapeHtml(m.upi) : 'No UPI added'}</span>
            </div>
          </div>
          <span class="rank-badge">${medal}</span>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px; color:var(--text-muted);">
            <span>Trip contribution</span>
            <span>${pct}%</span>
          </div>
          <div class="progress-metric-track">
            <div class="progress-metric-fill" style="width: ${pct}%"></div>
          </div>
        </div>

        <div class="metric-stats-row">
          <div class="metric-stat-pair">
            <span class="stat-header-sub">Total Paid</span>
            <span class="stat-val-bold">${currency}${m.paid.toLocaleString("en-IN")}</span>
          </div>
          <div class="metric-stat-pair">
            <span class="stat-header-sub">Fair Share</span>
            <span class="stat-val-bold">${currency}${m.owed.toLocaleString("en-IN")}</span>
          </div>
        </div>

        <div class="status-net-pill ${badgeClass}">
          <span>Balance Status</span>
          <strong>${badgeText}</strong>
        </div>
      </div>
    `;
  }).join("");
}

// ======================== MODAL INPUTS & LIVE SPLIT MATH ========================
function renderExpenseModalFields() {
  const payerSelect = document.getElementById("expense-paid-by");
  const splitContainer = document.getElementById("split-checkboxes-container");
  const { members } = appState;

  const currentVal = payerSelect.value;
  payerSelect.innerHTML = members.map(m => `
    <option value="${m.id}" ${m.id === currentVal ? 'selected' : ''}>
      ${escapeHtml(m.name)}
    </option>
  `).join("");

  splitContainer.innerHTML = members.map(m => `
    <label class="split-item-row active" data-id="${m.id}">
      <input type="checkbox" name="split-member-check" value="${m.id}" checked onchange="handleSplitCheckboxChange(this)">
      <div class="split-member-mini-avatar" style="background-color: ${m.color || '#6366F1'}">
        ${escapeHtml(m.name.charAt(0).toUpperCase())}
      </div>
      <span style="font-weight:700; font-size:13px;">${escapeHtml(m.name)}</span>
    </label>
  `).join("");

  updateLiveSplitHint();
}

function handleSplitCheckboxChange(input) {
  const label = input.closest(".split-item-row");
  if (input.checked) {
    label.classList.add("active");
  } else {
    label.classList.remove("active");
  }
  updateLiveSplitHint();
}

function updateLiveSplitHint() {
  const amountInput = document.getElementById("expense-amount");
  const amount = parseFloat(amountInput.value) || 0;
  const checkedBoxes = document.querySelectorAll('input[name="split-member-check"]:checked');
  const count = checkedBoxes.length;
  const hint = document.getElementById("live-split-hint");

  if (count === 0) {
    hint.textContent = "Select at least 1 person";
    hint.style.color = "var(--accent-coral)";
    return;
  }

  hint.style.color = "var(--accent-emerald)";
  if (amount > 0) {
    const perPerson = Math.round((amount / count) * 100) / 100;
    hint.textContent = `₹${amount.toLocaleString("en-IN")} ÷ ${count} members = ₹${perPerson.toLocaleString("en-IN")} each`;
  } else {
    hint.textContent = `Splitting equally among ${count} members`;
  }
}

// ======================== SQUAD MANAGEMENT & EDITING ========================
function renderSquadManageList() {
  const container = document.getElementById("squad-list-container");
  if (!container) return;
  const { members, expenses } = appState;

  container.innerHTML = members.map(m => {
    const isEditing = editingMemberId === m.id;
    const isActive = expenses.some(e => e.paidBy === m.id || (e.splitBetween && e.splitBetween.includes(m.id)));

    if (isEditing) {
      return `
        <div class="squad-row-card editing-card" onclick="event.stopPropagation()">
          <div class="squad-edit-grid">
            <div class="input-field-group">
              <label class="field-label" style="font-size:10px;">Name</label>
              <input type="text" id="edit-mem-name-${m.id}" class="custom-input" value="${escapeHtml(m.name)}" placeholder="Member name" required onclick="event.stopPropagation()">
            </div>
            <div class="input-field-group">
              <label class="field-label" style="font-size:10px;">UPI ID (e.g. name@upi)</label>
              <input type="text" id="edit-mem-upi-${m.id}" class="custom-input" value="${escapeHtml(m.upi || '')}" placeholder="Optional UPI ID" onclick="event.stopPropagation()">
            </div>
          </div>
          <div class="squad-edit-actions">
            <button type="button" class="btn-action-ghost btn-sm" onclick="cancelEditMember(event)" title="Cancel">Cancel</button>
            <button type="button" class="btn-action-submit btn-sm" onclick="saveEditMember('${m.id}', event)" title="Save changes">Save</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="squad-row-card" onclick="event.stopPropagation()">
        <div class="squad-row-left">
          <div class="avatar-badge" style="width:34px; height:34px; font-size:13px; background-color: ${m.color || '#6366F1'}">
            ${escapeHtml(m.name.charAt(0).toUpperCase())}
          </div>
          <div>
            <div style="font-weight:700; font-size:14px; color:var(--text-primary);">${escapeHtml(m.name)}</div>
            ${m.upi ? `<div style="font-size:11px; color:var(--accent-emerald); font-weight:600;">UPI: ${escapeHtml(m.upi)}</div>` : `<div style="font-size:11px; color:var(--text-muted);">No UPI added</div>`}
          </div>
        </div>

        <div class="squad-row-actions">
          <button type="button" class="btn-icon-action" onclick="startEditMember('${m.id}', event)" title="Edit name & UPI">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            <span style="font-size:12px; font-weight:700; margin-left:2px;">Edit</span>
          </button>

          ${isActive ? `
            <span class="active-bill-tag" title="Participated in trip expenses">Active</span>
          ` : `
            <button type="button" class="btn-trash-icon" onclick="deleteMember('${m.id}', event)" title="Remove member">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          `}
        </div>
      </div>
    `;
  }).join("");
}

function startEditMember(id, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  editingMemberId = id;
  renderSquadManageList();
  setTimeout(() => {
    document.getElementById(`edit-mem-name-${id}`)?.focus();
  }, 50);
}

function cancelEditMember(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  editingMemberId = null;
  renderSquadManageList();
}

async function saveEditMember(id, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const nameInput = document.getElementById(`edit-mem-name-${id}`);
  const upiInput = document.getElementById(`edit-mem-upi-${id}`);
  const name = nameInput ? nameInput.value.trim() : "";
  const upi = upiInput ? upiInput.value.trim() : "";

  if (!name) {
    showToast("Name cannot be empty", true);
    return;
  }

  try {
    const res = await fetch(`/api/members/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, upi })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update member");
    }

    editingMemberId = null;
    showToast(`Updated to ${name}! ✨`);

    // Direct local update so modal stays smooth
    const m = appState.members.find(x => x.id === id);
    if (m) {
      m.name = name;
      m.upi = upi;
    }
    renderSquadManageList();
    renderExpenseModalFields();
    renderLeaderboard();
    renderSettlements();
    fetchTripData(true);
  } catch (err) {
    showToast(err.message, true);
  }
}

// ======================== QUICK PRESETS ========================
function setupPresets() {
  document.querySelectorAll(".preset-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.getElementById("expense-title").value = chip.dataset.title;
      document.getElementById("expense-amount").value = chip.dataset.amount;

      const catRadio = document.querySelector(`input[name="expense-category"][value="${chip.dataset.cat}"]`);
      if (catRadio) catRadio.checked = true;

      updateLiveSplitHint();
      showToast(`Selected "${chip.dataset.title}"`);
    });
  });

  // Amount input triggers live hint
  document.getElementById("expense-amount").addEventListener("input", updateLiveSplitHint);
}

// ======================== SEARCH & FILTER ========================
function setupSearch() {
  const searchInput = document.getElementById("expense-search-input");
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderExpensesFeed();
  });

  document.querySelectorAll("#category-filter-bar .cat-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#category-filter-bar .cat-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentCategory = pill.dataset.category;
      renderExpensesFeed();
    });
  });
}

// ======================== FORM SUBMISSIONS ========================
function setupFormListeners() {
  // Add Expense Form
  document.getElementById("form-add-expense").addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("expense-title").value.trim();
    const amount = parseFloat(document.getElementById("expense-amount").value);
    const paidBy = document.getElementById("expense-paid-by").value;
    const category = document.querySelector('input[name="expense-category"]:checked')?.value || "Food";

    const splitCheckboxes = document.querySelectorAll('input[name="split-member-check"]:checked');
    const splitBetween = Array.from(splitCheckboxes).map(cb => cb.value);

    if (!title || isNaN(amount) || amount <= 0) {
      showToast("Please enter a valid title and amount", true);
      return;
    }

    if (splitBetween.length === 0) {
      showToast("Select at least 1 person to split with", true);
      return;
    }

    const payload = {
      title,
      amount,
      paidBy,
      splitBetween,
      category,
      splitType: "equal",
      date: new Date().toISOString().split("T")[0]
    };

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Could not save expense");

      document.getElementById("modal-expense").classList.remove("open");
      document.getElementById("form-add-expense").reset();
      renderExpenseModalFields();

      // Confetti burst
      if (typeof confetti === "function") {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.65 },
          colors: ["#6366F1", "#10B981", "#F59E0B"]
        });
      }

      showToast("Expense logged! 🚖");
      fetchTripData();
    } catch (err) {
      showToast("Error: " + err.message, true);
    }
  });

  // Add Member Form
  document.getElementById("form-add-member").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("new-member-name");
    const upiInput = document.getElementById("new-member-upi");
    const name = nameInput.value.trim();
    const upi = upiInput.value.trim();

    if (!name) return;

    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, upi })
      });

      if (!res.ok) throw new Error("Could not add member");

      nameInput.value = "";
      upiInput.value = "";
      showToast(`Added ${name} to squad!`);
      fetchTripData();
    } catch (err) {
      showToast("Error adding member: " + err.message, true);
    }
  });
}

// Delete Expense
async function deleteExpense(id) {
  if (!confirm("Are you sure you want to remove this expense?")) return;

  try {
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed");
    showToast("Expense removed");
    fetchTripData();
  } catch (err) {
    showToast("Error deleting", true);
  }
}

// Delete Member
async function deleteMember(id, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  if (!confirm("Are you sure you want to remove this member?")) return;

  try {
    const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Cannot delete member", true);
      return;
    }
    showToast("Member removed");

    // Immediate local update so squad modal stays open and responsive
    appState.members = appState.members.filter(m => m.id !== id);
    renderSquadManageList();
    renderExpenseModalFields();
    renderLeaderboard();
    renderSettlements();
    fetchTripData(true);
  } catch (err) {
    showToast("Error removing member: " + err.message, true);
  }
}

// ======================== WHATSAPP SUMMARY GENERATOR ========================
function setupWhatsApp() {
  document.getElementById("btn-copy-whatsapp").addEventListener("click", () => {
    const { tripName, currency, expenses, analytics } = appState;
    const { totalSpent, settlements, memberStats } = analytics;

    if (expenses.length === 0) {
      showToast("No expenses to summarize yet!", true);
      return;
    }

    let msg = `🚖 *${tripName.toUpperCase()}* 🌙\n`;
    msg += `📍 *Trip Expense Settlements*\n`;
    msg += `💰 *Total Spent:* ${currency}${totalSpent.toLocaleString("en-IN")} across ${expenses.length} bills\n\n`;

    if (settlements.length > 0) {
      msg += `🤝 *DIRECT UPI TRANSFERS:*\n`;
      settlements.forEach(s => {
        msg += `• *${s.fromName}* pays *${s.toName}*: ${currency}${s.amount.toLocaleString("en-IN")}${s.toUpi ? ` (UPI: ${s.toUpi})` : ''}\n`;
      });
      msg += `\n`;
    } else {
      msg += `🎉 *All settled up! Zero pending payments.*\n\n`;
    }

    msg += `📊 *SQUAD SPEND STATS:*\n`;
    memberStats.forEach(m => {
      const net = m.balance > 0 ? `+${currency}${m.balance} (Gets back)` : m.balance < 0 ? `-${currency}${Math.abs(m.balance)} (Owes)` : `Settled`;
      msg += `• *${m.name}*: Paid ${currency}${m.paid} | Fair Share ${currency}${m.owed} ➔ *${net}*\n`;
    });

    msg += `\n✨ _Calculated fairly via Kolkata Night Riders Splitter_`;

    navigator.clipboard.writeText(msg).then(() => {
      showToast("Summary copied! Paste in WhatsApp 📋");
    }).catch(() => {
      prompt("Copy your summary below:", msg);
    });
  });
}

// ======================== TABS & MODALS EVENTS ========================
function setupTabs() {
  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const paneId = "pane-" + btn.dataset.tab;
      document.getElementById(paneId)?.classList.add("active");
    });
  });
}

function setupModals() {
  const expenseModal = document.getElementById("modal-expense");
  const membersModal = document.getElementById("modal-members");

  document.getElementById("btn-open-add-expense").addEventListener("click", () => {
    expenseModal.classList.add("open");
    document.getElementById("expense-title").focus();
  });

  document.getElementById("btn-close-expense-modal").addEventListener("click", () => {
    expenseModal.classList.remove("open");
  });

  document.getElementById("btn-cancel-expense").addEventListener("click", () => {
    expenseModal.classList.remove("open");
  });

  document.getElementById("btn-open-manage-members").addEventListener("click", () => {
    membersModal.classList.add("open");
    document.getElementById("new-member-name").focus();
  });

  document.getElementById("btn-close-members-modal").addEventListener("click", () => {
    membersModal.classList.remove("open");
  });

  const upiModal = document.getElementById("modal-upi-qr");
  document.getElementById("btn-close-upi-modal").addEventListener("click", () => {
    upiModal.classList.remove("open");
  });

  document.getElementById("btn-modal-mark-settled").addEventListener("click", () => {
    markActivePaymentSettled();
  });

  [expenseModal, membersModal, upiModal].forEach(m => {
    if (m) {
      m.addEventListener("click", (e) => {
        if (e.target === m) m.classList.remove("open");
      });
    }
  });

  document.querySelectorAll(".modal-window").forEach(win => {
    win.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });

  // Select all / None split checkboxes
  document.getElementById("btn-split-all").addEventListener("click", () => {
    document.querySelectorAll('input[name="split-member-check"]').forEach(cb => {
      cb.checked = true;
      handleSplitCheckboxChange(cb);
    });
  });

  document.getElementById("btn-split-none").addEventListener("click", () => {
    document.querySelectorAll('input[name="split-member-check"]').forEach(cb => {
      cb.checked = false;
      handleSplitCheckboxChange(cb);
    });
  });
}

// Toast Display
function showToast(msg, isError = false) {
  const toast = document.getElementById("app-toast");
  toast.textContent = msg;
  toast.style.borderColor = isError ? "var(--accent-coral)" : "var(--accent-primary)";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// Utility: Escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
