// --- Supabase Client Setup ---
// It's best practice to keep these in a separate config file or environment variables
const SUPABASE_URL = 'https://fhnprrlmlhleomfqqvpp.supabase.co'; // <-- ใส่ Supabase URL ของคุณที่นี่
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZobnBycmxtbGhsZW9tZnFxdnBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5MTAyMjIsImV4cCI6MjA2NjQ4NjIyMn0.WA-_yNFWxpFnJBA3oh5UlOtq89KBm5hqsb51oi04hMk';   // <-- ใส่ Supabase Anon Key ของคุณที่นี่

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);


// --- Main Application Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // This function runs when the page is fully loaded

    const googleLoginButton = document.getElementById('google-login-btn');
    const errorMessageDiv = document.getElementById('error-message');

    // Function to handle the Google login process
    const handleGoogleLogin = async () => {
        try {
            errorMessageDiv.style.display = 'none'; // Hide any previous errors

            const { data, error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                redirectTo: window.location.origin + '/check_profile.html' 
            }
            });

            if (error) {
                console.error('Error during Google sign-in:', error.message);
                errorMessageDiv.innerText = `Login Failed: ${error.message}`;
                errorMessageDiv.style.display = 'block'; // Show the error
            }

            // If login is successful, Supabase handles the redirect automatically.
            // There's nothing more to do here.

        } catch (error) {
            console.error('An unexpected error occurred:', error.message);
            errorMessageDiv.innerText = 'An unexpected error occurred. Please try again.';
            errorMessageDiv.style.display = 'block';
        }
    };

    // Attach the function to the button's click event
    if (googleLoginButton) {
        googleLoginButton.addEventListener('click', handleGoogleLogin);
    }
});