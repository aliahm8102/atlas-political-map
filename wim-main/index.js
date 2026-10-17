// Map setup
const map = L.map("map", {
maxBounds: [
    [-85, -180],
    [85, 180],
],
maxBoundsViscosity: 1.0,
}).setView([20, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
attribution: "© OpenStreetMap contributors",
noWrap: true,
minZoom: 3,
}).addTo(map);

const politicianMarkers = [];
const layerGroup = L.layerGroup().addTo(map);


// Icon creator
function createPoliticianIcon(
imageUrl,
zoomLevel,
name,
role = "member"
) {
const size = zoomLevel * 3 + 20;
const borderColor =
    role === "leader" ? "gold" : role === "army" ? "green" : "#333";
const borderWidth =
    role === "leader" ? "4px" : role === "army" ? "3px" : "2px";
return L.divIcon({
    html: `<div class="politician-icon"
            style="width:${size}px;height:${size}px;border:${borderWidth} solid ${borderColor};"
            title="${name}">
        <img src="${imageUrl}" />
        </div>`,
    className: "",
    iconSize: [size, size],
});
}

// Modal
const modal = document.getElementById("infoModal");
const closeBtn = document.getElementById("closeInfo");
function showInfoModal(name, imageUrl, title) {
document.getElementById("infoName").textContent = name;
document.getElementById("infoTitle").textContent = title || "";
document.getElementById("infoImage").src = imageUrl;
modal.classList.add("show");
}
function hideInfoModal() {
modal.classList.remove("show");
}
closeBtn.onclick = hideInfoModal;
modal.addEventListener("click", (e) => {
if (e.target === modal) hideInfoModal();
});
window.addEventListener("keydown", (e) => {
if (e.key === "Escape") hideInfoModal();
});

const timeBar = document.getElementById("timeBar");
const yearLabel = document.getElementById("yearLabel");
const getSliderYear = () => parseInt(timeBar.value, 10);

function addPolitician(
lat,
lng,
name,
imageUrl,
role,
title,
startYear,
endYear
) {
const marker = L.marker([lat, lng], {
    icon: createPoliticianIcon(imageUrl, map.getZoom(), name, role),
    draggable: true,
    zIndexOffset: role === "leader" ? 1000 : 0,
});

marker.on("click", () => showInfoModal(name, imageUrl, title));

const record = {
    marker,
    imageUrl,
    name,
    role,
    title,
    startYear,
    endYear,
};
politicianMarkers.push(record);

const currentYear = getSliderYear();
const show =
    (startYear == null || currentYear >= startYear) &&
    (endYear == null || currentYear <= endYear);

if (show) marker.addTo(layerGroup);
}

function updateVisibility(currentDate) {
politicianMarkers.forEach((p) => {
    const shouldShow =
    (p.startYear == null || currentDate >= p.startYear) &&
    (p.endYear == null || currentDate <= p.endYear);

    const isShown = layerGroup.hasLayer(p.marker);

    if (shouldShow && !isShown) {
    p.marker.addTo(layerGroup);
    } else if (!shouldShow && isShown) {
    layerGroup.removeLayer(p.marker);
    }
});
}

// Resize on zoom
map.on("zoom", () => {
const zoomLevel = map.getZoom();
politicianMarkers.forEach((p) => {
    p.marker.setIcon(
    createPoliticianIcon(p.imageUrl, zoomLevel, p.name, p.role)
    );
});
});

// === load data ===
const files = ["politicians.json", "Iran.json", "Historical.json" , "popes.json" ,"US.json", "aaa.json"];
Promise.all(
    files.map((f) =>
        fetch(f)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [])
)
)
.then((lists) => {
    const all = lists.flat();
    all.forEach((p) => {
    addPolitician(
        p.lat,
        p.lng,
        p.name,
        p.imageUrl,
        p.role,
        p.title,
        p.startYear ?? null,
        p.endYear ?? null
    );
    });

    updateVisibility(getSliderYear());
})
.catch((error) => console.error("error", error));

// ***** Time Bar Logic *****

// === Helper: Convert decimal year to Year+Month ===
function getYearMonth(value) {
    const year = Math.floor(value);
    const monthIndex = Math.round((value - year) * 12); // 0-12
    const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];
    const month = monthNames[monthIndex];
    return { year, month };
}
// === Update Label and Visibility ===
timeBar.addEventListener("input", (e) => {
    const currentDate = parseFloat(e.target.value);
    const { year, month } = getYearMonth(currentDate);
    yearLabel.textContent = `${month} ${year}`;
    updateVisibility(currentDate);
});

// Initialize
const currentDate = getYearMonth(parseFloat(timeBar.value));
yearLabel.textContent = `${month} ${year}`;
updateVisibility(currentDate);

updateVisibility(getSliderYear());