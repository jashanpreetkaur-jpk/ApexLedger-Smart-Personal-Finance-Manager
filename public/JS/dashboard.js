function generateUID() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatCurrency(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
}

function formatDate(d) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function getMonthKey(d) {
    return d.slice(0, 7);
}

function getThisMonthKey() {
    return new Date().toISOString().slice(0, 7);
}

function getLastNMonthKeys(n) {
    var out = [];
    var now = new Date();
    for (var i = n - 1; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        out.push(d.toISOString().slice(0, 7));
    }
    return out;
}

function getMonthLabel(mk) {
    var parts = mk.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1)
        .toLocaleDateString('en-US', { month: 'short' });
}

function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function debounce(fn, wait) {
    var timer;
    return function() {
        var context = this;
        var args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function() {
            fn.apply(context, args);
        }, wait);
    };
}

function showToast(msg, kind) {
    kind = kind || 'success';
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' error' : '');
    el.innerHTML = '<span class="tdot"></span><span>' + escapeHtml(msg) + '</span>';
    document.getElementById('toastContainer').appendChild(el);
    
    setTimeout(function() {
        el.style.transition = 'opacity .3s ease, transform .3s ease';
        el.style.opacity = '0';
        el.style.transform = 'translateX(24px)';
        setTimeout(function() {
            el.remove();
        }, 300);
    }, 2600);
}

function emptyState(title, sub) {
    return '<div class="empty-state">' +
        '<div class="et">' + escapeHtml(title) + '</div>' +
        '<div class="es">' + escapeHtml(sub) + '</div>' +
        '</div>';
}

function sumByType(transactions, type) {
    return transactions
        .filter(function(t) { return t.type === type; })
        .reduce(function(sum, t) { return sum + Number(t.amount); }, 0);
}

function filterByMonth(transactions, monthKey) {
    return transactions.filter(function(t) {
        return getMonthKey(t.date) === monthKey;
    });
}

var currentUser = null;

function getStorageKey() {
    return 'ApexLedger_data_' + (currentUser ? currentUser.id : 'guest');
}

var EXPENSE_CATEGORIES = [
    { id: 'housing', label: 'Housing', color: '#d8bd8a' },
    { id: 'food', label: 'Food & Dining', color: '#d99b91' },
    { id: 'transport', label: 'Transport', color: '#9fb8d9' },
    { id: 'shopping', label: 'Shopping', color: '#c7c0e0' },
    { id: 'utilities', label: 'Utilities', color: '#b7d6bd' },
    { id: 'health', label: 'Health', color: '#8fd6c0' },
    { id: 'entertainment', label: 'Entertainment', color: '#b79bd9' },
    { id: 'travel', label: 'Travel', color: '#d8bd8a' },
    { id: 'education', label: 'Education', color: '#9fb8d9' },
    { id: 'other_expense', label: 'Other', color: '#9aa39f' }
];

var INCOME_CATEGORIES = [
    { id: 'salary', label: 'Salary', color: '#8fd6c0' },
    { id: 'freelance', label: 'Freelance', color: '#d8bd8a' },
    { id: 'investment', label: 'Investment', color: '#b7d6bd' },
    { id: 'gift', label: 'Gift', color: '#c7c0e0' },
    { id: 'business', label: 'Business', color: '#9fb8d9' },
    { id: 'other_income', label: 'Other', color: '#9aa39f' }
];

var ALL_CATEGORIES = EXPENSE_CATEGORIES.concat(INCOME_CATEGORIES);

function getCategoryInfo(id) {
    var found = null;
    ALL_CATEGORIES.forEach(function(c) {
        if (c.id === id) found = c;
    });
    return found || { label: id, color: '#9aa39f' };
}

var appState = {
    transactions: [],
    budgets: [],
    goals: []
};
var txnCurrentPage = 1;
var txnPageSize = 8;
var usdInrRate = null;

function saveData() {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            try {
                window.localStorage.setItem(getStorageKey(), JSON.stringify(appState));
                resolve(true);
            } catch (err) {
                reject(err);
            }
        }, 120);
    });
}

async function persistData() {
    try {
        await saveData();
    } catch (e) {
        showToast('Could not save — storage may be full', 'error');
    }
}

function loadData() {
    try {
        var raw = window.localStorage.getItem(getStorageKey());
        if (raw) {
            var parsed = JSON.parse(raw);
            appState.transactions = parsed.transactions || [];
            appState.budgets = parsed.budgets || [];
            appState.goals = parsed.goals || [];
            return true;
        }
    } catch (e) {}
    return false;
}

function seedDemoData() {
    var today = new Date();
    
    function getDate(offset) {
        var dt = new Date(today);
        dt.setDate(dt.getDate() - offset);
        return dt.toISOString().slice(0, 10);
    }

    appState.transactions = [
        { id: generateUID(), type: 'income', category: 'salary', amount: 6200, date: getDate(2), account: 'Bank', note: 'Monthly salary' },
        { id: generateUID(), type: 'expense', category: 'housing', amount: 1800, date: getDate(3), account: 'Bank', note: 'Rent' },
        { id: generateUID(), type: 'expense', category: 'food', amount: 210, date: getDate(4), account: 'Card', note: 'Groceries' },
        { id: generateUID(), type: 'expense', category: 'transport', amount: 96, date: getDate(5), account: 'Card', note: 'Fuel' },
        { id: generateUID(), type: 'expense', category: 'entertainment', amount: 64, date: getDate(6), account: 'Card', note: 'Streaming + movie' },
        { id: generateUID(), type: 'income', category: 'freelance', amount: 900, date: getDate(8), account: 'Bank', note: 'Design project' },
        { id: generateUID(), type: 'expense', category: 'utilities', amount: 180, date: getDate(9), account: 'Bank', note: 'Electricity + internet' },
        { id: generateUID(), type: 'expense', category: 'shopping', amount: 240, date: getDate(11), account: 'Card', note: 'New shoes' },
        { id: generateUID(), type: 'expense', category: 'health', amount: 55, date: getDate(13), account: 'Cash', note: 'Pharmacy' },
        { id: generateUID(), type: 'expense', category: 'food', amount: 88, date: getDate(15), account: 'Card', note: 'Dining out' },
        { id: generateUID(), type: 'income', category: 'investment', amount: 150, date: getDate(18), account: 'Bank', note: 'Dividend payout' },
        { id: generateUID(), type: 'expense', category: 'travel', amount: 410, date: getDate(20), account: 'Card', note: 'Weekend trip' },
        { id: generateUID(), type: 'expense', category: 'transport', amount: 52, date: getDate(22), account: 'Cash', note: 'Rideshare' },
        { id: generateUID(), type: 'expense', category: 'education', amount: 120, date: getDate(25), account: 'Bank', note: 'Online course' },
        { id: generateUID(), type: 'expense', category: 'food', amount: 95, date: getDate(33), account: 'Card', note: 'Groceries' },
        { id: generateUID(), type: 'income', category: 'salary', amount: 6200, date: getDate(33), account: 'Bank', note: 'Monthly salary' },
        { id: generateUID(), type: 'expense', category: 'housing', amount: 1800, date: getDate(34), account: 'Bank', note: 'Rent' },
        { id: generateUID(), type: 'expense', category: 'utilities', amount: 172, date: getDate(40), account: 'Bank', note: 'Electricity + internet' },
        { id: generateUID(), type: 'expense', category: 'shopping', amount: 190, date: getDate(45), account: 'Card', note: 'Clothing' },
        { id: generateUID(), type: 'income', category: 'freelance', amount: 650, date: getDate(50), account: 'Bank', note: 'Logo design' },
        { id: generateUID(), type: 'expense', category: 'entertainment', amount: 48, date: getDate(55), account: 'Card', note: 'Concert' },
        { id: generateUID(), type: 'expense', category: 'food', amount: 102, date: getDate(60), account: 'Card', note: 'Groceries' },
        { id: generateUID(), type: 'income', category: 'salary', amount: 6050, date: getDate(63), account: 'Bank', note: 'Monthly salary' }
    ];

    appState.budgets = [
        { id: generateUID(), category: 'food', limit: 450 },
        { id: generateUID(), category: 'shopping', limit: 350 },
        { id: generateUID(), category: 'entertainment', limit: 150 },
        { id: generateUID(), category: 'transport', limit: 200 },
        { id: generateUID(), category: 'utilities', limit: 220 }
    ];

    appState.goals = [
        { id: generateUID(), name: 'Emergency fund', target: 12000, current: 5200, deadline: '2026-12-31' },
        { id: generateUID(), name: 'New laptop', target: 2200, current: 800, deadline: '2026-11-01' },
        { id: generateUID(), name: 'Trip to Lisbon', target: 3000, current: 1650, deadline: '2026-10-15' }
    ];
}

var currentRoute = 'overview';
var ROUTES = ['overview', 'transactions', 'budgets', 'goals', 'insights'];

function getCurrentHashRoute() {
    var h = window.location.hash.replace('#', '');
    return ROUTES.indexOf(h) !== -1 ? h : 'overview';
}

function goTo(route) {
    window.location.hash = route;
}

function renderRoute(route) {
    currentRoute = route;
    
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) {
        views[i].classList.remove('active');
    }
    
    var target = document.getElementById('view' + route.charAt(0).toUpperCase() + route.slice(1));
    if (target) target.classList.add('active');
    
    var navBtns = document.querySelectorAll('#navlinks button');
    for (var j = 0; j < navBtns.length; j++) {
        navBtns[j].classList.toggle('active', navBtns[j].dataset.route === route);
    }
    
    if (route === 'overview') renderOverview();
    else if (route === 'transactions') renderTransactions();
    else if (route === 'budgets') renderBudgets();
    else if (route === 'goals') renderGoals();
    else if (route === 'insights') renderInsights();

    renderDashboardAlerts();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAll() {
    renderRoute(currentRoute);
}

function getAlertDateParts(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    var parts = value.split('-').map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) return null;
    return parts;
}

function daysUntilAlertDate(value) {
    var target = getAlertDateParts(value);
    if (!target) return null;
    var now = new Date();
    var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    var targetUTC = Date.UTC(target[0], target[1] - 1, target[2]);
    return Math.round((targetUTC - today) / 86400000);
}

function getDashboardAlertItems() {
    var alerts = [];
    var monthKey = getThisMonthKey();
    var budgets = Array.isArray(appState.budgets) ? appState.budgets : [];
    var transactions = Array.isArray(appState.transactions) ? appState.transactions : [];
    var goals = Array.isArray(appState.goals) ? appState.goals : [];

    budgets.forEach(function(budget) {
        if (!budget || typeof budget !== 'object') return;
        var limit = Number(budget.limit);
        if (!Number.isFinite(limit) || limit <= 0) return;
        var spent = transactions.reduce(function(total, transaction) {
            if (!transaction || transaction.type !== 'expense' || transaction.category !== budget.category || typeof transaction.date !== 'string' || transaction.date.slice(0, 7) !== monthKey) return total;
            var amount = Number(transaction.amount);
            return total + (Number.isFinite(amount) && amount > 0 ? amount : 0);
        }, 0);
        var percent = spent / limit * 100;
        if (percent >= 100) {
            alerts.push({ id: 'budget:' + monthKey + ':' + budget.id + ':limit', tone: 'critical', message: getCategoryInfo(budget.category).label + ' spending reached ' + Math.round(percent) + '% of its budget.' });
        } else if (percent >= 80) {
            alerts.push({ id: 'budget:' + monthKey + ':' + budget.id + ':warning', tone: 'warn', message: getCategoryInfo(budget.category).label + ' spending reached ' + Math.round(percent) + '% of its budget.' });
        }
    });

    try {
        var storedBills = JSON.parse(localStorage.getItem('apexledger_bills_' + currentUser.id) || '[]');
        if (Array.isArray(storedBills)) storedBills.forEach(function(bill) {
            var days = bill && daysUntilAlertDate(bill.dueDate);
            if (bill && !bill.paid && days !== null && days >= 0 && days <= 3) {
                alerts.push({ id: 'bill:' + bill.id + ':' + bill.dueDate, tone: 'warn', message: (bill.name || 'An unpaid bill') + ' is due ' + (days === 0 ? 'today.' : 'in ' + days + ' day' + (days === 1 ? '.' : 's.')) });
            }
        });
    } catch (error) {}

    goals.forEach(function(goal) {
        if (!goal || typeof goal.name !== 'string') return;
        var target = Number(goal.target);
        var current = Number(goal.current);
        var days = daysUntilAlertDate(goal.deadline);
        if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current >= target || days === null || days < 0 || days > 7) return;
        alerts.push({ id: 'goal:' + goal.id + ':' + goal.deadline, tone: 'good', message: goal.name + ' target date is ' + (days === 0 ? 'today.' : 'in ' + days + ' day' + (days === 1 ? '.' : 's.')) });
    });

    return alerts;
}

function renderDashboardAlerts() {
    var list = document.getElementById('dashboardAlertsList');
    if (!list || !currentUser) return;
    var alerts = getDashboardAlertItems();
    if (!alerts.length) {
        list.innerHTML = '<div class="dashboard-alert-empty">You are all caught up. No budget, bill, or goal reminders right now.</div>';
        return;
    }
    list.innerHTML = alerts.map(function(alert) {
        return '<div class="dashboard-alert ' + alert.tone + '">' + escapeHtml(alert.message) + '</div>';
    }).join('');

    var storageKey = 'ApexLedger_alerts_shown_' + currentUser.id;
    var shown = [];
    try {
        var saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (Array.isArray(saved)) shown = saved.filter(function(id) { return typeof id === 'string'; });
    } catch (error) {}
    if (window.apexLedgerAlertUserId !== currentUser.id) {
        window.apexLedgerAlertUserId = currentUser.id;
        window.apexLedgerShownAlerts = [];
    }
    if (!Array.isArray(window.apexLedgerShownAlerts)) window.apexLedgerShownAlerts = [];
    var known = shown.concat(window.apexLedgerShownAlerts);
    var fresh = alerts.filter(function(alert) { return known.indexOf(alert.id) === -1; });
    fresh.forEach(function(alert) { shown.push(alert.id); window.apexLedgerShownAlerts.push(alert.id); });
    shown = shown.slice(-120);
    window.apexLedgerShownAlerts = window.apexLedgerShownAlerts.slice(-120);
    try { localStorage.setItem(storageKey, JSON.stringify(shown)); } catch (error) {}
    fresh.slice(0, 3).forEach(function(alert) { showToast(alert.message, alert.tone === 'critical' ? 'error' : 'success'); });
}

function renderOverview() {
    var all = appState.transactions;
    var mk = getThisMonthKey();
    var thisMonth = filterByMonth(all, mk);
    
    var allIncome = sumByType(all, 'income');
    var allExpense = sumByType(all, 'expense');
    var balance = allIncome - allExpense;
    
    var mIncome = sumByType(thisMonth, 'income');
    var mExpense = sumByType(thisMonth, 'expense');
    var net = mIncome - mExpense;
    
    var savingsRate = mIncome > 0 ? Math.max(0, Math.min(100, Math.round((net / mIncome) * 100))) : 0;
    var ringColor = savingsRate >= 40 ? '#b7d6bd' : savingsRate >= 15 ? '#d8bd8a' : '#d99b91';
    
    var heroBalance = document.getElementById('heroBalance');
    heroBalance.textContent = formatCurrency(balance);
    heroBalance.classList.toggle('neg', balance < 0);
    
    document.getElementById('splitIncome').textContent = formatCurrency(mIncome);
    document.getElementById('splitExpense').textContent = formatCurrency(mExpense);
    
    var splitNet = document.getElementById('splitNet');
    splitNet.textContent = formatCurrency(net);
    splitNet.className = 'split-num mono ' + (net >= 0 ? 'up' : 'down');
    
    var ring = document.getElementById('savingsRing');
    ring.style.setProperty('--rp', savingsRate);
    ring.style.setProperty('--rc', ringColor);
    document.getElementById('savingsRingNum').textContent = savingsRate + '%';
    
    document.getElementById('statBudgets').textContent = appState.budgets.length;
    document.getElementById('statAllIncome').textContent = formatCurrency(allIncome);
    document.getElementById('statAllExpense').textContent = formatCurrency(allExpense);
    document.getElementById('statGoals').textContent = appState.goals.length;
    document.getElementById('statCount').textContent = all.length;
    
    renderRecentList();
    renderOverviewBars(thisMonth);
}

function renderRecentList() {
    var list = appState.transactions.slice();
    list.sort(function(a, b) {
        return new Date(b.date) - new Date(a.date);
    });
    list = list.slice(0, 6);
    
    var el = document.getElementById('recentList');
    if (list.length === 0) {
        el.innerHTML = emptyState('No transactions yet', 'Add your first transaction to see it here.');
        return;
    }
    
    var html = '';
    for (var i = 0; i < list.length; i++) {
        var t = list[i];
        var c = getCategoryInfo(t.category);
        html += '<div class="txn-row">' +
            '<span class="cat-dot" style="background:' + c.color + ';"></span>' +
            '<div class="txn-info">' +
                '<div class="txn-cat">' + c.label + '</div>' +
                '<div class="txn-meta">' + (t.note ? escapeHtml(t.note) + ' · ' : '') + formatDate(t.date) + '</div>' +
            '</div>' +
            '<div class="txn-amt ' + t.type + ' mono">' + (t.type === 'income' ? '+' : '−') + formatCurrency(t.amount) +
            '</div>' +
        '</div>';
    }
    el.innerHTML = html;
}

function renderOverviewBars(thisMonthTxns) {
    var expenses = thisMonthTxns.filter(function(t) { return t.type === 'expense'; });
    var byCat = {};
    
    for (var i = 0; i < expenses.length; i++) {
        var t = expenses[i];
        byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
    }
    
    var entries = Object.entries(byCat);
    entries.sort(function(a, b) { return b[1] - a[1]; });
    entries = entries.slice(0, 6);
    
    var barsEl = document.getElementById('overviewBars');
    var labelsEl = document.getElementById('overviewBarsLabels');
    
    if (entries.length === 0) {
        barsEl.innerHTML = '';
        labelsEl.innerHTML = '';
        barsEl.outerHTML = '<div id="overviewBars">' + emptyState('No spending yet', 'Categories will appear here once you log expenses.') + '</div>';
        return;
    }
    
    var maxVal = entries[0][1];
    var barsHtml = '';
    var labelsHtml = '';
    
    for (var j = 0; j < entries.length; j++) {
        var catInfo = getCategoryInfo(entries[j][0]);
        var height = Math.max(6, Math.round((entries[j][1] / maxVal) * 100));
        barsHtml += '<div class="b" style="height:' + height + '%;background:' + catInfo.color + ';"></div>';
        labelsHtml += '<span>' + catInfo.label.split(' ')[0] + '</span>';
    }
    
    barsEl.innerHTML = barsHtml;
    labelsEl.innerHTML = labelsHtml;
}

function renderTransactions() {
    populateFilterCategories();
    renderTxnTable();
}

function populateFilterCategories() {
    var sel = document.getElementById('filterCategory');
    var html = '<option value="all">All categories</option>';
    for (var i = 0; i < ALL_CATEGORIES.length; i++) {
        html += '<option value="' + ALL_CATEGORIES[i].id + '">' + ALL_CATEGORIES[i].label + '</option>';
    }
    sel.innerHTML = html;
}

function renderTxnTable() {
    var searchInput = document.getElementById('searchInput');
    var search = (searchInput ? searchInput.value : '').toLowerCase();
    
    var activeBtn = document.querySelector('#typeFilterSeg button.active');
    var typeF = activeBtn ? activeBtn.dataset.val : 'all';
    
    var catF = document.getElementById('filterCategory').value;
    var dateF = document.getElementById('filterDate').value;
    var sortF = document.getElementById('filterSort').value;
    var dateStart = null;
    if (dateF === 'this-month') {
        var today = new Date();
        dateStart = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-01';
    } else if (dateF === 'last-30') {
        var cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 29);
        dateStart = cutoff.getFullYear() + '-' + String(cutoff.getMonth() + 1).padStart(2, '0') + '-' + String(cutoff.getDate()).padStart(2, '0');
    }
    
    var list = appState.transactions.filter(function(t) {
        if (typeF !== 'all' && t.type !== typeF) return false;
        if (catF !== 'all' && t.category !== catF) return false;
        if (dateStart && t.date < dateStart) return false;
        if (search) {
            var catLabel = getCategoryInfo(t.category).label.toLowerCase();
            var note = (t.note || '').toLowerCase();
            var account = (t.account || '').toLowerCase();
            if (catLabel.indexOf(search) === -1 && 
                note.indexOf(search) === -1 && 
                account.indexOf(search) === -1) {
                return false;
            }
        }
        return true;
    });
    
    var sorters = {
        'date-desc': function(a, b) { return new Date(b.date) - new Date(a.date); },
        'date-asc': function(a, b) { return new Date(a.date) - new Date(b.date); },
        'amount-desc': function(a, b) { return b.amount - a.amount; },
        'amount-asc': function(a, b) { return a.amount - b.amount; }
    };
    list = list.slice();
    list.sort(sorters[sortF] || sorters['date-desc']);

    var resultCount = document.getElementById('txnResultCount');
    resultCount.textContent = list.length + (list.length === 1 ? ' matching transaction' : ' matching transactions');

    var pagination = document.getElementById('txnPagination');
    var pageCount = Math.ceil(list.length / txnPageSize);
    if (txnCurrentPage > Math.max(1, pageCount)) txnCurrentPage = Math.max(1, pageCount);
    var startAt = (txnCurrentPage - 1) * txnPageSize;
    var pageItems = list.slice(startAt, startAt + txnPageSize);
    
    var body = document.getElementById('txnTableBody');
    var emptyEl = document.getElementById('txnEmpty');
    
    if (list.length === 0) {
        body.innerHTML = '';
        emptyEl.innerHTML = emptyState('No transactions found', 'Try adjusting your filters, or add a new one.');
        pagination.innerHTML = '';
        return;
    }
    emptyEl.innerHTML = '';
    
    var html = '';
    for (var i = 0; i < pageItems.length; i++) {
        var t = pageItems[i];
        var c = getCategoryInfo(t.category);
        html += '<tr>' +
            '<td><span class="cat-pill"><span class="cat-dot" style="background:' + c.color + ';"></span>' + c.label + '</span></td>' +
            '<td style="color:#9aa39f;">' + (t.note ? escapeHtml(t.note) : '—') + '</td>' +
            '<td style="color:#9aa39f;">' + formatDate(t.date) + '</td>' +
            '<td style="color:#9aa39f;">' + (t.account ? escapeHtml(t.account) : '—') + '</td>' +
            '<td style="text-align:right;" class="txn-amt ' + t.type + ' mono">' + (t.type === 'income' ? '+' : '−') + formatCurrency(t.amount) + '</td>' +
            '<td><div class="txn-actions" style="justify-content:flex-end;">' +
                '<button class="icon-btn" data-edit="' + t.id + '">✎</button>' +
                '<button class="icon-btn danger" data-del="' + t.id + '">✕</button>' +
            '</div></td>' +
        '</tr>';
    }
    body.innerHTML = html;
    pagination.innerHTML = '<span>Showing ' + (startAt + 1) + '–' + Math.min(startAt + txnPageSize, list.length) + ' of ' + list.length + '</span>' +
        '<div><button type="button" class="btn btn-ghost" id="txnPrev" ' + (txnCurrentPage <= 1 ? 'disabled' : '') + '>Previous</button>' +
        '<span>Page ' + txnCurrentPage + ' of ' + Math.max(1, pageCount) + '</span>' +
        '<button type="button" class="btn btn-ghost" id="txnNext" ' + (txnCurrentPage >= pageCount ? 'disabled' : '') + '>Next</button></div>';
    document.getElementById('txnPrev').onclick = function() { txnCurrentPage--; renderTxnTable(); };
    document.getElementById('txnNext').onclick = function() { txnCurrentPage++; renderTxnTable(); };
    
    var editBtns = body.querySelectorAll('[data-edit]');
    for (var j = 0; j < editBtns.length; j++) {
        editBtns[j].onclick = function() { openTxnModal(this.dataset.edit); };
    }
    
    var delBtns = body.querySelectorAll('[data-del]');
    for (var k = 0; k < delBtns.length; k++) {
        delBtns[k].onclick = function() { deleteTransaction(this.dataset.del); };
    }
}

function renderBudgets() {
    var mk = getThisMonthKey();
    var grid = document.getElementById('budgetGrid');
    
    if (appState.budgets.length === 0) {
        grid.innerHTML = emptyState('No budgets set', 'Create a budget to track spending by category.');
        renderDashboardAlerts();
        return;
    }
    
    var html = '';
    for (var i = 0; i < appState.budgets.length; i++) {
        var b = appState.budgets[i];
        var c = getCategoryInfo(b.category);
        
        var spent = appState.transactions
            .filter(function(t) {
                return t.type === 'expense' && 
                       t.category === b.category && 
                       getMonthKey(t.date) === mk;
            })
            .reduce(function(sum, t) { return sum + Number(t.amount); }, 0);
        
        var pct = Math.min(100, Math.round((spent / b.limit) * 100));
        var segCount = 12;
        var onCount = Math.round((pct / 100) * segCount);
        var meterClass = pct >= 100 ? 'coral' : pct >= 75 ? '' : 'mint';
        
        var segs = '';
        for (var j = 0; j < segCount; j++) {
            segs += '<span class="' + (j < onCount ? 'on' : '') + '"></span>';
        }
        
        html += '<div class="card">' +
            '<div class="card-head">' +
                '<div style="display:flex;align-items:center;gap:9px;">' +
                    '<span class="cat-dot" style="background:' + c.color + ';width:11px;height:11px;"></span>' +
                    '<span class="card-title">' + c.label + '</span>' +
                '</div>' +
                '<div class="txn-actions">' +
                    '<button class="icon-btn" data-bedit="' + b.id + '">✎</button>' +
                    '<button class="icon-btn danger" data-bdel="' + b.id + '">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="meter ' + meterClass + '">' + segs + '</div>' +
            '<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:12.5px;color:#9aa39f;">' +
                '<span class="mono">' + formatCurrency(spent) + ' spent</span>' +
                '<span class="mono">' + formatCurrency(b.limit) + ' limit</span>' +
            '</div>' +
            (pct >= 100 ? 
                '<div style="font-size:11.5px;color:#d99b91;margin-top:8px;">Over budget by ' + formatCurrency(spent - b.limit) + '</div>' :
                '<div style="font-size:11.5px;color:#6b716e;margin-top:8px;">' + formatCurrency(b.limit - spent) + ' remaining</div>'
            ) +
        '</div>';
    }
    grid.innerHTML = html;
    
    var editBtns = grid.querySelectorAll('[data-bedit]');
    for (var k = 0; k < editBtns.length; k++) {
        editBtns[k].onclick = function() { openBudgetModal(this.dataset.bedit); };
    }
    
    var delBtns = grid.querySelectorAll('[data-bdel]');
    for (var l = 0; l < delBtns.length; l++) {
        delBtns[l].onclick = function() {
            appState.budgets = appState.budgets.filter(function(x) { return x.id !== this.dataset.bdel; });
            persistData();
            showToast('Budget deleted');
            renderBudgets();
        };
    }
    renderDashboardAlerts();
}

function renderGoals() {
    var grid = document.getElementById('goalGrid');
    
    if (appState.goals.length === 0) {
        grid.innerHTML = emptyState('No goals yet', 'Create a savings goal to start tracking progress.');
        renderDashboardAlerts();
        return;
    }
    
    var html = '';
    for (var i = 0; i < appState.goals.length; i++) {
        var g = appState.goals[i];
        var pct = Math.min(100, Math.round((g.current / g.target) * 100));
        
        html += '<div class="card">' +
            '<div class="ring-wrap">' +
                '<div class="ring-dyn" style="--rp:' + pct + ';--rc:#d8bd8a;width:76px;height:76px;">' +
                    '<span class="ring-num" style="font-size:14px;">' + pct + '%</span>' +
                '</div>' +
                '<div>' +
                    '<div class="card-title">' + escapeHtml(g.name) + '</div>' +
                    (g.deadline ? '<div class="card-sub">Target: ' + formatDate(g.deadline) + '</div>' : '') +
                '</div>' +
            '</div>' +
            '<div style="margin-top:16px;font-size:13px;color:#9aa39f;">' +
                '<b class="mono" style="color:#edf1ee;">' + formatCurrency(g.current) + '</b> of ' + formatCurrency(g.target) +
            '</div>' +
            '<div style="display:flex;gap:8px;margin-top:14px;">' +
                '<button class="btn btn-ghost" data-contribute="' + g.id + '" style="flex:1;justify-content:center;padding:9px;font-size:12.5px;">Add funds</button>' +
                '<button class="icon-btn danger" data-gdel="' + g.id + '">✕</button>' +
            '</div>' +
        '</div>';
    }
    grid.innerHTML = html;
    
    var contributeBtns = grid.querySelectorAll('[data-contribute]');
    for (var j = 0; j < contributeBtns.length; j++) {
        contributeBtns[j].onclick = function() {
            document.getElementById('contributeGoalId').value = this.dataset.contribute;
            document.getElementById('contributeForm').reset();
            openModal('contributeModal');
        };
    }
    
    var delBtns = grid.querySelectorAll('[data-gdel]');
    for (var k = 0; k < delBtns.length; k++) {
        delBtns[k].onclick = function() {
            appState.goals = appState.goals.filter(function(g) { return g.id !== this.dataset.gdel; });
            persistData();
            showToast('Goal deleted');
            renderGoals();
        };
    }
    renderDashboardAlerts();
}

function renderInsights() {
    var months = getLastNMonthKeys(6);
    var incomeData = [];
    var expenseData = [];
    var maxVal = 1;
    
    for (var i = 0; i < months.length; i++) {
        var monthTxns = filterByMonth(appState.transactions, months[i]);
        var inc = sumByType(monthTxns, 'income');
        var exp = sumByType(monthTxns, 'expense');
        incomeData.push(inc);
        expenseData.push(exp);
        if (inc > maxVal) maxVal = inc;
        if (exp > maxVal) maxVal = exp;
    }
    
    var dualbarsHtml = '';
    for (var j = 0; j < months.length; j++) {
        var incHeight = Math.max(4, Math.round((incomeData[j] / maxVal) * 100));
        var expHeight = Math.max(4, Math.round((expenseData[j] / maxVal) * 100));
        dualbarsHtml += '<div class="grp">' +
            '<div class="b inc" style="height:' + incHeight + '%;" title="Income ' + formatCurrency(incomeData[j]) + '"></div>' +
            '<div class="b exp" style="height:' + expHeight + '%;" title="Expenses ' + formatCurrency(expenseData[j]) + '"></div>' +
        '</div>';
    }
    document.getElementById('insightDualbars').innerHTML = dualbarsHtml;
    
    var labelsHtml = '';
    for (var k = 0; k < months.length; k++) {
        labelsHtml += '<span>' + getMonthLabel(months[k]) + '</span>';
    }
    document.getElementById('insightDualbarsLabels').innerHTML = labelsHtml;
    
    var net = [];
    var maxAbsNet = 1;
    for (var l = 0; l < months.length; l++) {
        var n = incomeData[l] - expenseData[l];
        net.push(n);
        if (Math.abs(n) > maxAbsNet) maxAbsNet = Math.abs(n);
    }
    
    var netHtml = '';
    for (var m = 0; m < net.length; m++) {
        var color = net[m] >= 0 ? 
            'linear-gradient(180deg,#b7d6bd,rgba(183,214,189,0.25))' : 
            'linear-gradient(180deg,#d99b91,rgba(217,155,145,0.25))';
        var height = Math.max(4, Math.round((Math.abs(net[m]) / maxAbsNet) * 100));
        netHtml += '<div class="b" style="height:' + height + '%;background:' + color + ';" title="' + formatCurrency(net[m]) + '"></div>';
    }
    document.getElementById('insightNetBars').innerHTML = netHtml;
    document.getElementById('insightNetLabels').innerHTML = labelsHtml;
    
    var mk = getThisMonthKey();
    var monthExpenses = filterByMonth(appState.transactions, mk).filter(function(t) { return t.type === 'expense'; });
    var byCat = {};
    for (var n = 0; n < monthExpenses.length; n++) {
        var t = monthExpenses[n];
        byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
    }
    
    var entries = Object.entries(byCat);
    entries.sort(function(a, b) { return b[1] - a[1]; });
    entries = entries.slice(0, 7);
    
    var topEl = document.getElementById('topCats');
    if (entries.length === 0) {
        topEl.innerHTML = emptyState('No spending yet', 'Top categories appear once you log expenses.');
        return;
    }
    
    var maxEntry = entries[0][1];
    var topHtml = '';
    for (var o = 0; o < entries.length; o++) {
        var c = getCategoryInfo(entries[o][0]);
        var pct = Math.round((entries[o][1] / maxEntry) * 100);
        topHtml += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:13px;">' +
            '<div style="width:110px;font-size:12.5px;color:#9aa39f;flex:none;">' + c.label + '</div>' +
            '<div style="flex:1;height:8px;border-radius:20px;background:rgba(255,255,255,0.1);overflow:hidden;">' +
                '<div style="height:100%;width:' + pct + '%;background:' + c.color + ';border-radius:20px;"></div>' +
            '</div>' +
            '<div style="width:64px;text-align:right;font-size:12px;" class="mono">' + formatCurrency(entries[o][1]) + '</div>' +
        '</div>';
    }
    topEl.innerHTML = topHtml;
}

function openModal(id) {
    document.getElementById('modalBackdrop').classList.add('show');
    document.getElementById(id).classList.add('show');
}

function closeModals() {
    document.getElementById('modalBackdrop').classList.remove('show');
    var modals = document.querySelectorAll('.modal');
    for (var i = 0; i < modals.length; i++) {
        modals[i].classList.remove('show');
    }
}

function buildCatPicker() {
    var picker = document.getElementById('catPicker');
    var cats = currentTxnType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    var html = '';
    for (var i = 0; i < cats.length; i++) {
        html += '<button type="button" class="cat-opt" data-cat="' + cats[i].id + '">' +
            '<span class="cat-dot" style="background:' + cats[i].color + ';"></span>' +
            cats[i].label +
        '</button>';
    }
    picker.innerHTML = html;
    
    var optBtns = picker.querySelectorAll('.cat-opt');
    for (var j = 0; j < optBtns.length; j++) {
        optBtns[j].onclick = function() {
            picker.querySelectorAll('.cat-opt').forEach(function(x) {
                x.classList.remove('selected');
            });
            this.classList.add('selected');
            document.getElementById('txnCategory').value = this.dataset.cat;
        };
    }
}

var currentTxnType = 'expense';

function setTxnType(type) {
    currentTxnType = type;
    var expenseBtn = document.getElementById('typeExpense');
    var incomeBtn = document.getElementById('typeIncome');
    expenseBtn.className = type === 'expense' ? 'on-expense' : '';
    incomeBtn.className = type === 'income' ? 'on-income' : '';
    buildCatPicker();
    document.getElementById('txnCategory').value = '';
}

function openTxnModal(editId) {
    document.getElementById('txnForm').reset();
    document.getElementById('txnId').value = '';
    
    if (editId) {
        var t = null;
        for (var i = 0; i < appState.transactions.length; i++) {
            if (appState.transactions[i].id === editId) {
                t = appState.transactions[i];
                break;
            }
        }
        if (!t) return;
        
        document.getElementById('txnModalTitle').textContent = 'Edit transaction';
        document.getElementById('txnId').value = t.id;
        setTxnType(t.type);
        document.getElementById('txnAmount').value = t.amount;
        document.getElementById('txnDate').value = t.date;
        document.getElementById('txnAccount').value = t.account || '';
        document.getElementById('txnNote').value = t.note || '';
        document.getElementById('txnCategory').value = t.category;
        
        setTimeout(function() {
            var selected = document.querySelector('.cat-opt[data-cat="' + t.category + '"]');
            if (selected) selected.classList.add('selected');
        }, 0);
    } else {
        document.getElementById('txnModalTitle').textContent = 'Add transaction';
        setTxnType('expense');
        document.getElementById('txnDate').value = new Date().toISOString().slice(0, 10);
    }
    openModal('txnModal');
}

function deleteTransaction(id) {
    appState.transactions = appState.transactions.filter(function(t) { return t.id !== id; });
    persistData();
    showToast('Transaction deleted');
    renderAll();
}

function openBudgetModal(editId) {
    var sel = document.getElementById('budgetCategory');
    var html = '';
    for (var i = 0; i < EXPENSE_CATEGORIES.length; i++) {
        html += '<option value="' + EXPENSE_CATEGORIES[i].id + '">' + EXPENSE_CATEGORIES[i].label + '</option>';
    }
    sel.innerHTML = html;
    document.getElementById('budgetForm').reset();
    document.getElementById('budgetId').value = '';
    
    if (editId) {
        var b = null;
        for (var j = 0; j < appState.budgets.length; j++) {
            if (appState.budgets[j].id === editId) {
                b = appState.budgets[j];
                break;
            }
        }
        if (b) {
            document.getElementById('budgetModalTitle').textContent = 'Edit budget';
            document.getElementById('budgetId').value = b.id;
            sel.value = b.category;
            document.getElementById('budgetLimit').value = b.limit;
        }
    } else {
        document.getElementById('budgetModalTitle').textContent = 'New budget';
    }
    openModal('budgetModal');
}

function setupEvents() {
    var navBtns = document.querySelectorAll('#navlinks button');
    for (var i = 0; i < navBtns.length; i++) {
        navBtns[i].addEventListener('click', function() {
            goTo(this.dataset.route);
        });
    }
    
    var gotoBtns = document.querySelectorAll('[data-goto]');
    for (var j = 0; j < gotoBtns.length; j++) {
        gotoBtns[j].addEventListener('click', function() {
            goTo(this.dataset.goto);
        });
    }
    
    document.getElementById('addTxnBtn').addEventListener('click', function() {
        openTxnModal(null);
    });
    
    document.getElementById('heroIncome').addEventListener('click', function() {
        openTxnModal(null);
        setTxnType('income');
    });
    document.getElementById('heroExpense').addEventListener('click', function() {
        openTxnModal(null);
        setTxnType('expense');
    });
    
    document.getElementById('typeExpense').onclick = function() { setTxnType('expense'); };
    document.getElementById('typeIncome').onclick = function() { setTxnType('income'); };
    
    document.getElementById('txnForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        var category = document.getElementById('txnCategory').value;
        var amount = parseFloat(document.getElementById('txnAmount').value);
        
        if (!category) {
            showToast('Please choose a category', 'error');
            return;
        }
        if (!amount || amount <= 0) {
            showToast('Enter a valid amount', 'error');
            return;
        }
        
        var id = document.getElementById('txnId').value;
        var payload = {
            id: id || generateUID(),
            type: currentTxnType,
            category: category,
            amount: amount,
            date: document.getElementById('txnDate').value,
            account: document.getElementById('txnAccount').value.trim(),
            note: document.getElementById('txnNote').value.trim()
        };
        
        if (id) {
            var idx = -1;
            for (var k = 0; k < appState.transactions.length; k++) {
                if (appState.transactions[k].id === id) {
                    idx = k;
                    break;
                }
            }
            if (idx !== -1) {
                appState.transactions[idx] = payload;
                showToast('Transaction updated');
            }
        } else {
            appState.transactions.push(payload);
            showToast('Transaction added');
        }
        
        await persistData();
        closeModals();
        renderAll();
    });
    
    document.getElementById('addBudgetBtn').addEventListener('click', function() {
        openBudgetModal(null);
    });
    
    document.getElementById('budgetForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        var id = document.getElementById('budgetId').value;
        var category = document.getElementById('budgetCategory').value;
        var limit = parseFloat(document.getElementById('budgetLimit').value);
        
        if (!limit || limit <= 0) {
            showToast('Enter a valid limit', 'error');
            return;
        }
        
        var exists = false;
        for (var m = 0; m < appState.budgets.length; m++) {
            if (appState.budgets[m].category === category && appState.budgets[m].id !== id) {
                exists = true;
                break;
            }
        }
        if (!id && exists) {
            showToast('A budget for this category already exists', 'error');
            return;
        }
        
        if (id) {
            var idx = -1;
            for (var n = 0; n < appState.budgets.length; n++) {
                if (appState.budgets[n].id === id) {
                    idx = n;
                    break;
                }
            }
            if (idx !== -1) {
                appState.budgets[idx] = { id: id, category: category, limit: limit };
                showToast('Budget updated');
            }
        } else {
            appState.budgets.push({ id: generateUID(), category: category, limit: limit });
            showToast('Budget created');
        }
        
        await persistData();
        closeModals();
        renderBudgets();
    });
    
    document.getElementById('addGoalBtn').addEventListener('click', function() {
        document.getElementById('goalForm').reset();
        openModal('goalModal');
    });
    
    document.getElementById('goalForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        var name = document.getElementById('goalName').value.trim();
        var target = parseFloat(document.getElementById('goalTarget').value);
        var current = parseFloat(document.getElementById('goalCurrent').value) || 0;
        var deadline = document.getElementById('goalDeadline').value;
        
        if (!name || !target || target <= 0) {
            showToast('Fill in a name and target amount', 'error');
            return;
        }
        
        appState.goals.push({
            id: generateUID(),
            name: name,
            target: target,
            current: current,
            deadline: deadline
        });
        
        await persistData();
        closeModals();
        showToast('Goal created');
        renderGoals();
    });
    
    document.getElementById('contributeForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        var id = document.getElementById('contributeGoalId').value;
        var amount = parseFloat(document.getElementById('contributeAmount').value);
        
        if (!amount || amount <= 0) {
            showToast('Enter a valid amount', 'error');
            return;
        }
        
        for (var p = 0; p < appState.goals.length; p++) {
            if (appState.goals[p].id === id) {
                appState.goals[p].current += amount;
                break;
            }
        }
        
        await persistData();
        closeModals();
        showToast('Contribution added');
        renderGoals();
    });
    
    var searchInput = document.getElementById('searchInput');
    searchInput.oninput = debounce(function() { txnCurrentPage = 1; renderTxnTable(); }, 250);
    
    document.getElementById('filterCategory').onchange = function() { txnCurrentPage = 1; renderTxnTable(); };
    document.getElementById('filterDate').onchange = function() { txnCurrentPage = 1; renderTxnTable(); };
    document.getElementById('filterSort').onchange = function() { txnCurrentPage = 1; renderTxnTable(); };
    document.getElementById('resetTxnFilters').onclick = function() {
        document.getElementById('searchInput').value = '';
        document.getElementById('filterCategory').value = 'all';
        document.getElementById('filterDate').value = 'all';
        document.getElementById('filterSort').value = 'date-desc';
        var typeButtons = document.querySelectorAll('#typeFilterSeg button');
        for (var i = 0; i < typeButtons.length; i++) {
            typeButtons[i].classList.toggle('active', typeButtons[i].dataset.val === 'all');
        }
        txnCurrentPage = 1;
        renderTxnTable();
    };
    
    var typeFilterBtns = document.querySelectorAll('#typeFilterSeg button');
    for (var q = 0; q < typeFilterBtns.length; q++) {
        typeFilterBtns[q].onclick = function() {
            var parent = this.parentElement;
            var btns = parent.querySelectorAll('button');
            for (var r = 0; r < btns.length; r++) {
                btns[r].classList.remove('active');
            }
            this.classList.add('active');
            txnCurrentPage = 1;
            renderTxnTable();
        };
    }
    
    document.getElementById('modalBackdrop').onclick = closeModals;
    var closeBtns = document.querySelectorAll('[data-close]');
    for (var s = 0; s < closeBtns.length; s++) {
        closeBtns[s].onclick = closeModals;
    }
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModals();
    });
    
    document.getElementById('userChip').addEventListener('click', function(e) {
        document.getElementById('userMenu').classList.toggle('show');
        e.stopPropagation();
    });
    document.addEventListener('click', function() {
        document.getElementById('userMenu').classList.remove('show');
    });
    document.getElementById('userMenu').addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    document.getElementById('menuCurrency').onclick = function() {
        showToast('Currency is fixed to USD in this demo');
    };
    document.getElementById('menuReset').onclick = async function() {
        if (!window.confirm('This will erase all your data and restore the demo. Continue?')) return;
        seedDemoData();
        await persistData();
        renderAll();
        showToast('Data reset to demo');
    };

    document.getElementById('menuSignout').onclick = function() {
        Auth.logout();
        window.location.href = '/';
    };
    
    window.addEventListener('hashchange', function() {
        renderRoute(getCurrentHashRoute());
    });
    document.getElementById('retryExchange').addEventListener('click', loadExchangeRate);
    document.getElementById('exchangeAmount').addEventListener('input', updateCurrencyConversion);
}

function setGreeting() {
    var hour = new Date().getHours();
    var part;
    if (hour < 12) part = 'GOOD MORNING';
    else if (hour < 18) part = 'GOOD AFTERNOON';
    else part = 'GOOD EVENING';
    document.getElementById('greetingKicker').textContent = part;
}

function tickClock() {
    var now = new Date();
    document.getElementById('footerClock').textContent = now.toLocaleString('en-US', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function initializeUser() {
    if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) {
        window.location.href = '/login';
        return false;
    }

    currentUser = Auth.getCurrentUser();
    if (!currentUser) {
        window.location.href = '/login';
        return false;
    }

    var fullName = (currentUser.firstName + ' ' + currentUser.lastName).trim() || currentUser.email;
    var initials = ((currentUser.firstName || '').charAt(0) + (currentUser.lastName || '').charAt(0)).toUpperCase();
    if (!initials) {
        initials = currentUser.email.slice(0, 2).toUpperCase();
    }

    var nameEl = document.getElementById('userName');
    var avatarEl = document.getElementById('userAvatar');
    var greetingEl = document.getElementById('greetingName');

    if (nameEl) nameEl.textContent = fullName;
    if (avatarEl) avatarEl.textContent = initials;
    if (greetingEl) greetingEl.textContent = 'Welcome back, ' + (currentUser.firstName || fullName);

    return true;
}

async function init() {
    if (!initializeUser()) {
        return;
    }

    var hadData = loadData();
    if (!hadData) {
        seedDemoData();
        await persistData();
    }
    
    setGreeting();
    tickClock();
    setInterval(tickClock, 30000);
    
    setupEvents();
    renderRoute(getCurrentHashRoute());
    loadExchangeRate();
}

async function loadExchangeRate() {
    var status = document.getElementById('exchangeStatus');
    var rate = document.getElementById('exchangeRate');
    var retry = document.getElementById('retryExchange');
    if (!status || !rate || !retry) return;
    retry.disabled = true;
    usdInrRate = null;
    status.textContent = 'Loading exchange rate…';
    rate.textContent = '';
    updateCurrencyConversion();
    try {
        var response = await fetch('https://open.er-api.com/v6/latest/USD');
        if (!response.ok) throw new Error('The rate service returned an error.');
        var data = await response.json();
        if (data.result !== 'success' || !data.rates || !data.rates.INR) throw new Error('The exchange rate is unavailable.');
        usdInrRate = Number(data.rates.INR);
        status.textContent = '1 USD = ' + usdInrRate.toFixed(2) + ' INR';
        rate.textContent = 'Updated ' + new Date(data.time_last_update_utc).toLocaleDateString();
        updateCurrencyConversion();
    } catch (error) {
        status.textContent = 'Exchange rate unavailable. Check your connection and retry.';
        updateCurrencyConversion();
    } finally {
        retry.disabled = false;
    }
}

function updateCurrencyConversion() {
    var amountInput = document.getElementById('exchangeAmount');
    var result = document.getElementById('conversionResult');
    if (!amountInput || !result) return;
    var amount = Number(amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
        result.textContent = 'Enter an amount greater than zero.';
    } else if (usdInrRate === null) {
        result.textContent = 'Conversion will appear when the rate loads.';
    } else {
        result.textContent = new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR', maximumFractionDigits: 2
        }).format(amount * usdInrRate);
    }
}

init();

console.log('ApexLedger initialized successfully!');
