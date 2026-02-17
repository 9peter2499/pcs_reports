// =================================================================
// PCS Test Case - Company Directory Script (View Detail Modal)
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

    // --- 3. Filter Logic ---
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

    // --- 4. Render (Cards with Click Event) ---
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
            // Badges for Card (Limit 2)
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

            // Card HTML (Added onclick)
            // Note: We attach the click event to the whole card-body-custom wrapper or the card itself
            const cardHtml = `
                <div class="col-md-6 col-lg-4 col-xl-3">
                    <div class="directory-card h-100" onclick="openDetailModal('${com.company_id}')">
                        <div class="card-header-custom d-flex justify-content-between align-items-start">
                            <div class="text-truncate pe-2 w-100">
                                <h7 class="company-name text-truncate" title="${com.company_name}">${com.company_name}</h7>
                                <div class="mt-1">${groupsHtml}</div>
                            </div>
                            <div class="text-muted"><i class="bi bi-eye"></i></div> </div>
                        <div class="card-body-custom">
                            <div class="info-row">
                                <i class="bi bi-person info-icon"></i>
                                <div class="text-truncate fw-medium text-dark">${com.contact_person || '-'}</div>
                            </div>
                            <div class="info-row">
                                <i class="bi bi-phone info-icon"></i>
                                <div>${com.contact_phone || '-'}</div>
                            </div>
                            <div class="info-row">
                                <i class="bi bi-building info-icon"></i>
                                <div class="text-truncate">${com.phone || '-'}</div>
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

    // --- 5. Modal Logic (Global Function) ---
    window.openDetailModal = (companyId) => {
        const com = allCompanies.find(c => String(c.company_id) === String(companyId));
        if (!com) return;

        // 1. Basic Info
        dName.textContent = com.company_name || '-';
        dContactName.textContent = com.contact_person || '-';
        dContactPhone.textContent = com.contact_phone || '-';
        dEmail.textContent = com.email || '-';
        dPhone.textContent = com.phone || '-';
        dAddress.textContent = com.address || '-';
        dUpdated.textContent = com.updated_at ? new Date(com.updated_at).toLocaleString('th-TH') : '-';

        // 2. Stakeholder Badges (Show All)
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

        // 3. Map Button
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