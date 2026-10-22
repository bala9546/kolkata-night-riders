// Kolkata Night Riders • Trip Splitter Frontend Engine

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

let currentCategoryFilter = "ALL";
let isPolling = true;

const CATEGORY_ICONS = {
  Food: "🍲",
  Travel: "🚕",
  Stay: "🏨",
  Chai: "☕",
  Sightseeing: "🏛️",
  General: "🎟️"
};

// ======================== INITIALIZATION ========================
document.addEventListener("DOMContentLoaded", () => {
  fetchTripData();
  setupTabEvents();
  setupModalEvents();
  setupFormEvents();
  setupWhatsAppCopy();

  // Live background polling (every 4 seconds for real-time multiplayer)
  setInterval(() => {
    if (isPolling) fetchTripData(true);
  }, 4000);
});

// ======================== DATA FETCHING ========================
async function fetchTripData(silent = false) {
  try {
    const res = await fetch("/api/data");
    if (!res.ok) throw new Error("Failed to load trip data");
    const data = await res.json();
    appState = data;
    renderApp();
  } catch (err) {
    if (!silent) showToast("Network error: Could not reach server", true);
  }
}

// ======================== RENDER FUNCTIONS ========================
function renderApp() {
  const { currency, members, expenses, analytics } = appState;

  // Header / Hero Stats
  document.getElementById("stat-total-spent").textContent = `${currency}${analytics.totalSpent.toLocaleString("en-IN")}`;
  document.getElementById("stat-expense-count").textContent = `${expenses.length} bills logged`;
  document.getElementById("stat-member-count").textContent = members.length;
  document.getElementById("stat-settlement-count").textContent = analytics.settlements.length;
  document.getElementById("tab-expense-badge").textContent = expenses.length;

  // Render Tabs
  renderSettlements();
  renderExpenses();
  renderBalances();
  renderExpenseModalInputs();
  renderMembersModalList();
}

// Render Tab 1: Who Owes Who
function renderSettlements() {
  const container = document.getElementById("settlements-container");
  const { settlements, totalSpent } = appState.analytics;
  const { currency, members } = appState;

  if (members.length < 2) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <h4 class="empty-title">Add More Squad Members</h4>
        <p class="empty-desc">Click "Manage Members" to add your 6 travel buddies.</p>
      </div>
    `;
    return;
  }

  if (totalSpent === 0 || settlements.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎉</div>
        <h4 class="empty-title">All Settled Up!</h4>
        <p class="empty-desc">No debts are currently pending. Add a bill to start tracking splits.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = settlements.map(item => {
    const fromMember = appState.members.find(m => m.id === item.fromId) || { name: item.fromName, color: "#E34222" };
    const toMember = appState.members.find(m => m.id === item.toId) || { name: item.toName, color: "#046A38" };

    return `
      <div class="settlement-card">
        <div class="debt-flow">
          <div class="person-badge">
            <div class="avatar-circle" style="background-color: ${fromMember.color || '#E34222'}">
              ${escapeHtml(fromMember.name.charAt(0).toUpperCase())}
            </div>
            <div>
              <div class="person-name">${escapeHtml(fromMember.name)}</div>
              <div class="person-role">PAYS</div>
            </div>
          </div>

          <div class="flow-arrow-wrap">
            <div class="flow-arrow">➔</div>
            <div class="flow-label">TRANSFERS</div>
          </div>

          <div class="person-badge">
            <div class="avatar-circle" style="background-color: ${toMember.color || '#046A38'}">
              ${escapeHtml(toMember.name.charAt(0).toUpperCase())}
            </div>
            <div>
              <div class="person-name">${escapeHtml(toMember.name)}</div>
              <div class="person-role">RECEIVES</div>
            </div>
          </div>
        </div>

        <div class="settlement-amount-box">
          <div class="amount-val">${currency}${item.amount.toLocaleString("en-IN")}</div>
          <div class="amount-sub">Direct UPI / Cash</div>
        </div>
      </div>
    `;
  }).join("");
}

// Render Tab 2: Expenses List
function renderExpenses() {
  const container = document.getElementById("expenses-container");
  const { expenses, currency, members } = appState;

  let filtered = expenses;
  if (currentCategoryFilter !== "ALL") {
    filtered = expenses.filter(e => e.category === currentCategoryFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🧾</div>
        <h4 class="empty-title">No expenses found</h4>
        <p class="empty-desc">${currentCategoryFilter === "ALL" ? "Tap 'Add New Expense' above to add your first Kolkata bill!" : "No expenses in this category."}</p>
      </div>
    `;
    return;
  }

  const memberMap = new Map(members.map(m => [m.id, m]));

  container.innerHTML = filtered.map(exp => {
    const payer = memberMap.get(exp.paidBy) || { name: "Unknown", color: "#046A38" };
    const icon = CATEGORY_ICONS[exp.category] || "🎟️";
    const splitCount = exp.splitBetween ? exp.splitBetween.length : members.length;
    const splitNames = (exp.splitBetween || [])
      .map(id => memberMap.get(id)?.name || "Member")
      .slice(0, 3)
      .join(", ") + (splitCount > 3 ? ` +${splitCount - 3} more` : "");

    return `
      <div class="expense-card" data-id="${exp.id}">
        <div class="expense-main">
          <div class="expense-cat-icon">${icon}</div>
          <div class="expense-details">
            <div class="expense-title">${escapeHtml(exp.title)}</div>
            <div class="expense-meta">
              <span>Paid by <strong class="payer-highlight">${escapeHtml(payer.name)}</strong></span>
              <span>•</span>
              <span>For: ${escapeHtml(splitNames)}</span>
              <span>•</span>
              <span>${exp.date || "Trip"}</span>
            </div>
          </div>
        </div>

        <div class="expense-right">
          <div class="expense-amount-wrap">
            <div class="expense-amount">${currency}${Number(exp.amount).toLocaleString("en-IN")}</div>
            <div class="expense-split-tag">Split by ${splitCount}</div>
          </div>
          <button class="btn-icon-delete" onclick="deleteExpense('${exp.id}')" title="Delete expense">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// Render Tab 3: Balances
function renderBalances() {
  const container = document.getElementById("balances-container");
  const { memberStats } = appState.analytics;
  const { currency } = appState;

  if (memberStats.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No members yet.</p></div>`;
    return;
  }

  // Sort descending by who paid the most
  const sorted = [...memberStats].sort((a, b) => b.balance - a.balance);

  container.innerHTML = sorted.map(m => {
    let badgeClass = "settled";
    let badgeText = "All Settled";
    if (m.balance > 0.01) {
      badgeClass = "positive";
      badgeText = `Gets back ${currency}${m.balance.toLocaleString("en-IN")}`;
    } else if (m.balance < -0.01) {
      badgeClass = "negative";
      badgeText = `Owes ${currency}${Math.abs(m.balance).toLocaleString("en-IN")}`;
    }

    return `
      <div class="balance-card">
        <div class="balance-card-header">
          <div class="avatar-circle" style="background-color: ${m.color || '#046A38'}">
            ${escapeHtml(m.name.charAt(0).toUpperCase())}
          </div>
          <div>
            <div class="member-name">${escapeHtml(m.name)}</div>
          </div>
        </div>

        <div class="balance-stats-row">
          <div class="balance-stat-item">
            <span class="stat-lbl">Paid for group</span>
            <span class="stat-num">${currency}${m.paid.toLocaleString("en-IN")}</span>
          </div>
          <div class="balance-stat-item">
            <span class="stat-lbl">Fair share</span>
            <span class="stat-num">${currency}${m.owed.toLocaleString("en-IN")}</span>
          </div>
        </div>

        <div class="net-badge ${badgeClass}">
          <span>Balance</span>
          <span>${badgeText}</span>
        </div>
      </div>
    `;
  }).join("");
}

// Render Form Inputs inside Modal
function renderExpenseModalInputs() {
  const payerSelect = document.getElementById("expense-paid-by");
  const splitContainer = document.getElementById("split-members-checklist");
  const { members } = appState;

  const currentPayer = payerSelect.value;
  payerSelect.innerHTML = members.map(m => `
    <option value="${m.id}" ${m.id === currentPayer ? 'selected' : ''}>
      ${escapeHtml(m.name)}
    </option>
  `).join("");

  splitContainer.innerHTML = members.map(m => `
    <label class="split-checkbox-item checked" data-id="${m.id}">
      <input type="checkbox" name="split-member" value="${m.id}" checked onchange="toggleCheckboxStyle(this)">
      <span>${escapeHtml(m.name)}</span>
    </label>
  `).join("");
}

function toggleCheckboxStyle(input) {
  const label = input.closest(".split-checkbox-item");
  if (input.checked) {
    label.classList.add("checked");
  } else {
    label.classList.remove("checked");
  }
}

// Render Manage Members List
function renderMembersModalList() {
  const container = document.getElementById("members-manage-container");
  const { members, expenses } = appState;

  container.innerHTML = members.map(m => {
    const hasExpenses = expenses.some(e => e.paidBy === m.id || (e.splitBetween && e.splitBetween.includes(m.id)));
    return `
      <div class="member-row">
        <div class="member-row-left">
          <div class="member-initials" style="background-color: ${m.color || '#046A38'}">
            ${escapeHtml(m.name.charAt(0).toUpperCase())}
          </div>
          <strong>${escapeHtml(m.name)}</strong>
        </div>
        ${hasExpenses ? `
          <span style="font-size: 11px; color: var(--color-text-muted);">Active in bills</span>
        ` : `
          <button class="btn-icon-delete" onclick="deleteMember('${m.id}')" title="Remove member">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        `}
      </div>
    `;
  }).join("");
}

// ======================== ACTIONS & API CALLS ========================

// Add Expense
async function handleExpenseSubmit(e) {
  e.preventDefault();

  const title = document.getElementById("expense-title").value.trim();
  const amount = parseFloat(document.getElementById("expense-amount").value);
  const paidBy = document.getElementById("expense-paid-by").value;
  const category = document.querySelector('input[name="expense-category"]:checked')?.value || "Food";

  const splitCheckboxes = document.querySelectorAll('input[name="split-member"]:checked');
  const splitBetween = Array.from(splitCheckboxes).map(cb => cb.value);

  if (!title || isNaN(amount) || amount <= 0) {
    showToast("Please enter a valid expense title and amount", true);
    return;
  }

  if (splitBetween.length === 0) {
    showToast("Please select at least 1 person to split with", true);
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

    if (!res.ok) throw new Error("Failed to save expense");

    // Close modal & reset form
    document.getElementById("modal-expense").classList.remove("open");
    document.getElementById("form-add-expense").reset();
    renderExpenseModalInputs();

    // Trigger celebration confetti!
    if (typeof confetti === "function") {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#046A38", "#E34222", "#F9EBD7"]
      });
    }

    showToast("Expense added successfully! 🚖");
    fetchTripData();
  } catch (err) {
    showToast("Error adding expense: " + err.message, true);
  }
}

// Delete Expense
async function deleteExpense(id) {
  if (!confirm("Are you sure you want to delete this expense?")) return;

  try {
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete");
    showToast("Expense deleted");
    fetchTripData();
  } catch (err) {
    showToast("Error deleting expense", true);
  }
}

// Add Member
async function handleMemberSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("new-member-name");
  const name = input.value.trim();
  if (!name) return;

  try {
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });

    if (!res.ok) throw new Error("Failed to add member");

    input.value = "";
    showToast(`Added ${name} to squad!`);
    fetchTripData();
  } catch (err) {
    showToast("Error adding member: " + err.message, true);
  }
}

// Delete Member
async function deleteMember(id) {
  try {
    const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Cannot delete member", true);
      return;
    }
    showToast("Member removed");
    fetchTripData();
  } catch (err) {
    showToast("Error removing member", true);
  }
}

// ======================== WHATSAPP SUMMARY GENERATOR ========================
function setupWhatsAppCopy() {
  document.getElementById("btn-copy-whatsapp").addEventListener("click", () => {
    const { tripName, currency, expenses, analytics } = appState;
    const { totalSpent, settlements, memberStats } = analytics;

    if (expenses.length === 0) {
      showToast("No expenses to summarize yet!", true);
      return;
    }

    let msg = `🚖 *${tripName.toUpperCase()}* 🌙\n`;
    msg += `📍 *Trip Expense Settlement Summary*\n`;
    msg += `💰 *Total Spent:* ${currency}${totalSpent.toLocaleString("en-IN")} (${expenses.length} bills)\n\n`;

    if (settlements.length > 0) {
      msg += `🤝 *DIRECT TRANSFERS (Minimum Payments):*\n`;
      settlements.forEach(s => {
        msg += `• *${s.fromName}* pays *${s.toName}*: ${currency}${s.amount.toLocaleString("en-IN")}\n`;
      });
      msg += `\n`;
    } else {
      msg += `🎉 *All settled up! Zero pending transfers.*\n\n`;
    }

    msg += `📊 *INDIVIDUAL BREAKDOWN:*\n`;
    memberStats.forEach(m => {
      const net = m.balance > 0 ? `+${currency}${m.balance}` : m.balance < 0 ? `-${currency}${Math.abs(m.balance)}` : `Settled`;
      msg += `• *${m.name}*: Paid ${currency}${m.paid} | Share ${currency}${m.owed} (${net})\n`;
    });

    msg += `\n✨ _Calculated fairly via Kolkata Night Riders Trip Splitter_`;

    navigator.clipboard.writeText(msg).then(() => {
      showToast("Summary copied! Paste it in WhatsApp 📋");
    }).catch(() => {
      // Fallback
      prompt("Copy your WhatsApp summary below:", msg);
    });
  });
}

// ======================== UI EVENTS ========================
function setupTabEvents() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const tabId = "tab-" + btn.dataset.tab;
      document.getElementById(tabId)?.classList.add("active");
    });
  });

  // Category Filter Pills
  document.querySelectorAll("#category-filter-bar .pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#category-filter-bar .pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentCategoryFilter = pill.dataset.category;
      renderExpenses();
    });
  });
}

function setupModalEvents() {
  const expenseModal = document.getElementById("modal-expense");
  const memberModal = document.getElementById("modal-members");

  document.getElementById("btn-open-expense-modal").addEventListener("click", () => {
    expenseModal.classList.add("open");
    document.getElementById("expense-title").focus();
  });

  document.getElementById("btn-close-expense-modal").addEventListener("click", () => {
    expenseModal.classList.remove("open");
  });

  document.getElementById("btn-cancel-expense").addEventListener("click", () => {
    expenseModal.classList.remove("open");
  });

  document.getElementById("btn-open-member-modal").addEventListener("click", () => {
    memberModal.classList.add("open");
    document.getElementById("new-member-name").focus();
  });

  document.getElementById("btn-close-member-modal").addEventListener("click", () => {
    memberModal.classList.remove("open");
  });

  document.getElementById("btn-close-member-modal-footer").addEventListener("click", () => {
    memberModal.classList.remove("open");
  });

  // Close modals on backdrop click
  [expenseModal, memberModal].forEach(m => {
    m.addEventListener("click", (e) => {
      if (e.target === m) m.classList.remove("open");
    });
  });

  // Select All / Clear All Split checkboxes
  document.getElementById("btn-split-select-all").addEventListener("click", () => {
    document.querySelectorAll('input[name="split-member"]').forEach(cb => {
      cb.checked = true;
      toggleCheckboxStyle(cb);
    });
  });

  document.getElementById("btn-split-clear-all").addEventListener("click", () => {
    document.querySelectorAll('input[name="split-member"]').forEach(cb => {
      cb.checked = false;
      toggleCheckboxStyle(cb);
    });
  });
}

function setupFormEvents() {
  document.getElementById("form-add-expense").addEventListener("submit", handleExpenseSubmit);
  document.getElementById("form-add-member").addEventListener("submit", handleMemberSubmit);
}

// Toast Helper
function showToast(msg, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.style.borderColor = isError ? "#E34222" : "#046A38";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
}

// Escape HTML utility
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
