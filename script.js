document.addEventListener('DOMContentLoaded', () => {
    const chatFile = document.getElementById('chatFile');
    const loadingDiv = document.getElementById('loading');
    const searchBox = document.getElementById('searchBox');
    const searchResultsDiv = document.getElementById('searchResults');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const tooltipTrigger = document.querySelector('.tooltip-trigger');
    const tooltip = document.getElementById('tooltip');
    const senderFilter = document.getElementById('senderFilter');
    const senderFilterType = document.getElementById('senderFilterType');
    const fileFilter = document.getElementById('fileFilter');
    const fileFilterType = document.getElementById('fileFilterType');
    const linkFilter = document.getElementById('linkFilter');
    const linkFilterType = document.getElementById('linkFilterType');
     const dateFilter = document.getElementById('dateFilter');
    const dateFilterType = document.getElementById('dateFilterType');
    const beforeDateInput = document.getElementById('beforeDate');
    const afterDateInput = document.getElementById('afterDate');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const domainFilterDiv = document.querySelector('.domain-filter');
    const chatHistoryContent = document.getElementById('chatHistoryContent');
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    const donateBtn = document.getElementById('donateBtn');


    let chatData = [];
    let filteredChatData = [];
    let currentSearchTerm = '';
     const itemsPerPage = 20;
     let currentPage = 1;
     let fuse;
    let isProcessing = false; // Flag to prevent concurrent processing
     let fileReader;



        // Function to extract date string in MMM YYYY format
    function formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleString('default', { month: 'short', year: 'numeric' });
    }


      // Function to group messages by conversation
        function groupMessagesByConversation(messages) {
            const conversations = [];
            let currentConversation = [];
             let lastSender = null;
             let lastTimestamp = null;

              messages.forEach((message, index) => {
                  const timeDiff = lastTimestamp ? Math.abs(new Date(message.timestamp) - new Date(lastTimestamp)) : null;

                // Start a new conversation if there is a large time gap or different sender
                if(index === 0 ||  (lastSender && message.sender !== lastSender) || (timeDiff && timeDiff > 10 * 60 * 1000) ) { // 10 minutes gap
                    if(currentConversation.length > 0){
                           conversations.push(currentConversation);
                    }
                   currentConversation = [];
                }
                currentConversation.push(message);
                lastSender = message.sender;
                  lastTimestamp = message.timestamp;
            });
            if (currentConversation.length > 0) {
                    conversations.push(currentConversation);
                }


            return conversations;
        }

    // Function to extract senders, files, links and dates from chat messages
        function extractChatInfo(messages) {
           const senders = new Map();
           const files = new Map();
           const links = new Map();
            const dates = new Map();


            messages.forEach(message => {

                // Extract senders
                senders.set(message.sender, (senders.get(message.sender) || 0) + 1);

                // Extract file extensions
               const fileRegex = /\.(jpg|jpeg|png|gif|mp4|mov|pdf|docx|xlsx|pptx|zip|rar)$/gi;
               let match;
                  while ((match = fileRegex.exec(message.text)) !== null) {
                        const ext = match[0].toLowerCase();
                        files.set(ext, (files.get(ext) || 0) + 1);
                   }

                 // Extract links and their domain
               const urlRegex = /(https?:\/\/[^\s]+)/g;
                let urlMatch;
                while ((urlMatch = urlRegex.exec(message.text)) !== null) {
                    try {
                        const url = new URL(urlMatch[0]);
                          const domain = url.hostname;
                          links.set(domain, (links.get(domain) || 0) + 1);
                    } catch (error) {
                        console.error('Invalid URL:', urlMatch[0], error);
                    }

                }

                // Extract date
                  const date = formatDate(message.timestamp)
                 dates.set(date, (dates.get(date) || 0) +1 );


            });

               return {
                senders: Array.from(senders).sort(([, countA], [, countB]) => countB - countA),
                files: Array.from(files).sort(([, countA], [, countB]) => countB - countA),
                 links: Array.from(links).sort(([, countA], [, countB]) => countB - countA),
                dates: Array.from(dates).sort(([, countA], [, countB]) => countB - countA)
            };
        }
    // Function to display filter options
    function displayFilterOptions(filterElement, options) {
        filterElement.innerHTML = '';
        options.forEach(([value, count]) => {
            const option = document.createElement('option');
            option.value = value;
            option.text = `${value} (${count})`;
            filterElement.appendChild(option);
        });

    }

     function createDomainFilters(domains) {
            domainFilterDiv.innerHTML = '';

             domains.forEach(([domain, count]) => {
                const label = document.createElement('label');
                 const input = document.createElement('input');
                input.type = 'checkbox';
                input.value = domain;
                 input.id = `domain-${domain}`; // Unique ID for label association
                  label.appendChild(input);
                  const textSpan = document.createElement('span');
                 textSpan.textContent = `${domain} (${count})`;
                  label.appendChild(textSpan);
                domainFilterDiv.appendChild(label);
            });
        }


      function parseChat(text) {
         const messageRegex = /^\[(.*?)\]\s(.*?):\s(.*?)$/gm;
          const messages = [];
          let match;

            while ((match = messageRegex.exec(text)) !== null) {
               messages.push({
                timestamp: match[1],
                sender: match[2].trim(),
                text: match[3].trim()
            });
          }
        return messages;
        }
     // Function to process file in chunks
       function processFile(file) {
        if (isProcessing) {
            console.log('already processing');
            return;
           }
        isProcessing = true;
         loadingDiv.textContent = 'Loading...';
        chatData = []; // Reset chat data

        fileReader = new FileReader();
           let lastIndex = 0;
           const chunkSize = 500000; // 500KB chunk size

            fileReader.onload = function (event) {
                const chunk = event.target.result;
                   const messages = parseChat(chunk);
                    chatData.push(...messages);
                lastIndex += chunk.length;
                if (lastIndex < file.size) {
                     readChunk(lastIndex);
                } else {

                     const chatInfo = extractChatInfo(chatData);
                       displayFilterOptions(senderFilter, chatInfo.senders);
                     displayFilterOptions(fileFilter, chatInfo.files);
                     displayFilterOptions(linkFilter, chatInfo.links);
                     displayFilterOptions(dateFilter, chatInfo.dates);
                    createDomainFilters(chatInfo.links)

                        filteredChatData = [...chatData];
                       displayResults(filteredChatData);
                        displayFullChatHistory();

                    loadingDiv.textContent = 'File Loaded';
                    isProcessing = false;
                       fileReader = null;


                 }
            };

            fileReader.onerror = function (event) {
             loadingDiv.textContent = 'Error loading file.';
                console.error('Error reading file:', event);
                isProcessing = false;
                   fileReader = null;
            };

             function readChunk(index) {
                    const blob = file.slice(index, index + chunkSize);
                      fileReader.readAsText(blob);
             }

              readChunk(lastIndex);

    }


    // Function to handle file upload
    chatFile.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) {
             loadingDiv.textContent = 'No file selected.';
                return;
          }

         processFile(file);

    });


   function setupFuse() {
          if(chatData.length > 0){
        fuse = new Fuse(chatData, {
            keys: ['text', 'sender'],
            includeMatches: true,
            threshold: 0.3 // Adjust threshold as needed

        });
        }
    }


    // Function to filter messages based on selected options
        function applyFilters() {

             let filteredResults = [...chatData];
            // Sender Filter
             if(senderFilterType.value === 'selected' && senderFilter.selectedOptions.length > 0 ){
                 const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
                    filteredResults = filteredResults.filter(message => selectedSenders.includes(message.sender));
             }
              // File Filter
             if(fileFilterType.value === 'selected' && fileFilter.selectedOptions.length > 0){
                 const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
                   filteredResults = filteredResults.filter(message =>
                       selectedFiles.some(fileExt => message.text.toLowerCase().includes(fileExt)));
            }
              // Link filter
            if (linkFilterType.value === 'selected' && linkFilter.selectedOptions.length > 0) {
                 const selectedDomains = Array.from(linkFilter.selectedOptions).map(option => option.value);
               filteredResults = filteredResults.filter(message =>
                 selectedDomains.some(domain => {
                      try{
                           const urlRegex = /(https?:\/\/[^\s]+)/g;
                             let match;
                         while((match = urlRegex.exec(message.text)) !== null){
                           const url = new URL(match[0]);
                            if(url.hostname.includes(domain)){
                                 return true;
                              }
                           }
                           return false;


                      }catch(error){
                           return false;

                         }
                } )
            );
             }else if(linkFilterType.value === 'selected' && domainFilterDiv.querySelectorAll('input[type="checkbox"]:checked').length > 0){
                    const selectedDomains = Array.from(domainFilterDiv.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => checkbox.value);

                    filteredResults = filteredResults.filter(message =>
                        selectedDomains.some(domain => {
                            try {
                                const urlRegex = /(https?:\/\/[^\s]+)/g;
                                let match;
                                while((match = urlRegex.exec(message.text)) !== null){
                                    const url = new URL(match[0]);
                                    if(url.hostname.includes(domain)){
                                          return true;
                                    }
                                }
                                return false;


                            } catch(error) {
                                return false;

                            }
                        })
                    );

            }


            // Date Filter
              if(dateFilterType.value === 'selected' && dateFilter.selectedOptions.length > 0 ){
                  const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);

                    filteredResults = filteredResults.filter(message => {
                           const messageDate = formatDate(message.timestamp)
                          return selectedDates.includes(messageDate);
                     });
              }


                 // Date Range filter
             const beforeDate = beforeDateInput.value ? new Date(beforeDateInput.value) : null;
               const afterDate = afterDateInput.value ? new Date(afterDateInput.value) : null;

              if (beforeDate) {
                filteredResults = filteredResults.filter(message => new Date(message.timestamp) <= beforeDate);
                }
              if (afterDate) {
                  filteredResults = filteredResults.filter(message => new Date(message.timestamp) >= afterDate);
              }
             filteredChatData =  filteredResults;
             currentPage = 1;
             displayResults(filteredChatData);
        }

    // Event listeners for filter dropdowns
      senderFilterType.addEventListener('change', () => {
          if (senderFilterType.value === 'any') {
                senderFilter.value = '';
           }
        applyFilters();
      });

      senderFilter.addEventListener('change', () => {
            if(senderFilter.selectedOptions.length > 0 && senderFilterType.value != 'selected'){
                  senderFilterType.value = 'selected';
            } else if(senderFilter.selectedOptions.length === 0){
                senderFilterType.value = 'any';
            }
            applyFilters();
      });
     fileFilterType.addEventListener('change', () => {
       if (fileFilterType.value === 'notFile') {
                fileFilter.value = '';
           }
       applyFilters();

     });
    fileFilter.addEventListener('change', () => {
         if(fileFilter.selectedOptions.length > 0 && fileFilterType.value != 'selected'){
                  fileFilterType.value = 'selected';
            }else if(fileFilter.selectedOptions.length === 0){
                  fileFilterType.value = 'notFile';
            }
          applyFilters();
    });
     linkFilterType.addEventListener('change', () => {
         if(linkFilterType.value === 'any'){
             linkFilter.value = '';
         }
         applyFilters();
     });
    linkFilter.addEventListener('change', () => {
           if(linkFilter.selectedOptions.length > 0 && linkFilterType.value != 'selected'){
                  linkFilterType.value = 'selected';
            }else if(linkFilter.selectedOptions.length === 0){
                  linkFilterType.value = 'any';
            }
        applyFilters();
    });
     domainFilterDiv.addEventListener('change', () =>{
            if(linkFilterType.value === 'any'){
               linkFilterType.value = 'selected';
            }

          applyFilters();
     })
      dateFilterType.addEventListener('change', () => {
          if (dateFilterType.value === 'any') {
                dateFilter.value = '';
           }
          applyFilters();
      });
       dateFilter.addEventListener('change', () => {
            if(dateFilter.selectedOptions.length > 0 && dateFilterType.value != 'selected'){
                  dateFilterType.value = 'selected';
             }else if (dateFilter.selectedOptions.length === 0){
                 dateFilterType.value = 'any';
             }
            applyFilters();
      });
    beforeDateInput.addEventListener('change', applyFilters);
    afterDateInput.addEventListener('change', applyFilters);

       // Reset filters
    resetFiltersBtn.addEventListener('click', () => {
        senderFilterType.value = 'any';
        senderFilter.value = '';
        fileFilterType.value = 'notFile';
        fileFilter.value = '';
        linkFilterType.value = 'any';
        linkFilter.value = '';
        dateFilterType.value = 'any';
        dateFilter.value = '';
         beforeDateInput.value = '';
        afterDateInput.value = '';
        domainFilterDiv.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
       filteredChatData = [...chatData];
        currentPage = 1;
        displayResults(filteredChatData);
           displayFullChatHistory();
    });


    // Function to perform search
       const debouncedSearch = debounce(performSearch, 300);
    function performSearch() {

        const searchTerm = searchBox.value.trim();
            currentSearchTerm = searchTerm;
         if (searchTerm) {
            if(!fuse){
              setupFuse();
            }

              const searchResult = fuse.search(searchTerm);
            const matchedMessages = searchResult.map(result => result.item);


            const filteredSearchResults = applyFiltersToSearchResults(matchedMessages);

           displayResults(filteredSearchResults);
         } else {
           applyFilters();

         }
    }


        function applyFiltersToSearchResults(searchResults) {

             let filteredResults = [...searchResults];
            // Sender Filter
             if(senderFilterType.value === 'selected' && senderFilter.selectedOptions.length > 0 ){
                 const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
                    filteredResults = filteredResults.filter(message => selectedSenders.includes(message.sender));
             }
              // File Filter
             if(fileFilterType.value === 'selected' && fileFilter.selectedOptions.length > 0){
                 const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
                   filteredResults = filteredResults.filter(message =>
                       selectedFiles.some(fileExt => message.text.toLowerCase().includes(fileExt)));
            }
               // Link filter
               if (linkFilterType.value === 'selected' && linkFilter.selectedOptions.length > 0) {
                 const selectedDomains = Array.from(linkFilter.selectedOptions).map(option => option.value);
               filteredResults = filteredResults.filter(message =>
                 selectedDomains.some(domain => {
                      try{
                           const urlRegex = /(https?:\/\/[^\s]+)/g;
                             let match;
                         while((match = urlRegex.exec(message.text)) !== null){
                           const url = new URL(match[0]);
                            if(url.hostname.includes(domain)){
                                 return true;
                              }
                           }
                           return false;


                      }catch(error){
                           return false;

                         }
                } )
            );
             } else if(linkFilterType.value === 'selected' && domainFilterDiv.querySelectorAll('input[type="checkbox"]:checked').length > 0){
                const selectedDomains = Array.from(domainFilterDiv.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => checkbox.value);
                    filteredResults = filteredResults.filter(message =>
                        selectedDomains.some(domain => {
                            try {
                                const urlRegex = /(https?:\/\/[^\s]+)/g;
                                let match;
                                while((match = urlRegex.exec(message.text)) !== null){
                                    const url = new URL(match[0]);
                                    if(url.hostname.includes(domain)){
                                        return true;
                                    }
                                }
                                return false;


                            } catch(error) {
                                return false;
                            }
                        })
                    );

            }

            // Date Filter
              if(dateFilterType.value === 'selected' && dateFilter.selectedOptions.length > 0 ){
                  const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
                    filteredResults = filteredResults.filter(message => {
                         const messageDate = formatDate(message.timestamp)
                          return selectedDates.includes(messageDate);
                     });
              }


                 // Date Range filter
             const beforeDate = beforeDateInput.value ? new Date(beforeDateInput.value) : null;
               const afterDate = afterDateInput.value ? new Date(afterDateInput.value) : null;

              if (beforeDate) {
                filteredResults = filteredResults.filter(message => new Date(message.timestamp) <= beforeDate);
                }
              if (afterDate) {
                  filteredResults = filteredResults.filter(message => new Date(message.timestamp) >= afterDate);
              }


               return filteredResults
        }
    // Event listener for search input
    searchBox.addEventListener('input', () => {
           currentPage = 1;
           debouncedSearch();
    });


    // Function to display search results
    function displayResults(messages) {
         searchResultsDiv.innerHTML = '';
        searchResultsDiv.classList.remove('hidden');


           const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
             const paginatedMessages = messages.slice(startIndex, endIndex);


           if (paginatedMessages.length === 0) {
             const noResult = document.createElement('div');
            noResult.textContent = 'No results found.';
              searchResultsDiv.appendChild(noResult);
            loadMoreBtn.classList.add('hidden');

                return;
           }


          const conversations = groupMessagesByConversation(paginatedMessages);
          const fragment = document.createDocumentFragment(); // document fragment to batch dom changes


            conversations.forEach(conversation => {
                 const firstMessage = conversation[0];
                 const resultItem = document.createElement('div');
                resultItem.classList.add('result-item');
                  resultItem.textContent = `[${firstMessage.timestamp}] ${firstMessage.sender}: ${firstMessage.text}`;
                 resultItem.addEventListener('click', () => expandConversation(conversation, firstMessage.timestamp));
               fragment.appendChild(resultItem);
            });

             searchResultsDiv.appendChild(fragment);


            if (messages.length > endIndex) {
                 loadMoreBtn.classList.remove('hidden');
             } else {
                loadMoreBtn.classList.add('hidden');
            }


        }

          loadMoreBtn.addEventListener('click', () => {
           currentPage++;
            displayResults(filteredChatData);
       });
       // Function to expand a conversation
    function expandConversation(conversation, selectedTimestamp) {


           // Scroll to the selected message
         const selectedMessageElement = document.getElementById(`message-${selectedTimestamp.replace(/[\s:,]/g, '-')}`);
             if(selectedMessageElement){
            selectedMessageElement.scrollIntoView({
             behavior: 'smooth',
            block: 'start'
           });
         }

    }

       // Function to display the full chat history
        function displayFullChatHistory(){
             chatHistoryContent.innerHTML = '';
           if(chatData.length === 0 ) return;
            const fragment = document.createDocumentFragment(); // document fragment to batch dom changes
              chatData.forEach(message => {
                  const messageDiv = document.createElement('div');
                 messageDiv.classList.add('conversation-message');
                 messageDiv.textContent = `[${message.timestamp}] ${message.sender}: ${message.text}`;
                  messageDiv.id = `message-${message.timestamp.replace(/[\s:,]/g, '-')}`
                    fragment.appendChild(messageDiv);
             });
            chatHistoryContent.appendChild(fragment);
             chatHistoryContent.scrollTop = chatHistoryContent.scrollHeight;
        }
   // Tooltip logic
      tooltipTrigger.addEventListener('click', (event) => {
        tooltip.classList.toggle('hidden');
         event.stopPropagation();
    });
     document.addEventListener('click', (event) => {
        if(!event.target.closest('.search-container')){
             tooltip.classList.add('hidden');
        }
     });
    // Scroll to top logic
    scrollToTopBtn.addEventListener('click', () => {
       window.scrollTo({ top: 0, behavior: 'smooth' });
     });

    // Donate button logic
    donateBtn.addEventListener('click', () => {
       window.open('https://example.com/donate', '_blank');
    });

   // Debounce function
    function debounce(func, delay) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

});
