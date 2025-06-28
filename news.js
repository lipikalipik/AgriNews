// Constants
const API_KEY = 'a5075f4bbda301f5322cdf28282bad60';
const BASE_URL = 'https://gnews.io/api/v4/search';
const UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutes

// DOM Elements
let newsContainer, loginMessage, loginBtn, profileDropdown, profileName, profileImage;
let newsGrid, searchInput, searchBtn, clearSearchBtn, filterButtons, marketPrices, lastUpdatedTime;
let newsTemplate, errorTemplate;

// State
let newsArticles = [];
let currentFilter = 'all';
let searchQuery = '';

// Market prices data (fallback)
const marketPricesData = [
    { crop: 'Rice', price: '2000/quintal', change: '+2.5%' },
    { crop: 'Wheat', price: '2200/quintal', change: '+1.8%' },
    { crop: 'Cotton', price: '6500/quintal', change: '-0.5%' },
    { crop: 'Sugarcane', price: '350/quintal', change: '+3.2%' },
    { crop: 'Soybean', price: '4200/quintal', change: '+1.2%' },
    { crop: 'Maize', price: '1800/quintal', change: '+0.8%' }
];

// Government schemes data
const governmentSchemes = [
    {
        title: 'PM-KISAN',
        description: 'Direct income support of ₹6,000 per year to farmers',
        status: 'Active',
        deadline: 'Ongoing'
    },
    {
        title: 'PM Fasal Bima Yojana',
        description: 'Crop insurance scheme for farmers',
        status: 'Active',
        deadline: 'Ongoing'
    },
    {
        title: 'Kisan Credit Card',
        description: 'Easy credit access for farmers',
        status: 'Active',
        deadline: 'Ongoing'
    },
    {
        title: 'Soil Health Card Scheme',
        description: 'Free soil testing for farmers',
        status: 'Active',
        deadline: 'Ongoing'
    }
];

// Initialize DOM elements
function initializeDOMElements() {
    newsContainer = document.querySelector('.news-container');
    loginMessage = document.querySelector('.login-message');
    loginBtn = document.getElementById('nav-login-btn');
    profileDropdown = document.querySelector('.profile-dropdown');
    profileName = document.getElementById('nav-profile-name');
    profileImage = document.getElementById('nav-profile-image');
    newsGrid = document.getElementById('news-grid');
    searchInput = document.getElementById('search-input');
    searchBtn = document.getElementById('search-btn');
    clearSearchBtn = document.getElementById('clear-search-btn');
    filterButtons = document.querySelectorAll('.filter-btn');
    marketPrices = document.getElementById('market-prices');
    lastUpdatedTime = document.getElementById('last-updated-time');
    newsTemplate = document.getElementById('news-template');
    errorTemplate = document.getElementById('error-template');

    // Debug log for DOM elements
    console.log('DOM Elements initialized:', {
        newsContainer: !!newsContainer,
        searchInput: !!searchInput,
        searchBtn: !!searchBtn,
        clearSearchBtn: !!clearSearchBtn,
        filterButtons: filterButtons ? filterButtons.length : 0,
        newsGrid: !!newsGrid,
        newsTemplate: !!newsTemplate,
        errorTemplate: !!errorTemplate
    });
}

// Check authentication status using Supabase
async function checkAuthStatus() {
    try {
        // Check if Supabase is available (from auth.js)
        if (typeof supabase !== 'undefined') {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (session && session.user) {
                // User is logged in with Supabase
                if (loginBtn) loginBtn.style.display = 'none';
                if (profileDropdown) profileDropdown.style.display = 'block';
                if (profileName) profileName.textContent = session.user.email;
                if (loginMessage) loginMessage.style.display = 'none';
                if (newsContainer) newsContainer.style.display = 'block';

                // Load profile photo if exists
                const profile = await getCurrentUserProfile();
                if (profile && profile.avatar_url && profileImage) {
                    profileImage.src = profile.avatar_url;
                } else if (profileImage) {
                    profileImage.src = '../assets/default-avatar.svg';
                }

                // Initialize news manager
                initializeNewsManager();
                return;
            }
        }

        // Fallback to localStorage check
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

        if (currentUser) {
            // User is logged in via localStorage
            if (loginBtn) loginBtn.style.display = 'none';
            if (profileDropdown) profileDropdown.style.display = 'block';
            if (profileName) profileName.textContent = currentUser.name || currentUser.email;
            if (loginMessage) loginMessage.style.display = 'none';
            if (newsContainer) newsContainer.style.display = 'block';

            // Load profile photo if exists
            const profileData = JSON.parse(localStorage.getItem(`profile_${currentUser.email}`) || '{}');
            if (profileData.photoUrl && profileImage) {
                profileImage.src = profileData.photoUrl;
            } else if (profileImage) {
                profileImage.src = '../assets/default-avatar.svg';
            }

            // Initialize news manager
            initializeNewsManager();
        } else {
            // User is not logged in
            if (loginMessage) loginMessage.style.display = 'flex';
            if (newsContainer) newsContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        // Show login message on error
        if (loginMessage) loginMessage.style.display = 'flex';
        if (newsContainer) newsContainer.style.display = 'none';
    }
}

// Check authentication status
document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    checkAuthStatus();
});

// Handle logout
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('logout-btn')) {
        e.preventDefault();

        // Clear localStorage
        localStorage.removeItem('currentUser');

        // Logout from Supabase if available
        if (typeof logout === 'function') {
            logout();
        }

        window.location.href = '../home.html';
    }
});

// Handle login redirect
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('login-redirect-btn')) {
        window.location.href = '../login.html';
    }
});

// Initialize news manager
function initializeNewsManager() {
    console.log('Initializing news manager...'); // Debug log
    fetchNews();
    displayMarketPrices();
    displayGovernmentSchemes();
    setupEventListeners();
    startAutoUpdate();
}

// Fetch news from API with better error handling
async function fetchNews() {
    try {
        showLoading();

        // Construct search query based on filter and search input
        let finalQuery = '';

        // If there's a user search query, use it as the primary search
        if (searchQuery && searchQuery.trim()) {
            finalQuery = searchQuery.trim();
        } else {
            // Use filter-specific queries with single effective terms
            switch (currentFilter) {
                case 'schemes':
                    finalQuery = 'scheme';
                    break;
                case 'market':
                    finalQuery = 'price';
                    break;
                case 'climate':
                    finalQuery = 'weather';
                    break;
                case 'subsidies':
                    finalQuery = 'subsidy';
                    break;
                case 'all':
                default:
                    finalQuery = 'agriculture';
                    break;
            }
        }

        console.log('Search query:', finalQuery); // Debug log

        const params = new URLSearchParams({
            apikey: API_KEY,
            q: finalQuery,
            lang: 'en',
            country: 'in',
            max: 12 // Number of articles to return
        });

        const response = await fetch(`${BASE_URL}?${params}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        console.log('API Response:', data); // Debug log

        if (data.articles && data.articles.length > 0) {
            newsArticles = data.articles;
            displayNews();
        } else {
            showError('No news articles found. Please try a different search term or filter.');
        }
    } catch (error) {
        console.error('Error fetching news:', error);

        // Handle specific API errors
        if (error.message.includes('429')) {
            showError('API rate limit exceeded. Please try again later.');
        } else if (error.message.includes('401')) {
            showError('API key invalid. Please contact support.');
        } else {
            showError('Failed to load news. Please check your internet connection and try again.');
        }
    }
}

// Display news articles
function displayNews() {
    if (!newsGrid) return;

    newsGrid.innerHTML = '';

    newsArticles.forEach(article => {
        const clone = newsTemplate.content.cloneNode(true);

        // Set article image
        const img = clone.querySelector('.news-image img');
        img.src = article.image || '../assets/default-news.jpg';
        img.alt = article.title;
        img.onerror = function () {
            this.src = '../assets/default-news.jpg';
        };

        // Set article content
        clone.querySelector('.news-title').textContent = article.title;
        clone.querySelector('.news-source').textContent = article.source.name;
        clone.querySelector('.news-date').textContent = formatDate(article.publishedAt);
        clone.querySelector('.news-description').textContent = article.description;
        clone.querySelector('.read-more').href = article.url;

        newsGrid.appendChild(clone);
    });
}

// Display market prices with real-time updates
function displayMarketPrices() {
    if (!marketPrices) return;

    marketPrices.innerHTML = marketPricesData.map(item => `
        <div class="market-item">
            <div class="crop-info">
                <span class="crop-name">${item.crop}</span>
                <span class="crop-change ${item.change.startsWith('+') ? 'positive' : 'negative'}">${item.change}</span>
            </div>
            <span class="crop-price">₹${item.price}</span>
        </div>
    `).join('');

    if (lastUpdatedTime) {
        lastUpdatedTime.textContent = formatDate(new Date());
    }
}

// Display government schemes
function displayGovernmentSchemes() {
    const schemesContainer = document.getElementById('schemes-container');
    if (!schemesContainer) return;

    schemesContainer.innerHTML = governmentSchemes.map(scheme => `
        <div class="scheme-card">
            <h4>${scheme.title}</h4>
            <p>${scheme.description}</p>
            <div class="scheme-status">
                <span class="status-badge ${scheme.status.toLowerCase()}">${scheme.status}</span>
                <span class="deadline">Deadline: ${scheme.deadline}</span>
            </div>
        </div>
    `).join('');
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    if (searchBtn) {
        searchBtn.addEventListener('click', handleSearch);
        console.log('Search button event listener added'); // Debug log
    }
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        });

        // Show/hide clear button based on input
        searchInput.addEventListener('input', () => {
            if (clearSearchBtn) {
                clearSearchBtn.style.display = searchInput.value.trim() ? 'block' : 'none';
            }
        });

        console.log('Search input event listener added'); // Debug log
    }

    // Clear search functionality
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            console.log('Clear search button clicked'); // Debug log
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
            searchQuery = '';
            currentFilter = 'all';

            // Update filter button states
            if (filterButtons) {
                filterButtons.forEach(btn => {
                    if (btn.dataset.category === 'all') {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }

            clearSearchBtn.style.display = 'none';
            fetchNews();
        });
    }

    // Filter functionality
    if (filterButtons && filterButtons.length > 0) {
        console.log('Setting up filter buttons:', filterButtons.length); // Debug log
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                console.log('Filter button clicked:', btn.dataset.category); // Debug log

                // Remove active class from all buttons
                filterButtons.forEach(b => b.classList.remove('active'));

                // Add active class to clicked button
                btn.classList.add('active');

                // Update current filter
                currentFilter = btn.dataset.category;

                // Clear search input when filter changes
                if (searchInput) {
                    searchInput.value = '';
                    searchQuery = '';
                    if (clearSearchBtn) {
                        clearSearchBtn.style.display = 'none';
                    }
                }

                // Fetch news with new filter
                fetchNews();
            });
        });
    } else {
        console.log('No filter buttons found'); // Debug log
    }

    // Mobile menu
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }
}

// Handle search
function handleSearch() {
    if (!searchInput) {
        console.log('Search input not found'); // Debug log
        return;
    }

    const query = searchInput.value.trim();
    console.log('Search query:', query); // Debug log

    if (query) {
        searchQuery = query;
        // Reset filter to 'all' when searching
        currentFilter = 'all';

        // Update filter button states
        if (filterButtons) {
            filterButtons.forEach(btn => {
                if (btn.dataset.category === 'all') {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        fetchNews();
    } else {
        // If search is empty, show all news
        searchQuery = '';
        currentFilter = 'all';
        fetchNews();
    }
}

// Show loading state
function showLoading() {
    if (!newsGrid) return;

    newsGrid.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading news...</p>
        </div>
    `;
}

// Show error state with custom message
function showError(message = 'Failed to load news. Please try again later.') {
    if (!newsGrid || !errorTemplate) return;

    const clone = errorTemplate.content.cloneNode(true);
    newsGrid.innerHTML = '';

    // Update error message
    const errorText = clone.querySelector('p');
    if (errorText) {
        errorText.textContent = message;
    }

    newsGrid.appendChild(clone);

    // Add retry functionality
    const retryBtn = newsGrid.querySelector('.retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', fetchNews);
    }
}

// Start auto-update
function startAutoUpdate() {
    setInterval(() => {
        fetchNews();
        displayMarketPrices();
    }, UPDATE_INTERVAL);
}

// Format date
function formatDate(dateString) {
    try {
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (error) {
        return 'Invalid Date';
    }
}

// Handle mobile menu
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }
}); 
