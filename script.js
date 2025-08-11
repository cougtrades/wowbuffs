let buffs = [];
let pastBuffs = [];
let faction = "horde";
let selectedBuffTypes = ["all"]; // Changed from selectedBuffType = "all" to array
let selectedTimezone = localStorage.getItem("selectedTimezone") || Intl.DateTimeFormat().resolvedOptions().timeZone;
let groupedBuffs = [];
let showLocalTime = localStorage.getItem("showLocalTime") !== "false";
let lastBuffsEtag = { horde: null, alliance: null };
let isPageHidden = false;

function populateTimezoneDropdown() {
  const timezoneSelect = document.getElementById("timezone");
  const timezoneSearch = document.getElementById("timezoneSearch");
  const countryTimezones = {
    "United States": ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"],
    "Canada": ["America/Toronto", "America/Vancouver"],
    "Australia": ["Australia/Perth", "Australia/Sydney"],
    "Chile": ["America/Santiago"],
    "Brazil": ["America/Sao_Paulo"],
    "United Kingdom": ["Europe/London"],
    "New Zealand": ["Pacific/Auckland"],
    "China": ["Asia/Shanghai"],
    "Argentina": ["America/Argentina/Buenos_Aires"],
    "Germany": ["Europe/Berlin"],
    "Sweden": ["Europe/Stockholm"],
    "Ukraine": ["Europe/Kiev"],
    "Mexico": ["America/Mexico_City"],
    "Colombia": ["America/Bogota"],
    "Russia": ["Europe/Moscow"],
    "Norway": ["Europe/Oslo"],
    "Spain": ["Europe/Madrid"],
    "Singapore": ["Asia/Singapore"],
    "Finland": ["Europe/Helsinki"],
    "Peru": ["America/Lima"],
    "Indonesia": ["Asia/Jakarta"],
    "Netherlands": ["Europe/Amsterdam"],
    "Denmark": ["Europe/Copenhagen"],
    "South Korea": ["Asia/Seoul"],
    "Taiwan": ["Asia/Taipei"],
    "Venezuela": ["America/Caracas"],
    "France": ["Europe/Paris"],
    "Hungary": ["Europe/Budapest"],
    "Romania": ["Europe/Bucharest"],
    "Saudi Arabia": ["Asia/Riyadh"],
    "Belarus": ["Europe/Minsk"],
    "Czechia": ["Europe/Prague"],
    "Poland": ["Europe/Warsaw"],
    "Thailand": ["Asia/Bangkok"],
    "Costa Rica": ["America/Costa_Rica"],
    "Iceland": ["Atlantic/Reykjavik"],
    "Malaysia": ["Asia/Kuala_Lumpur"],
    "Serbia": ["Europe/Belgrade"],
    "Uruguay": ["America/Montevideo"],
    "Cyprus": ["Asia/Nicosia"],
    "Japan": ["Asia/Tokyo"]
  };

  let options = Object.entries(countryTimezones).map(([country, zones]) => {
    return `<optgroup label="${country}">
      ${zones.map(zone => `<option value="${zone}" ${zone === selectedTimezone ? "selected" : ""}>${zone}</option>`).join("")}
    </optgroup>`;
  }).join("");

  timezoneSelect.innerHTML = options;
}

function updateTimezone() {
  selectedTimezone = document.getElementById("timezone").value;
  localStorage.setItem("selectedTimezone", selectedTimezone);
  displayBuffs();
  startCountdown();
}

function updateBuffType(type) {
  if (!type) {
    selectedBuffTypes = ['all'];
  } else if (type === 'all') {
    // If 'all' is clicked, clear other selections and select only 'all'
    selectedBuffTypes = ['all'];
  } else {
    // Remove 'all' if it's currently selected
    if (selectedBuffTypes.includes('all')) {
      selectedBuffTypes = selectedBuffTypes.filter(t => t !== 'all');
    }
    
    // Toggle the selected buff type
    if (selectedBuffTypes.includes(type)) {
      // Remove the buff type if it's already selected
      selectedBuffTypes = selectedBuffTypes.filter(t => t !== type);
      // If no buffs are selected, default to 'all'
      if (selectedBuffTypes.length === 0) {
        selectedBuffTypes = ['all'];
      }
    } else {
      // Add the buff type to selection
      selectedBuffTypes.push(type);
    }
  }
  
  // Set active button state
  const buffTypes = ['all', 'onyxia', 'zandalar', 'nefarian', 'rend'];
  buffTypes.forEach(bt => {
    const btn = document.getElementById(`buff${bt.charAt(0).toUpperCase() + bt.slice(1)}Btn`);
    if (btn) btn.classList.toggle('active', selectedBuffTypes.includes(bt));
  });
  
  console.log(`Selected buff types: ${selectedBuffTypes.join(', ')}`);
  displayBuffs();
  startCountdown();
}

async function fetchWithCache(url, etagKey) {
  try {
    const headers = {};
    const etag = lastBuffsEtag[etagKey];
    if (etag) headers['If-None-Match'] = etag;
    const response = await fetch(url, { headers });
    if (response.status === 304) {
      // Not modified; do nothing, caller should keep existing data
      return null;
    }
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const newEtag = response.headers.get('ETag');
    if (newEtag) lastBuffsEtag[etagKey] = newEtag;
    const data = await response.json();
    return data;
  } catch (e) {
    console.warn('Fetch with cache failed, falling back:', e);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    return data;
  }
}

async function loadBuffs() {
  if (isPageHidden) return; // Skip network while hidden
  try {
    let baseUrl = `${faction}_buffs.json`;
    console.log(`Loading buffs from: ${baseUrl}`);
    let data = await fetchWithCache(baseUrl, faction);
    if (data === null && buffs.length) {
      // Use existing buffs if not modified
      data = [...buffs, ...pastBuffs];
    } else if (data === null) {
      // Nothing cached yet; fetch once without cache headers
      const resp = await fetch(baseUrl);
      if (!resp.ok) throw new Error(`HTTP error! Status: ${resp.status}`);
      data = await resp.json();
    }
    
    // For Zandalar buffs, we need to load from both factions since they work for both
    let zandalarBuffs = [];
    const otherFaction = faction === 'horde' ? 'alliance' : 'horde';
    try {
      const otherData = await fetchWithCache(`${otherFaction}_buffs.json`, otherFaction);
      if (otherData) {
        zandalarBuffs = otherData.filter(buff => buff.buff.toLowerCase() === 'zandalar');
      }
    } catch (error) {
      console.warn('Could not load other faction Zandalar buffs:', error);
    }
    
    // Combine the main faction buffs with Zandalar buffs from the other faction
    let allBuffs = Array.isArray(data) ? [...data, ...zandalarBuffs] : [...zandalarBuffs];
    
    // Separate past and future buffs
    let now = moment().tz("America/Denver");
    let allBuffsDeduped = Array.from(new Map(allBuffs.map(item => [item.datetime + item.guild + item.buff, item])).values());
    
    // Store past buffs for time since last buff calculation
    pastBuffs = allBuffsDeduped
      .filter(buff => moment(buff.datetime).tz("America/Denver").isBefore(now))
      .sort((a, b) => moment(a.datetime).valueOf() - moment(b.datetime).valueOf());
    
    // Filter for upcoming buffs only for display
    buffs = allBuffsDeduped
      .filter(buff => moment(buff.datetime).tz("America/Denver").isAfter(now))
      .sort((a, b) => moment(a.datetime).valueOf() - moment(b.datetime).valueOf());
    
    console.log(`Loaded ${buffs.length} upcoming buffs and ${pastBuffs.length} past buffs`);
    displayBuffs();
    startCountdown();
  } catch (error) {
    console.error(`Error loading buffs: ${error.message}`);
    document.getElementById("buffTimeline").innerHTML = `<div class="timeline-card"><p class="summary">Error</p><div class="details"><p>Error loading buffs: ${error.message}</p></div></div>`;
    buffs = [];
    pastBuffs = [];
  }
}

function updateFaction(selected) {
  if (selected) {
    faction = selected;
  }
  // Set active button state
  const hordeBtn = document.getElementById('hordeBtn');
  const allianceBtn = document.getElementById('allianceBtn');
  if (hordeBtn && allianceBtn) {
    hordeBtn.classList.toggle('active', faction === 'horde');
    allianceBtn.classList.toggle('active', faction === 'alliance');
  }
  console.log(`Selected faction: ${faction}`);
  document.getElementById("buffTimeline").innerHTML = "";
  document.getElementById("countdownTimer").textContent = "--:--:--";
  document.getElementById("lastBuffTime").textContent = "--:--:--";
  if (faction === "alliance") {
    document.body.classList.add("alliance");
    // Hide rend button for alliance
    const rendBtn = document.getElementById('buffRendBtn');
    if (rendBtn) {
      rendBtn.style.display = 'none';
    }
    // If rend is currently selected, switch to 'all'
    if (selectedBuffTypes.includes('rend')) {
      selectedBuffTypes = ['all'];
      updateBuffType('all');
    }
  } else {
    document.body.classList.remove("alliance");
    // Show rend button for horde
    const rendBtn = document.getElementById('buffRendBtn');
    if (rendBtn) {
      rendBtn.style.display = 'inline-flex';
    }
  }
  loadBuffs();
  localStorage.removeItem("alertedBuffs");
}

function formatDateTime(date, isServerTime = false) {
  const timezone = isServerTime ? "America/Denver" : selectedTimezone;
  return moment(date).tz(timezone).format(
    isServerTime ? "dddd, MMMM D, h:mm A" : "dddd, MMMM D, h:mm A"
  );
}

function formatCountdown(buffDate) {
  try {
    let now = moment().tz("America/Denver");
    let timeDiff = buffDate.diff(now);
    
    if (timeDiff <= 0) {
      return "Buff is now!";
    }

    let duration = moment.duration(timeDiff);
    let days = Math.floor(duration.asDays());
    let hours = duration.hours();
    let minutes = duration.minutes();
    let seconds = duration.seconds();
    
    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    
    return parts.join(" ");
  } catch (error) {
    console.error(`Error formatting countdown: ${error.message}`);
    return "Invalid date";
  }
}

function groupBuffsByDate() {
  let now = moment().tz("America/Denver");
  groupedBuffs = [];
  let filteredBuffs = buffs.filter(buff => {
    let buffDate = moment(buff.datetime).tz("America/Denver");
    let diffDays = buffDate.startOf('day').diff(now.startOf('day'), 'days');
    // Filter out rend buffs for alliance
    if (faction === 'alliance' && buff.buff.toLowerCase() === 'rend') {
      return false;
    }
    // Check if buff matches any of the selected types
    return diffDays >= 0 && diffDays <= 7 && (
      selectedBuffTypes.includes("all") || 
      selectedBuffTypes.some(type => buff.buff.toLowerCase() === type.toLowerCase())
    );
  });

  // Sort buffs by date, with today's buffs first
  filteredBuffs.sort((a, b) => {
    let dateA = moment(a.datetime).tz("America/Denver");
    let dateB = moment(b.datetime).tz("America/Denver");
    let diffDaysA = dateA.startOf('day').diff(now.startOf('day'), 'days');
    let diffDaysB = dateB.startOf('day').diff(now.startOf('day'), 'days');
    
    if (diffDaysA !== diffDaysB) {
      return diffDaysA - diffDaysB;
    }
    return dateA.valueOf() - dateB.valueOf();
  });

  let currentDate = null;
  let currentGroup = null;

  filteredBuffs.forEach(buff => {
    let buffDate = moment(buff.datetime).tz("America/Denver");
    let diffDays = buffDate.startOf('day').diff(now.startOf('day'), 'days');
    let label = diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : buffDate.format("dddd, MMM D");

    let dateKey = buffDate.format("YYYY-MM-DD");
    if (!currentDate || currentDate !== dateKey) {
      currentDate = dateKey;
      currentGroup = { label, buffs: [] };
      groupedBuffs.push(currentGroup);
    }
    currentGroup.buffs.push(buff);
  });
}

function toggleTimeFormat() {
  showLocalTime = !showLocalTime;
  localStorage.setItem("showLocalTime", showLocalTime);
  const button = document.getElementById('timeFormatToggle');
  const disclaimer = document.getElementById('timeFormatText');
  
  if (showLocalTime) {
    button.textContent = 'Show Server Time';
    disclaimer.textContent = 'Times shown are in your local time. Click any buff to see server time.';
  } else {
    button.textContent = 'Show Local Time';
    disclaimer.textContent = 'Times shown are in server time. Click any buff to see your local time.';
  }
  
  // Force a complete refresh of the buff display
  groupBuffsByDate();
  displayBuffs();
}

function displayBuffs() {
  groupBuffsByDate();
  let buffTimeline = document.getElementById("buffTimeline");
  buffTimeline.innerHTML = "";
  let now = moment().tz("America/Denver");

  if (groupedBuffs.length === 0) {
    console.log("No buffs to display for Today/Tomorrow.");
    buffTimeline.innerHTML = '<div class="timeline-card"><p class="summary">No Buffs</p><div class="details"><p>No upcoming buffs for today or tomorrow.</p></div></div>';
    return;
  }

  console.log(`Rendering ${groupedBuffs.length} groups`);

  groupedBuffs.forEach(group => {
    let groupDiv = document.createElement("div");
    groupDiv.className = "timeline-group";
    let groupContent = `<h2>${group.label}</h2>`;

    group.buffs.forEach(buff => {
      let buffDate = moment(buff.datetime).tz("America/Denver");
      let timeDiff = buffDate.diff(now);
      let isGlowing = timeDiff <= 600000 && timeDiff > 0;
      let displayTime = showLocalTime ? formatDateTime(buffDate, false) : formatDateTime(buffDate, true);
      let alternateTime = showLocalTime ? formatDateTime(buffDate, true) : formatDateTime(buffDate, false);
      let countdown = formatCountdown(buffDate);
      let iconSrc = `${buff.buff.toLowerCase()}-icon.png`;
      
      // Extract just the time from the displayTime
      let timeOnly = showLocalTime ? 
        moment(buffDate).tz(selectedTimezone).format('h:mm A') : 
        moment(buffDate).tz("America/Denver").format('h:mm A');
      
      groupContent += `
        <div class="timeline-card ${isGlowing ? 'glowing' : ''}" data-datetime="${buff.datetime}">
          <p class="summary"><img src="${iconSrc}" alt="${buff.buff} Icon" class="buff-icon" loading="lazy" decoding="async" width="35" height="35"><strong>${timeOnly} - ${buff.buff}</strong></p>
          <div class="details">
            <p><strong>Guild:</strong> ${buff.guild}</p>
            <p><strong>${showLocalTime ? 'Server Time' : 'Your Time'}:</strong> ${alternateTime}</p>
            ${buff.notes ? `<p><strong>Notes:</strong> ${buff.notes}</p>` : ''}
            <p><strong>Countdown:</strong> <span class="buff-countdown">${countdown}</span></p>
          </div>
        </div>
      `;
    });

    groupDiv.innerHTML = groupContent;
    buffTimeline.appendChild(groupDiv);
  });

  // Add click event listeners to toggle expanded state
  document.querySelectorAll('.timeline-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('expanded');
    });
  });

  // Start updating all countdown timers
  updateAllCountdowns();

  console.log("Buffs rendered successfully");
}

function updateAllCountdowns() {
  if (isPageHidden) return;
  const cards = document.querySelectorAll('.timeline-card');
  const now = moment().tz("America/Denver");

  cards.forEach(card => {
    const datetime = card.dataset.datetime;
    const countdownElement = card.querySelector('.buff-countdown');
    if (datetime && countdownElement) {
      const buffDate = moment(datetime).tz("America/Denver");
      countdownElement.textContent = formatCountdown(buffDate);
    }
  });
}

function searchBuffs() {
  let searchTerm = document.getElementById("buffSearch").value.toLowerCase();
  console.log(`Searching for: ${searchTerm}`);
  let now = moment().tz("America/Denver");
  let filteredBuffs = buffs.filter(buff => {
    let serverTime = formatDateTime(new Date(buff.datetime), true).toLowerCase();
    let guild = buff.guild.toLowerCase();
    let buffType = buff.buff.toLowerCase();
    let notes = (buff.notes || "").toLowerCase();
    return (serverTime.includes(searchTerm) || guild.includes(searchTerm) || buffType.includes(searchTerm) || notes.includes(searchTerm)) &&
           (selectedBuffTypes.includes("all") || selectedBuffTypes.some(type => buff.buff.toLowerCase() === type.toLowerCase()));
  });
  let upcomingFilteredBuffs = filteredBuffs.filter(buff => {
    let buffDate = moment(buff.datetime).tz("America/Denver");
    let diffDays = buffDate.startOf('day').diff(now.startOf('day'), 'days');
    return diffDays >= 0 && diffDays <= 1;
  });
  console.log(`Found ${upcomingFilteredBuffs.length} buffs after search:`, upcomingFilteredBuffs);
  buffs = upcomingFilteredBuffs;
  displayBuffs();
}

function startCountdown() {
  let lastBuffs = null;
  let alertedBuffsInSession = new Set(); // Track alerts in current session
  let animationId = null;
  let lastUpdate = 0;

  function updateCountdown(timestamp) {
    // Use requestAnimationFrame for smoother performance
    if (isPageHidden) {
      animationId = requestAnimationFrame(updateCountdown);
      return;
    }
    if (!lastUpdate || timestamp - lastUpdate >= 1000) { // Update every 1000ms (1 second)
      lastUpdate = timestamp;
      
      let now = moment().tz("America/Denver");
      let filteredBuffs = buffs.filter(buff => selectedBuffTypes.includes("all") || selectedBuffTypes.some(type => buff.buff.toLowerCase() === type.toLowerCase()));
      let filteredPastBuffs = pastBuffs.filter(buff => selectedBuffTypes.includes("all") || selectedBuffTypes.some(type => buff.buff.toLowerCase() === type.toLowerCase()));

      if (filteredBuffs.length === 0 && filteredPastBuffs.length === 0) {
        document.getElementById("countdownTimer").textContent = "--:--:--";
        document.getElementById("lastBuffTime").textContent = "--:--:--";
        animationId = requestAnimationFrame(updateCountdown);
        return;
      }

      // Get the most recent past buff (last in the array since we sorted ascending)
      let lastBuff = filteredPastBuffs[filteredPastBuffs.length - 1];
      if (lastBuff) {
        let lastBuffDate = moment(lastBuff.datetime).tz("America/Denver");
        let timeDiff = now.diff(lastBuffDate);
        let duration = moment.duration(timeDiff);
        let days = Math.floor(duration.asDays());
        let hours = duration.hours();
        let minutes = duration.minutes();
        let seconds = duration.seconds();
        
        let timeString;
        if (days === 0) {
          if (hours === 0) {
            if (minutes === 0) {
              timeString = `${seconds}s`;
            } else {
              timeString = `${minutes}m ${seconds}s`;
            }
          } else {
            timeString = `${hours}h ${minutes}m ${seconds}s`;
          }
        } else {
          timeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
        document.getElementById("lastBuffTime").textContent = timeString;
      } else {
        document.getElementById("lastBuffTime").textContent = "--:--:--";
      }

      // Find the next upcoming buff
      let nextBuff = filteredBuffs.find(e => {
        let buffDate = moment(e.datetime).tz("America/Denver");
        return buffDate.isAfter(now);
      });

      if (!nextBuff) {
        document.getElementById("countdownTimer").textContent = "No upcoming buffs";
        if (lastBuffs !== null) {
          displayBuffs();
          lastBuffs = null;
        }
        animationId = requestAnimationFrame(updateCountdown);
        return;
      }

      let buffDate = moment(nextBuff.datetime).tz("America/Denver");
      let timeDiff = buffDate.diff(now);
      let alertedBuffs = new Set(JSON.parse(localStorage.getItem("alertedBuffs")) || []);
      let buffKey = `${nextBuff.datetime}_${nextBuff.guild}_${nextBuff.buff}`;

      // Only alert if the buff is still upcoming (timeDiff > 0) and within 10 minutes
      if (timeDiff <= 600000 && timeDiff > 0 && !alertedBuffs.has(buffKey) && !alertedBuffsInSession.has(buffKey) && buffDate.isAfter(now)) {
        showCustomNotification(nextBuff);
        alertedBuffs.add(buffKey);
        alertedBuffsInSession.add(buffKey);
        localStorage.setItem("alertedBuffs", JSON.stringify([...alertedBuffs]));
        displayBuffs();
      }

      if (timeDiff <= 0) {
        document.getElementById("countdownTimer").textContent = `${nextBuff.buff} buff is now!`;
        let upcomingBuffs = filteredBuffs.filter(e => {
          let d = moment(e.datetime).tz("America/Denver");
          return d.isAfter(now);
        });
        if (JSON.stringify(upcomingBuffs) !== JSON.stringify(lastBuffs)) {
          buffs = upcomingBuffs;
          displayBuffs();
          lastBuffs = upcomingBuffs;
        }
        localStorage.removeItem("alertedBuffs");
        animationId = requestAnimationFrame(updateCountdown);
        return;
      }

      let duration = moment.duration(timeDiff);
      let days = Math.floor(duration.asDays());
      let hours = duration.hours();
      let minutes = duration.minutes();
      let seconds = duration.seconds();
      
      let timeString;
      if (days === 0) {
        if (hours === 0) {
          if (minutes === 0) {
            timeString = `${seconds}s`;
          } else {
            timeString = `${minutes}m ${seconds}s`;
          }
        } else {
          timeString = `${hours}h ${minutes}m ${seconds}s`;
        }
      } else {
        timeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
      }
      document.getElementById("countdownTimer").textContent = `${nextBuff.buff} drops in ${timeString}`;

      // Update all countdown timers in expanded cards
      updateAllCountdowns();
    }
    
    // Continue the animation loop
    animationId = requestAnimationFrame(updateCountdown);
  }

  function showCustomNotification(buff) {
    let notification = document.createElement("div");
    notification.className = "custom-notification";
    notification.innerHTML = `
      <p>${buff.buff} buff from ${buff.guild} drops in 10 minutes at ${formatDateTime(new Date(buff.datetime), false)} (Your Time)</p>
      <button onclick="this.parentElement.remove()">Close</button>
    `;
    document.body.appendChild(notification);

    // Only play sound for Onyxia buffs
    if (buff.buff.toLowerCase() === 'onyxia') {
      let audio = new Audio("/10minalert.mp3");
      audio.play().catch(e => console.warn("Sound playback failed:", e));
    }

    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 30000);

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Buff Alert!", {
        body: `${buff.buff} buff from ${buff.guild} drops in 10 minutes at ${formatDateTime(new Date(buff.datetime), false)} (Your Time)`,
        icon: "/favicon.ico"
      });
    } else if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }

  // Start the animation loop
  updateCountdown();
  
  // Return cleanup function
  return function stopCountdown() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };
}

// Pause timers and network when tab is hidden
function handleVisibilityChange() {
  isPageHidden = document.hidden;
}

document.addEventListener('visibilitychange', handleVisibilityChange);

// Swipe Gestures for Mobile
document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('timeFormatToggle');
  const disclaimer = document.getElementById('timeFormatText');
  
  // Set initial button and disclaimer text based on stored preference
  if (showLocalTime) {
    button.textContent = 'Show Server Time';
    disclaimer.textContent = 'Times shown are in your local time. Click any buff to see server time.';
  } else {
    button.textContent = 'Show Local Time';
    disclaimer.textContent = 'Times shown are in server time. Click any buff to see your local time.';
  }

  populateTimezoneDropdown();
  loadBuffs();
  // Poll less often; will revalidate via ETag and pause when hidden
  setInterval(() => { if (!isPageHidden) loadBuffs(); }, 120000);
  displayBuffs();
  
  // Start the optimized countdown
  const stopCountdown = startCountdown();
  
  // Cleanup function for when page unloads
  window.addEventListener('beforeunload', () => {
    if (stopCountdown) {
      stopCountdown();
    }
  });
});

document.addEventListener('DOMContentLoaded', function() {
  // Set initial active button
  updateFaction(faction);
  // Set initial active button for buffs
  updateBuffType('all');
});