// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const joinUsBtn = document.getElementById('joinUsBtn');
const authModalElement = document.getElementById('authModal');
const authModal = new bootstrap.Modal(authModalElement);
const authForm = document.getElementById('authForm');
const authModalTitle = document.getElementById('authModalTitle');
const toggleAuth = document.getElementById('toggleAuth');
const userTypeGroup = document.getElementById('userTypeGroup');
const nameGroup = document.getElementById('nameGroup');
const locationGroup = document.getElementById('locationGroup');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const getLocationBtn = document.getElementById('getLocationBtn');
const latitudeInput = document.getElementById('latitude');
const longitudeInput = document.getElementById('longitude');

// State
let isLoginMode = true;

// Event Listeners
loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Login button clicked');
    isLoginMode = true;
    updateAuthModal();
    try {
        authModal.show();
    } catch (error) {
        console.error('Error showing modal:', error);
        // Fallback
        authModalElement.classList.add('show');
        authModalElement.style.display = 'block';
    }
});

signupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = false;
    updateAuthModal();
    authModal.show();
});

joinUsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = false;
    updateAuthModal();
    authModal.show();
});

toggleAuth.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    updateAuthModal();
});

// Get location button click handler
getLocationBtn.addEventListener('click', getCurrentLocation);

// Form submission
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Form submitted');
    
    const formData = new FormData(authForm);
    const email = formData.get('email');
    const password = formData.get('password');

    console.log('Form data:', { email, isLoginMode });

    // Validate input
    if (!email || !password) {
        alert('Please fill in all required fields');
        return;
    }

    // Show loading state
    authSubmitBtn.disabled = true;
    authSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Processing...';

    try {
        const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
        console.log('Making request to:', endpoint);

        const requestBody = isLoginMode ? 
            { email, password } : 
            {
                email,
                password,
                userType: formData.get('userType'),
                name: formData.get('name'),
                location: {
                    latitude: parseFloat(formData.get('latitude')),
                    longitude: parseFloat(formData.get('longitude'))
                }
            };

        console.log('Request body:', requestBody);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (!response.ok) {
            throw new Error(data.message || 'Authentication failed');
        }

        console.log('Authentication successful:', { userType: data.user.userType });

        // Store token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Close modal and redirect to dashboard
        try {
            authModal.hide();
        } catch (error) {
            console.error('Error hiding modal:', error);
            // Fallback
            authModalElement.classList.remove('show');
            authModalElement.style.display = 'none';
        }

        // Redirect after a short delay to ensure modal is hidden
        setTimeout(() => {
            window.location.href = `/dashboard.html?type=${data.user.userType}`;
        }, 100);
    } catch (error) {
        console.error('Authentication error:', error);
        alert(error.message || 'An error occurred during authentication');
    } finally {
        // Reset loading state
        authSubmitBtn.disabled = false;
        authSubmitBtn.innerHTML = isLoginMode ? 'Login' : 'Sign Up';
    }
});

// Helper Functions
function updateAuthModal() {
    console.log('Updating modal for:', isLoginMode ? 'login' : 'signup');
    
    // Update modal title and button text
    authModalTitle.textContent = isLoginMode ? 'Login' : 'Sign Up';
    authSubmitBtn.textContent = isLoginMode ? 'Login' : 'Sign Up';
    toggleAuth.textContent = isLoginMode 
        ? "Don't have an account? Sign up"
        : 'Already have an account? Login';
    
    // Show/hide form fields
    userTypeGroup.style.display = isLoginMode ? 'none' : 'block';
    nameGroup.style.display = isLoginMode ? 'none' : 'block';
    locationGroup.style.display = isLoginMode ? 'none' : 'block';
    
    // Reset form
    authForm.reset();
}

function getCurrentLocation() {
    if (navigator.geolocation) {
        getLocationBtn.disabled = true;
        getLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Getting Location...';
        
        navigator.geolocation.getCurrentPosition(
            position => {
                latitudeInput.value = position.coords.latitude;
                longitudeInput.value = position.coords.longitude;
                getLocationBtn.disabled = false;
                getLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt me-1"></i>Get My Location';
            },
            error => {
                console.error('Error getting location:', error);
                alert('Unable to get your location. Please enter coordinates manually.');
                getLocationBtn.disabled = false;
                getLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt me-1"></i>Get My Location';
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    } else {
        alert('Geolocation is not supported by your browser. Please enter coordinates manually.');
    }
}

// Check if user is already logged in
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (token && user) {
        window.location.href = `/dashboard.html?type=${user.userType}`;
    }
}

// Initialize
checkAuthStatus(); 