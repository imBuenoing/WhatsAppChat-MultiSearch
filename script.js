document.addEventListener('DOMContentLoaded', () => {
    // --- PWA Service Worker Registration ---
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
    let completeChatHistory = []; // Will hold the full, original chat for context view
    currentFilteredResults = []; // Will hold the current list of filtered results
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
                    // Store the complete, original chat history for the full context view
                    completeChatHistory = payload.messages;
                    populateAllFilters(payload);
                    triggerFilterUpdate();
                    break;
                case 'filterResults':
                    // The payload is the array of filtered message objects.
                    currentFilteredResults = payload;
                    renderedCount = 0;
                    resultsContainer.innerHTML = '';
                    renderResultsPage();
                    break;
            }
        };
    }

    const triggerFilterUpdate = debounce(() => {
        if (worker) {
            worker.postMessage({ type: 'filter', payload: filterState });
        }
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

    // --- Filter Population & UI ---
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
                    optionsContainer.insertAdjacentHTML('beforeend', `
                        <label>
                            <input type="checkbox" value="${item}" ${isChecked ? 'checked' : ''}>
                            ${item}
                            <span class="item-count">${count}</span>
                        </label>
                    `);
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
            html += `<li class="tree-item collapsed">
                <div class="tree-label">
                    <span class="caret"></span>
                    <input type="checkbox" value="${year}-">
                    <strong>${year}</strong> (${dateTree[year].count})
                </div><ul>`;
            const sortedMonths = Object.keys(dateTree[year].months).sort((a, b) => b - a);
            for (const month of sortedMonths) {
                 html += `<li class="tree-item collapsed">
                    <div class="tree-label">
                        <span class="caret"></span>
                        <input type="checkbox" value="${year}-${month}-">
                        ${monthNames[parseInt(month)]} (${dateTree[year].months[month].count})
                    </div><ul>`;
                const sortedDays = Object.keys(dateTree[year].months[month].days).sort((a, b) => b - a);
                for (const day of sortedDays) {
                    html += `<li><div class="tree-label">
                        <input type="checkbox" value="${year}-${month}-${day}">
                        Day ${day} (${dateTree[year].months[month].days[day]})
                    </div></li>`;
                }
                html += '</ul></li>';
            }
            html += '</ul></li>';
        }
        html += '</ul>';
        dateFilterContainer.innerHTML = html;
    }
    
    // --- Event Handling for Filters ---
    searchInput.addEventListener('input', debounce(() => {
        filterState.searchTerm = searchInput.value;
        triggerFilterUpdate();
    }, 300));
    
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
        const checked = dateFilterContainer.querySelectorAll('input:checked');
        const dates = new Set();
        checked.forEach(cb => {
            const parentLi = cb.closest('li');
            const isParentChecked = parentLi.parentElement.closest('li')?.querySelector(':scope > .tree-label > input:checked');
            if (!isParentChecked) {
                dates.add(cb.value);
            }
        });
        filterState.dates = Array.from(dates);
    }
    
    document.querySelectorAll('.multi-select-button').forEach(button => {
        button.addEventListener('click', () => button.nextElementSibling.classList.toggle('show'));
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.multi-select-container')) {
            document.querySelectorAll('.multi-select-dropdown.show').forEach(d => d.classList.remove('show'));
        }
    });
    function updateMultiSelectButtonText(button, stateKey) {
        const count = filterState[stateKey].length;
        if (count > 0) button.querySelector('span').textContent = `${count} selected`;
        else button.querySelector('span').textContent = button.dataset.defaultText;
    }

    // --- Rendering Results & Full Chat View ---
    function renderResultsPage() {
        const resultsToRender = currentFilteredResults.slice(renderedCount, renderedCount + RESULTS_PER_PAGE);

        if (renderedCount === 0 && resultsToRender.length === 0) {
             resultsInfo.textContent = 'No results found matching your criteria.';
             loadMoreBtn.style.display = 'none';
             return;
        }

        resultsToRender.forEach(msg => {
            resultsContainer.insertAdjacentHTML('beforeend', `
                <div class="result-item" data-message-id="${msg.id}">
                    <div class="meta"><span class="sender">${msg.sender}</span> - <span class="timestamp">${new Date(msg.timestamp).toLocaleString()}</span></div>
                    <div class="content">${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}</div>
                </div>`);
        });

        renderedCount += resultsToRender.length;
        resultsInfo.textContent = `Showing ${renderedCount} of ${currentFilteredResults.length} results.`;
        loadMoreBtn.style.display = renderedCount < currentFilteredResults.length ? 'block' : 'none';
    }
    loadMoreBtn.addEventListener('click', renderResultsPage);

    resultsContainer.addEventListener('click', e => {
        const resultItem = e.target.closest('.result-item');
        if (resultItem) {
            const msgId = parseInt(resultItem.dataset.messageId);
            renderFullChat(msgId);
        }
    });
    
    function renderFullChat(highlightId) {
        fullChatContainer.innerHTML = '';
        const contextMessages = [...completeChatHistory].sort((a, b) => a.timestamp - b.timestamp);

        contextMessages.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'chat-message';
            item.id = `full-chat-msg-${msg.id}`;
            if (msg.id === highlightId) item.classList.add('highlight');
            item.innerHTML = `
                <div class="sender-name">${msg.sender}</div>
                <div class="content">${msg.content.replace(/\n/g, '<br>')}</div>
                <div class="timestamp">${new Date(msg.timestamp).toLocaleString()}</div>
            `;
            fullChatContainer.appendChild(item);
        });
        fullChatView.classList.add('show');
        document.getElementById(`full-chat-msg-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    document.getElementById('close-full-chat').addEventListener('click', () => fullChatView.classList.remove('show'));
    
    // --- Utility Functions ---
    function resetAll() {
        filterState = {
            senders: [], fileExts: [], domains: [], dates: [],
            fromMode: 'any', filesMode: 'not_file_related', linksMode: 'any',
            afterDate: null, beforeDate: null, searchTerm: ''
        };
        completeChatHistory = [];
        document.querySelectorAll('.filter-group input[type="text"], .filter-group input[type="date"]').forEach(i => i.value = '');
        document.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
        document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
        document.querySelectorAll('.multi-select-button span').forEach(s => {
             if (s.parentElement.dataset.defaultText) s.textContent = s.parentElement.dataset.defaultText;
        });
        dateFilterContainer.innerHTML = '';
        resultsContainer.innerHTML = '';
        resultsInfo.textContent = 'Upload a chat file to begin.';
        loadMoreBtn.style.display = 'none';

        if (worker) triggerFilterUpdate();
    }
    resetFiltersBtn.addEventListener('click', resetAll);

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    const donateBtn = document.getElementById('donateBtn');
    window.addEventListener('scroll', () => {
        const shouldShow = document.body.scrollTop > 100 || document.documentElement.scrollTop > 100;
        scrollToTopBtn.classList.toggle('show', shouldShow);
        donateBtn.classList.toggle('show', shouldShow);
    });
    scrollToTopBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
});
