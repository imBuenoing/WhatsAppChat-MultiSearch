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

    /**
     * Parses the WhatsApp chat file content.
     * @param {string} text - The content of the .txt file.
     */
    function parseChatFile(text) {
        loadingSpinner.style.display = 'block';
        resultsInfo.textContent = 'Parsing chat file, please wait...';
        
        // Use a timeout to allow the UI to update before the heavy parsing task
        setTimeout(() => {
            const lines = text.split('\n');
            const messages = [];
            // Regex to match a new message line: [date, time] sender: message
            // Handles different date formats and the optional '~' before sender.
            const messageRegex = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2}:\d{2}\s?[APM]{2})\]\s(?:~\s)?([^:]+):\s([\s\S]*)/;
            // Link regex
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            // File attachment regex
            const fileRegex = /<attached: (.*?)(?:>| as .*)/;


            let currentMessage = null;
            let messageId = 0;

            for (const line of lines) {
                const match = line.match(messageRegex);
                if (match) {
                    if (currentMessage) messages.push(currentMessage);

                    const [_, timestampStr, sender, content] = match;
                    const timestamp = parseTimestamp(timestampStr);
                    
                    currentMessage = {
                        id: messageId++,
                        timestamp,
                        date: timestamp.toISOString().split('T')[0], // YYYY-MM-DD for easy filtering
                        sender: sender.trim(),
                        content: content.trim(),
                        files: [],
                        links: []
                    };
                } else if (currentMessage) {
                    // This is a continuation of the previous message
                    currentMessage.content += '\n' + line.trim();
                }
            }
            if (currentMessage) messages.push(currentMessage);
            
            // Post-process to extract links and files from content
            messages.forEach(msg => {
                const fileMatch = msg.content.match(fileRegex);
                if (fileMatch) {
                    const fileName = fileMatch[1];
                    const extension = fileName.split('.').pop().toLowerCase();
                    if(extension !== fileName) msg.files.push(extension);
                }

                const linkMatches = msg.content.match(urlRegex);
                if (linkMatches) {
                    msg.links = linkMatches.map(url => {
                        try {
                            return new URL(url).hostname.replace('www.', '');
                        } catch (e) {
                            return null;
                        }
                    }).filter(Boolean); // Filter out any invalid URLs
                }
            });
            
            allMessages = messages;
            initializeFuse();
            populateFilters();
            applyFiltersAndSearch();
            loadingSpinner.style.display = 'none';
        }, 10);
    }

    /**
     * Parses WhatsApp's timestamp format into a Date object.
     * @param {string} timestampStr - e.g., "8/15/22, 10:30:45 PM"
     * @returns {Date}
     */
    function parseTimestamp(timestampStr) {
        // WhatsApp format is tricky (M/D/YY or D/M/YY). We'll assume M/D/YY common in US exports.
        // A more robust solution might need user input for date format.
        const parts = timestampStr.match(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)\s([APM]{2})/);
        if (!parts) return new Date(); // Fallback
        
        let [_, month, day, year, hour, minute, second, ampm] = parts;
        
        if (year.length === 2) year = '20' + year;
        
        hour = parseInt(hour);
        if (ampm.toUpperCase() === 'PM' && hour < 12) {
            hour += 12;
        } else if (ampm.toUpperCase() === 'AM' && hour === 12) {
            hour = 0;
        }

        return new Date(year, month - 1, day, hour, parseInt(minute), parseInt(second));
    }


    /**
     * Initializes the Fuse.js fuzzy search instance.
     */
    function initializeFuse() {
        const options = {
            keys: ['content', 'sender'],
            includeScore: true,
            threshold: 0.4, // Adjust for more/less fuzziness
            useExtendedSearch: true,
        };
        fuse = new Fuse(allMessages, options);
    }
    
    /**
     * Populates filter dropdowns based on parsed chat data.
     */
    function populateFilters() {
        const senderCounts = {};
        const fileExtCounts = {};
        const domainCounts = {};
        const dateCounts = {};

        allMessages.forEach(msg => {
            senderCounts[msg.sender] = (senderCounts[msg.sender] || 0) + 1;
            msg.files.forEach(ext => {
                fileExtCounts[ext] = (fileExtCounts[ext] || 0) + 1;
            });
            msg.links.forEach(domain => {
                domainCounts[domain] = (domainCounts[domain] || 0) + 1;
            });
            dateCounts[msg.date] = (dateCounts[msg.date] || 0) + 1;
        });
        
        populateMultiSelect(fromMsDropdown, senderCounts);
        populateMultiSelect(filesMsDropdown, fileExtCounts);
        populateMultiSelect(linksMsDropdown, domainCounts);
        // Sort dates descending for the dropdown
        const sortedDateCounts = Object.entries(dateCounts).sort((a, b) => b[0].localeCompare(a[0])).reduce((acc, [key, value]) => ({...acc, [key]: value }), {});
        populateMultiSelect(dateMsDropdown, sortedDateCounts);
    }
    
    /**
     * Generic function to populate a multi-select dropdown.
     * @param {HTMLElement} dropdownEl - The dropdown element to populate.
     * @param {object} counts - An object of items and their counts.
     */
    function populateMultiSelect(dropdownEl, counts) {
        dropdownEl.innerHTML = '';
        const sortedItems = Object.entries(counts).sort((a, b) => b[1] - a[1]); // Sort by count descending

        for (const [item, count] of sortedItems) {
            const label = document.createElement('label');
            label.innerHTML = `
                <input type="checkbox" value="${item}" data-group="${dropdownEl.id}">
                ${item}
                <span class="item-count">${count}</span>
            `;
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
            // Advanced search logic
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
            beforeDateEnd.setHours(23, 59, 59, 999); // Include the whole day
            results = results.filter(msg => msg.timestamp <= beforeDateEnd);
        }

        // Sort final results by date, descending
        results.sort((a, b) => b.timestamp - a.timestamp);

        renderResults(results);
    }

    /**
     * Builds a Fuse.js extended search query from a user's string.
     * @param {string} query - The search string.
     * @returns {object} A Fuse.js query object.
     */
    function buildFuseQuery(query) {
        const andTerms = [];
        const orTerms = [];
        const notTerms = [];
        const exactTerms = [];

        // Extract exact phrases
        query = query.replace(/"([^"]+)"/g, (match, term) => {
            exactTerms.push({ content: `'${term}` }); // Use ' for exact match in Fuse
            return '';
        });

        const tokens = query.split(/\s+/).filter(Boolean);
        let nextOp = null; // 'AND', 'OR', 'NOT'
        
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

            if (nextOp === 'OR') {
                orTerms.push({ content: token });
            } else { // Default is AND
                andTerms.push({ content: token });
            }
            nextOp = null;
        }

        const fuseQuery = { $and: [] };
        if (andTerms.length > 0) fuseQuery.$and.push(...andTerms);
        if (exactTerms.length > 0) fuseQuery.$and.push(...exactTerms);
        if (notTerms.length > 0) fuseQuery.$and.push(...notTerms);
        if (orTerms.length > 0) fuseQuery.$and.push({ $or: orTerms });

        return fuseQuery.$and.length > 0 ? fuseQuery : { content: query }; // Fallback to simple search
    }


    /**
     * Renders the search results in the main content area.
     * @param {Array<object>} messages - The messages to display.
     */
    function renderResults(messages) {
        resultsContainer.innerHTML = '';
        if (messages.length > 0) {
            resultsInfo.textContent = `Showing ${messages.length} results.`;
            messages.forEach(msg => {
                const item = document.createElement('div');
                item.className = 'result-item';
                item.dataset.messageId = msg.id;
                item.innerHTML = `
                    <div class="meta">
                        <span class="sender">${msg.sender}</span> - 
                        <span class="timestamp">${msg.timestamp.toLocaleString()}</span>
                    </div>
                    <div class="content">${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}</div>
                `;
                resultsContainer.appendChild(item);
            });
        } else {
            resultsInfo.textContent = 'No results found matching your criteria.';
        }
    }
    
    /**
     * Renders the full chat history in the side panel.
     * @param {number} highlightId - The ID of the message to highlight and scroll to.
     */
    function renderFullChat(highlightId) {
        fullChatContainer.innerHTML = '';
        // Sort ascending for conversation flow
        const sortedMessages = [...allMessages].sort((a, b) => a.timestamp - b.timestamp);

        sortedMessages.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'chat-message';
            item.id = `full-chat-msg-${msg.id}`;
            if (msg.id === highlightId) {
                item.classList.add('highlight');
            }
            item.innerHTML = `
                <div class="sender-name">${msg.sender}</div>
                <div class="content">${msg.content.replace(/\n/g, '<br>')}</div>
                <div class="timestamp">${msg.timestamp.toLocaleString()}</div>
            `;
            fullChatContainer.appendChild(item);
        });

        // Show the panel and scroll to the highlighted message
        fullChatView.classList.add('show');
        const highlightElement = document.getElementById(`full-chat-msg-${highlightId}`);
        if (highlightElement) {
            highlightElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    /**
     * Resets all filters to their default state.
     */
    function resetFilters() {
        // Reset state object
        filterState.senders = [];
        filterState.fileExts = [];
        filterState.domains = [];
        filterState.dates = [];
        filterState.afterDate = null;
        filterState.beforeDate = null;
        filterState.searchTerm = '';

        // Reset UI elements
        searchInput.value = '';
        afterDateInput.value = '';
        beforeDateInput.value = '';

        // Reset "From" filter
        fromModeSelect.value = 'any';
        fromMsDropdown.querySelectorAll('input').forEach(c => c.checked = false);
        updateMultiSelectButton(fromMsButton, 'Select Senders...');

        // Reset "Files" filter
        filesModeSelect.value = 'not_file_related';
        filesMsDropdown.querySelectorAll('input').forEach(c => c.checked = false);
        updateMultiSelectButton(filesMsButton, 'Select File Types...');

        // Reset "Links" filter
        linksModeSelect.value = 'any';
        linksMsDropdown.querySelectorAll('input').forEach(c => c.checked = false);
        updateMultiSelectButton(linksMsButton, 'Select Domains...');

        // Reset "Date" filter
        dateModeSelect.value = 'any';
        dateMsDropdown.querySelectorAll('input').forEach(c => c.checked = false);
        updateMultiSelectButton(dateMsButton, 'Select Dates...');
        
        applyFiltersAndSearch();
    }


    // --- Event Handlers ---

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            resetFilters(); // Reset everything for new file
            parseChatFile(event.target.result);
        };
        reader.readAsText(file);
    });

    searchInput.addEventListener('input', () => {
        filterState.searchTerm = searchInput.value;
        applyFiltersAndSearch();
    });

    resetFiltersBtn.addEventListener('click', resetFilters);

    // Date Range Filter Handlers
    afterDateInput.addEventListener('change', () => {
        filterState.afterDate = afterDateInput.value ? new Date(afterDateInput.value) : null;
        applyFiltersAndSearch();
    });
    beforeDateInput.addEventListener('change', () => {
        filterState.beforeDate = beforeDateInput.value ? new Date(beforeDateInput.value) : null;
        applyFiltersAndSearch();
    });

    // --- Multi-Select Dropdown Logic ---
    function setupMultiSelect(button, dropdown, stateKey, modeSelect, defaultMode, selectedMode) {
        button.addEventListener('click', () => {
            dropdown.classList.toggle('show');
        });

        dropdown.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                const selected = Array.from(dropdown.querySelectorAll('input:checked')).map(c => c.value);
                filterState[stateKey] = selected;

                // Behavior: If user selects items, auto-switch mode to "Selected"
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
            // Behavior: If user changes mode to "Any"/"Not File", clear selections
            if(modeSelect.value === defaultMode) {
                dropdown.querySelectorAll('input:checked').forEach(c => c.checked = false);
                filterState[stateKey] = [];
                updateMultiSelectButton(button, button.dataset.defaultText);
                applyFiltersAndSearch();
            }
        });

        // Store default text
        button.dataset.defaultText = button.querySelector('span').textContent;
    }

    function updateMultiSelectButton(button, text) {
        button.querySelector('span').textContent = text;
    }
    
    // Close dropdowns if clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.multi-select-container')) {
            document.querySelectorAll('.multi-select-dropdown').forEach(d => d.classList.remove('show'));
        }
    });

    // Initialize all multi-selects
    setupMultiSelect(fromMsButton, fromMsDropdown, 'senders', fromModeSelect, 'any', 'selected');
    setupMultiSelect(filesMsButton, filesMsDropdown, 'fileExts', filesModeSelect, 'not_file_related', 'selected');
    setupMultiSelect(linksMsButton, linksMsDropdown, 'domains', linksModeSelect, 'any', 'selected');
    setupMultiSelect(dateMsButton, dateMsDropdown, 'dates', dateModeSelect, 'any', 'selected');

    // --- Full Chat View Handlers ---
    resultsContainer.addEventListener('click', (e) => {
        const resultItem = e.target.closest('.result-item');
        if (resultItem) {
            const messageId = parseInt(resultItem.dataset.messageId);
            renderFullChat(messageId);
        }
    });

    closeFullChatBtn.addEventListener('click', () => {
        fullChatView.classList.remove('show');
    });

    // --- Floating Button Handlers ---
    window.addEventListener('scroll', () => {
        const shouldShow = document.body.scrollTop > 100 || document.documentElement.scrollTop > 100;
        scrollToTopBtn.classList.toggle('show', shouldShow);
        donateBtn.classList.toggle('show', shouldShow);
    });

    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});
