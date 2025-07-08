// === 1. Constants ===
const appId = "f30028e16e88f9c49da416055f9656e5";
const apiurl = `https://api.openweathermap.org/data/2.5/weather?appid=${appId}&q=`;
const link = "https://api.openweathermap.org/data/2.5/air_pollution";

// === 2. DOM References ===
const latInp = document.querySelector("#latitude");
const lonInp = document.querySelector("#longitude");
const airQuality = document.querySelector(".air-quality");
const airQualityStat = document.querySelector(".air-quality-status");
const srchBtn = document.querySelector(".search-btn");
const errorLabel = document.querySelector("label[for='error-msg']");
const componentsEle = document.querySelectorAll(".component-val");

const cityValue = document.querySelector(".enterlocation input");
const citySearchBtn = document.querySelector(".city-search-btn");
const historyContainer = document.querySelector(".history-buttons");


// === Leaflet Map Setup ===
let map, marker;

function initMap(lat, lon) {
    if (!map) {
        map = L.map('map').setView([lat, lon], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        marker = L.marker([lat, lon], { draggable: true }).addTo(map);
        
        // On drag, update lat/lon fields and fetch air quality
        marker.on('dragend', function (e) {
            const pos = e.target.getLatLng();
            latInp.value = pos.lat.toFixed(4);
            lonInp.value = pos.lng.toFixed(4);
            getairquality(pos.lat.toFixed(4), pos.lng.toFixed(4));
        });
    } else {
        map.setView([lat, lon], 10);
        marker.setLatLng([lat, lon]);
    }
}
function showToast(message, duration = 3000) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.className = "toast show";
    setTimeout(() => {
        toast.className = "toast";
    }, duration);
}
function showLoader() {
    document.getElementById("loader").style.display = "block";
}
function hideLoader() {
    document.getElementById("loader").style.display = "none";
}


// === 3. Functions (Define BEFORE usage) ===

// Fetch Air Quality by Coordinates
const getairquality = async (lat, lon) => {
    try {
        showLoader();
        const rawdata = await fetch(`${link}?lat=${lat}&lon=${lon}&appid=${appId}`);
        const airdata = await rawdata.json();

        if (!airdata || !airdata.list || airdata.list.length === 0) {
            throw new Error("No air quality data found.");
        }

        setvaluesofair(airdata);
        setcomponentofair(airdata);
    } catch (error) {
        errorLabel.innerText = `Air Quality Error: ${error.message}`;
        showToast("Error fetching air quality data.");
        console.error("Air Quality Fetch Error:", error);
    }finally {
        hideLoader();
    }
};

// Set AQI index and color
const setvaluesofair = airdata => {
    const aqi = airdata.list[0].main.aqi;
    let airstat = "", color = "";

    switch (aqi) {
        case 1: airstat = "Good"; color = "rgb(19,201,28)"; break;
        case 2: airstat = "Fair"; color = "rgb(15,134,25)"; break;
        case 3: airstat = "Moderate"; color = "rgb(201,83,13)"; break;
        case 4: airstat = "Poor"; color = "rgb(204,83,13)"; break;
        case 5: airstat = "Very Poor"; color = "rgb(204,13,13)"; break;
        default: airstat = "Unknown"; color = "gray";
    }

    airQuality.innerText = aqi;
    airQualityStat.innerText = airstat;
    airQualityStat.style.color = color;
};
const safeLimits = {
    co: 10000,     // Carbon Monoxide (µg/m³)
    no: 200,       // Nitrogen Monoxide
    no2: 200,      // Nitrogen Dioxide
    o3: 180,       // Ozone
    so2: 20,       // Sulphur Dioxide
    pm2_5: 25,     // PM2.5
    pm10: 50,      // PM10
    nh3: 400       // Ammonia
};
function showMaskAdvisory(components, aqi) {
    const pm25 = components.pm2_5;
    const advisoryEl = document.querySelector(".mask-advisory");

    if (!advisoryEl) return;

    if (aqi >= 3 || pm25 > 35) {
        advisoryEl.innerHTML = `<span style="color:orange;">⚠️ It's advisable to wear a mask today due to poor air quality.</span>`;
    } else {
        advisoryEl.innerHTML = `<span style="color:lightgreen;">✅ Air is relatively clean. Mask not necessary.</span>`;
    }
}



const setcomponentofair = airdata => {
    const component = { ...airdata.list[0].components };

    componentsEle.forEach(ele => {
        const attr = ele.getAttribute('data-comp');
        const value = component[attr];
        const safeLimit = safeLimits[attr];

        if (value !== undefined) {
            let status = "";
            if (value <= safeLimit) {
                status = `<span style="color:lightgreen;">(Safe)</span>`;
            } else if (value <= safeLimit * 2) {
                status = `<span style="color:orange;">(Moderate)</span>`;
            } else {
                status = `<span style="color:red;">(Unsafe)</span>`;
            }

            ele.innerHTML = `${value} µg/m³ ${status}`;
        } else {
            ele.innerText = "N/A";
        }
    });

    updateChart(component); // keep your chart if present
    showMaskAdvisory(component, airdata.list[0].main.aqi);
};

let pollutantChart; // Global reference

function updateChart(components) {
    const labels = Object.keys(components);
    const values = Object.values(components);

    const data = {
        labels: labels,
        datasets: [{
            label: 'μg/m³',
            backgroundColor: '#269fe6',
            borderColor: '#1276b8',
            data: values,
            borderWidth: 1
        }]
    };

    const config = {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Pollutant Concentrations'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    };

    // If chart already exists, destroy and redraw
    if (pollutantChart) {
        pollutantChart.destroy();
    }
    pollutantChart = new Chart(document.getElementById('pollutantChart'), config);
}

// === 4. Geolocation ===
const getUserLocation = () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(onPositionGathered, onPositionGatherError);
    } else {
        onPositionGatherError({ message: "Geolocation not supported by this browser." });
    }
};

const onPositionGathered = pos => {
    const lat = pos.coords.latitude.toFixed(4);
    const lon = pos.coords.longitude.toFixed(4);
    latInp.value = lat;
    lonInp.value = lon;
    getairquality(lat, lon);
    initMap(lat, lon); // <-- Add this line
};


const onPositionGatherError = e => {
    errorLabel.innerText = e.message;
};
const toggle = document.getElementById("darkToggle");
toggle.addEventListener("change", () => {
    document.body.classList.toggle("dark-theme", toggle.checked);
});


// === 5. City Name Search ===
async function checkweather(cityName) {
    try {
        showLoader();
        const response = await fetch(apiurl + cityName);
        const data = await response.json();

        if (data.cod !== 200) {
            throw new Error(data.message || "City not found");
        }

        getairquality(data.coord.lat, data.coord.lon);
        initMap(data.coord.lat, data.coord.lon);
        saveToHistory(cityName);
        showToast("Data loaded successfully!");

    } catch (error) {
        errorLabel.innerText = `City Search Error: ${error.message}`;
        console.error("City Search Error:", error);
    }finally {
        hideLoader();
    }
}

// === 6. Search History ===
function saveToHistory(city) {
    let history = JSON.parse(localStorage.getItem("searchHistory")) || [];

    if (!history.includes(city)) {
        history.unshift(city);
        if (history.length > 5) history.pop();
        localStorage.setItem("searchHistory", JSON.stringify(history));
        renderHistory();
    }
}

function renderHistory() {
    let history = JSON.parse(localStorage.getItem("searchHistory")) || [];
    historyContainer.innerHTML = "";

    history.forEach(city => {
        const btn = document.createElement("button");
        btn.innerText = city;
        btn.classList.add("history-btn");
        btn.addEventListener("click", () => checkweather(city));
        historyContainer.appendChild(btn);
    });
}

// === 7. Event Listeners ===
citySearchBtn.addEventListener("click", () => {
    checkweather(cityValue.value.trim());
});

srchBtn.addEventListener("click", () => {
    const lat = parseFloat(latInp.value);
    const lon = parseFloat(lonInp.value);

    if (isNaN(lat) || isNaN(lon)) {
        errorLabel.innerText = "Invalid latitude or longitude.";
        return;
    }

    getairquality(lat.toFixed(4), lon.toFixed(4));
    initMap(lat, lon);
});
checkweather(cityName).then(() => {
    showToast("City data loaded!");
});

// === 8. Init App ===
getUserLocation();
renderHistory();
