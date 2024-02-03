document.addEventListener('DOMContentLoaded', () => {
    const authenticateBtn = document.getElementById('authenticate');
    const lastPageEl = document.getElementById('lastPage');

    // Function to update the last page information
    function updateLastPageInfo() {
        // Retrieve last page info from storage
        chrome.storage.local.get(['lastPage'], function(result) {
            if (result.lastPage) {
                lastPageEl.textContent = `Last page added: ${result.lastPage.title}`;
            }
        });
    }

    // Listen for authenticate button clicks
    authenticateBtn.addEventListener('click', () => {
        // Trigger authentication process
        chrome.runtime.sendMessage({action: "authenticate"});
    });


    updateLastPageInfo();
});