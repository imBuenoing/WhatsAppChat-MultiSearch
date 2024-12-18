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
     let linkDomains = {};
    let chatData = [];
     let senderCounts = {};
     let fileCounts = {};
     let dateCounts = {};
    let fuse;
    let currentResults = [];
    let itemsPerPage = 20;
    let currentPage = 1;

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
                  linkType: linkFilterType.value,
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
    senderFilterType.addEventListener('change', () => {
        senderFilter.value = [];
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
                    linkType: linkFilterType.value,
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
                linkType: linkFilterType.value,
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
           fileFilter.value = [];
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
                     linkType: linkFilterType.value,
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
                     linkType: linkFilterType.value,
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
        dateFilter.value = [];
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
                     linkType: linkFilterType.value,
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
                     linkType: linkFilterType.value,
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
    linkFilter.value = [];
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
                    linkType: linkFilterType.value,
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
                     linkType: linkFilterType.value,
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
                      linkType: linkFilterType.value,
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
            
