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

  // Real-time synchronization polling (every 4 seconds)
  setInterval(() => {
    if (isPolling) fetchTripData(true);
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
  const { currency, members, expenses, analytics } = appState;
  const totalSpent = analytics.totalSpent || 0;
  const memberCount = members.length;
  const avg = memberCount > 0 ? Math.round(totalSpent / memberCount) : 0;

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
    const upiId = s.toUpi || toMember.upi;

    // UPI Deep Link for Google Pay / PhonePe / Paytm on mobile
    const upiLink = upiId
      ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(toMember.name)}&am=${encodeURIComponent(s.amount)}&cu=INR&tn=Kolkata%20Trip%20Split`
      : null;

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

          ${upiLink ? `
            <a href="${upiLink}" class="btn-upi-pay" title="Open GPay / PhonePe / Paytm">
              <span>⚡</span> Pay via UPI
            </a>
          ` : `
            <button class="btn-action-ghost btn-sm" onclick="copySettlementDetail('${escapeHtml(fromMember.name)}', '${escapeHtml(toMember.name)}', ${s.amount})">
              Copy Info
            </button>
          `}
        </div>
      </div>
    `;
  }).join("");
}

function copySettlementDetail(from, to, amt) {
  const text = `${from} pays ${to}: ₹${amt}`;
  navigator.clipboard.writeText(text);
  showToast(`Copied: "${text}"`);
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

// ======================== SQUAD MANAGEMENT ========================
function renderSquadManageList() {
  const container = document.getElementById("squad-list-container");
  const { members, expenses } = appState;

  container.innerHTML = members.map(m => {
    const isActive = expenses.some(e => e.paidBy === m.id || (e.splitBetween && e.splitBetween.includes(m.id)));
    return `
      <div class="squad-row-card">
        <div class="squad-row-left">
          <div class="avatar-badge" style="width:34px; height:34px; font-size:13px; background-color: ${m.color || '#6366F1'}">
            ${escapeHtml(m.name.charAt(0).toUpperCase())}
          </div>
          <div>
            <div style="font-weight:700; font-size:14px;">${escapeHtml(m.name)}</div>
            ${m.upi ? `<div style="font-size:11px; color:var(--text-muted);">${escapeHtml(m.upi)}</div>` : ''}
          </div>
        </div>

        ${isActive ? `
          <span style="font-size:11px; color:var(--text-muted); font-weight:600;">Active in bills</span>
        ` : `
          <button class="btn-trash-icon" onclick="deleteMember('${m.id}')" title="Remove member">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        `}
      </div>
    `;
  }).join("");
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
async function deleteMember(id) {
  try {
    const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Cannot delete", true);
      return;
    }
    showToast("Member removed");
    fetchTripData();
  } catch (err) {
    showToast("Error removing member", true);
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

  document.getElementById("btn-close-members-footer").addEventListener("click", () => {
    membersModal.classList.remove("open");
  });

  [expenseModal, membersModal].forEach(m => {
    m.addEventListener("click", (e) => {
      if (e.target === m) m.classList.remove("open");
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
