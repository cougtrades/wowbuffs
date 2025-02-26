let buffs = [];
let faction = "horde"; // Default to Horde
let filters = {
    serverTime: true,
    yourTime: true,
    server: true,
    guild: true,
    buff: true,
    notes: true
};

document.addEventListener("DOMContentLoaded", () => {
    // Initialize filter popups
    const filters = document.querySelectorAll('.filter');
    filters.forEach(filter => {
        filter.addEventListener('click', (e) => {
            e.preventDefault();
            showFilterPopup(filter.dataset.column);
        });
    });

    async function loadBuffs() {
        try {
            const url = `${faction}_buffs.json`;
            console.log(`Attempting to load: ${url}`); // Debug log
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            
            buffs = Array.from(new Map(data.map(item => [item.datetime + item.guild, item])).values());
            buffs.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
            displayBuffs();
            startCountdown();
        } catch (error) {
            console.error("Load error:", error); // Debug log
            document.getElementById("buffList").innerHTML = `<tr><td colspan="6">Error loading buffs: ${error.message}</td></tr>`;
            buffs = [];
        }
    }

    function updateFaction() {
        faction = document.getElementById("faction").value;
        document.getElementById("buffList").innerHTML = "";
        document.getElementById("countdownTimer").textContent = "--:--:--";
        if (faction === "alliance") {
            document.body.classList.add("alliance");
        } else {
            document.body.classList.remove("alliance");
        }
        loadBuffs();
    }

    function formatDateTime(date, isServerTime = false) {
        if (isServerTime) {
            return date.toLocaleString("en-US", {
                timeZone: "America/Denver",
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
                hour12: true
            });
        } else {
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            return date.toLocaleString("en-US", {
                timeZone: userTimezone,
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
                hour12: true
            });
        }
    }

    function displayBuffs() {
        const buffList = document.getElementById("buffList");
        buffList.innerHTML = "";
        
        if (buffs.length === 0) {
            buffList.innerHTML = `<tr><td colspan="6">No buffs available.</td></tr>`;
            return;
        }

        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const now = new Date();
        const localNow = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));

        const futureBuffs = buffs.filter(buff => {
            const utcDate = new Date(buff.datetime);
            const localBuffDate = new Date(utcDate.toLocaleString("en-US", { timeZone: userTimezone }));
            return localBuffDate > localNow;
        });

        if (futureBuffs.length === 0) {
            buffList.innerHTML = `<tr><td colspan="6">No upcoming buffs available.</td></tr>`;
            return;
        }

        futureBuffs.forEach(buff => {
            const utcDate = new Date(buff.datetime);
            if (isNaN(utcDate.getTime())) {
                console.warn(`Invalid UTC datetime: '${buff.datetime}', using current date`);
                utcDate = new Date();
            }

            const serverTime = formatDateTime(utcDate, true);
            const yourTime = formatDateTime(utcDate, false);
            const row = document.createElement("tr");
            const cells = [
                filters.serverTime ? `<td>${serverTime}</td>` : '',
                filters.yourTime ? `<td>${yourTime}</td>` : '',
                filters.server ? `<td>${buff.server || "Doomhowl"}</td>` : '',
                filters.guild ? `<td>${buff.guild}</td>` : '',
                filters.buff ? `<td>Onyxia</td>` : '', // Hardcoded as Onyxia
                filters.notes ? `<td>${buff.notes || ""}</td>` : ''
            ].filter(cell => cell !== '').join('');
            row.innerHTML = cells;
            buffList.appendChild(row);
        });
    }

    function showFilterPopup(column) {
        const popup = document.createElement('div');
        popup.className = 'filter-popup';
        popup.innerHTML = `
            <div class="popup-content">
                <h4>Show Column</h4>
                <label><input type="checkbox" value="serverTime" ${filters.serverTime ? 'checked' : ''}> Server Time</label><br>
                <label><input type="checkbox" value="yourTime" ${filters.yourTime ? 'checked' : ''}> Your Time</label><br>
                <label><input type="checkbox" value="server" ${filters.server ? 'checked' : ''}> Server</label><br>
                <label><input type="checkbox" value="guild" ${filters.guild ? 'checked' : ''}> Guild</label><br>
                <label><input type="checkbox" value="buff" ${filters.buff ? 'checked' : ''}> Buff</label><br>
                <label><input type="checkbox" value="notes" ${filters.notes ? 'checked' : ''}> Notes</label><br>
                <button onclick="applyFilters('${column}')">Apply</button>
            </div>
        `;
        document.body.appendChild(popup);

        // Position popup near the clicked filter
        const filterRect = document.querySelector(`.filter[data-column="${column}"]`).getBoundingClientRect();
        popup.style.position = 'absolute';
        popup.style.left = `${filterRect.left}px`;
        popup.style.top = `${filterRect.bottom + window.scrollY}px`;

        // Close popup if clicking outside
        document.addEventListener('click', closePopupOutside, { once: true });
    }

    window.applyFilters = function(column) {
        const checkboxes = document.querySelectorAll('.filter-popup input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            filters[checkbox.value] = checkbox.checked;
        });
        document.querySelector('.filter-popup').remove();
        displayBuffs(); // Re-render table with new filters
    };

    function closePopupOutside(e) {
        const popup = document.querySelector('.filter-popup');
        if (popup && !popup.contains(e.target)) {
            popup.remove();
        }
    }

    function startCountdown() {
        let lastDisplayedBuffs = null;

        function updateCountdown() {
            if (buffs.length === 0) {
                document.getElementById("countdownTimer").textContent = "No upcoming buffs";
                return;
            }

            const now = new Date();
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const localNow = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));

            const nextBuff = buffs.find(buff => {
                const buffDate = new Date(buff.datetime);
                const localBuffDate = new Date(buffDate.toLocaleString("en-US", { timeZone: userTimezone }));
                return localBuffDate > localNow;
            });

            if (!nextBuff) {
                document.getElementById("countdownTimer").textContent = "No upcoming buffs";
                if (lastDisplayedBuffs !== null) {
                    displayBuffs();
                    lastDisplayedBuffs = null;
                }
                return;
            }

            const buffDate = new Date(nextBuff.datetime);
            const localBuffDate = new Date(buffDate.toLocaleString("en-US", { timeZone: userTimezone }));
            const timeDiff = localBuffDate - localNow;

            if (timeDiff <= 0) {
                document.getElementById("countdownTimer").textContent = "Buff is now!";
                const currentFutureBuffs = buffs.filter(buff => {
                    const utcDate = new Date(buff.datetime);
                    const localBuffDate = new Date(utcDate.toLocaleString("en-US", { timeZone: userTimezone }));
                    return localBuffDate > localNow;
                });
                if (JSON.stringify(currentFutureBuffs) !== JSON.stringify(lastDisplayedBuffs)) {
                    buffs = currentFutureBuffs;
                    displayBuffs();
                    lastDisplayedBuffs = currentFutureBuffs;
                }
                return;
            }

            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

            let timerDisplay;
            if (days === 0) {
                if (hours === 0) {
                    if (minutes === 0) {
                        timerDisplay = `${seconds}`;
                    } else {
                        timerDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    }
                } else {
                    timerDisplay = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            } else {
                timerDisplay = `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }

            document.getElementById("countdownTimer").textContent = timerDisplay;
        }

        updateCountdown();
        setInterval(updateCountdown, 1000);
    }

    loadBuffs();
    setInterval(loadBuffs, 60000); // Refresh every minute
});
