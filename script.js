document.addEventListener('DOMContentLoaded', () => {

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => console.log('Service Worker registered successfully:', registration))
                .catch(err => console.error('Service Worker registration failed:', err));
        });
    }

    // --- DOM Elements ---
    const fileInput = document.getElementById('chatFile');
    const loadingSpinner = document.getElementById('loading-spinner');
    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('results-container');
    const resultsInfo = document.getElementById('results-info');
    const resetFiltersBtn = document.getElementById('resetFilters');
    const loadMoreBtn = document.getElementById('loadMoreBtn'); // NEW

    // Filter Elements
    const fromModeSelect = document.getElementById('from-mode-select');
    const fromMsButton = document.getElementById('from-ms-button');
    const fromMsDropdown = document.getElementById('from-ms-dropdown');
    
    const filesModeSelect = document.getElementById('files-mode-select');
    const filesMsButton = document.getElementById('files-ms-button');
    const filesMsDropdown = document.getElementById('files-ms-dropdown');

    const linksModeSelect = document.getElementById('links-mode-select');
    const linksMsButton = document.getElementById('links-ms-button');
    const linksMsDropdown = document.getElementById('links-ms-dropdown');

    const dateModeSelect = document.getElementById('date-mode-select');
    const dateMsButton = document.getElementById('date-ms-button');
    const dateMsDropdown = document.getElementById('date-ms-dropdown');

    const afterDateInput = document.getElementById('afterDate');
    const beforeDateInput = document.getElementById('beforeDate');
    
    // Full Chat View Elements
    const fullChatView = document.getElementById('full-chat-view');
    const fullChatContainer = document.getElementById('full-chat-container');
    const closeFullChatBtn = document.getElementById('close-full-chat');

    // Floating Buttons
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    const donateBtn = document.getElementById('donateBtn');

    // --- Global State ---
    let allMessages = [];
    let currentFilteredResults = []; // NEW: Store the currently filtered list
    let renderedCount = 0; // NEW: Track how many results are shown
    const RESULTS_PER_PAGE = 50; // NEW: Pagination constant
    let fuse;
    const filterState = {
        senders: [],
        fileExts: [],
        domains: [],
        dates: [],
        afterDate: null,
        beforeDate: null,
        searchTerm: ''
    };

    // --- Core Logic ---

    // NEW: Debounce function to delay execution
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // MODIFIED: File input handler now uses the Web Worker
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        resetFilters(); // Reset UI
        loadingSpinner.style.display = 'block';
        resultsInfo.textContent = 'Reading file... The UI will remain responsive.';
        
        const reader = new FileReader();
        reader.onload = (event) => {
            // Create a new worker
            const worker = new Worker('parser.worker.js');
            
            // Handle messages from the worker
            worker.onmessage = (e) => {
                const { type, data } = e.data;
                if (type === 'status') {
                    resultsInfo.textContent = data; // Update status from worker
                } else if (type === 'result') {
                    resultsInfo.textContent = 'Initializing search index...';
                    allMessages = data.messages;
                    
                    // The worker already did the heavy lifting of counting
                    populateFilters(data);
                    
                    initializeFuse();
                    applyFiltersAndSearch();
                    
                    loadingSpinner.style.display = 'none';
                    worker.terminate(); // Clean up the worker
                }
            };

            worker.onerror = (e) => {
                console.error('Error in worker:', e);
                resultsInfo.textContent = `Error processing file: ${e.message}`;
                loadingSpinner.style.display = 'none';
                worker.terminate();
            };
            
            // Send the file text to the worker to start parsing
            worker.postMessage({ type: 'parse', text: event.target.result });
        };
        reader.readAsText(file);
    });

    /**
     * Initializes the Fuse.js fuzzy search instance.
     */
    function initializeFuse() {
        const options = {
            keys: ['content', 'sender'],
            includeScore: true,
            threshold: 0.4,
            useExtendedSearch: true,
        };
        fuse = new Fuse(allMessages, options);
    }
    
    // MODIFIED: Now receives pre-counted data from the worker
    function populateFilters(data) {
        populateMultiSelect(fromMsDropdown, data.senderCounts);
        populateMultiSelect(filesMsDropdown, data.fileExtCounts);
        populateMultiSelect(linksMsDropdown, data.domainCounts);
        const sortedDateCounts = Object.entries(data.dateCounts).sort((a, b) => b[0].localeCompare(a[0])).reduce((acc, [key, value]) => ({...acc, [key]: value }), {});
        populateMultiSelect(dateMsDropdown, sortedDateCounts);
    }
    
    function populateMultiSelect(dropdownEl, counts) {
        dropdownEl.innerHTML = '';
        const sortedItems = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        for (const [item, count] of sortedItems) {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${item}" data-group="${dropdownEl.id}"> ${item} <span class="item-count">${count}</span>`;
            dropdownEl.appendChild(label);
        }
    }
    
    /**
     * Applies all active filters and search term to the messages.
     */
    function applyFiltersAndSearch() {
        if (allMessages.length === 0) return;

        let results;

        // 1. Fuzzy Search
        if (filterState.searchTerm) {
            const fuseQuery = buildFuseQuery(filterState.searchTerm);
            results = fuse.search(fuseQuery).map(result => result.item);
        } else {
            results = [...allMessages];
        }

        // 2. Filter by selected items
        if (fromModeSelect.value === 'selected' && filterState.senders.length > 0) {
            results = results.filter(msg => filterState.senders.includes(msg.sender));
        }
        if (filesModeSelect.value === 'selected' && filterState.fileExts.length > 0) {
            results = results.filter(msg => msg.files.some(ext => filterState.fileExts.includes(ext)));
        } else if (filesModeSelect.value === 'not_file_related') {
            results = results.filter(msg => msg.files.length === 0);
        }
        if (linksModeSelect.value === 'selected' && filterState.domains.length > 0) {
            results = results.filter(msg => msg.links.some(domain => filterState.domains.includes(domain)));
        }
        if (dateModeSelect.value === 'selected' && filterState.dates.length > 0) {
            results = results.filter(msg => filterState.dates.includes(msg.date));
        }

        // 3. Filter by date range
        if (filterState.afterDate) {
            results = results.filter(msg => msg.timestamp >= filterState.afterDate);
        }
        if (filterState.beforeDate) {
            const beforeDateEnd = new Date(filterState.beforeDate);
            beforeDateEnd.setHours(23, 59, 59, 999);
            results = results.filter(msg => msg.timestamp <= beforeDateEnd);
        }

        // Sort final results by date, descending
        results.sort((a, b) => b.timestamp - a.timestamp);

        // NEW: Store results and reset pagination
        currentFilteredResults = results;
        renderedCount = 0;
        resultsContainer.innerHTML = ''; // Clear previous results

        renderResultsPage();
    }
    
    // NEW: Renders a "page" of results and handles the "Load More" button.
    function renderResultsPage() {
        const resultsToRender = currentFilteredResults.slice(renderedCount, renderedCount + RESULTS_PER_PAGE);

        if (renderedCount === 0 && resultsToRender.length === 0) {
             resultsInfo.textContent = 'No results found matching your criteria.';
             loadMoreBtn.style.display = 'none';
             return;
        }

        resultsToRender.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.dataset.messageId = msg.id;
            item.innerHTML = `
                <div class="meta"><span class="sender">${msg.sender}</span> - <span class="timestamp">${msg.timestamp.toLocaleString()}</span></div>
                <div class="content">${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}</div>
            `;
            resultsContainer.appendChild(item);
        });

        renderedCount += resultsToRender.length;
        
        resultsInfo.textContent = `Showing ${renderedCount} of ${currentFilteredResults.length} results.`;
        
        // Show or hide the "Load More" button
        if (renderedCount < currentFilteredResults.length) {
            loadMoreBtn.style.display = 'block';
        } else {
            loadMoreBtn.style.display = 'none';
        }
    }
    
    loadMoreBtn.addEventListener('click', renderResultsPage);

    // MODIFIED: Search input is now debounced
    const debouncedSearch = debounce(() => {
        filterState.searchTerm = searchInput.value;
        applyFiltersAndSearch();
    }, 300);
    searchInput.addEventListener('input', debouncedSearch);


    // --- All other functions (buildFuseQuery, renderFullChat, resetFilters, event handlers) remain the same ---
    // Make sure to keep the rest of your original script.js code from this point on.
    // I am omitting it here for brevity, but you need to include:
    // - buildFuseQuery()
    // - renderFullChat()
    // - resetFilters()
    // - All the multi-select setup and other event handlers.
    
    // (Pasting the remaining functions for completeness)

    function buildFuseQuery(query) {
        const andTerms = [], orTerms = [], notTerms = [], exactTerms = [];
        query = query.replace(/"([^"]+)"/g, (match, term) => {
            exactTerms.push({ content: `'${term}` });
            return '';
        });
        const tokens = query.split(/\s+/).filter(Boolean);
        let nextOp = null;
        for(let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.toUpperCase() === 'AND' || token.toUpperCase() === 'OR') {
                nextOp = token.toUpperCase();
                continue;
            }
            if (token.toUpperCase() === 'NOT') {
                const notTerm = tokens[++i];
                if(notTerm) notTerms.push({ content: `!${notTerm}`});
                continue;
            }
            if (nextOp === 'OR') orTerms.push({ content: token });
            else andTerms.push({ content: token });
            nextOp = null;
        }
        const fuseQuery = { $and: [] };
        if (andTerms.length > 0) fuseQuery.$and.push(...andTerms);
        if (exactTerms.length > 0) fuseQuery.$and.push(...exactTerms);
        if (notTerms.length > 0) fuseQuery.$and.push(...notTerms);
        if (orTerms.length > 0) fuseQuery.$and.push({ $or: orTerms });
        return fuseQuery.$and.length > 0 ? fuseQuery : { content: query };
    }

    function renderFullChat(highlightId) {
        fullChatContainer.innerHTML = '';
        const sortedMessages = [...allMessages].sort((a, b) => a.timestamp - b.timestamp);
        sortedMessages.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'chat-message';
            item.id = `full-chat-msg-${msg.id}`;
            if (msg.id === highlightId) item.classList.add('highlight');
            item.innerHTML = `
                <div class="sender-name">${msg.sender}</div>
                <div class="content">${msg.content.replace(/\n/g, '<br>')}</div>
                <div class="timestamp">${msg.timestamp.toLocaleString()}</div>
            `;
            fullChatContainer.appendChild(item);
        });
        fullChatView.classList.add('show');
        const highlightElement = document.getElementById(`full-chat-msg-${highlightId}`);
        if (highlightElement) {
            highlightElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function resetFilters() {
        filterState.senders = []; filterState.fileExts = []; filterState.domains = [];
        filterState.dates = []; filterState.afterDate = null; filterState.beforeDate = null;
        filterState.searchTerm = '';
        searchInput.value = ''; afterDateInput.value = ''; beforeDateInput.value = '';
        fromModeSelect.value = 'any';
        fromMsDropdown.querySelectorAll('input').forEach(c => c.checked = false);
        updateMultiSelectButton(fromMsButton, 'Select Senders...');
        filesModeSelect.value = 'not_file_related';
        filesMsDropdown.querySelectorAll('input').forEach(c => c.checked = false);
        updateMultiSelectButton(filesMsButton, 'Select File Types...');
        linksModeSelect.value = 'any';
        linksMsDropdown.querySelectorAll('input').forEach(c => c.checked = false);
        updateMultiSelectButton(linksMsButton, 'Select Domains...');
        dateModeSelect.value = 'any';
        dateMsDropdown.querySelectorAll('input').forEach(c => c.checked = false);
        updateMultiSelectButton(dateMsButton, 'Select Dates...');
        if(allMessages.length > 0) applyFiltersAndSearch();
    }
    
    resetFiltersBtn.addEventListener('click', resetFilters);
    afterDateInput.addEventListener('change', () => { filterState.afterDate = afterDateInput.value ? new Date(afterDateInput.value) : null; applyFiltersAndSearch(); });
    beforeDateInput.addEventListener('change', () => { filterState.beforeDate = beforeDateInput.value ? new Date(beforeDateInput.value) : null; applyFiltersAndSearch(); });

    function setupMultiSelect(button, dropdown, stateKey, modeSelect, defaultMode, selectedMode) {
        button.addEventListener('click', () => dropdown.classList.toggle('show'));
        dropdown.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                const selected = Array.from(dropdown.querySelectorAll('input:checked')).map(c => c.value);
                filterState[stateKey] = selected;
                if (selected.length > 0) {
                    modeSelect.value = selectedMode;
                    updateMultiSelectButton(button, `${selected.length} selected`);
                } else {
                    modeSelect.value = defaultMode;
                    updateMultiSelectButton(button, button.dataset.defaultText);
                }
                applyFiltersAndSearch();
            }
        });
        modeSelect.addEventListener('change', () => {
            if(modeSelect.value === defaultMode) {
                dropdown.querySelectorAll('input:checked').forEach(c => c.checked = false);
                filterState[stateKey] = [];
                updateMultiSelectButton(button, button.dataset.defaultText);
                applyFiltersAndSearch();
            }
        });
        button.dataset.defaultText = button.querySelector('span').textContent;
    }
    function updateMultiSelectButton(button, text) { button.querySelector('span').textContent = text; }
    document.addEventListener('click', (e) => { if (!e.target.closest('.multi-select-container')) { document.querySelectorAll('.multi-select-dropdown').forEach(d => d.classList.remove('show')); } });
    setupMultiSelect(fromMsButton, fromMsDropdown, 'senders', fromModeSelect, 'any', 'selected');
    setupMultiSelect(filesMsButton, filesMsDropdown, 'fileExts', filesModeSelect, 'not_file_related', 'selected');
    setupMultiSelect(linksMsButton, linksMsDropdown, 'domains', linksModeSelect, 'any', 'selected');
    setupMultiSelect(dateMsButton, dateMsDropdown, 'dates', dateModeSelect, 'any', 'selected');
    resultsContainer.addEventListener('click', (e) => { const resultItem = e.target.closest('.result-item'); if (resultItem) { const messageId = parseInt(resultItem.dataset.messageId); renderFullChat(messageId); } });
    closeFullChatBtn.addEventListener('click', () => { fullChatView.classList.remove('show'); });
    window.addEventListener('scroll', () => { const shouldShow = document.body.scrollTop > 100 || document.documentElement.scrollTop > 100; scrollToTopBtn.classList.toggle('show', shouldShow); donateBtn.classList.toggle('show', shouldShow); });
    scrollToTopBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
});
