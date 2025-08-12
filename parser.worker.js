// Overwrite parser.worker.js with this new version

// Import Fuse.js library directly into the worker
importScripts('https://cdn.jsdelivr.net/npm/fuse.js/dist/fuse.min.js');

let allMessages = [];
let fuse;

// --- Main Message Handler ---
self.onmessage = (e) => {
    const { type, payload } = e.data;
    if (type === 'parse') {
        parseAndIndex(payload.text);
    } else if (type === 'filter') {
        filterAndSearch(payload.filterState);
    }
};

// --- Parsing and Indexing Function ---
function parseAndIndex(text) {
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
    const dateTree = {}; // New hierarchical structure

    messages.forEach(msg => {
        // Files
        const fileMatch = msg.content.match(fileRegex);
        msg.files = [];
        if (fileMatch) {
            const fileName = fileMatch[1];
            const extension = fileName.split('.').pop().toLowerCase();
            if (extension !== fileName) {
                msg.files.push(extension);
                fileExtCounts[extension] = (fileExtCounts[extension] || 0) + 1;
            }
        }
        
        // Links
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

        // Counts
        senderCounts[msg.sender] = (senderCounts[msg.sender] || 0) + 1;

        // Build Date Tree
        const [year, month, day] = msg.date.split('-');
        if (!dateTree[year]) dateTree[year] = { count: 0, months: {} };
        if (!dateTree[year].months[month]) dateTree[year].months[month] = { count: 0, days: {} };
        if (!dateTree[year].months[month].days[day]) dateTree[year].months[month].days[day] = 0;
        
        dateTree[year].count++;
        dateTree[year].months[month].count++;
        dateTree[year].months[month].days[day]++;
    });

    allMessages = messages;
    
    // Initialize Fuse.js
    self.postMessage({ type: 'status', payload: 'Creating search index...' });
    const fuseOptions = { keys: ['content', 'sender'], includeScore: true, threshold: 0.4, useExtendedSearch: true };
    fuse = new Fuse(allMessages, fuseOptions);

    // Send all initial data to main thread
    self.postMessage({
        type: 'initialData',
        payload: {
            senderCounts,
            fileExtCounts,
            domainCounts,
            dateTree,
            totalMessages: allMessages.length
        }
    });
}

// --- Filtering and Searching Function ---
function filterAndSearch(filterState) {
    let results = [];

    // 1. Start with search or all messages
    if (filterState.searchTerm) {
        const fuseQuery = buildFuseQuery(filterState.searchTerm);
        results = fuse.search(fuseQuery).map(result => result.item);
    } else {
        results = [...allMessages];
    }
    
    // 2. Apply filters
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

    // Hierarchical Date Filter
    if (filterState.dates.length > 0) {
        results = results.filter(msg => {
            return filterState.dates.some(d => msg.date.startsWith(d));
        });
    }

    if (filterState.afterDate) {
        const afterTimestamp = new Date(filterState.afterDate).getTime();
        results = results.filter(msg => msg.timestamp.getTime() >= afterTimestamp);
    }
    if (filterState.beforeDate) {
        const beforeTimestamp = new Date(filterState.beforeDate).getTime() + 86400000; // end of day
        results = results.filter(msg => msg.timestamp.getTime() <= beforeTimestamp);
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    // Send filtered results back
    self.postMessage({ type: 'filterResults', payload: results });
}

// --- Helper Functions (inside worker) ---
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
        if (['AND', 'OR'].includes(token.toUpperCase())) { nextOp = token.toUpperCase(); continue; }
        if (token.toUpperCase() === 'NOT') { const notTerm = tokens[++i]; if(notTerm) notTerms.push({ content: `!${notTerm}`}); continue; }
        if (nextOp === 'OR') orTerms.push({ content: token }); else andTerms.push({ content: token });
        nextOp = null;
    }
    const fuseQuery = { $and: [] };
    if (andTerms.length) fuseQuery.$and.push(...andTerms);
    if (exactTerms.length) fuseQuery.$and.push(...exactTerms);
    if (notTerms.length) fuseQuery.$and.push(...notTerms);
    if (orTerms.length) fuseQuery.$and.push({ $or: orTerms });
    return fuseQuery.$and.length ? fuseQuery : { content: query };
}
