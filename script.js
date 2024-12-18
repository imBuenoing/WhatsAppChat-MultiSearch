document.addEventListener('DOMContentLoaded', () => {
    const chatFile = document.getElementById('chatFile');
    const loadingDiv = document.getElementById('loading');
    const searchBox = document.getElementById('searchBox');
    const searchResultsDiv = document.getElementById('searchResults');
    const filtersDiv = document.getElementById('filters');
    const searchContainerDiv = document.querySelector(".search-container");
    const senderFilter = document.getElementById('senderFilter');
    const fileFilter = document.getElementById('fileFilter');
    const linkFilter = document.getElementById('linkFilter');

    let chatData = [];
     let senderCounts = {};
     let fileCounts = {};
    let fuse;

    chatFile.addEventListener('change', async (event) => {
        loadingDiv.textContent = 'Processing chat file...';
         filtersDiv.classList.add('hidden');
      searchContainerDiv.classList.add('hidden');
        searchResultsDiv.classList.add("hidden");


        const file = event.target.files[0];

        if (!file) {
            loadingDiv.textContent = "No file selected.";
             return;
        }


        try {
              const fileContents = await readFile(file);
            const {chatData:parsedData, senderCounts: parsedSenders, fileCounts: parsedFiles} = parseChat(fileContents);
            chatData = parsedData;
            senderCounts = parsedSenders
             fileCounts = parsedFiles

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
          const query = searchBox.value;
          const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
           const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
           const selectedLink = linkFilter.value;
           const filters = {
                senders: selectedSenders,
                fileExtensions: selectedFiles,
                link: selectedLink
            }
              const results = performSearch(fuse, query, filters);
              displayResults(results);
        }

    });

    senderFilter.addEventListener('change', () => {
      const query = searchBox.value;

       if (fuse){
             const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
             const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
             const selectedLink = linkFilter.value;
               const filters = {
                senders: selectedSenders,
                fileExtensions: selectedFiles,
                  link: selectedLink
            }

              const results = performSearch(fuse, query, filters);
              displayResults(results);
        }

    });
        fileFilter.addEventListener('change', () => {
          const query = searchBox.value;
           if (fuse){
               const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
              const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
               const selectedLink = linkFilter.value;
                const filters = {
                senders: selectedSenders,
                fileExtensions: selectedFiles,
                    link: selectedLink
            }
                const results = performSearch(fuse, query, filters);
              displayResults(results);
        }

    });
     linkFilter.addEventListener('change', () => {
        const query = searchBox.value;

          if (fuse){
                const selectedSenders = Array.from(senderFilter.selectedOptions).map(option => option.value);
               const selectedFiles = Array.from(fileFilter.selectedOptions).map(option => option.value);
              const selectedLink = linkFilter.value;

                  const filters = {
                  senders: selectedSenders,
                   fileExtensions: selectedFiles,
                      link: selectedLink
              }


                 const results = performSearch(fuse, query, filters);
               displayResults(results);
        }

    });

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
      const regex = /^\[(.*?)\]\s([^\:]+)\:\s(.*)$/;

      lines.forEach((line) => {
        const match = line.match(regex);
        if (match) {
          const timestamp = match[1];
          const sender = match[2].trim();
          const message = match[3].trim();

          const fileExtensions = extractFileExtensions(message);
            const hasLink = messageContainsLink(message);


          chatData.push({ timestamp, sender, message, fileExtensions, hasLink });


            senderCounts[sender] = (senderCounts[sender] || 0) + 1;

          fileExtensions.forEach(extension => {
            fileCounts[extension] = (fileCounts[extension] || 0 )+1;
          })
        }
      });


      return {chatData, senderCounts, fileCounts };

    }

     function messageContainsLink(message) {
       const linkRegex = /(https?:\/\/[^\s]+)/i; // Basic regex for URLs

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
        if (filters.senders && filters.senders.length > 0 && !filters.senders.includes(item.sender)) {
          return false
        }
        if (filters.fileExtensions && filters.fileExtensions.length > 0 && !item.fileExtensions.some(extension => filters.fileExtensions.includes(extension))) {
          return false
        }
          if (filters.link === "hasLink" && !item.hasLink) {
           return false
        }
        if(filters.link === "noLink" && item.hasLink){
           return false;
        }


        return true;
      });
  }



   function displayResults(results) {
        searchResultsDiv.innerHTML = '';
        searchResultsDiv.classList.remove("hidden")
        if (results.length === 0){
             searchResultsDiv.innerHTML = '<p>No results</p>';
           return;
        }
      results.forEach((result) => {
            const item = result.item;
            const element = document.createElement('div');
            element.classList.add("result-item")

           element.innerHTML = `
                <p><strong>${item.sender}</strong> - ${item.timestamp}</p>
              <p>${item.message}</p>

            `;
          searchResultsDiv.appendChild(element);
        });
    }


   function setupFilters() {

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

});
