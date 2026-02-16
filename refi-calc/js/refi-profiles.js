/* =====================================================
   REFI PROFILES — Client Profile Save/Load Manager
   Mountain State Financial Group

   Uses localStorage to persist named client profiles.
   Each profile stores a complete snapshot of all form
   inputs so they can be restored instantly.
   ===================================================== */

const RefiProfiles = (() => {
    'use strict';

    const STORAGE_KEY = 'msfg_refi_profiles';
    let statusTimer = null;

    // -------------------------------------------------
    // INITIALIZATION
    // -------------------------------------------------

    function init() {
        bindEvents();
        refreshProfileList();
    }

    function bindEvents() {
        const btnSave = document.getElementById('btnSaveProfile');
        const btnLoad = document.getElementById('btnLoadProfile');
        const btnDelete = document.getElementById('btnDeleteProfile');
        const nameInput = document.getElementById('profileNameInput');

        if (btnSave) btnSave.addEventListener('click', saveProfile);
        if (btnLoad) btnLoad.addEventListener('click', loadProfile);
        if (btnDelete) btnDelete.addEventListener('click', deleteProfile);

        // Allow Enter key in profile name input to save
        if (nameInput) {
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    saveProfile();
                }
            });
        }

        // Auto-populate name input when selecting a profile
        const select = document.getElementById('profileSelect');
        if (select) {
            select.addEventListener('change', () => {
                const name = select.value;
                if (name) {
                    document.getElementById('profileNameInput').value = name;
                }
            });
        }
    }

    // -------------------------------------------------
    // STORAGE HELPERS
    // -------------------------------------------------

    function getAllProfiles() {
        try {
            const json = localStorage.getItem(STORAGE_KEY);
            return json ? JSON.parse(json) : {};
        } catch (e) {
            console.error('Error reading profiles from localStorage:', e);
            return {};
        }
    }

    function setAllProfiles(profiles) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
        } catch (e) {
            console.error('Error saving profiles to localStorage:', e);
            showStatus('Error saving — storage may be full.', 'error');
        }
    }

    // -------------------------------------------------
    // SAVE
    // -------------------------------------------------

    function saveProfile() {
        const nameInput = document.getElementById('profileNameInput');
        const name = (nameInput.value || '').trim();

        if (!name) {
            showStatus('Please enter a profile name.', 'error');
            nameInput.focus();
            return;
        }

        // Read all current form inputs
        const data = RefiUI.readAllInputs();

        // Add metadata
        data._profileMeta = {
            name: name,
            savedAt: new Date().toISOString(),
            version: 1
        };

        // Check if overwriting
        const profiles = getAllProfiles();
        const isOverwrite = profiles.hasOwnProperty(name);

        if (isOverwrite) {
            if (!confirm(`Profile "${name}" already exists. Overwrite?`)) return;
        }

        profiles[name] = data;
        setAllProfiles(profiles);
        refreshProfileList(name);
        showStatus(`Profile "${name}" ${isOverwrite ? 'updated' : 'saved'} successfully.`, 'success');
    }

    // -------------------------------------------------
    // LOAD
    // -------------------------------------------------

    function loadProfile() {
        const select = document.getElementById('profileSelect');
        const name = select.value;

        if (!name) {
            showStatus('Select a profile to load.', 'error');
            return;
        }

        const profiles = getAllProfiles();
        const data = profiles[name];

        if (!data) {
            showStatus(`Profile "${name}" not found.`, 'error');
            return;
        }

        // Write all inputs to the form
        RefiUI.writeAllInputs(data);

        // Update the name input to show which profile is loaded
        document.getElementById('profileNameInput').value = name;

        showStatus(`Profile "${name}" loaded.`, 'success');
    }

    // -------------------------------------------------
    // DELETE
    // -------------------------------------------------

    function deleteProfile() {
        const select = document.getElementById('profileSelect');
        const name = select.value;

        if (!name) {
            showStatus('Select a profile to delete.', 'error');
            return;
        }

        if (!confirm(`Delete profile "${name}"? This cannot be undone.`)) return;

        const profiles = getAllProfiles();
        delete profiles[name];
        setAllProfiles(profiles);
        refreshProfileList();

        // Clear name input if it matches the deleted profile
        const nameInput = document.getElementById('profileNameInput');
        if (nameInput.value === name) {
            nameInput.value = '';
        }

        showStatus(`Profile "${name}" deleted.`, 'success');
    }

    // -------------------------------------------------
    // REFRESH DROPDOWN
    // -------------------------------------------------

    function refreshProfileList(selectedName) {
        const select = document.getElementById('profileSelect');
        if (!select) return;

        const profiles = getAllProfiles();
        const names = Object.keys(profiles).sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase())
        );

        select.innerHTML = '<option value="">-- Select a Profile --</option>';

        names.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;

            // Show saved date if available
            const meta = profiles[name]._profileMeta;
            if (meta && meta.savedAt) {
                const date = new Date(meta.savedAt);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                opt.textContent = `${name}  (${dateStr})`;
            } else {
                opt.textContent = name;
            }

            if (name === selectedName) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });

        // Update profile count display
        updateProfileCount(names.length);
    }

    function updateProfileCount(count) {
        const label = document.querySelector('.profile-label');
        if (label) {
            label.textContent = `Client Profiles (${count}):`;
        }
    }

    // -------------------------------------------------
    // STATUS MESSAGE
    // -------------------------------------------------

    function showStatus(message, type) {
        const el = document.getElementById('profileStatus');
        if (!el) return;

        el.textContent = message;
        el.className = 'profile-status profile-status-' + type;

        // Clear after 4 seconds
        if (statusTimer) clearTimeout(statusTimer);
        statusTimer = setTimeout(() => {
            el.textContent = '';
            el.className = 'profile-status';
        }, 4000);
    }

    // -------------------------------------------------
    // PUBLIC API
    // -------------------------------------------------

    return {
        init,
        getAllProfiles,
        saveProfile,
        loadProfile,
        deleteProfile,
        refreshProfileList
    };

})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    RefiProfiles.init();
});
