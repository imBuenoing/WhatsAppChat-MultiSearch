document.addEventListener('DOMContentLoaded', () => {
     const tooltipTrigger = document.querySelector('.tooltip-trigger');
    const tooltip = document.getElementById('tooltip');
    document.addEventListener('click', (event) => {
        if (event.target !== tooltipTrigger && !tooltip.contains(event.target)) {
            tooltip.classList.add('hidden');
        }
    });


   tooltipTrigger.addEventListener('click', () => {
    tooltip.classList.toggle('hidden');
});

    const chatFile = document.getElementById('chatFile');
    const loadingDiv = document.getElementById('loading');
    const searchBox = document.getElementById('searchBox');
    const searchResultsDiv = document.getElementById('searchResults');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    const donateBtn = document.getElementById('donateBtn');
    const filtersDiv = document.querySelector(".sidebar");
       const searchContainerDiv = document.querySelector(".search-container");
    const senderFilter = document.getElementById('senderFilter');
     const senderFilterType = document.getElementById('senderFilterType');
    const fileFilter = document.getElementById('fileFilter');
    const fileFilterType = document.getElementById('fileFilterType');
    const dateFilter = document.getElementById('dateFilter');
       const dateFilterType = document.getElementById('dateFilterType');
    const linkFilter = document.getElementById('linkFilter');
        const linkFilterType = document.getElementById('linkFilterType');
  const domainFilterContainer = document.querySelector(".domain-filter");
    const beforeDateInput = document.getElementById('beforeDate');
     const afterDateInput = document.getElementById('afterDate');
    const resetFiltersBtn = document.getElementById("resetFiltersBtn");
     let linkDomains = {};
    let chatData = [];
     let senderCounts = {};
     let fileCounts = {};
     let dateCounts = {};
    let fuse;
    let currentResults = [];
    let itemsPerPage = 20;
    let currentPage = 1;


         resetFiltersBtn.addEventListener('click', resetFilters);

    scrollToTopBtn.addEventListener('click', () => {
         window.scrollTo({ top: 0, behavior: 'smooth' });
    });
       donateBtn.addEventListener('click', () => {
        window.open('https://www.buymeacoffee.com/imbuenoing', '_blank');
     })


    chatFile.addEventListener('change', async (event) => {
        loadingDiv.textContent = 'Processing chat file...';
        filtersDiv.classList.add('hidden');
        searchContainerDiv.classList.add('hidden');
        searchResultsDiv.classList.add("hidden");
        loadMoreBtn.classList.add("hidden");

        const file = event.target.files[0];

        if (!file) {
            loadingDiv.textContent = "No file selected.";
             return;
        }


        try {
              const fileContents = await readFile(file);
             const {chatData:parsedData, senderCounts: parsedSenders, fileCounts: parsedFiles, dateCounts: parsedDates, linkDomains:parsedLinkDomains} = parseChat(fileContents);
            chatData = parsedData;
            senderCounts = parsedSenders
             fileCounts = parsedFiles;
             dateCounts = parsedDates;
            linkDomains = parsedLinkDomains;
          await saveChatData(await openDatabase(), chatData);
             setupFilters();
             setupSearch();
          filtersDiv.classList.remove('hidden');
           searchContainerDiv.classList.remove('hidden');
         loadingDiv.textContent = 'Chat loaded successfully';



        } catch (error) {
             loadingDiv.textContent = 'Error processing file: ' + error.message;
        }

    });

    searchBox.addEventListener('input', () => {
        if (fuse){
            currentPage = 1;
          const query = searchBox.value;
          const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
           const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
          const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
           const selectedLink = linkFilter.value;
        const selectedDomains = getSelectedDomains();
            const beforeDate = beforeDateInput.value;
            const afterDate = afterDateInput.value;

           const filters = {
                senders: selectedSenders,
               sendersType: senderFilterType.value,
                fileExtensions: selectedFiles,
               fileExtensionsType: fileFilterType.value,
                link: selectedLink,
                dates: selectedDates,
                datesType: dateFilterType.value,
               domains: selectedDomains,
              beforeDate: beforeDate,
            afterDate: afterDate
            }
              const results = performSearch(fuse, query, filters);
             currentResults = results;
              displayResults(results);
        }

    });

     senderFilterType.addEventListener("change", () => {
         if (fuse){
            currentPage = 1;
           const query = searchBox.value;
             const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
              const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
            const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
           const selectedLink = linkFilter.value;
              const selectedDomains = getSelectedDomains();
            const beforeDate = beforeDateInput.value;
            const afterDate = afterDateInput.value;

           const filters = {
                senders: selectedSenders,
               sendersType: senderFilterType.value,
                fileExtensions: selectedFiles,
                 fileExtensionsType: fileFilterType.value,
                link: selectedLink,
                dates: selectedDates,
                 datesType: dateFilterType.value,
               domains: selectedDomains,
              beforeDate: beforeDate,
            afterDate: afterDate
            }
                const results = performSearch(fuse, query, filters);
             currentResults = results;
             displayResults(results);
        }
     })

    senderFilter.addEventListener('change', () => {
       if (fuse){
          currentPage = 1;
      const query = searchBox.value;
             const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
              const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
            const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
           const selectedLink = linkFilter.value;
             const selectedDomains = getSelectedDomains();
              const beforeDate = beforeDateInput.value;
                const afterDate = afterDateInput.value;

           const filters = {
                senders: selectedSenders,
               sendersType: senderFilterType.value,
                fileExtensions: selectedFiles,
                 fileExtensionsType: fileFilterType.value,
                link: selectedLink,
                dates: selectedDates,
                 datesType: dateFilterType.value,
               domains: selectedDomains,
              beforeDate: beforeDate,
            afterDate: afterDate
            }

            const results = performSearch(fuse, query, filters);
           currentResults = results;
           displayResults(results);
        }

    });
     fileFilterType.addEventListener("change", () => {
         if (fuse){
               currentPage = 1;
              const query = searchBox.value;
               const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
              const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
            const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
             const selectedLink = linkFilter.value;
               const selectedDomains = getSelectedDomains();
              const beforeDate = beforeDateInput.value;
                const afterDate = afterDateInput.value;

                const filters = {
                 senders: selectedSenders,
               sendersType: senderFilterType.value,
                fileExtensions: selectedFiles,
                fileExtensionsType: fileFilterType.value,
                    link: selectedLink,
                    dates: selectedDates,
                   datesType: dateFilterType.value,
                   domains: selectedDomains,
                  beforeDate: beforeDate,
                  afterDate: afterDate
            }

             const results = performSearch(fuse, query, filters);
           currentResults = results;
           displayResults(results);
        }
     });

        fileFilter.addEventListener('change', () => {
           if (fuse){
               currentPage = 1;
          const query = searchBox.value;
               const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
              const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
            const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
             const selectedLink = linkFilter.value;
                 const selectedDomains = getSelectedDomains();
              const beforeDate = beforeDateInput.value;
                const afterDate = afterDateInput.value;

                const filters = {
                   senders: selectedSenders,
                   sendersType: senderFilterType.value,
                fileExtensions: selectedFiles,
                  fileExtensionsType: fileFilterType.value,
                    link: selectedLink,
                    dates: selectedDates,
                    datesType: dateFilterType.value,
                   domains: selectedDomains,
                  beforeDate: beforeDate,
                  afterDate: afterDate
            }

             const results = performSearch(fuse, query, filters);
           currentResults = results;
           displayResults(results);
        }

    });
      dateFilterType.addEventListener('change', () => {
         if (fuse){
              currentPage = 1;
            const query = searchBox.value;

               const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
              const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
               const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
             const selectedLink = linkFilter.value;
                const selectedDomains = getSelectedDomains();
              const beforeDate = beforeDateInput.value;
                const afterDate = afterDateInput.value;

                  const filters = {
                     senders: selectedSenders,
                     sendersType: senderFilterType.value,
                   fileExtensions: selectedFiles,
                   fileExtensionsType: fileFilterType.value,
                      link: selectedLink,
                      dates: selectedDates,
                      datesType: dateFilterType.value,
                    domains: selectedDomains,
                   beforeDate: beforeDate,
                  afterDate: afterDate
              }

             const results = performSearch(fuse, query, filters);
                currentResults = results;
               displayResults(results);
        }
     });

          dateFilter.addEventListener('change', () => {
           if (fuse){
              currentPage = 1;
            const query = searchBox.value;

               const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
              const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
               const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
             const selectedLink = linkFilter.value;
                 const selectedDomains = getSelectedDomains();
              const beforeDate = beforeDateInput.value;
                const afterDate = afterDateInput.value;

                  const filters = {
                     senders: selectedSenders,
                     sendersType: senderFilterType.value,
                   fileExtensions: selectedFiles,
                  fileExtensionsType: fileFilterType.value,
                      link: selectedLink,
                      dates: selectedDates,
                      datesType: dateFilterType.value,
                    domains: selectedDomains,
                   beforeDate: beforeDate,
                  afterDate: afterDate
              }

             const results = performSearch(fuse, query, filters);
                currentResults = results;
               displayResults(results);
        }

    });
     linkFilterType.addEventListener("change", () => {
         if (fuse){
              currentPage = 1;
        const query = searchBox.value;

                const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
               const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
               const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
             const selectedLink = linkFilter.value;
           const selectedDomains = getSelectedDomains();
              const beforeDate = beforeDateInput.value;
                const afterDate = afterDateInput.value;

                  const filters = {
                   senders: selectedSenders,
                    sendersType: senderFilterType.value,
                   fileExtensions: selectedFiles,
                   fileExtensionsType: fileFilterType.value,
                      link: selectedLink,
                      dates: selectedDates,
                      datesType: dateFilterType.value,
                     domains: selectedDomains,
                    beforeDate: beforeDate,
                  afterDate: afterDate
              }


            const results = performSearch(fuse, query, filters);
                currentResults = results;
              displayResults(results);
        }
     });
     linkFilter.addEventListener('change', () => {
          if (fuse){
             currentPage = 1;
        const query = searchBox.value;

                const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
               const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
               const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
             const selectedLink = linkFilter.value;
           const selectedDomains = getSelectedDomains();
              const beforeDate = beforeDateInput.value;
                const afterDate = afterDateInput.value;

                  const filters = {
                     senders: selectedSenders,
                   sendersType: senderFilterType.value,
                   fileExtensions: selectedFiles,
                      fileExtensionsType: fileFilterType.value,
                      link: selectedLink,
                      dates: selectedDates,
                        datesType: dateFilterType.value,
                     domains: selectedDomains,
                     beforeDate: beforeDate,
                   afterDate: afterDate
              }


            const results = performSearch(fuse, query, filters);
                currentResults = results;
              displayResults(results);
        }

    });
    beforeDateInput.addEventListener("change", () => {
      if (fuse){
        currentPage = 1;
       const query = searchBox.value;

                const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
               const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
               const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
             const selectedLink = linkFilter.value;
           const selectedDomains = getSelectedDomains();
              const beforeDate = beforeDateInput.value;
                const afterDate = afterDateInput.value;

                  const filters = {
                     senders: selectedSenders,
                     sendersType: senderFilterType.value,
                   fileExtensions: selectedFiles,
                     fileExtensionsType: fileFilterType.value,
                      link: selectedLink,
                      dates: selectedDates,
                      datesType: dateFilterType.value,
                     domains: selectedDomains,
                    beforeDate: beforeDate,
                  afterDate: afterDate
              }

        const results = performSearch(fuse, query, filters);
                currentResults = results;
              displayResults(results);
      }
    });

        afterDateInput.addEventListener("change", () => {
      if (fuse){
        currentPage = 1;
          const query = searchBox.value;

                const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
               const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
               const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
             const selectedLink = linkFilter.value;
           const selectedDomains = getSelectedDomains();
              const beforeDate = beforeDateInput.value;
                const afterDate = afterDateInput.value;

                  const filters = {
                    senders: selectedSenders,
                    sendersType: senderFilterType.value,
                   fileExtensions: selectedFiles,
                  fileExtensionsType: fileFilterType.value,
                      link: selectedLink,
                      dates: selectedDates,
                      datesType: dateFilterType.value,
                     domains: selectedDomains,
                     beforeDate: beforeDate,
                   afterDate: afterDate
              }

            const results = performSearch(fuse, query, filters);
                currentResults = results;
              displayResults(results);
      }
    });
        domainFilterContainer.addEventListener("change", () => {
            if (fuse) {
                currentPage = 1;
                 const query = searchBox.value;

                const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
               const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
               const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
             const selectedLink = linkFilter.value;
             const selectedDomains = getSelectedDomains();
              const beforeDate = beforeDateInput.value;
                const afterDate = afterDateInput.value;

                  const filters = {
                       senders: selectedSenders,
                     sendersType: senderFilterType.value,
                   fileExtensions: selectedFiles,
                  fileExtensionsType: fileFilterType.value,
                      link: selectedLink,
                      dates: selectedDates,
                      datesType: dateFilterType.value,
                     domains: selectedDomains,
                     beforeDate: beforeDate,
                   afterDate: afterDate
              }
             const results = performSearch(fuse, query, filters);
              currentResults = results;
              displayResults(results);
            }
        });
        loadMoreBtn.addEventListener('click', () => {
            currentPage++;
            displayResults(currentResults);

    });
        function resetFilters() {
            senderFilter.value = [];
           fileFilter.value = [];
           dateFilter.value = [];
             beforeDateInput.value = "";
            afterDateInput.value = "";
           linkFilter.value = "";

            const domainCheckboxes = document.querySelectorAll('.domain-filter input[type="checkbox"]:checked');
            domainCheckboxes.forEach(checkbox => checkbox.checked = false);
        currentPage = 1;
        if (fuse){
         const query = searchBox.value;
           const filters = {
             senders: [],
                sendersType: "any",
                fileExtensions: [],
                 fileExtensionsType: "selected",
                    link: "any",
                    dates: [],
                    datesType: "any",
                   domains: [],
                   beforeDate: null,
                  afterDate: null
              }
                  const results = performSearch(fuse, query, filters);
                currentResults = results;
              displayResults(results);
         }
        }


  async function loadDataFromIndexedDB() {
        loadingDiv.textContent = 'Loading chat from local storage...';
    const db = await openDatabase();
     const savedData = await getChatData(db);
    if (savedData && savedData.length > 0){
          chatData = savedData;
          setupFilters();
          setupSearch();
        filtersDiv.classList.remove('hidden');
       searchContainerDiv.classList.remove('hidden');
            loadingDiv.textContent = 'Chat loaded from storage';
          } else {
           loadingDiv.textContent = 'No chat available in local storage. Upload file';
        }

}
      loadDataFromIndexedDB();
       if ('serviceWorker' in navigator) {
         navigator.serviceWorker.register('sw.js')
           .then(registration => {
             console.log('Service Worker registered with scope:', registration.scope);
           })
           .catch(error => {
             console.error('Service Worker registration failed:', error);
           });
       }


    function readFile(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
           reader.onload = (event) => resolve(event.target.result);
          reader.onerror = (error) => reject(error);
           reader.readAsText(file);
       });
    }

     function parseChat(chatText) {
            const lines = chatText.split("\n");
            const chatData = [];
            const senderCounts = {};
            const fileCounts = {};
            const dateCounts = {};
            const linkDomains = {};
            const regex = /^\[(.*?)\]\s([^\:]+)\:\s(.*)$/;

            lines.forEach((line) => {
                const match = line.match(regex);
                if (match) {
                    const timestamp = match[1];
                    const sender = match[2].trim();
                    const message = match[3].trim();

                    const fileExtensions = extractFileExtensions(message);
                    const hasLink = messageContainsLink(message);
                    const date = new Date(timestamp);
                    const year = date.getFullYear();
                    const month = date.toLocaleString('default', { month: 'long' });
                    const dateString = `${month} ${year}`;

                     if (hasLink) {
                         const domain = extractDomain(message);
                         if (domain) {
                            linkDomains[domain] = (linkDomains[domain] || 0) + 1;
                        }

                     }

                    chatData.push({ timestamp, sender, message, fileExtensions, hasLink, dateString });

                    senderCounts[sender] = (senderCounts[sender] || 0) + 1;

                    fileExtensions.forEach(extension => {
                        fileCounts[extension] = (fileCounts[extension] || 0) + 1;
                    });
                    dateCounts[dateString] = (dateCounts[dateString] || 0) + 1;
                }
            });

            return { chatData, senderCounts, fileCounts, dateCounts, linkDomains };
        }

      function extractDomain(message) {
        const urlRegex = /(https?:\/\/[^\s/]+)/i;
        const match = message.match(urlRegex);
        if (match) {
            try {
                const url = new URL(match[0]);
                return url.hostname.replace(/^www\./, '');
            } catch (e) {
                return null;
            }
        }
          return null;

      }

    function messageContainsLink(message) {
        const linkRegex = /(https?:\/\/[^\s]+)/i;
        return linkRegex.test(message);
    }


    function extractFileExtensions(message) {
      const regex = /\.(jpg|jpeg|png|gif|pdf|mp4|mov|avi|doc|docx|xls|xlsx|txt)/gi;
      const matches = message.match(regex) || [];
      return matches.map(match => match.slice(1));
    }


   function setupSearch() {
      const options = {
        keys: ['message'],
        includeScore: true,
         useExtendedSearch: true
      };

        fuse = new Fuse(chatData, options);
        console.log("Fuse.js setup")

    }
    function performSearch(fuse, query, filters) {
     const searchResults =  filterResults(fuse.search(query), filters);
    return searchResults
  }

   function filterResults(results, filters){
     return results.filter((result) => {
          const item = result.item;

         if (filters.sendersType === "selected" && filters.senders && filters.senders.length > 0 && !filters.senders.includes(item.sender)) {
          return false
           }
           if (filters.datesType === "selected" && filters.dates && filters.dates.length > 0 && !filters.dates.includes(item.dateString)) {
            return false;
          }


         if (filters.fileExtensionsType === "selected" && filters.fileExtensions && filters.fileExtensions.length > 0) {

             if( !item.fileExtensions.some(extension => filters.fileExtensions.includes(extension)) && item.fileExtensions.length > 0) {
                return false
            }
         } else if (filters.fileExtensionsType === "notFile" && item.fileExtensions.length > 0){
              return false;
            }

       if (filters.domains && filters.domains.length > 0){
           if (filters.link === "hasLink" && !filters.domains.some(domain => item.message.includes(domain))) {
                return false
            }
             if (filters.link === "any" && filters.domains.some(domain => item.message.includes(domain))){
             } else if (filters.link === "any"){
            }   else {
           if (filters.domains && filters.domains.length > 0 && filters.link === "hasLink" && !filters.domains.some(domain => item.message.includes(domain))) {
                   return false
            }
           }
       } else {
             if (filters.link === "hasLink" && !item.hasLink) {
           return false
        }
          if(filters.link === "noLink" && item.hasLink){
           return false;
        }
       }

      if (filters.beforeDate) {
        const messageDate = new Date(item.timestamp);
        const beforeDate = new Date(filters.beforeDate);
          if (messageDate >= beforeDate){
            return false;
         }

      }

        if (filters.afterDate) {
            const messageDate = new Date(item.timestamp);
             const afterDate = new Date(filters.afterDate);
              if (messageDate <= afterDate){
            return false;
         }
       }
        return true;
      });
  }


    function displayResults(results) {

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
           const paginatedResults = results.slice(startIndex, endIndex);

         if (currentPage === 1) {
            searchResultsDiv.innerHTML = '';
            searchResultsDiv.classList.remove("hidden");
        }


      if (paginatedResults.length === 0 && currentPage === 1){
            searchResultsDiv.innerHTML = '<p>No results</p>';
              loadMoreBtn.classList.add("hidden");
           return;
        }
        if (paginatedResults.length === 0 && currentPage > 1){
                loadMoreBtn.classList.add("hidden");
           return;
        }


      paginatedResults.forEach((result) => {
            const item = result.item;
            const element = document.createElement('div');
            element.classList.add("result-item")

           element.innerHTML = `
                <p><strong>${item.sender}</strong> - ${item.timestamp}</p>
              <p>${item.message}</p>

            `;
          searchResultsDiv.appendChild(element);
        });

        if (endIndex < results.length){
               loadMoreBtn.classList.remove("hidden");
            } else {
               loadMoreBtn.classList.add("hidden");
        }
    }

      function getSelectedDomains() {
        const domainCheckboxes = document.querySelectorAll('.domain-filter input[type="checkbox"]:checked');
        return Array.from(domainCheckboxes).map(checkbox => checkbox.value);
     }

    function setupFilters() {

          domainFilterContainer.innerHTML = '';

          Object.keys(linkDomains).forEach(domain => {
            const label = document.createElement("label");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = domain;
             label.appendChild(checkbox);
              label.appendChild(document.createTextNode(`${domain} (${linkDomains[domain]})`));
              domainFilterContainer.appendChild(label);
          });


      senderFilter.innerHTML = '';
        Object.keys(senderCounts).forEach(sender => {
            const option = document.createElement('option');
            option.value = sender;
            option.text = `${sender} (${senderCounts[sender]})`;
             senderFilter.appendChild(option);

        });

       fileFilter.innerHTML = '';

      Object.keys(fileCounts).forEach(file => {
          const option = document.createElement('option');
            option.value = file;
            option.text = `${file} (${fileCounts[file]})`;
              fileFilter.appendChild(option);
        })
          dateFilter.innerHTML = '';

          Object.keys(dateCounts).forEach(date => {
              const option = document.createElement("option");
              option.value = date;
                option.text = `${date} (${dateCounts[date]})`;
                dateFilter.appendChild(option);

          });
    }


      function openDatabase() {
          return new Promise((resolve, reject) => {
            const request = indexedDB.open('chatDB', 1);

            request.onerror = (event) => {
              reject('Error opening database');
            };

            request.onupgradeneeded = (event) => {
              const db = event.target.result;
              db.createObjectStore('chats', { keyPath: 'id', autoIncrement: true });
            };

            request.onsuccess = (event) => {
              resolve(event.target.result);
            };
        });
      }


      async function saveChatData(db, chatData) {
            const transaction = db.transaction(['chats'], 'readwrite');
            const store = transaction.objectStore('chats');
            chatData.forEach(item => store.add(item));
              await transaction.done;
           console.log("Data Saved to IndexedDB");
       }

    async function getChatData(db){
        const transaction = db.transaction(['chats'], 'readonly');
        const store = transaction.objectStore('chats');
            const allData = await store.getAll();
        return allData;
        }
    function resetFilters() {
            senderFilter.value = [];
           fileFilter.value = [];
           dateFilter.value = [];
             beforeDateInput.value = "";
            afterDateInput.value = "";
           linkFilter.value = "";

            const domainCheckboxes = document.querySelectorAll('.domain-filter input[type="checkbox"]:checked');
            domainCheckboxes.forEach(checkbox => checkbox.checked = false);
        currentPage = 1;
        if (fuse){
         const query = searchBox.value;
           const filters = {
             senders: [],
                sendersType: "any",
                fileExtensions: [],
                 fileExtensionsType: "selected",
                    link: "any",
                    dates: [],
                    datesType: "any",
                   domains: [],
                   beforeDate: null,
                  afterDate: null
              }
                  const results = performSearch(fuse, query, filters);
                currentResults = results;
              displayResults(results);
         }
        }

});
