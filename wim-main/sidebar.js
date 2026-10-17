// Sidebar elements
const sidebar = document.getElementById("sidebar");
const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");

//geo json element
let natoLayer = null;
let activeGeoJsonLayers = [];


// Toggle sidebar open/close
toggleSidebarBtn.onclick = () => {
    sidebar.classList.add("open");
    // تغییر متن دکمه به ✖
    toggleSidebarBtn.textContent = "✖";
    // تغییر عملکرد دکمه برای بستن سایدبار
    toggleSidebarBtn.onclick = closeSidebar;
}

// بستن سایدبار
function closeSidebar() {
    sidebar.classList.remove("open");
    // برگرداندن متن دکمه به ☰
    toggleSidebarBtn.textContent = "☰";
    // برگرداندن عملکرد اصلی
    toggleSidebarBtn.onclick = openSidebar;
}

// باز کردن سایدبار
function openSidebar() {
    sidebar.classList.add("open");
    toggleSidebarBtn.textContent = "✖";
    toggleSidebarBtn.onclick = closeSidebar;
}

// بستن سایدبار با دکمه ✖ داخل آن
closeSidebarBtn.onclick = closeSidebar;

// b1 & b2 button
const b1 = document.getElementById("b1");
const b2 = document.getElementById("b2");

b1.onclick = () => {
    b1.classList.toggle("active");
    if (b1.classList.contains("active")) {
        loadGeoJson("nato-countries.json");
    } else {
        console.log("Button 1 غیرفعال شد");
        removeAllGeoJsonLayers();
    }
}

b2.onclick = () => {
    b2.classList.toggle("active");
    if (b2.classList.contains("active")) {
        // اینجا می‌توانید عملکرد خاصی اضافه کنید
    } else {
        // اینجا می‌توانید عملکرد خاصی اضافه کنید
    }
}

    // بارگذاری وضعیت اولیه
    loadButtonStates();

    // Event listener برای b1
    b1.onclick = () => {
        const isActive = b1.classList.toggle("active");
        localStorage.setItem('b1Active', isActive);
        
        console.log(`Button 1: ${isActive ? 'فعال' : 'غیرفعال'}`);
        // اینجا می‌توانید عملکرد خاصی اضافه کنید
    };

    // Event listener برای b2
    b2.onclick = () => {
        const isActive = b2.classList.toggle("active");
        localStorage.setItem('b2Active', isActive);
        
        console.log(`Button 2: ${isActive ? 'فعال' : 'غیرفعال'}`);
        // اینجا می‌توانید عملکرد خاصی اضافه کنید
    };


// صبر کن تا DOM کامل لود شود
document.addEventListener('DOMContentLoaded', () => {
    // بررسی وجود المنت‌ها قبل از فراخوانی
    if (sidebar && toggleSidebarBtn) {
        initSidebar();
    }
    
    if (b1 && b2) {
        initButtons();
    }
    
    console.log("Sidebar module loaded successfully!");
});


// loadGeoJson function
function loadGeoJson(filePath) {
    fetch(filePath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`خطا در بارگیری ${filePath}: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // ایجاد لایه GeoJSON
            const geoJsonLayer = L.geoJSON(data, {
                style: {
                    fillColor: "#1e40af", 
                    weight: 2,
                    opacity: 1,
                    color: "#1e3a8a", 
                    fillOpacity: 0.3,
                },  
                interactive: false,
            }).addTo(map);
            
            // ذخیره لایه برای مدیریت بعدی
            activeGeoJsonLayers.push(geoJsonLayer);
            
            // تنظیم view بر اساس محدوده داده‌ها
            if (data.bbox) {
                const bounds = [
                    [data.bbox[1], data.bbox[0]],
                    [data.bbox[3], data.bbox[2]]
                ];
                map.fitBounds(bounds);
            } else if (geoJsonLayer.getBounds) {
                const bounds = geoJsonLayer.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds);
                }
            }
            
        })
        .catch(error => {
            alert(`خطا در بارگیری فایل ${filePath}`);
        });
}

// remove all Geojson file
function removeAllGeoJsonLayers() {
    activeGeoJsonLayers.forEach(layer => {
        if (layer && map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    activeGeoJsonLayers = [];
}