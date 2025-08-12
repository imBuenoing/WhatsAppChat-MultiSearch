document.addEventListener('DOMContentLoaded', () => {
    // PWA Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => console.error('SW reg failed:', err));
        });
    }

    // --- DOM Elements ---
    const fileInput = document.getElementById('chatFile');
    const loadingSpinner = document.getElementById('loading-spinner');
    const resultsInfo = document.getElementById('results-info');
    const resultsContainer = document.getElementById('results-container');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const resetFiltersBtn = document.getElementById('resetFilters');
    const searchInput = document.getElementById('searchInput');
    const dateFilterContainer = document.getElementById('date-filter-container');
    const fullChatView = document.getElementById('full-chat-view');
    const fullChatContainer = document.getElementById('full-chat-container');

    // --- Global State ---
    let worker;
    let currentFilteredResults = [];
    let renderedCount = 0;
    const RESULTS_PER_PAGE = 50;
    let filterState = {
        senders: [], fileExts: [], domains: [], dates: [],
        fromMode: 'any', filesMode: 'not_file_related', linksMode: 'any',
        afterDate: null, beforeDate: null, searchTerm: ''
    };

    // --- Worker Initialization & Communication ---
    function initializeWorker() {
        if (worker) worker.terminate();
        worker = new Worker('parser.worker.js');

        worker.onmessage = (e) => {
            const { type, payload } = e.data;
            switch (type) {
                case 'status':
                    resultsInfo.textContent = payload;
                    loadingSpinner.style.display = 'block';
                    break;
                case 'initialData':
                    loadingSpinner.style.display = 'none';
                    populateAllFilters(payload);
                    triggerFilterUpdate();
                    break;
                case 'filterResults':
                    currentFilteredResults = payload.map(m => ({ id: m.id, sender: m.sender, timestamp: new Date(m.timestamp), content: m.content }));
                    renderedCount = 0;
                    resultsContainer.innerHTML = '';
                    renderResultsPage();
                    break;
                case 'fullChatData': // New: Handles the response from the worker
                    renderFullChat(payload.messages, payload.highlightId);
                    break;
            }
        };
    }

    const triggerFilterUpdate = debounce(() => {
        if (worker) worker.postMessage({ type: 'filter', payload: filterState });
    }, 200);

    // --- File Handling ---
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        resetAll();
        initializeWorker();
        const reader = new FileReader();
        reader.onload = (event) => {
            worker.postMessage({ type: 'parse', payload: { text: event.target.result } });
        };
        reader.readAsText(file);
    });
    
    // --- NEW: Click Handler for Results ---
    resultsContainer.addEventListener('click', (e) => {
        const resultItem = e.target.closest('.result-item');
        if (resultItem && worker) {
            const msgId = parseInt(resultItem.dataset.messageId, 10);
            
            // Show the panel with a loading spinner immediately for good UX
            fullChatView.classList.add('show');
            fullChatContainer.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';
            
            // Ask the worker for the full chat context
            worker.postMessage({ type: 'getFullChat', payload: { highlightId: msgId } });
        }
    });

    // --- Filter Population & Handling (Largely unchanged) ---
    function populateAllFilters(data) {
        setupSearchableDropdown('from', data.senderCounts);
        setupSearchableDropdown('files', data.fileExtCounts);
        setupSearchableDropdown('links', data.domainCounts);
        renderDateFilter(data.dateTree);
    }
    
    function setupSearchableDropdown(name, counts) {
        const button = document.getElementById(`${name}-ms-button`);
        const dropdown = document.getElementById(`${name}-ms-dropdown`);
        const searchInput = dropdown.querySelector('.dropdown-search');
        const optionsContainer = dropdown.querySelector('.dropdown-options');
        const modeSelect = document.getElementById(`${name}-mode-select`);

        modeSelect.dataset.statekey = name === 'from' ? 'senders' : (name === 'files' ? 'fileExts' : 'domains');
        button.dataset.defaultText = button.querySelector('span').textContent;

        const sortedItems = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        
        const renderOptions = (filter = '') => {
            optionsContainer.innerHTML = '';
            sortedItems
                .filter(([item]) => item.toLowerCase().includes(filter.toLowerCase()))
                .forEach(([item, count]) => {
                    const isChecked = filterState[modeSelect.dataset.statekey].includes(item);
                    optionsContainer.insertAdjacentHTML('beforeend', `<label><input type="checkbox" value="${item}" ${isChecked ? 'checked' : ''}>${item}<span class="item-count">${count}</span></label>`);
                });
        };

        renderOptions();
        searchInput.addEventListener('input', () => renderOptions(searchInput.value));

        optionsContainer.addEventListener('change', e => {
            if (e.target.type === 'checkbox') {
                const selected = Array.from(optionsContainer.querySelectorAll('input:checked')).map(c => c.value);
                filterState[modeSelect.dataset.statekey] = selected;

                if (selected.length > 0) {
                    modeSelect.value = 'selected';
                } else {
                    modeSelect.value = modeSelect.options[0].value;
                }
                updateMultiSelectButtonText(button, modeSelect.dataset.statekey);
                filterState[`${name}Mode`] = modeSelect.value;
                triggerFilterUpdate();
            }
        });
        
        modeSelect.addEventListener('change', () => {
             filterState[`${name}Mode`] = modeSelect.value;
             if (modeSelect.value !== 'selected') {
                filterState[modeSelect.dataset.statekey] = [];
                renderOptions();
                updateMultiSelectButtonText(button, modeSelect.dataset.statekey);
             }
             triggerFilterUpdate();
        });
    }

    function renderDateFilter(dateTree) {
        const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let html = '<ul>';
        const sortedYears = Object.keys(dateTree).sort((a, b) => b - a);
        for (const year of sortedYears) {
            html += `<li class="tree-item collapsed"><div class="tree-label"><span class="caret"></span><input type="checkbox" value="${year}-"><strong>${year}</strong> (${dateTree[year].count})</div><ul>`;
            const sortedMonths = Object.keys(dateTree[year].months).sort((a, b) => b - a);
            for (const month of sortedMonths) {
                 html += `<li class="tree-item collapsed"><div class="tree-label"><span class="caret"></span><input type="checkbox" value="${year}-${month}-">${monthNames[parseInt(month)]} (${dateTree[year].months[month].count})</div><ul>`;
                const sortedDays = Object.keys(dateTree[year].months[month].days).sort((a, b) => b - a);
                for (const day of sortedDays) {
                    html += `<li><div class="tree-label"><input type="checkbox" value="${year}-${month}-${day}">Day ${day} (${dateTree[year].months[month].days[day]})</div></li>`;
                }
                html += '</ul></li>';
            }
            html += '</ul></li>';
        }
        html += '</ul>';
        dateFilterContainer.innerHTML = html;
    }
    
    // All other filter event handlers...
    searchInput.addEventListener('input', debounce(() => { filterState.searchTerm = searchInput.value; triggerFilterUpdate(); }, 300));
    document.getElementById('afterDate').addEventListener('change', e => { filterState.afterDate = e.target.value; triggerFilterUpdate(); });
    document.getElementById('beforeDate').addEventListener('change', e => { filterState.beforeDate = e.target.value; triggerFilterUpdate(); });
    dateFilterContainer.addEventListener('click', e => {
        const label = e.target.closest('.tree-label');
        if (!label) return;
        if (e.target.classList.contains('caret') || e.target.tagName === 'STRONG') {
            label.parentElement.classList.toggle('collapsed');
        }
        if (e.target.type === 'checkbox') {
            const childrenCheckboxes = label.parentElement.querySelectorAll('li input[type="checkbox"]');
            childrenCheckboxes.forEach(child => child.checked = e.target.checked);
            updateDateFilterState();
            triggerFilterUpdate();
        }
    });
    function updateDateFilterState() {
        const checked = Array.from(dateFilterContainer.querySelectorAll('input:checked'));
        const dates = new Set();
        checked.forEach(cb => {
            const isParentChecked = cb.closest('li')?.parentElement.closest('li')?.querySelector(':scope > .tree-label > input:checked');
            if (!isParentChecked) dates.add(cb.value);
        });
        filterState.dates = Array.from(dates);
    }
    document.querySelectorAll('.multi-select-button').forEach(button => button.addEventListener('click', () => button.nextElementSibling.classList.toggle('show')));
    document.addEventListener('click', e => { if (!e.target.closest('.multi-select-container')) document.querySelectorAll('.multi-select-dropdown.show').forEach(d => d.classList.remove('show')); });
    function updateMultiSelectButtonText(button, stateKey) {
        const count = filterState[stateKey].length;
        button.querySelector('span').textContent = count > 0 ? `${count} selected` : button.dataset.defaultText;
    }

    // --- Rendering ---
    function renderResultsPage() {
        const resultsToRender = currentFilteredResults.slice(renderedCount, renderedCount + RESULTS_PER_PAGE);
        if (renderedCount === 0 && resultsToRender.length === 0) {
             resultsInfo.textContent = 'No results found matching your criteria.';
             loadMoreBtn.style.display = 'none';
             return;
        }
        resultsToRender.forEach(msg => {
            resultsContainer.insertAdjacentHTML('beforeend', `<div class="result-item" data-message-id="${msg.id}"><div class="meta"><span class="sender">${msg.sender}</span> - <span class="timestamp">${msg.timestamp.toLocaleString()}</span></div><div class="content">${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}</div></div>`);
        });
        renderedCount += resultsToRender.length;
        resultsInfo.textContent = `Showing ${renderedCount} of ${currentFilteredResults.length} results.`;
        loadMoreBtn.style.display = renderedCount < currentFilteredResults.length ? 'block' : 'none';
    }
    loadMoreBtn.addEventListener('click', renderResultsPage);
    
    // --- NEW: Renders the full chat view in the side panel ---
    function renderFullChat(messages, highlightId) {
        fullChatContainer.innerHTML = '';
        // The worker sends data that may not be sorted for chat view.
        // We must sort it here in ascending order.
        const sortedMessages = messages.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

        sortedMessages.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'chat-message';
            item.id = `full-chat-msg-${msg.id}`;
            if (msg.id === highlightId) item.classList.add('highlight');
            // Data from worker needs dates to be reconstructed
            const timestamp = new Date(msg.timestamp);
            item.innerHTML = `
                <div class="sender-name">${msg.sender}</div>
                <div class="content">${msg.content.replace(/\n/g, '<br>')}</div>
                <div class="timestamp">${timestamp.toLocaleString()}</div>
            `;
            fullChatContainer.appendChild(item);
        });
        
        // Scroll to the highlighted message
        const highlightElement = document.getElementById(`full-chat-msg-${highlightId}`);
        if (highlightElement) {
            highlightElement.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
    }
    document.getElementById('close-full-chat').addEventListener('click', () => fullChatView.classList.remove('show'));

    // --- Reset and Utils ---
    function resetAll() {
        filterState = { senders: [], fileExts: [], domains: [], dates: [], fromMode: 'any', filesMode: 'not_file_related', linksMode: 'any', afterDate: null, beforeDate: null, searchTerm: '' };
        document.querySelectorAll('input[type="text"], input[type="date"], input[type="checkbox"]').forEach(i => { if(i.closest('.filter-group')) i.value = ''; i.checked = false; });
        document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
        document.querySelectorAll('.multi-select-button span').forEach(s => { if(s.parentElement.dataset.defaultText) s.textContent = s.parentElement.dataset.defaultText; });
        dateFilterContainer.innerHTML = '';
        resultsContainer.innerHTML = '';
        resultsInfo.textContent = 'Upload a chat file to begin.';
        loadMoreBtn.style.display = 'none';
        if (worker) triggerFilterUpdate();
    }
    resetFiltersBtn.addEventListener('click', resetAll);
    function debounce(func, delay) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; }
    
    // Floating buttons... (code omitted for brevity, it's unchanged)
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    const donateBtn = document.getElementById('donateBtn');
    window.addEventListener('scroll', () => { const shouldShow = document.documentElement.scrollTop > 100; scrollToTopBtn.classList.toggle('show', shouldShow); donateBtn.classList.toggle('show', shouldShow); });
    scrollToTopBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
});
