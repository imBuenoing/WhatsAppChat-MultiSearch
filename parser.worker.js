// This is the final, optimized worker. It has NO Fuse.js dependency.

let allMessages = [];

// --- Main Message Handler ---
self.onmessage = (e) => {
    const { type, payload } = e.data;
    if (type === 'parse') {
        parseFile(payload.text);
    } else if (type === 'filter') {
        filterAndSearch(payload);
    }
};

// --- Parsing Function ---
function parseFile(text) {
    self.postMessage({ type: 'status', payload: 'Parsing chat file...' });

    const lines = text.split('\n');
    const messages = [];
    const messageRegex = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2}:\d{2}\s?[APM]{2})\]\s(?:~\s)?([^:]+):\s([\s\S]*)/;
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
                date: timestamp.toISOString().split('T')[0],
                sender: sender.trim(),
                content: content.trim(),
            };
        } else if (currentMessage) {
            currentMessage.content += '\n' + line.trim();
        }
    }
    if (currentMessage) messages.push(currentMessage);

    self.postMessage({ type: 'status', payload: 'Analyzing content...' });

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const fileRegex = /<attached: (.*?)(?:>| as .*)/;
    const senderCounts = {}, fileExtCounts = {}, domainCounts = {};
    const dateTree = {};

    messages.forEach(msg => {
        const lowerCaseContent = msg.content.toLowerCase();
        msg.lowerCaseContent = lowerCaseContent; // Store for faster searching

        const fileMatch = lowerCaseContent.match(fileRegex);
        msg.files = [];
        if (fileMatch) {
            const fileName = fileMatch[1];
            const extension = fileName.split('.').pop();
            if (extension && extension !== fileName) {
                msg.files.push(extension);
                fileExtCounts[extension] = (fileExtCounts[extension] || 0) + 1;
            }
        }
        
        msg.links = [];
        const linkMatches = msg.content.match(urlRegex);
        if (linkMatches) {
            msg.links = linkMatches.map(url => {
                try {
                    const domain = new URL(url).hostname.replace('www.', '');
                    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
                    return domain;
                } catch (e) { return null; }
            }).filter(Boolean);
        }

        senderCounts[msg.sender] = (senderCounts[msg.sender] || 0) + 1;

        const [year, month, day] = msg.date.split('-');
        if (!dateTree[year]) dateTree[year] = { count: 0, months: {} };
        if (!dateTree[year].months[month]) dateTree[year].months[month] = { count: 0, days: {} };
        if (!dateTree[year].months[month].days[day]) dateTree[year].months[month].days[day] = 0;
        
        dateTree[year].count++;
        dateTree[year].months[month].count++;
        dateTree[year].months[month].days[day]++;
    });

    allMessages = messages;

    // We now send the full 'allMessages' array in the initial payload.
    self.postMessage({
        type: 'initialData',
        payload: {
            messages: allMessages, // ADD THIS LINE
            senderCounts,
            fileExtCounts,
            domainCounts,
            dateTree,
            totalMessages: allMessages.length
        }
    });
}

// --- High-Performance Filtering and Searching Function ---
function filterAndSearch(filterState) {
    let results = allMessages;

    // Apply simple, fast filters first
    if (filterState.fromMode === 'selected' && filterState.senders.length > 0) {
        const senderSet = new Set(filterState.senders);
        results = results.filter(msg => senderSet.has(msg.sender));
    }

    if (filterState.filesMode === 'selected' && filterState.fileExts.length > 0) {
        const fileExtSet = new Set(filterState.fileExts);
        results = results.filter(msg => msg.files.some(ext => fileExtSet.has(ext)));
    } else if (filterState.filesMode === 'not_file_related') {
        results = results.filter(msg => msg.files.length === 0);
    }
    
    if (filterState.linksMode === 'selected' && filterState.domains.length > 0) {
        const domainSet = new Set(filterState.domains);
        results = results.filter(msg => msg.links.some(domain => domainSet.has(domain)));
    }

    if (filterState.dates.length > 0) {
        results = results.filter(msg => filterState.dates.some(d => msg.date.startsWith(d)));
    }

    if (filterState.afterDate) {
        const afterTimestamp = new Date(filterState.afterDate).getTime();
        results = results.filter(msg => msg.timestamp.getTime() >= afterTimestamp);
    }
    if (filterState.beforeDate) {
        const beforeTimestamp = new Date(filterState.beforeDate).getTime() + 86400000; // end of day
        results = results.filter(msg => msg.timestamp.getTime() <= beforeTimestamp);
    }

    // Apply the text search last, on the already-reduced set of results
    if (filterState.searchTerm.trim() !== '') {
        const searchFn = buildSearchFunction(filterState.searchTerm);
        results = results.filter(msg => searchFn(msg.lowerCaseContent));
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    self.postMessage({ type: 'filterResults', payload: results });
}

// --- Lightweight Search Function Builder ---
function buildSearchFunction(query) {
    const lowerCaseQuery = query.toLowerCase();
    
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const exactPhrases = [];
    const withoutExacts = lowerCaseQuery.replace(/"([^"]+)"/g, (_, phrase) => {
        exactPhrases.push(escapeRegex(phrase));
        return '';
    });

    const notTerms = [];
    // --- THIS IS THE CORRECTED LINE ---
    const withoutNots = withoutExacts.replace(/not\s+(\w+)/g, (_, term) => {
        notTerms.push(escapeRegex(term));
        return '';
    });

    const tokens = withoutNots.trim().split(/\s+/).filter(Boolean);
    const andTerms = [];
    const orTerms = [];

    let nextIsOr = false;
    for (const token of tokens) {
        if (token === 'or') {
            nextIsOr = true;
            continue;
        }
        if (token === 'and') {
            nextIsOr = false;
            continue;
        }
        if (nextIsOr) {
            orTerms.push(escapeRegex(token));
            nextIsOr = false;
        } else {
            andTerms.push(escapeRegex(token));
        }
    }
    
    return (text) => {
        if (notTerms.length > 0) {
            for (const term of notTerms) {
                if (new RegExp(term, 'i').test(text)) return false;
            }
        }
        for (const phrase of exactPhrases) {
            if (!new RegExp(phrase, 'i').test(text)) return false;
        }
        for (const term of andTerms) {
            if (!new RegExp(term, 'i').test(text)) return false;
        }
        if (orTerms.length > 0) {
            if (!orTerms.some(term => new RegExp(term, 'i').test(text))) {
                return false;
            }
        }
        return true;
    };
}


// --- Helper Functions ---
function parseTimestamp(timestampStr) {
    const parts = timestampStr.match(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)\s([APM]{2})/);
    if (!parts) return new Date();
    let [_, month, day, year, hour, minute, second, ampm] = parts;
    if (year.length === 2) year = '20' + year;
    hour = parseInt(hour);
    if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
    else if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return new Date(year, month - 1, day, hour, parseInt(minute), parseInt(second));
}
