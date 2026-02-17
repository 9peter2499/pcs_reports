// --- Supabase Configuration ---
        const SUPABASE_URL = 'https://fhnprrlmlhleomfqqvpp.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZobnBycmxtbGhsZW9tZnFxdnBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5MTAyMjIsImV4cCI6MjA2NjQ4NjIyMn0.WA-_yNFWxpFnJBA3oh5UlOtq89KBm5hqsb51oi04hMk';

        // Initialize Supabase Client
        const { createClient } = supabase;
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

        // --- Application Logic ---
        document.addEventListener('DOMContentLoaded', () => {
            const googleLoginButton = document.getElementById('google-login-btn');
            const errorMessageDiv = document.getElementById('error-message');
            const btnTextSpan = googleLoginButton.querySelector('span');

            const handleGoogleLogin = async () => {
                try {
                    // 1. UI Loading State
                    errorMessageDiv.style.display = 'none';
                    googleLoginButton.classList.add('btn-loading');
                    btnTextSpan.innerText = 'Signing in...';

                    // 2. Perform Login
                    const { data, error } = await supabaseClient.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                            // ใช้ window.location.origin เพื่อรองรับทั้ง Localhost และ Production อัตโนมัติ
                            redirectTo: window.location.origin + '/check_profile.html',
                            queryParams: {
                                access_type: 'offline',
                                prompt: 'consent',
                            },
                        }
                    });

                    if (error) throw error;

                    // ถ้าสำเร็จ ระบบจะ Redirect ไปเอง ไม่ต้องทำอะไรต่อ

                } catch (error) {
                    console.error('Login Error:', error.message);
                    errorMessageDiv.innerText = `Login Failed: ${error.message}`;
                    errorMessageDiv.style.display = 'block';
                    
                    // Reset UI State
                    googleLoginButton.classList.remove('btn-loading');
                    btnTextSpan.innerText = 'Sign in with Google';
                }
            };

            if (googleLoginButton) {
                googleLoginButton.addEventListener('click', handleGoogleLogin);
            }
        });