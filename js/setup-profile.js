// =================================================================
// PCS Test Case - Profile Setup/Edit Script
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GLOBAL VARIABLES & DOM ELEMENTS ---
    let pageMode = 'REGISTER'; // 'REGISTER' or 'EDIT'
    let currentUser = null;

    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    const form = document.getElementById('profile-form');
    const fullNameInput = document.getElementById('full_name');
    const emailInput = document.getElementById('email');
    const positionInput = document.getElementById('position');
    const companySelect = document.getElementById('company');
    const phoneInput = document.getElementById('phone_number');
    const saveButton = document.getElementById('save-profile-btn');
    const backButton = document.getElementById('back-to-dashboard-btn');
    const errorMessageDiv = document.getElementById('error-message');


    // --- 2. UI SETUP FUNCTIONS ---

    // ตั้งค่าหน้าสำหรับ "ลงทะเบียนครั้งแรก"
    async function setupRegisterMode() {
        pageMode = 'REGISTER';
        pageTitle.innerText = 'Complete Your Profile';
        pageSubtitle.innerText = 'กรุณากรอกข้อมูลเพิ่มเติมเพื่อเริ่มใช้งานระบบ';
        saveButton.innerText = 'บันทึกและเริ่มใช้งาน';

        // ปลดล็อคฟิลด์ที่จำเป็น
        positionInput.readOnly = false;
        companySelect.disabled = false;
        backButton.style.display = 'none';

        // โหลดรายชื่อบริษัทมาใส่ใน dropdown
        await populateCompanyDropdown();
    }

    // ตั้งค่าหน้าสำหรับ "แก้ไขโปรไฟล์"
    function setupEditMode(profile) {
        pageMode = 'EDIT';
        pageTitle.innerText = 'Edit Your Profile';
        pageSubtitle.innerText = 'คุณสามารถแก้ไขตำแหน่งและหมายเลขโทรศัพท์ได้';
        saveButton.innerText = 'อัปเดตข้อมูล';

        // ล็อคฟิลด์ที่ไม่ให้แก้ไข
        companySelect.disabled = true;
        backButton.style.display = 'block';

        // เติมข้อมูลบริษัท
        if (profile.company) {
            companySelect.innerHTML = `<option value="${profile.company_id}" selected>${profile.company.company_name}</option>`;
        }
    }

    async function populateCompanyDropdown() {
        const { data: companies, error } = await supabaseClient.from('company').select('*').order('company_name');
        if (error) { console.error('Error fetching companies', error); return; }

        companySelect.innerHTML = '<option value="" disabled selected>-- กรุณาเลือกบริษัท --</option>';
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.company_id;
            option.textContent = company.company_name;
            companySelect.appendChild(option);
        });
    }


    // --- 3. CORE LOGIC ---

    async function initializePage() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) { window.location.replace('/login.html'); return; }
        currentUser = session.user;

        // เติมข้อมูลพื้นฐาน
        fullNameInput.value = currentUser.user_metadata?.full_name || '';
        emailInput.value = currentUser.email || '';

        // ตรวจสอบโปรไฟล์เพื่อกำหนด "โหมด" ของหน้า
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select(`*, company(company_name)`)
            .eq('id', currentUser.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = Not found, which is ok
            errorMessageDiv.innerText = 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้';
            errorMessageDiv.style.display = 'block';
            return;
        }

        if (profile && profile.company_id) {
            // กรณีที่ 2: มีข้อมูลครบ -> เข้าสู่โหมดแก้ไข
            positionInput.value = profile.position || '';
            phoneInput.value = profile.telephone || '';
            setupEditMode(profile);
        } else {
            // กรณีที่ 1: ข้อมูลไม่ครบ -> เข้าสู่โหมดลงทะเบียน
            await setupRegisterMode();
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        saveButton.disabled = true;
        saveButton.innerText = 'กำลังบันทึก...';

        // ดึงค่าจาก Input
        const phoneVal = phoneInput.value.trim();

        const profileData = {
            position: positionInput.value.trim(),
            // 🔥 แก้ตรงนี้: ถ้าเป็นค่าว่าง ให้ส่ง null ไปแทน
            telephone: phoneVal === '' ? null : phoneVal, 
            full_name: fullNameInput.value,
            updated_at: new Date()
        };

        // ... (โค้ดส่วน Company Logic เหมือนเดิม) ...
        if (pageMode === 'REGISTER') {
            if (!companySelect.value) {
                alert('กรุณาเลือกบริษัท');
                saveButton.disabled = false;
                saveButton.innerText = 'บันทึกและเริ่มใช้งาน';
                return;
            }
            profileData.company_id = companySelect.value;
        }

        const { error } = await supabaseClient.from('profiles')
            .update(profileData).eq('id', currentUser.id);

        if (error) {
            console.error(error); // ดู Error ใน Console F12
            // แสดง Error ให้เห็นชัดๆ (User จะได้รู้ว่าติดตรงไหนถ้าแก้แล้วยังไม่ผ่าน)
            errorMessageDiv.innerText = `เกิดข้อผิดพลาด: ${error.message}`;
            errorMessageDiv.style.display = 'block';
            
            saveButton.disabled = false;
            saveButton.innerText = 'บันทึกข้อมูล';
        } else {
            // alert('บันทึกข้อมูลสำเร็จ!'); // ตัด alert ออกก็ได้ถ้าต้องการความลื่นไหล
            window.location.href = '/index.html'; 
        }
    }


    // --- 4. EVENT LISTENERS & INITIALIZATION ---
    form.addEventListener('submit', handleFormSubmit);
    initializePage();

});
