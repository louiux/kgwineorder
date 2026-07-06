(function () {
  'use strict';

  var LS_CATALOG = 'kgwines_catalog_v1';
  var LS_ORDER = 'kgwines_order_v1';

  var catalog = [];
  var order = {}; // id -> qty
  var sortState = { key: null, dir: 1 };

  // ---------- Persistence ----------
  function loadCatalog() {
    var raw = localStorage.getItem(LS_CATALOG);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* fall through */ }
    }
    return JSON.parse(JSON.stringify(window.WINES_DATA));
  }

  function saveCatalog() {
    localStorage.setItem(LS_CATALOG, JSON.stringify(catalog));
  }

  function loadOrder() {
    var raw = localStorage.getItem(LS_ORDER);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* fall through */ }
    }
    return {};
  }

  function saveOrder() {
    localStorage.setItem(LS_ORDER, JSON.stringify(order));
  }

  // ---------- Helpers ----------
  function money(n) {
    if (n === null || n === undefined || isNaN(n)) return '£0.00';
    return '£' + n.toFixed(2);
  }

  function pct(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Math.round(n * 100) + '%';
  }

  function findWine(id) {
    for (var i = 0; i < catalog.length; i++) if (catalog[i].id === id) return catalog[i];
    return null;
  }

  function uniqueSorted(arr) {
    return Array.from(new Set(arr.filter(function (v) { return v && v.trim(); }))).sort();
  }

  function nextId() {
    var max = 0;
    catalog.forEach(function (w) { if (w.id > max) max = w.id; });
    return max + 1;
  }

  // ---------- Filter dropdown population ----------
  function populateFilterOptions() {
    var supplierSel = document.getElementById('filter-supplier');
    var typeSel = document.getElementById('filter-type');
    var regionSel = document.getElementById('filter-region');

    var suppliers = uniqueSorted(catalog.map(function (w) { return w.supplierLabel; }));
    var types = uniqueSorted(catalog.map(function (w) { return w.typeLabel; }));
    var regions = uniqueSorted(catalog.map(function (w) { return w.regionLabel; }));

    fillSelect(supplierSel, suppliers);
    fillSelect(typeSel, types);
    fillSelect(regionSel, regions);

    fillDatalist('supplier-list', suppliers);
    fillDatalist('type-list', types);
    fillDatalist('region-list', regions);
  }

  function fillSelect(sel, values) {
    var current = sel.value;
    sel.innerHTML = '<option value="">' + sel.getAttribute('data-placeholder-text') + '</option>';
    values.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      sel.appendChild(opt);
    });
    if (values.indexOf(current) !== -1) sel.value = current;
  }

  function fillDatalist(id, values) {
    var dl = document.getElementById(id);
    dl.innerHTML = '';
    values.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v;
      dl.appendChild(opt);
    });
  }

  // set placeholder text attrs used by fillSelect
  document.getElementById('filter-supplier').setAttribute('data-placeholder-text', 'All Suppliers');
  document.getElementById('filter-type').setAttribute('data-placeholder-text', 'All Types');
  document.getElementById('filter-region').setAttribute('data-placeholder-text', 'All Regions');

  // ---------- Filtering ----------
  function getFilteredWines() {
    var q = document.getElementById('search').value.trim().toLowerCase();
    var supplier = document.getElementById('filter-supplier').value;
    var type = document.getElementById('filter-type').value;
    var region = document.getElementById('filter-region').value;
    var organic = document.getElementById('filter-organic').checked;
    var vegan = document.getElementById('filter-vegan').checked;
    var orderedOnly = document.getElementById('filter-ordered').checked;

    var list = catalog.filter(function (w) {
      if (q && w.description.toLowerCase().indexOf(q) === -1 &&
          w.supplierLabel.toLowerCase().indexOf(q) === -1 &&
          w.regionLabel.toLowerCase().indexOf(q) === -1) return false;
      if (supplier && w.supplierLabel !== supplier) return false;
      if (type && w.typeLabel !== type) return false;
      if (region && w.regionLabel !== region) return false;
      if (organic && !w.organic) return false;
      if (vegan && !w.vegan) return false;
      if (orderedOnly && !(order[w.id] > 0)) return false;
      return true;
    });

    if (sortState.key) {
      var key = sortState.key, dir = sortState.dir;
      list.sort(function (a, b) {
        var av = a[key], bv = b[key];
        if (av === null || av === undefined) av = typeof bv === 'number' ? -Infinity : '';
        if (bv === null || bv === undefined) bv = typeof av === 'number' ? -Infinity : '';
        if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    } else {
      list.sort(function (a, b) { return a.description.localeCompare(b.description); });
    }

    return list;
  }

  // ---------- Rendering: Order tab ----------
  function renderOrderTable() {
    var tbody = document.getElementById('wine-tbody');
    var list = getFilteredWines();
    tbody.innerHTML = '';
    document.getElementById('empty-state').hidden = list.length > 0;

    list.forEach(function (w) {
      var tr = document.createElement('tr');
      var qty = order[w.id] || 0;
      if (qty > 0) tr.className = 'has-qty';

      var tags = '';
      if (w.organic) tags += '<span class="tag tag-organic">Organic</span>';
      if (w.vegan) tags += '<span class="tag tag-vegan">Vegan</span>';

      var lineTotal = qty * (w.cost || 0);

      tr.innerHTML =
        '<td><div class="wine-desc">' + escapeHtml(w.description) + '</div>' +
          (tags ? '<div class="wine-tags">' + tags + '</div>' : '') + '</td>' +
        '<td>' + escapeHtml(w.supplierLabel) + '</td>' +
        '<td class="col-type">' + escapeHtml(w.typeLabel) + '</td>' +
        '<td class="col-region">' + escapeHtml(w.regionLabel) + '</td>' +
        '<td class="num">' + money(w.cost) + '</td>' +
        '<td class="num col-rsp">' + money(w.rsp) + '</td>' +
        '<td class="num col-margin">' + pct(w.marginPct) + '</td>' +
        '<td class="num"><input type="number" min="0" step="1" class="qty-input" data-id="' + w.id + '" value="' + (qty || '') + '" placeholder="0"></td>' +
        '<td class="num line-total">' + money(lineTotal) + '</td>';

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.qty-input').forEach(function (input) {
      input.addEventListener('input', function () {
        var id = Number(input.dataset.id);
        var val = parseInt(input.value, 10);
        if (isNaN(val) || val <= 0) delete order[id];
        else order[id] = val;
        saveOrder();
        renderRowTotal(input, id);
        renderSummary();
      });
    });
  }

  function renderRowTotal(input, id) {
    var w = findWine(id);
    var qty = order[id] || 0;
    var tr = input.closest('tr');
    tr.classList.toggle('has-qty', qty > 0);
    tr.querySelector('.line-total').textContent = money(qty * (w.cost || 0));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- Order summary ----------
  function renderSummary() {
    var ids = Object.keys(order).filter(function (id) { return order[id] > 0; });
    var hasItems = ids.length > 0;
    document.getElementById('summary-empty').hidden = hasItems;
    document.getElementById('summary-content').hidden = !hasItems;
    if (!hasItems) return;

    var bySupplier = {};
    var totalBottles = 0, totalEx = 0;

    ids.forEach(function (id) {
      var w = findWine(Number(id));
      if (!w) return;
      var qty = order[id];
      totalBottles += qty;
      var lineEx = qty * (w.cost || 0);
      totalEx += lineEx;
      var key = w.supplierLabel;
      if (!bySupplier[key]) bySupplier[key] = { bottles: 0, cost: 0 };
      bySupplier[key].bottles += qty;
      bySupplier[key].cost += lineEx;
    });

    var supEl = document.getElementById('summary-suppliers');
    supEl.innerHTML = '';
    Object.keys(bySupplier).sort().forEach(function (name) {
      var s = bySupplier[name];
      var row = document.createElement('div');
      row.className = 'summary-supplier-row';
      row.innerHTML = '<span class="name">' + escapeHtml(name) + '</span>' +
        '<span class="meta">' + s.bottles + ' btl · ' + money(s.cost) + '</span>';
      supEl.appendChild(row);
    });

    document.getElementById('sum-bottles').textContent = totalBottles;
    document.getElementById('sum-ex').textContent = money(totalEx);
    document.getElementById('sum-inc').textContent = money(totalEx * 1.2);
  }

  // ---------- Manage tab (CMS) ----------
  function renderManageTable() {
    var q = document.getElementById('manage-search').value.trim().toLowerCase();
    var tbody = document.getElementById('manage-tbody');
    var list = catalog.filter(function (w) {
      if (!q) return true;
      return w.description.toLowerCase().indexOf(q) !== -1 ||
             w.supplierLabel.toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return a.description.localeCompare(b.description); });

    tbody.innerHTML = '';
    list.forEach(function (w) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="wine-desc">' + escapeHtml(w.description) + '</td>' +
        '<td>' + escapeHtml(w.supplierLabel) + '</td>' +
        '<td class="col-type">' + escapeHtml(w.typeLabel) + '</td>' +
        '<td class="col-region">' + escapeHtml(w.regionLabel) + '</td>' +
        '<td class="col-organic">' + (w.organic ? '<span class="bool-yes">Yes</span>' : '<span class="bool-no">—</span>') + '</td>' +
        '<td class="col-vegan">' + (w.vegan ? '<span class="bool-yes">Yes</span>' : '<span class="bool-no">—</span>') + '</td>' +
        '<td class="num">' + money(w.cost) + '</td>' +
        '<td class="num col-rsp">' + money(w.rsp) + '</td>' +
        '<td><button class="icon-btn" data-edit="' + w.id + '">Edit</button></td>';
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { openWineModal(Number(btn.dataset.edit)); });
    });
  }

  // ---------- Wine edit modal ----------
  var modal = document.getElementById('wine-modal');

  function openWineModal(id) {
    var w = id ? findWine(id) : null;
    document.getElementById('wine-modal-title').textContent = w ? 'Edit Wine' : 'Add Wine';
    document.getElementById('f-id').value = w ? w.id : '';
    document.getElementById('f-description').value = w ? w.description : '';
    document.getElementById('f-supplier').value = w ? w.supplierLabel : '';
    document.getElementById('f-type').value = w ? w.typeLabel : '';
    document.getElementById('f-region').value = w ? w.regionLabel : '';
    document.getElementById('f-cost').value = w ? w.cost : '';
    document.getElementById('f-rsp').value = w ? w.rsp : '';
    document.getElementById('f-organic').checked = w ? !!w.organic : false;
    document.getElementById('f-vegan').checked = w ? !!w.vegan : false;
    document.getElementById('btn-delete-wine').hidden = !w;
    modal.hidden = false;
  }

  function closeWineModal() { modal.hidden = true; }

  document.getElementById('btn-cancel-modal').addEventListener('click', closeWineModal);
  document.getElementById('btn-add-wine').addEventListener('click', function () { openWineModal(null); });

  document.getElementById('wine-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var idVal = document.getElementById('f-id').value;
    var cost = parseFloat(document.getElementById('f-cost').value);
    var rsp = parseFloat(document.getElementById('f-rsp').value);
    var rspEx = rsp / 1.2;
    var marginPct = rsp ? (rsp - (cost * 1.2)) / rsp : null;
    var marginGbp = rspEx - cost;

    var data = {
      description: document.getElementById('f-description').value.trim(),
      supplier: document.getElementById('f-supplier').value.trim(),
      supplierLabel: document.getElementById('f-supplier').value.trim(),
      type: document.getElementById('f-type').value.trim().toLowerCase(),
      typeLabel: document.getElementById('f-type').value.trim(),
      region: document.getElementById('f-region').value.trim().toLowerCase(),
      regionLabel: document.getElementById('f-region').value.trim(),
      organic: document.getElementById('f-organic').checked,
      vegan: document.getElementById('f-vegan').checked,
      cost: cost,
      rsp: rsp,
      rspEx: Math.round(rspEx * 100) / 100,
      marginPct: marginPct !== null ? Math.round(marginPct * 10000) / 10000 : null,
      marginGbp: Math.round(marginGbp * 100) / 100,
      deal: null
    };

    if (idVal) {
      var w = findWine(Number(idVal));
      Object.assign(w, data);
    } else {
      data.id = nextId();
      catalog.push(data);
    }

    saveCatalog();
    closeWineModal();
    refreshAll();
  });

  document.getElementById('btn-delete-wine').addEventListener('click', function () {
    var idVal = Number(document.getElementById('f-id').value);
    if (!idVal) return;
    if (!confirm('Delete this wine from the list?')) return;
    catalog = catalog.filter(function (w) { return w.id !== idVal; });
    delete order[idVal];
    saveCatalog();
    saveOrder();
    closeWineModal();
    refreshAll();
  });

  document.getElementById('btn-restore-defaults').addEventListener('click', function () {
    if (!confirm('Restore the original wine list? Any edits or added/removed wines will be lost. Your current order quantities are kept where wines still match.')) return;
    catalog = JSON.parse(JSON.stringify(window.WINES_DATA));
    saveCatalog();
    refreshAll();
  });

  // ---------- Order forms generation ----------
  var orderModal = document.getElementById('order-modal');

  function buildOrderForms() {
    var bySupplier = {};
    Object.keys(order).forEach(function (id) {
      var qty = order[id];
      if (!qty || qty <= 0) return;
      var w = findWine(Number(id));
      if (!w) return;
      if (!bySupplier[w.supplierLabel]) bySupplier[w.supplierLabel] = [];
      bySupplier[w.supplierLabel].push({ wine: w, qty: qty });
    });
    return bySupplier;
  }

  function openOrderModal() {
    var bySupplier = buildOrderForms();
    var suppliers = Object.keys(bySupplier).sort();
    if (suppliers.length === 0) { alert('Add quantities to some wines first.'); return; }

    var tabsEl = document.getElementById('order-forms-tabs');
    var contentEl = document.getElementById('order-forms-content');
    tabsEl.innerHTML = '';
    contentEl.innerHTML = '';

    var today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    suppliers.forEach(function (supplier, idx) {
      var items = bySupplier[supplier];
      items.sort(function (a, b) { return a.wine.description.localeCompare(b.wine.description); });
      var totalBottles = items.reduce(function (s, i) { return s + i.qty; }, 0);
      var totalEx = items.reduce(function (s, i) { return s + i.qty * (i.wine.cost || 0); }, 0);

      var tabBtn = document.createElement('button');
      tabBtn.className = 'order-form-tab-btn' + (idx === 0 ? ' active' : '');
      tabBtn.textContent = supplier;
      tabBtn.dataset.target = 'sheet-' + idx;
      tabsEl.appendChild(tabBtn);

      var sheet = document.createElement('div');
      sheet.className = 'order-sheet' + (idx === 0 ? ' active' : '');
      sheet.id = 'sheet-' + idx;

      var rowsHtml = items.map(function (i) {
        return '<tr><td>' + escapeHtml(i.wine.description) + '</td>' +
          '<td>' + escapeHtml(i.wine.regionLabel) + '</td>' +
          '<td class="num">' + i.qty + '</td>' +
          '<td class="num">' + money(i.wine.cost) + '</td>' +
          '<td class="num">' + money(i.qty * (i.wine.cost || 0)) + '</td></tr>';
      }).join('');

      sheet.innerHTML =
        '<div class="order-sheet-header">' +
          '<div><h4>Order — ' + escapeHtml(supplier) + '</h4>' +
          '<div class="sub">KG Wines · ' + today + ' · ' + totalBottles + ' bottles</div></div>' +
          '<div class="order-sheet-actions">' +
            '<button class="btn btn-ghost btn-sm" data-copy="' + idx + '">Copy as text</button>' +
            '<button class="btn btn-ghost btn-sm" data-csv="' + idx + '">Download CSV</button>' +
            '<button class="btn btn-primary btn-sm" data-print="' + idx + '">Print / Save PDF</button>' +
          '</div>' +
        '</div>' +
        '<table><thead><tr><th>Wine</th><th>Region</th><th class="num">Qty</th><th class="num">Unit Cost</th><th class="num">Line Total</th></tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody></table>' +
        '<div class="grand-total">Total (ex VAT): ' + money(totalEx) + ' &nbsp;·&nbsp; Total (inc VAT): ' + money(totalEx * 1.2) + '</div>';

      contentEl.appendChild(sheet);
    });

    tabsEl.querySelectorAll('.order-form-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabsEl.querySelectorAll('.order-form-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        contentEl.querySelectorAll('.order-sheet').forEach(function (s) { s.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
      });
    });

    contentEl.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var supplier = suppliers[Number(btn.dataset.copy)];
        var items = bySupplier[supplier];
        var text = 'ORDER — ' + supplier + '\nKG Wines · ' + today + '\n\n';
        items.forEach(function (i) {
          text += i.qty + ' x ' + i.wine.description + ' (' + i.wine.regionLabel + ') — ' + money(i.wine.cost) + ' ea = ' + money(i.qty * (i.wine.cost || 0)) + '\n';
        });
        var totalEx = items.reduce(function (s, i) { return s + i.qty * (i.wine.cost || 0); }, 0);
        text += '\nTotal (ex VAT): ' + money(totalEx) + '\nTotal (inc VAT): ' + money(totalEx * 1.2) + '\n';
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = 'Copy as text'; }, 1500);
        });
      });
    });

    contentEl.querySelectorAll('[data-csv]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var supplier = suppliers[Number(btn.dataset.csv)];
        var items = bySupplier[supplier];
        var rows = [['Wine', 'Region', 'Qty', 'Unit Cost', 'Line Total']];
        items.forEach(function (i) {
          rows.push([i.wine.description, i.wine.regionLabel, i.qty, i.wine.cost, (i.qty * (i.wine.cost || 0)).toFixed(2)]);
        });
        var csv = rows.map(function (r) {
          return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
        }).join('\n');
        var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'Order-' + supplier.replace(/\s+/g, '-') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
      });
    });

    contentEl.querySelectorAll('[data-print]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var supplier = suppliers[Number(btn.dataset.print)];
        printOrderSheet(supplier, bySupplier[supplier], today);
      });
    });

    orderModal.hidden = false;
  }

  function printOrderSheet(supplier, items, today) {
    var totalBottles = items.reduce(function (s, i) { return s + i.qty; }, 0);
    var totalEx = items.reduce(function (s, i) { return s + i.qty * (i.wine.cost || 0); }, 0);

    var rowsHtml = items.map(function (i) {
      return '<tr><td>' + escapeHtml(i.wine.description) + '</td>' +
        '<td>' + escapeHtml(i.wine.regionLabel) + '</td>' +
        '<td class="num">' + i.qty + '</td>' +
        '<td class="num">' + money(i.wine.cost) + '</td>' +
        '<td class="num">' + money(i.qty * (i.wine.cost || 0)) + '</td></tr>';
    }).join('');

    var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<title>Order - ' + escapeHtml(supplier) + '</title>' +
      '<style>' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#1c2a22;padding:32px;}' +
      'h1{font-size:20px;color:#0e3723;margin:0 0 4px;}' +
      '.sub{color:#555;font-size:13px;margin-bottom:22px;}' +
      'table{width:100%;border-collapse:collapse;}' +
      'th{text-align:left;padding:8px 10px;font-size:12px;text-transform:uppercase;border-bottom:2px solid #999;}' +
      'td{padding:8px 10px;border-bottom:1px solid #ccc;font-size:13px;}' +
      'th.num,td.num{text-align:right;}' +
      '.grand-total{text-align:right;font-size:15px;font-weight:700;padding:14px 4px;}' +
      '</style></head><body>' +
      '<h1>Order — ' + escapeHtml(supplier) + '</h1>' +
      '<div class="sub">KG Wines · ' + today + ' · ' + totalBottles + ' bottles</div>' +
      '<table><thead><tr><th>Wine</th><th>Region</th><th class="num">Qty</th><th class="num">Unit Cost</th><th class="num">Line Total</th></tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody></table>' +
      '<div class="grand-total">Total (ex VAT): ' + money(totalEx) + ' &nbsp;·&nbsp; Total (inc VAT): ' + money(totalEx * 1.2) + '</div>' +
      '</body></html>';

    var w = window.open('', '_blank', 'width=850,height=1000');
    if (!w) {
      alert('Your browser blocked the print window as a pop-up. Please allow pop-ups for this page and try again.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(function () {
      w.focus();
      w.print();
    }, 300);
  }

  document.getElementById('btn-generate').addEventListener('click', openOrderModal);
  document.getElementById('btn-close-order').addEventListener('click', function () { orderModal.hidden = true; });

  document.getElementById('btn-clear-order').addEventListener('click', function () {
    if (!confirm('Clear all quantities from the current order?')) return;
    order = {};
    saveOrder();
    refreshAll();
  });

  // ---------- Save / load order to file (backup against lost browser data) ----------
  document.getElementById('btn-save-order').addEventListener('click', function () {
    var items = Object.keys(order).filter(function (id) { return order[id] > 0; }).map(function (id) {
      var w = findWine(Number(id));
      return {
        id: Number(id),
        description: w ? w.description : null,
        supplier: w ? w.supplierLabel : null,
        qty: order[id]
      };
    });
    var payload = { savedAt: new Date().toISOString(), items: items };
    var blob = new Blob(['﻿' + JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'KG-Wines-Order-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
  });

  document.getElementById('btn-load-order').addEventListener('click', function () {
    document.getElementById('load-order-input').click();
  });

  document.getElementById('load-order-input').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (err) {
        alert('That file could not be read as a saved order.');
        e.target.value = '';
        return;
      }
      if (!data || !Array.isArray(data.items)) {
        alert('That file does not look like a saved order.');
        e.target.value = '';
        return;
      }
      var whenText = data.savedAt ? new Date(data.savedAt).toLocaleString() : 'an unknown date';
      if (!confirm('Load the order saved on ' + whenText + '? This will replace your current order quantities.')) {
        e.target.value = '';
        return;
      }

      var unmatched = [];
      var newOrder = {};
      data.items.forEach(function (item) {
        var w = findWine(item.id);
        if (!w || (item.description && w.description !== item.description)) {
          w = catalog.find(function (c) {
            return c.description === item.description && c.supplierLabel === item.supplier;
          });
        }
        if (w && item.qty > 0) newOrder[w.id] = item.qty;
        else if (!w) unmatched.push(item.description || ('Wine #' + item.id));
      });

      order = newOrder;
      saveOrder();
      refreshAll();
      e.target.value = '';

      if (unmatched.length) {
        alert('Order loaded, but ' + unmatched.length + ' item(s) could not be matched to the current wine list (they may have been renamed or removed):\n\n' + unmatched.join('\n'));
      }
    };
    reader.readAsText(file);
  });

  // ---------- Tabs ----------
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // ---------- Sorting ----------
  document.querySelectorAll('th.sortable').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.dataset.sort;
      if (sortState.key === key) sortState.dir *= -1;
      else { sortState.key = key; sortState.dir = 1; }
      renderOrderTable();
    });
  });

  // ---------- Filter event wiring ----------
  ['search', 'filter-supplier', 'filter-type', 'filter-region', 'filter-organic', 'filter-vegan', 'filter-ordered'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', renderOrderTable);
  });

  document.getElementById('clear-filters').addEventListener('click', function () {
    document.getElementById('search').value = '';
    document.getElementById('filter-supplier').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-region').value = '';
    document.getElementById('filter-organic').checked = false;
    document.getElementById('filter-vegan').checked = false;
    document.getElementById('filter-ordered').checked = false;
    renderOrderTable();
  });

  document.getElementById('manage-search').addEventListener('input', renderManageTable);

  // ---------- Modal safety net: click backdrop or press Escape to close ----------
  [modal, orderModal].forEach(function (m) {
    m.addEventListener('click', function (e) {
      if (e.target === m) m.hidden = true;
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      modal.hidden = true;
      orderModal.hidden = true;
    }
  });

  // ---------- Init ----------
  function refreshAll() {
    populateFilterOptions();
    renderOrderTable();
    renderSummary();
    renderManageTable();
  }

  catalog = loadCatalog();
  order = loadOrder();
  refreshAll();
})();
