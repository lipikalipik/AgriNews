// API Configuration
const API_KEY = 'ed4c7e5994cfa3e1c8d5d5087fc720ad';
const WEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';
const FORECAST_BASE_URL = 'https://api.openweathermap.org/data/2.5/forecast';

let currentWeatherData = null;

// DOM Elements
const searchInput = document.getElementById('city-search');
const searchBtn = document.getElementById('search-btn');
const recentList = document.getElementById('recent-list');
const loadingSpinner = document.querySelector('.loading-spinner');
const errorMessage = document.getElementById('error-message');
const currentWeather = document.querySelector('.current-weather');
const agriAdvice = document.querySelector('.agri-advice');
const forecastSection = document.querySelector('.forecast-section');
const hourlyForecast = document.querySelector('.hourly-forecast');
const hourlyContainer = document.getElementById('hourly-container');
const scrollLeftBtn = document.querySelector('.scroll-left');
const scrollRightBtn = document.querySelector('.scroll-right');
const refreshSuggestionsBtn = document.getElementById('refresh-suggestions-btn');
const suggestCropsBtn = document.getElementById('suggest-crops-btn');

// Initialize recent searches from localStorage
let recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');

// Update recent searches display
function updateRecentSearches() {
    recentList.innerHTML = '';
    recentSearches.slice(0, 5).forEach(city => {
        const item = document.createElement('div');
        item.className = 'recent-item';
        item.textContent = city;
        item.addEventListener('click', () => fetchWeatherData(city));
        recentList.appendChild(item);
    });
}

// Add city to recent searches
function addToRecentSearches(city) {
    const index = recentSearches.indexOf(city);
    if (index > -1) {
        recentSearches.splice(index, 1);
    }
    recentSearches.unshift(city);
    if (recentSearches.length > 5) {
        recentSearches.pop();
    }
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    updateRecentSearches();
}

// Format date
function formatDate(timestamp, timezone) {
    const date = new Date((timestamp + timezone) * 1000);
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
    }).format(date);
}

// Format time
function formatTime(timestamp) {
    return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true
    });
}

// Fetch weather data
async function fetchWeatherData(city) {
    try {
        // Show loading spinner
        loadingSpinner.style.display = 'block';
        errorMessage.style.display = 'none';
        currentWeather.style.display = 'none';
        hourlyForecast.style.display = 'none';
        agriAdvice.style.display = 'none';
        forecastSection.style.display = 'none';

        // Fetch current weather
        const weatherUrl = `${WEATHER_BASE_URL}?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
        console.log('Fetching weather from:', weatherUrl);

        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();

        if (!weatherResponse.ok) {
            throw new Error(`Weather API Error: ${weatherData.message || 'City not found'}`);
        }

        // Fetch 5-day forecast (maximum available from free API)
        const forecastUrl = `${FORECAST_BASE_URL}?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
        console.log('Fetching forecast from:', forecastUrl);

        const forecastResponse = await fetch(forecastUrl);
        const forecastData = await forecastResponse.json();

        if (!forecastResponse.ok) {
            throw new Error(`Forecast API Error: ${forecastData.message || 'Forecast data not available'}`);
        }

        currentWeatherData = weatherData;

        // Process forecast data
        const hourlyData = forecastData.list.slice(0, 8); // Get next 24 hours (3-hour intervals)
        const dailyForecast = processForecastData(forecastData.list);

        // Update displays
        updateWeatherDisplay(weatherData, dailyForecast);
        updateHourlyDisplay(hourlyData);
        updateCropSuggestions();
        addToRecentSearches(city);

    } catch (error) {
        console.error('Error fetching weather data:', error);
        errorMessage.textContent = error.message || 'City not found. Please try again.';
        errorMessage.style.display = 'block';
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// Process forecast data to get daily forecasts
function processForecastData(forecastList) {
    const dailyData = [];
    const dailyMap = new Map();

    forecastList.forEach(item => {
        const date = new Date(item.dt * 1000).toLocaleDateString();

        if (!dailyMap.has(date)) {
            dailyMap.set(date, {
                dt: item.dt,
                temp: {
                    min: item.main.temp,
                    max: item.main.temp
                },
                weather: item.weather,
                pop: item.pop || 0
            });
        } else {
            const existing = dailyMap.get(date);
            existing.temp.min = Math.min(existing.temp.min, item.main.temp);
            existing.temp.max = Math.max(existing.temp.max, item.main.temp);
        }
    });

    dailyMap.forEach(value => dailyData.push(value));
    return dailyData.slice(0, 7);
}

// Update weather display
function updateWeatherDisplay(weather, forecast) {
    // Update current weather
    document.getElementById('city-name').textContent = weather.name;
    document.getElementById('current-date').textContent = formatDate(weather.dt, weather.timezone);
    document.getElementById('temperature').textContent = `${Math.round(weather.main.temp)}°C`;
    document.getElementById('weather-condition').textContent = weather.weather[0].description;
    document.getElementById('humidity').textContent = `${weather.main.humidity}%`;
    document.getElementById('wind-speed').textContent = `${weather.wind.speed} m/s`;
    document.getElementById('rainfall').textContent = weather.rain ? `${weather.rain['1h']} mm` : '0 mm';
    document.getElementById('sunrise').textContent = formatDate(weather.sys.sunrise, weather.timezone).split(', ')[1];
    document.getElementById('sunset').textContent = formatDate(weather.sys.sunset, weather.timezone).split(', ')[1];
    document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`;

    // Update forecast
    const forecastContainer = document.getElementById('forecast-container');
    forecastContainer.innerHTML = forecast.map(day => `
        <div class="forecast-card">
            <h3>${new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' })}</h3>
            <img src="https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png" alt="${day.weather[0].description}">
            <div class="forecast-temp">
                <span class="max-temp">${Math.round(day.temp.max)}°C</span>
                <span class="min-temp">${Math.round(day.temp.min)}°C</span>
            </div>
            <p>${day.weather[0].description}</p>
            <p>Rain: ${Math.round(day.pop * 100)}%</p>
        </div>
    `).join('');

    // Show weather sections
    currentWeather.style.display = 'block';
    agriAdvice.style.display = 'block';
    forecastSection.style.display = 'block';
}

// Update hourly display
function updateHourlyDisplay(hourlyData) {
    hourlyContainer.innerHTML = hourlyData.map(hour => `
        <div class="hourly-card">
            <div class="time">${formatTime(hour.dt)}</div>
            <img src="https://openweathermap.org/img/wn/${hour.weather[0].icon}@2x.png" 
                 alt="${hour.weather[0].description}">
            <div class="temp">${Math.round(hour.main.temp)}°C</div>
            <div class="details">
                <div>${hour.weather[0].description}</div>
                <div>${hour.main.humidity}% humidity</div>
            </div>
        </div>
    `).join('');

    hourlyForecast.style.display = 'block';
}

// Event Listeners
searchBtn.addEventListener('click', () => {
    const city = searchInput.value.trim();
    if (city) {
        fetchWeatherData(city);
    }
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = searchInput.value.trim();
        if (city) {
            fetchWeatherData(city);
        }
    }
});

scrollLeftBtn.addEventListener('click', () => {
    hourlyContainer.scrollBy({ left: -300, behavior: 'smooth' });
});

scrollRightBtn.addEventListener('click', () => {
    hourlyContainer.scrollBy({ left: 300, behavior: 'smooth' });
});

refreshSuggestionsBtn.addEventListener('click', updateCropSuggestions);

// Initial Load
updateRecentSearches();
if (recentSearches.length > 0) {
    fetchWeatherData(recentSearches[0]);
}

const cropSuggestions = {
    Tropical: {
        Clear: {
            hot: [
                { name: 'Cassava', icon: '🥔', description: 'Drought-resistant root crop', season: 'Year-round' },
                { name: 'Sweet Potato', icon: '🍠', description: 'Nutritious tuber crop', season: 'Year-round' },
                { name: 'Taro', icon: '🍃', description: 'Traditional root vegetable', season: 'Year-round' },
                { name: 'Yam', icon: '🥔', description: 'Staple food crop', season: 'Year-round' },
                { name: 'Pineapple', icon: '🍍', description: 'Tropical fruit crop', season: 'Year-round' },
                { name: 'Mango', icon: '🥭', description: 'Popular tropical fruit', season: 'Spring-Summer' },
                { name: 'Papaya', icon: '🥭', description: 'Fast-growing fruit tree', season: 'Year-round' },
                { name: 'Sugarcane', icon: '🎋', description: 'Commercial sugar crop', season: 'Year-round' },
                { name: 'Banana', icon: '🍌', description: 'Staple fruit crop', season: 'Year-round' },
                { name: 'Avocado', icon: '🥑', description: 'Nutritious fruit tree', season: 'Year-round' }
            ],
            warm: [
                { name: 'Maize', icon: '🌽', description: 'Staple grain crop', season: 'Spring-Summer' },
                { name: 'Rice', icon: '🍚', description: 'Primary food crop', season: 'Year-round' },
                { name: 'Cowpea', icon: '🫘', description: 'Drought-tolerant legume', season: 'Spring-Summer' },
                { name: 'Soybean', icon: '🫘', description: 'High-protein legume', season: 'Spring-Summer' },
                { name: 'Groundnut', icon: '🥜', description: 'Nutritious legume', season: 'Spring-Summer' },
                { name: 'Okra', icon: '🥬', description: 'Heat-loving vegetable', season: 'Spring-Summer' },
                { name: 'Eggplant', icon: '🍆', description: 'Warm-season vegetable', season: 'Spring-Summer' },
                { name: 'Chili Pepper', icon: '🌶️', description: 'Spice crop', season: 'Spring-Summer' }
            ],
        },
        Clouds: {
            hot: [
                { name: 'Rice', icon: '🍚', description: 'Primary food crop', season: 'Year-round' },
                { name: 'Sugarcane', icon: '🎋', description: 'Commercial sugar crop', season: 'Year-round' },
                { name: 'Banana', icon: '🍌', description: 'Staple fruit crop', season: 'Year-round' },
                { name: 'Ginger', icon: '🫚', description: 'Medicinal root crop', season: 'Year-round' },
                { name: 'Turmeric', icon: '🫚', description: 'Spice and medicinal crop', season: 'Year-round' }
            ],
            warm: [
                { name: 'Maize', icon: '🌽', description: 'Staple grain crop', season: 'Spring-Summer' },
                { name: 'Soybean', icon: '🫘', description: 'High-protein legume', season: 'Spring-Summer' },
                { name: 'Beans', icon: '🫘', description: 'Nutritious legumes', season: 'Spring-Summer' },
                { name: 'Leafy Greens', icon: '🥬', description: 'Nutritious vegetables', season: 'Year-round' },
                { name: 'Cucumber', icon: '🥒', description: 'Cooling vegetable', season: 'Spring-Summer' }
            ],
        },
        Rain: {
            hot: [
                { name: 'Rice', icon: '🍚', description: 'Primary food crop', season: 'Year-round' },
                { name: 'Taro', icon: '🍃', description: 'Traditional root vegetable', season: 'Year-round' },
                { name: 'Jute', icon: '🌿', description: 'Fiber crop', season: 'Spring-Summer' },
                { name: 'Sugarcane', icon: '🎋', description: 'Commercial sugar crop', season: 'Year-round' },
                { name: 'Sweet Potato', icon: '🍠', description: 'Nutritious tuber crop', season: 'Year-round' }
            ],
            warm: [
                { name: 'Rice', icon: '🍚', description: 'Primary food crop', season: 'Year-round' },
                { name: 'Maize', icon: '🌽', description: 'Staple grain crop', season: 'Spring-Summer' },
                { name: 'Beans', icon: '🫘', description: 'Nutritious legumes', season: 'Spring-Summer' },
                { name: 'Ginger', icon: '🫚', description: 'Medicinal root crop', season: 'Year-round' },
                { name: 'Turmeric', icon: '🫚', description: 'Spice and medicinal crop', season: 'Year-round' }
            ],
        },
    },
    Temperate: {
        Clear: {
            warm: [
                { name: 'Maize', icon: '🌽', description: 'Staple grain crop', season: 'Spring-Summer' },
                { name: 'Tomato', icon: '🍅', description: 'Popular vegetable', season: 'Spring-Summer' },
                { name: 'Bell Pepper', icon: '🫑', description: 'Sweet pepper variety', season: 'Spring-Summer' },
                { name: 'Cucumber', icon: '🥒', description: 'Cooling vegetable', season: 'Spring-Summer' },
                { name: 'Zucchini', icon: '🥒', description: 'Summer squash', season: 'Spring-Summer' },
                { name: 'Sunflower', icon: '🌻', description: 'Oil seed crop', season: 'Spring-Summer' },
                { name: 'Soybean', icon: '🫘', description: 'High-protein legume', season: 'Spring-Summer' },
                { name: 'Beans', icon: '🫘', description: 'Nutritious legumes', season: 'Spring-Summer' }
            ],
            cool: [
                { name: 'Wheat', icon: '🌾', description: 'Staple grain crop', season: 'Fall-Spring' },
                { name: 'Barley', icon: '🌾', description: 'Cereal grain', season: 'Fall-Spring' },
                { name: 'Oats', icon: '🌾', description: 'Nutritious grain', season: 'Fall-Spring' },
                { name: 'Potato', icon: '🥔', description: 'Staple tuber crop', season: 'Spring-Fall' },
                { name: 'Carrot', icon: '🥕', description: 'Root vegetable', season: 'Spring-Fall' },
                { name: 'Cabbage', icon: '🥬', description: 'Cool-season vegetable', season: 'Spring-Fall' },
                { name: 'Broccoli', icon: '🥦', description: 'Nutritious vegetable', season: 'Spring-Fall' },
                { name: 'Cauliflower', icon: '🥦', description: 'Cool-season vegetable', season: 'Spring-Fall' },
                { name: 'Peas', icon: '🫛', description: 'Cool-season legume', season: 'Spring-Fall' },
                { name: 'Lentil', icon: '🫘', description: 'Protein-rich legume', season: 'Spring-Fall' },
                { name: 'Apple', icon: '🍎', description: 'Popular fruit tree', season: 'Fall' },
                { name: 'Pear', icon: '🍐', description: 'Sweet fruit tree', season: 'Fall' }
            ],
        },
        Clouds: {
            warm: [
                { name: 'Broccoli', icon: '🥦', description: 'Nutritious vegetable', season: 'Spring-Fall' },
                { name: 'Spinach', icon: '🥬', description: 'Leafy green vegetable', season: 'Spring-Fall' },
                { name: 'Lettuce', icon: '🥬', description: 'Salad green', season: 'Spring-Fall' },
                { name: 'Kale', icon: '🥬', description: 'Nutritious leafy green', season: 'Spring-Fall' },
                { name: 'Radish', icon: '🥬', description: 'Fast-growing root crop', season: 'Spring-Fall' },
                { name: 'Beans', icon: '🫘', description: 'Nutritious legumes', season: 'Spring-Summer' },
                { name: 'Peas', icon: '🫛', description: 'Cool-season legume', season: 'Spring-Fall' }
            ],
            cool: [
                { name: 'Cabbage', icon: '🥬', description: 'Cool-season vegetable', season: 'Spring-Fall' },
                { name: 'Cauliflower', icon: '🥦', description: 'Cool-season vegetable', season: 'Spring-Fall' },
                { name: 'Brussels Sprouts', icon: '🥬', description: 'Winter vegetable', season: 'Fall-Winter' },
                { name: 'Leeks', icon: '🧅', description: 'Mild onion variety', season: 'Spring-Fall' },
                { name: 'Turnips', icon: '🥬', description: 'Root vegetable', season: 'Spring-Fall' }
            ],
        },
        Rain: {
            warm: [
                { name: 'Wheat', icon: '🌾', description: 'Staple grain crop', season: 'Fall-Spring' },
                { name: 'Barley', icon: '🌾', description: 'Cereal grain', season: 'Fall-Spring' },
                { name: 'Peas', icon: '🫛', description: 'Cool-season legume', season: 'Spring-Fall' },
                { name: 'Broccoli', icon: '🥦', description: 'Nutritious vegetable', season: 'Spring-Fall' },
                { name: 'Cauliflower', icon: '🥦', description: 'Cool-season vegetable', season: 'Spring-Fall' },
                { name: 'Potato', icon: '🥔', description: 'Staple tuber crop', season: 'Spring-Fall' }
            ],
            cool: [
                { name: 'Mushrooms', icon: '🍄', description: 'Fungi crop', season: 'Year-round' },
                { name: 'Kale', icon: '🥬', description: 'Nutritious leafy green', season: 'Spring-Fall' },
                { name: 'Spinach', icon: '🥬', description: 'Leafy green vegetable', season: 'Spring-Fall' }
            ],
        },
    },
    Arid: {
        Clear: {
            hot: [
                { name: 'Sorghum', icon: '🌾', description: 'Drought-resistant grain', season: 'Spring-Summer' },
                { name: 'Millet', icon: '🌾', description: 'Drought-tolerant grain', season: 'Spring-Summer' },
                { name: 'Cowpea', icon: '🫘', description: 'Drought-tolerant legume', season: 'Spring-Summer' },
                { name: 'Chickpea', icon: '🫘', description: 'Drought-resistant legume', season: 'Spring-Summer' },
                { name: 'Dates', icon: '🫘', description: 'Drought-tolerant fruit', season: 'Year-round' },
                { name: 'Figs', icon: '🫘', description: 'Drought-resistant fruit', season: 'Summer-Fall' },
                { name: 'Pomegranate', icon: '🫘', description: 'Drought-tolerant fruit', season: 'Fall' }
            ],
            warm: [
                { name: 'Lentil', icon: '🫘', description: 'Protein-rich legume', season: 'Spring-Fall' },
                { name: 'Barley', icon: '🌾', description: 'Cereal grain', season: 'Fall-Spring' },
                { name: 'Melons', icon: '🍈', description: 'Drought-tolerant fruits', season: 'Summer' },
                { name: 'Gourds', icon: '🎃', description: 'Drought-resistant vegetables', season: 'Summer-Fall' }
            ],
        },
        Clouds: {
            hot: [
                { name: 'Sorghum', icon: '🌾', description: 'Drought-resistant grain', season: 'Spring-Summer' },
                { name: 'Millet', icon: '🌾', description: 'Drought-tolerant grain', season: 'Spring-Summer' }
            ],
            warm: [
                { name: 'Chickpea', icon: '🫘', description: 'Drought-resistant legume', season: 'Spring-Summer' },
                { name: 'Lentil', icon: '🫘', description: 'Protein-rich legume', season: 'Spring-Fall' }
            ],
        },
    },
    default: [
        { name: 'Quinoa', icon: '🌾', description: 'Nutritious pseudo-grain', season: 'Spring-Summer' },
        { name: 'Amaranth', icon: '🌾', description: 'Ancient grain crop', season: 'Spring-Summer' },
        { name: 'Buckwheat', icon: '🌾', description: 'Fast-growing grain', season: 'Spring-Summer' }
    ]
};

function getClimateZone(lat) {
    const absLat = Math.abs(lat);
    if (absLat <= 23.5) {
        return 'Tropical';
    } else if (absLat > 23.5 && absLat <= 40) {
        // Simple check for arid regions, can be improved with more data like precipitation
        // For this example, we'll assume it's Temperate but an Arid check could go here
        return 'Temperate';
    } else if (absLat > 40 && absLat <= 66.5) {
        return 'Temperate';
    } else {
        return 'Polar'; // No specific crops for polar in this example
    }
}

function updateCropSuggestions() {
    if (!currentWeatherData) {
        return;
    }

    const temp = currentWeatherData.main.temp;
    const condition = currentWeatherData.weather[0].main;
    const lat = currentWeatherData.coord.lat;
    const climateZone = getClimateZone(lat);

    let tempCategory;
    if (temp > 27) {
        tempCategory = 'hot';
    } else if (temp >= 15) {
        tempCategory = 'warm';
    } else {
        tempCategory = 'cool';
    }

    let suggestedCrops = (cropSuggestions[climateZone] &&
        cropSuggestions[climateZone][condition] &&
        cropSuggestions[climateZone][condition][tempCategory])
        ? cropSuggestions[climateZone][condition][tempCategory]
        : cropSuggestions.default;

    const reasonsList = document.getElementById('advice-reasons');
    const adviceDescription = document.getElementById('advice-description');
    const adviceTitle = document.getElementById('advice-title');
    const adviceIcon = document.getElementById('advice-icon');

    // Update icon based on climate zone
    const climateIcons = {
        'Tropical': '🌴',
        'Temperate': '🌳',
        'Arid': '🏜️',
        'Polar': '❄️'
    };

    adviceTitle.textContent = `Crop Suggestions for ${climateZone} Climate`;
    adviceIcon.textContent = climateIcons[climateZone] || '🌱';

    if (suggestedCrops && suggestedCrops.length > 0) {
        const shuffledCrops = suggestedCrops.sort(() => 0.5 - Math.random());
        const selectedCrops = shuffledCrops.slice(0, 2); // Show 2 crops instead of 4

        adviceDescription.textContent = `Based on current weather (${condition.toLowerCase()}) and temperature (${Math.round(temp)}°C), here are some excellent crop suggestions for your ${climateZone.toLowerCase()} climate:`;

        reasonsList.innerHTML = selectedCrops.map((crop, index) => `
            <li class='crop-animate' style="animation-delay: ${index * 0.1}s">
                <span class="crop-icon">${crop.icon}</span>
                <div class="crop-info">
                    <span class="crop-name">${crop.name}</span>
                    <span class="crop-description">${crop.description}</span>
                    <span class="crop-season">🌱 ${crop.season}</span>
                </div>
            </li>
        `).join('');
    } else {
        adviceDescription.textContent = `No specific crop suggestions for the current climate (${climateZone}), weather (${condition.toLowerCase()}), and temperature (${Math.round(temp)}°C). Consider these versatile crops:`;
        reasonsList.innerHTML = cropSuggestions.default.map((crop, index) => `
            <li class='crop-animate' style="animation-delay: ${index * 0.1}s">
                <span class="crop-icon">${crop.icon}</span>
                <div class="crop-info">
                    <span class="crop-name">${crop.name}</span>
                    <span class="crop-description">${crop.description}</span>
                    <span class="crop-season">🌱 ${crop.season}</span>
                </div>
            </li>
        `).join('');
    }

    agriAdvice.style.display = 'block';
}

// Handle navbar profile
document.addEventListener('DOMContentLoaded', async () => {
    const loginButton = document.getElementById('nav-login-btn');
    const profileDropdown = document.getElementById('nav-profile-dropdown');
    const profileNameNav = document.getElementById('nav-profile-name');
    const profileImageNav = document.getElementById('nav-profile-image');
    const logoutButton = document.getElementById('nav-logout-btn');

    // Default state: User is logged out
    if (loginButton) loginButton.style.display = 'flex';
    if (profileDropdown) profileDropdown.style.display = 'none';

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Error getting session for UI update:', error);
        return;
    }

    if (session && session.user) {
        // User is logged in
        if (loginButton) loginButton.style.display = 'none';
        if (profileDropdown) profileDropdown.style.display = 'flex';

        // Use getCurrentUserProfile from auth.js as it's designed for current user
        const profile = await getCurrentUserProfile();
        if (profile) {
            if (profileNameNav) profileNameNav.textContent = profile.full_name || session.user.email;
            if (profile.avatar_url && profileImageNav) {
                profileImageNav.src = profile.avatar_url;
            } else if (profileImageNav) {
                profileImageNav.src = 'assets/default-avatar.svg';
            }
        } else {
            if (profileNameNav) profileNameNav.textContent = session.user.email;
            if (profileImageNav) profileImageNav.src = 'assets/default-avatar.svg';
        }

        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                logout(); // from auth.js
            });
        }
    } else {
        // User is not logged in
        if (loginButton && !loginButton.onclick) {
            loginButton.onclick = () => { window.location.href = 'login.html'; };
        }
    }

    // Hamburger menu toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const authButtons = document.querySelector('.auth-buttons');
    if (hamburger && navLinks && authButtons) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            authButtons.classList.toggle('active');
        });
    }

    // Profile dropdown toggle
    const profileTrigger = document.querySelector('.profile-trigger');
    if (profileTrigger) {
        profileTrigger.addEventListener('click', (event) => {
            event.stopPropagation();
            const content = profileTrigger.nextElementSibling;
            if (content && content.classList.contains('dropdown-content')) {
                content.style.display = content.style.display === 'block' ? 'none' : 'block';
            }
        });
    }
    // Close dropdown if clicked outside
    window.addEventListener('click', function (event) {
        if (profileDropdown && !profileDropdown.contains(event.target)) {
            const content = document.querySelector('.profile-dropdown .dropdown-content');
            if (content) content.style.display = 'none';
        }
    });
}); 
