// =================================================================
// PCS Test Case - Layout Loader Utility
// =================================================================

/**
 * ดึงเนื้อหา HTML จากไฟล์ที่กำหนด แล้วนำไปใส่ใน Element ที่เป็น Placeholder
 * 💡 จุดสำคัญ: ฟังก์ชันนี้จะ return Promise ซึ่งทำให้สคริปต์อื่นสามารถ "รอ" จนกว่าจะโหลดเสร็จได้
 *
 * @param {string} url - ที่อยู่ของไฟล์ HTML ที่จะดึง (เช่น '/_header.html')
 * @param {string} placeholderId - ID ของ Element ที่จะนำเนื้อหาไปใส่
 * @returns {Promise<void>} Promise ที่จะสมบูรณ์เมื่อโหลดเนื้อหาเสร็จ
 */
const loadComponent = (url, placeholderId) => {
    // การ return fetch() คือหัวใจที่ทำให้โค้ดทำงานแบบ Asynchronous ได้ถูกต้อง
    return fetch(url)
        .then(response => {
            // ตรวจสอบว่าไฟล์หาเจอหรือไม่ (ป้องกัน Error 404)
            if (!response.ok) {
                throw new Error(`File not found: ${url} (Status: ${response.status})`);
            }
            return response.text(); // แปลง Response เป็น Text (HTML)
        })
        .then(html => {
            const placeholder = document.getElementById(placeholderId);
            if (placeholder) {
                placeholder.innerHTML = html; // นำ HTML ที่ได้ไปใส่ใน Placeholder
            } else {
                // แจ้งเตือนหากหา Placeholder ไม่เจอ
                console.warn(`Placeholder element with ID '${placeholderId}' not found.`);
            }
        })
        .catch(error => {
            // แสดง Error ใน Console หากเกิดข้อผิดพลาดระหว่างทาง
            console.error(`Failed to load component '${url}':`, error);
        });
};