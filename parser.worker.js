// This script runs in a separate thread and will not block the UI.

/**
 * Parses WhatsApp's timestamp format into a Date object.
 * @param {string} timestampStr - e.g., "8/15/22, 10:30:45 PM"
 * @returns {Date}
 */
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

/**
 * The main parsing function, now inside the worker.
 * @param {string} text - The content of the .txt file.
 */
function parseChatFile(text) {
    // Notify the main thread that parsing has started.
    self.postMessage({ type: 'status', data: 'Parsing chat file...' });

    const lines = text.split('\n');
    const messages = [];
    const messageRegex = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2}:\d{2}\s?[APM]{2})\]\s(?:~\s)?([^:]+):\s([\s\S]*)/;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
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
                date: timestamp.toISOString().split('T')[0],
                sender: sender.trim(),
                content: content.trim(),
                files: [],
                links: []
            };
        } else if (currentMessage) {
            currentMessage.content += '\n' + line.trim();
        }
    }
    if (currentMessage) messages.push(currentMessage);

    // Notify main thread about progress before heavy post-processing.
    self.postMessage({ type: 'status', data: 'Extracting files and links...' });

    // Pre-calculate filter data while iterating once.
    const senderCounts = {};
    const fileExtCounts = {};
    const domainCounts = {};
    const dateCounts = {};

    messages.forEach(msg => {
        // Extract files
        const fileMatch = msg.content.match(fileRegex);
        if (fileMatch) {
            const fileName = fileMatch[1];
            const extension = fileName.split('.').pop().toLowerCase();
            if (extension !== fileName) {
                msg.files.push(extension);
                fileExtCounts[extension] = (fileExtCounts[extension] || 0) + 1;
            }
        }
        
        // Extract links
        const linkMatches = msg.content.match(urlRegex);
        if (linkMatches) {
            msg.links = linkMatches.map(url => {
                try {
                    const domain = new URL(url).hostname.replace('www.', '');
                    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
                    return domain;
                } catch (e) {
                    return null;
                }
            }).filter(Boolean);
        }

        // Aggregate counts
        senderCounts[msg.sender] = (senderCounts[msg.sender] || 0) + 1;
        dateCounts[msg.date] = (dateCounts[msg.date] || 0) + 1;
    });

    // Send all processed data back to the main thread in one go.
    self.postMessage({
        type: 'result',
        data: {
            messages,
            senderCounts,
            fileExtCounts,
            domainCounts,
            dateCounts
        }
    });
}


// Listen for messages from the main thread
self.onmessage = (e) => {
    if (e.data.type === 'parse') {
        parseChatFile(e.data.text);
    }
};
