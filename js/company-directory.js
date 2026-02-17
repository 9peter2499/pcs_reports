// =================================================================
// PCS Test Case - Company Directory Script (PDPA Compliant)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const container = document.getElementById('companies-container');
    const loadingEl = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-input');
    const stakeholderFilter = document.getElementById('stakeholder-filter');

    // Modal Elements
    const detailModalEl = document.getElementById('companyDetailModal');
    const detailModal = new bootstrap.Modal(detailModalEl);

    // Detail Fields
    const dName = document.getElementById('detail-name');
    const dGroups = document.getElementById('detail-groups');
    const dContactName = document.getElementById('detail-contact-name');
    const dContactPhone = document.getElementById('detail-contact-phone');
    const dEmail = document.getElementById('detail-email');
    const dPhone = document.getElementById('detail-phone');
    const dAddress = document.getElementById('detail-address');
    const dMapContainer = document.getElementById('detail-map-container');
    const dUpdated = document.getElementById('detail-updated');

    let allCompanies = [];
    let allStakeholderGroups = [];

    // --- 1. Initial Load ---
    async function init() {
        if (typeof supabaseClient === 'undefined') {
            console.error('Supabase client missing');
            return;
        }
        await Promise.all([fetchCompanies(), fetchStakeholderGroups()]);
    }

    // --- 2. Data Fetching ---
    async function fetchCompanies() {
        showLoading(true);
        try {
            const { data, error } = await supabaseClient
                .from('company')
                .select(`
                    *,
                    stakeholder_company_links (
                        stakeholder_groups (id, name)
                    )
                `)
                .order('company_name');

            if (error) throw error;
            allCompanies = data || [];
            applyFilters(); 

        } catch (err) {
            console.error('Fetch companies error:', err);
        } finally {
            showLoading(false);
        }
    }

    async function fetchStakeholderGroups() {
        try {
            const { data, error } = await supabaseClient
                .from('stakeholder_groups')
                .select('id, name')
                .order('display_order');
            
            if (error) throw error;
            allStakeholderGroups = data || [];
            
            if (stakeholderFilter) {
                stakeholderFilter.innerHTML = '<option value="all" selected>ทุกกลุ่ม Stakeholder</option>';
                allStakeholderGroups.forEach(g => {
                    const opt = document.createElement('option');
                    opt.value = g.id;
                    opt.textContent = g.name;
                    stakeholderFilter.appendChild(opt);
                });
            }
        } catch (err) { console.error(err); }
    }

    // --- 3. HELPER: PDPA Masking Functions (🔥 สำคัญ) ---
    
    // Mask เบอร์โทร: 0812345678 -> 081-xxx-5678
    function maskPhone(phone) {
        if (!phone) return '-';
        // ลบขีดเดิมออกก่อน
        const cleanPhone = phone.replace(/-/g, '').replace(/\s/g, '');
        if (cleanPhone.length < 9) return phone; // เบอร์แปลกๆ ไม่ Mask
        
        // แสดง 3 ตัวหน้า - xxx - 4 ตัวหลัง
        return cleanPhone.substring(0, 3) + '-xxx-' + cleanPhone.substring(cleanPhone.length - 4);
    }

    // Mask อีเมล: somchai@company.com -> s*****i@company.com
    function maskEmail(email) {
        if (!email) return '-';
        const parts = email.split('@');
        if (parts.length < 2) return email;

        const name = parts[0];
        const domain = parts[1];

        if (name.length <= 2) {
            return name[0] + '***@' + domain;
        }
        // เอาตัวแรกกับตัวสุดท้ายไว้ ตรงกลางเป็นดอกจัน
        return name[0] + '*****' + name[name.length - 1] + '@' + domain;
    }

    // Mask ชื่อคน: สมชาย ใจดี -> คุณสมชาย จ. (หรือ สม***)
    // ในบริบท Business Test Case อาจจะโชว์ชื่อจริงได้ แต่บังนามสกุล
    function maskName(name) {
        if (!name) return '-';
        const parts = name.trim().split(/\s+/); // แยกเว้นวรรค
        
        if (parts.length > 1) {
            // กรณีมีชื่อ-นามสกุล: สมชาย ใจดี -> สมชาย จ.
            const firstName = parts[0];
            const lastName = parts[1];
            return `${firstName} ${lastName.substring(0, 1)}.`;
        }
        return name; // ถ้ามีพยางค์เดียวแสดงหมด
    }


    // --- 4. Filter Logic ---
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const selectedGroup = stakeholderFilter.value;

        const filtered = allCompanies.filter(c => {
            const matchesSearch = 
                (c.company_name && c.company_name.toLowerCase().includes(searchTerm)) ||
                (c.contact_person && c.contact_person.toLowerCase().includes(searchTerm)) ||
                (c.phone && c.phone.includes(searchTerm));

            let matchesGroup = true;
            if (selectedGroup !== 'all') {
                const links = c.stakeholder_company_links || [];
                matchesGroup = links.some(link => link.stakeholder_groups?.id === selectedGroup);
            }
            return matchesSearch && matchesGroup;
        });
        renderCompanies(filtered);
    }

    // --- 5. Render Cards (Apply Masking) ---
    function renderCompanies(companies) {
        container.innerHTML = '';
        
        if (companies.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        container.style.display = 'flex';

        companies.forEach(com => {
            // Badges
            let groupsHtml = '';
            const links = com.stakeholder_company_links || [];
            if (links.length > 0) {
                const maxShow = 2;
                links.slice(0, maxShow).forEach(link => {
                    groupsHtml += `<span class="badge bg-primary-subtle text-primary badge-group me-1">${link.stakeholder_groups?.name}</span>`;
                });
                if (links.length > maxShow) {
                    groupsHtml += `<span class="badge bg-light text-muted border badge-group">+${links.length - maxShow}</span>`;
                }
            }

            // 🔥 Apply Masking for Card View
            const displayContact = maskName(com.contact_person);
            const displayMobile = maskPhone(com.contact_phone);
            // เบอร์ Office ปกติเปิดเผยได้ แต่ถ้าอยาก Mask ก็ใช้ maskPhone(com.phone)
            const displayOffice = com.phone || '-'; 

            const cardHtml = `
                <div class="col-md-6 col-lg-4 col-xl-3">
                    <div class="directory-card h-100" onclick="openDetailModal('${com.company_id}')">
                        <div class="card-header-custom d-flex justify-content-between align-items-start">
                            <div class="text-truncate pe-2 w-100">
                                <h6 class="company-name text-truncate" title="${com.company_name}">${com.company_name}</h6>
                                <div class="mt-1">${groupsHtml}</div>
                            </div>
                            <div class="text-muted"><i class="bi bi-eye"></i></div> 
                        </div>
                        <div class="card-body-custom">
                            <div class="info-row">
                                <i class="bi bi-person info-icon"></i>
                                <div class="text-truncate fw-medium text-dark">${displayContact}</div>
                            </div>
                            <div class="info-row">
                                <i class="bi bi-phone info-icon"></i>
                                <div>${displayMobile}</div>
                            </div>
                            <div class="info-row">
                                <i class="bi bi-building info-icon"></i>
                                <div class="text-truncate">${displayOffice}</div>
                            </div>
                            <div class="info-row mb-0">
                                <i class="bi bi-pin-map info-icon"></i>
                                <div class="text-truncate-2" style="font-size:0.8rem; line-height:1.4;">${com.address || '-'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += cardHtml;
        });
    }

    // --- 6. Modal Logic (Apply Masking) ---
    window.openDetailModal = (companyId) => {
        const com = allCompanies.find(c => String(c.company_id) === String(companyId));
        if (!com) return;

        // Basic Info
        dName.textContent = com.company_name || '-';
        dPhone.textContent = com.phone || '-';
        dAddress.textContent = com.address || '-';
        dUpdated.textContent = com.updated_at ? new Date(com.updated_at).toLocaleString('th-TH') : '-';

        // 🔥 Apply Masking for Modal View
        // (เลือกได้ว่าจะเปิดหมดใน Modal หรือจะ Mask ต่อ)
        // เพื่อความปลอดภัยตามโจทย์ PDPA ผมจะ Mask ในนี้ด้วยครับ
        dContactName.textContent = maskName(com.contact_person);
        dContactPhone.textContent = maskPhone(com.contact_phone);
        dEmail.textContent = maskEmail(com.email); 

        // Stakeholder Badges
        dGroups.innerHTML = '';
        const links = com.stakeholder_company_links || [];
        if (links.length > 0) {
            links.forEach(link => {
                const badge = document.createElement('span');
                badge.className = 'badge bg-info-subtle text-info-emphasis px-3 py-2 rounded-pill';
                badge.textContent = link.stakeholder_groups?.name;
                dGroups.appendChild(badge);
            });
        } else {
            dGroups.innerHTML = '<span class="text-muted small">ไม่ระบุกลุ่ม</span>';
        }

        // Map Button
        dMapContainer.innerHTML = '';
        if (com.map_link) {
            dMapContainer.innerHTML = `
                <a href="${com.map_link}" target="_blank" class="btn btn-outline-success btn-sm w-100">
                    <i class="bi bi-geo-alt-fill me-1"></i>เปิดแผนที่ Google Map
                </a>`;
        } else {
            dMapContainer.innerHTML = '<span class="text-muted small">- ไม่มีข้อมูลแผนที่ -</span>';
        }

        detailModal.show();
    };

    function showLoading(show) {
        loadingEl.style.display = show ? 'block' : 'none';
        if(show) container.style.display = 'none';
    }

    // Event Listeners
    searchInput.addEventListener('input', applyFilters);
    stakeholderFilter.addEventListener('change', applyFilters);

    // Init
    init();
});