let buffs = [];
let pastBuffs = [];
let faction = "horde";
let selectedBuffType = "all";
let selectedTimezone = localStorage.getItem("selectedTimezone") || Intl.DateTimeFormat().resolvedOptions().timeZone;
let groupedBuffs = [];
let showLocalTime = false;

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

function updateBuffType() {
  selectedBuffType = document.getElementById("buffType").value;
  console.log(`Selected buff type: ${selectedBuffType}`);
  displayBuffs();
  startCountdown();
}

async function loadBuffs() {
  try {
    let url = `${faction}_buffs.json?ts=${Date.now()}`;
    console.log(`Loading buffs from: ${url}`);
    let response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    let data = await response.json();
    
    // Separate past and future buffs
    let now = moment().tz("America/Denver");
    let allBuffs = Array.from(new Map(data.map(item => [item.datetime + item.guild + item.buff, item])).values());
    
    // Store past buffs for time since last buff calculation
    pastBuffs = allBuffs
      .filter(buff => moment(buff.datetime).tz("America/Denver").isBefore(now))
      .sort((a, b) => moment(a.datetime).valueOf() - moment(b.datetime).valueOf());
    
    // Filter for upcoming buffs only for display
    buffs = allBuffs
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

function updateFaction() {
  faction = document.getElementById("faction").value;
  console.log(`Selected faction: ${faction}`);
  document.getElementById("buffTimeline").innerHTML = "";
  document.getElementById("countdownTimer").textContent = "--:--:--";
  document.getElementById("lastBuffTime").textContent = "--:--:--";
  if (faction === "alliance") {
    document.body.classList.add("alliance");
  } else {
    document.body.classList.remove("alliance");
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
    return diffDays >= 0 && diffDays <= 7 && (selectedBuffType === "all" || buff.buff.toLowerCase() === selectedBuffType.toLowerCase());
  });

  console.log(`Filtered ${filteredBuffs.length} buffs for next 7 days:`, filteredBuffs);

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

  console.log(`Grouped into ${groupedBuffs.length} groups:`, groupedBuffs);
}

function toggleTimeFormat() {
  showLocalTime = !showLocalTime;
  const button = document.getElementById('timeFormatToggle');
  const disclaimer = document.getElementById('timeFormatText');
  
  if (showLocalTime) {
    button.textContent = 'Show Server Time';
    disclaimer.textContent = 'Times shown are in your local time. Click any buff to see server time.';
  } else {
    button.textContent = 'Show Local Time';
    disclaimer.textContent = 'Times shown are in server time. Click any buff to see your local time.';
  }
  
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
      groupContent += `
        <div class="timeline-card ${isGlowing ? 'glowing' : ''}" data-datetime="${buff.datetime}">
          <p class="summary"><img src="${iconSrc}" alt="${buff.buff} Icon" class="buff-icon"><strong>${displayTime} - ${buff.buff}</strong></p>
          <div class="details">
            <p><strong>Dropped by:</strong> ${buff.guild}</p>
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
           (selectedBuffType === "all" || buff.buff.toLowerCase() === selectedBuffType.toLowerCase());
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

  function updateCountdown() {
    let now = moment().tz("America/Denver");
    let filteredBuffs = buffs.filter(buff => selectedBuffType === "all" || buff.buff.toLowerCase() === selectedBuffType.toLowerCase());
    let filteredPastBuffs = pastBuffs.filter(buff => selectedBuffType === "all" || buff.buff.toLowerCase() === selectedBuffType.toLowerCase());

    if (filteredBuffs.length === 0 && filteredPastBuffs.length === 0) {
      document.getElementById("countdownTimer").textContent = "--:--:--";
      document.getElementById("lastBuffTime").textContent = "--:--:--";
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
      return;
    }

    let buffDate = moment(nextBuff.datetime).tz("America/Denver");
    let timeDiff = buffDate.diff(now);
    let alertedBuffs = new Set(JSON.parse(localStorage.getItem("alertedBuffs")) || []);
    let buffKey = `${nextBuff.datetime}_${nextBuff.guild}_${nextBuff.buff}`;

    if (timeDiff <= 600000 && timeDiff > 0 && !alertedBuffs.has(buffKey)) {
      showCustomNotification(nextBuff);
      alertedBuffs.add(buffKey);
      localStorage.setItem("alertedBuffs", JSON.stringify([...alertedBuffs]));
      displayBuffs();
    }

    if (timeDiff <= 0) {
      document.getElementById("countdownTimer").textContent = "Buff is now!";
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
    document.getElementById("countdownTimer").textContent = timeString;

    // Update all countdown timers in expanded cards
    updateAllCountdowns();
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

  updateCountdown();
  setInterval(updateCountdown, 1000);
}

function scrollTimeline(direction) {
  const timeline = document.getElementById("buffTimeline");
  const groups = timeline.getElementsByClassName("timeline-group");
  if (groups.length === 0) return;

  // Get the width of a single group including its gap
  const groupStyle = window.getComputedStyle(groups[0]);
  const groupWidth = groups[0].offsetWidth + parseInt(groupStyle.marginRight) + parseInt(groupStyle.marginLeft);
  
  // Calculate the current scroll position
  const currentScroll = timeline.scrollLeft;
  
  // Find the current visible group
  const currentGroupIndex = Math.round(currentScroll / groupWidth);
  
  // Calculate the next group index
  const nextGroupIndex = Math.max(0, Math.min(groups.length - 1, currentGroupIndex + direction));
  
  // Scroll to the next group
  timeline.scrollTo({
    left: nextGroupIndex * groupWidth,
    behavior: 'smooth'
  });
}

// Swipe Gestures for Mobile
document.addEventListener('DOMContentLoaded', () => {
  const buffTimeline = document.getElementById('buffTimeline');
  let touchStartX = 0;
  let touchEndX = 0;

  buffTimeline.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  });

  buffTimeline.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    const groups = buffTimeline.getElementsByClassName("timeline-group");
    if (groups.length === 0) return;

    const groupStyle = window.getComputedStyle(groups[0]);
    const groupWidth = groups[0].offsetWidth + parseInt(groupStyle.marginRight) + parseInt(groupStyle.marginLeft);
    
    if (touchStartX - touchEndX > 50) {
      buffTimeline.scrollTo({
        left: buffTimeline.scrollLeft + groupWidth,
        behavior: 'smooth'
      });
    }
    if (touchEndX - touchStartX > 50) {
      buffTimeline.scrollTo({
        left: buffTimeline.scrollLeft - groupWidth,
        behavior: 'smooth'
      });
    }
  });

  populateTimezoneDropdown();
  loadBuffs();
  setInterval(loadBuffs, 60000);
  displayBuffs();
});
